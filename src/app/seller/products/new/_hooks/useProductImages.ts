import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

export function useProductImages(initialImages: SellerProductImage[] = []) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [images, setImages] = useState<SellerProductImage[]>(initialImages);
  const [imageWarnings, setImageWarnings] = useState<Record<string, string>>({});

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const processImageFile = async (file: File, imageId: string, isPrimary: boolean): Promise<SellerProductImage> => {
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
      if (!context) throw new Error("Unable to process image.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, processedSize, processedSize);
      context.drawImage(sourceImage, sourceX, sourceY, cropSize, cropSize, 0, 0, processedSize, processedSize);

      const processedBlob = await canvasToBlob(canvas, file.type === "image/png" ? "image/png" : "image/webp");
      const processedUrl = URL.createObjectURL(processedBlob);
      objectUrlsRef.current.push(processedUrl);

      if (wasAutoCropped) {
        setImageWarnings((current) => ({
          ...current,
          ...Object.fromEntries([[imageId, AUTO_CROPPED_IMAGE_WARNING]]),
        }));
      }

      return {
        id: imageId,
        url: processedUrl,
        name: file.name,
        isPrimary,
        originalWidth: sourceImage.naturalWidth,
        originalHeight: sourceImage.naturalHeight,
        processedWidth: processedSize,
        processedHeight: processedSize,
        wasAutoCropped,
        linkedVariantValue: undefined,
      };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  };

  const handleImageSelection = async (files: FileList | null) => {
    if (!files?.length) return;

    const slotsAvailable = Math.max(0, MAX_IMAGES - images.length);
    if (!slotsAvailable) {
      toast.error("Maximum 10 images allowed.");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, slotsAvailable);
    const rejected = Array.from(files).filter((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE);
    const accepted = selectedFiles.filter((file) => ACCEPTED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE);

    if (rejected.length) toast.error("Some images were skipped. Use JPG, PNG, or WEBP under 3MB each.");
    if (files.length > slotsAvailable) toast.warning(`Only ${slotsAvailable} more image${slotsAvailable === 1 ? "" : "s"} can be added.`);

    try {
      const nextImages = await Promise.all(
        accepted.map((file, index) => processImageFile(file, `${file.name}-${Date.now()}-${index}`, images.length === 0 && index === 0)),
      );
      const croppedCount = nextImages.filter((image) => image.wasAutoCropped).length;
      if (croppedCount) toast.warning(`${croppedCount} image${croppedCount === 1 ? "" : "s"} auto-cropped to square.`);
      setImages((current) => [...current, ...nextImages]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to process one or more images.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (imageId: string) => {
    setImages((current) => {
      const removed = current.find((image) => image.id === imageId);
      if (removed?.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== removed?.url);
      const remaining = current.filter((image) => image.id !== imageId);
      return remaining.map((image, index) => ({ ...image, isPrimary: index === 0 ? true : image.isPrimary }));
    });
    setImageWarnings((current) => withoutRecordKey(current, imageId));
  };

  const setPrimaryImage = (imageId: string) => {
    setImages((current) => current.map((image) => ({ ...image, isPrimary: image.id === imageId })));
  };

  const setImageVariant = (imageId: string, linkedVariantValue: string) => {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        linkedVariantValue: image.id === imageId ? linkedVariantValue || undefined : image.linkedVariantValue,
      })),
    );
  };

  return {
    fileInputRef,
    handleImageSelection,
    imageWarnings,
    images,
    removeImage,
    setImageVariant,
    setPrimaryImage,
  };
}
