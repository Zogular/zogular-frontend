import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { uploadSellerProductImage } from "@/services/seller-product-image-uploads";
import type { SellerProductImage } from "@/services/seller-catalog";
import {
  ACCEPTED_IMAGE_TYPES,
  AUTO_CROPPED_IMAGE_WARNING,
  canvasToBlob,
  loadImage,
  MAX_IMAGES,
  MAX_IMAGE_SIZE,
  MAX_PROCESSED_IMAGE_SIZE,
  withoutRecordKey,
} from "../_lib/product-listing-studio";

function normalizeInitialImages(initialImages: SellerProductImage[]) {
  return initialImages.map((image, index) => {
    const isBlobImage = image.url.startsWith("blob:");

    return {
      ...image,
      isPrimary: image.isPrimary || index === 0,
      sortOrder: image.sortOrder ?? index,
      uploadStatus: isBlobImage ? "failed" : (image.uploadStatus ?? "uploaded"),
      uploadError: isBlobImage
        ? "Re-add this image so it can upload to Cloudinary."
        : image.uploadError,
    } satisfies SellerProductImage;
  });
}

export function useProductImages(initialImages: SellerProductImage[] = []) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const imageFilesRef = useRef(new Map<string, File>());
  const uploadPromisesRef = useRef(new Map<string, Promise<void>>());
  const [images, setImages] = useState<SellerProductImage[]>(() =>
    normalizeInitialImages(initialImages),
  );
  const imagesRef = useRef(images);
  const [imageWarnings, setImageWarnings] = useState<Record<string, string>>({});

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const hasFailedUploads = useMemo(
    () => images.some((image) => image.uploadStatus === "failed"),
    [images],
  );
  const isUploadingImages = useMemo(
    () => images.some((image) => image.uploadStatus === "uploading"),
    [images],
  );

  const revokeTrackedObjectUrl = (url?: string) => {
    if (!url || !url.startsWith("blob:")) {
      return;
    }

    URL.revokeObjectURL(url);
    objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url);
  };

  const updateImageById = (imageId: string, updater: (image: SellerProductImage) => SellerProductImage) => {
    setImages((current) =>
      current.map((image, index) => {
        if (image.id !== imageId) {
          return image;
        }

        const nextImage = updater(image);
        return {
          ...nextImage,
          sortOrder: index,
        };
      }),
    );
  };

  const uploadImageById = async (imageId: string, fallbackPreviewUrl?: string) => {
    const existingUpload = uploadPromisesRef.current.get(imageId);
    if (existingUpload) {
      return existingUpload;
    }

    const uploadFile = imageFilesRef.current.get(imageId);
    if (!uploadFile) {
      updateImageById(imageId, (image) => ({
        ...image,
        uploadStatus: "failed",
        uploadError: "Re-add this image so it can upload to Cloudinary.",
      }));
      return;
    }

    const sourceImage = imagesRef.current.find((image) => image.id === imageId);
    const previousPreviewUrl =
      fallbackPreviewUrl ||
      sourceImage?.localPreviewUrl ||
      (sourceImage?.url.startsWith("blob:") ? sourceImage.url : undefined);

    const task = (async () => {
      updateImageById(imageId, (image) => ({
        ...image,
        uploadStatus: "uploading",
        uploadError: undefined,
      }));

      try {
        const uploadedImage = await uploadSellerProductImage(uploadFile);

        updateImageById(imageId, (image) => ({
          ...image,
          url: uploadedImage.url,
          publicId: uploadedImage.publicId,
          alt: image.alt ?? image.name,
          processedWidth: uploadedImage.width ?? image.processedWidth,
          processedHeight: uploadedImage.height ?? image.processedHeight,
          originalWidth: image.originalWidth ?? uploadedImage.width ?? undefined,
          originalHeight: image.originalHeight ?? uploadedImage.height ?? undefined,
          uploadStatus: "uploaded",
          uploadError: undefined,
          localPreviewUrl: previousPreviewUrl,
        }));

        imageFilesRef.current.delete(imageId);
        revokeTrackedObjectUrl(previousPreviewUrl);
      } catch (error) {
        updateImageById(imageId, (image) => ({
          ...image,
          uploadStatus: "failed",
          uploadError: error instanceof Error ? error.message : "Image upload failed.",
        }));
      } finally {
        uploadPromisesRef.current.delete(imageId);
      }
    })();

    uploadPromisesRef.current.set(imageId, task);
    return task;
  };

  const processImageFile = async (
    file: File,
    imageId: string,
    isPrimary: boolean,
  ): Promise<{ image: SellerProductImage; processedFile: File }> => {
    const sourceUrl = URL.createObjectURL(file);

    try {
      const sourceImage = await loadImage(sourceUrl);
      const cropSize = Math.min(sourceImage.naturalWidth, sourceImage.naturalHeight);
      const processedSize = Math.min(cropSize, MAX_PROCESSED_IMAGE_SIZE);
      const wasAutoCropped = sourceImage.naturalWidth !== sourceImage.naturalHeight;
      const sourceX = Math.max(0, Math.floor((sourceImage.naturalWidth - cropSize) / 2));
      const sourceY = Math.max(0, Math.floor((sourceImage.naturalHeight - cropSize) / 2));
      const canvas = document.createElement("canvas");
      canvas.width = processedSize;
      canvas.height = processedSize;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Unable to process image.");
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, processedSize, processedSize);
      context.drawImage(
        sourceImage,
        sourceX,
        sourceY,
        cropSize,
        cropSize,
        0,
        0,
        processedSize,
        processedSize,
      );

      const outputType = file.type === "image/png" ? "image/png" : "image/webp";
      const processedBlob = await canvasToBlob(canvas, outputType);
      const processedFile = new File(
        [processedBlob],
        file.name.replace(/\.[^.]+$/, outputType === "image/png" ? ".png" : ".webp"),
        { type: outputType },
      );
      const processedUrl = URL.createObjectURL(processedBlob);
      objectUrlsRef.current.push(processedUrl);

      if (wasAutoCropped) {
        setImageWarnings((current) => ({
          ...current,
          ...Object.fromEntries([[imageId, AUTO_CROPPED_IMAGE_WARNING]]),
        }));
      }

      return {
        processedFile,
        image: {
          id: imageId,
          url: processedUrl,
          localPreviewUrl: processedUrl,
          name: file.name,
          alt: file.name,
          isPrimary,
          sortOrder: imagesRef.current.length,
          originalWidth: sourceImage.naturalWidth,
          originalHeight: sourceImage.naturalHeight,
          processedWidth: processedSize,
          processedHeight: processedSize,
          wasAutoCropped,
          linkedVariantValue: undefined,
          uploadStatus: "idle",
          uploadError: undefined,
        },
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const handleImageSelection = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }

    const currentCount = imagesRef.current.length;
    const slotsAvailable = Math.max(0, MAX_IMAGES - currentCount);
    if (!slotsAvailable) {
      toast.error("Maximum 10 images allowed.");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, slotsAvailable);
    const rejected = Array.from(files).filter(
      (file) =>
        !ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE,
    );
    const accepted = selectedFiles.filter(
      (file) =>
        ACCEPTED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE,
    );

    if (rejected.length) {
      toast.error("Some images were skipped. Use JPG, PNG, or WEBP under 3MB each.");
    }
    if (files.length > slotsAvailable) {
      toast.warning(`Only ${slotsAvailable} more image${slotsAvailable === 1 ? "" : "s"} can be added.`);
    }

    try {
      const processedResults = await Promise.all(
        accepted.map((file, index) =>
          processImageFile(
            file,
            `${file.name}-${Date.now()}-${index}`,
            currentCount === 0 && index === 0,
          ),
        ),
      );
      const croppedCount = processedResults.filter(
        ({ image }) => image.wasAutoCropped,
      ).length;

      if (croppedCount) {
        toast.warning(
          `${croppedCount} image${croppedCount === 1 ? "" : "s"} auto-cropped to square.`,
        );
      }

      processedResults.forEach(({ image, processedFile }) => {
        imageFilesRef.current.set(image.id, processedFile);
      });

      setImages((current) => [
        ...current,
        ...processedResults.map(
          ({ image }, index) =>
            ({
              ...image,
              sortOrder: current.length + index,
              uploadStatus: "uploading",
            }) satisfies SellerProductImage,
        ),
      ]);

      processedResults.forEach(({ image }) => {
        void uploadImageById(image.id, image.localPreviewUrl);
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to process one or more images.",
      );
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const ensureImagesUploaded = async () => {
    const imagesToUpload = imagesRef.current.filter(
      (image) =>
        image.url.startsWith("blob:") ||
        image.uploadStatus === "idle" ||
        image.uploadStatus === "failed" ||
        image.uploadStatus === "uploading",
    );

    if (imagesToUpload.length === 0) {
      return imagesRef.current;
    }

    await Promise.allSettled(
      imagesToUpload.map((image) => uploadImageById(image.id)),
    );

    const failedImages = imagesRef.current.filter(
      (image) =>
        image.uploadStatus === "failed" ||
        image.url.startsWith("blob:"),
    );

    if (failedImages.length > 0) {
      throw new Error("One or more images failed to upload. Retry them before saving.");
    }

    return imagesRef.current;
  };

  const removeImage = (imageId: string) => {
    const existingImage = imagesRef.current.find((image) => image.id === imageId);
    revokeTrackedObjectUrl(existingImage?.localPreviewUrl);
    revokeTrackedObjectUrl(existingImage?.url);
    imageFilesRef.current.delete(imageId);
    uploadPromisesRef.current.delete(imageId);

    setImages((current) => {
      const remaining = current.filter((image) => image.id !== imageId);
      const hasPrimary = remaining.some((image) => image.isPrimary);

      return remaining.map((image, index) => ({
        ...image,
        isPrimary: hasPrimary ? image.isPrimary : index === 0,
        sortOrder: index,
      }));
    });
    setImageWarnings((current) => withoutRecordKey(current, imageId));
  };

  const setPrimaryImage = (imageId: string) => {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        isPrimary: image.id === imageId,
      })),
    );
  };

  const setImageAlt = (imageId: string, alt: string) => {
    updateImageById(imageId, (image) => ({
      ...image,
      alt,
    }));
  };

  const setImageVariant = (imageId: string, linkedVariantValue: string) => {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        linkedVariantValue:
          image.id === imageId ? linkedVariantValue || undefined : image.linkedVariantValue,
      })),
    );
  };

  const retryImageUpload = async (imageId: string) => {
    await uploadImageById(imageId);
  };

  return {
    ensureImagesUploaded,
    fileInputRef,
    handleImageSelection,
    hasFailedUploads,
    imageWarnings,
    images,
    isUploadingImages,
    removeImage,
    retryImageUpload,
    setImageAlt,
    setImageVariant,
    setPrimaryImage,
  };
}
