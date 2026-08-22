import { apiClient } from "@/services/api";
import {
  isAllowedCloudinaryUploadFile,
  uploadFileToCloudinary,
  type SignedCloudinaryUploadConfig,
} from "@/services/cloudinary-direct-upload";

type ProductImageSignatureResponse = {
  status: string;
  data: SignedCloudinaryUploadConfig;
};

export type UploadedSellerProductImage = {
  url: string;
  publicId: string;
  uploadReservationId?: string;
  width: number | null;
  height: number | null;
};

type ProductImageConfirmResponse = {
  status: string;
  data: {
    reservationId: string;
    publicId: string;
    url: string;
    width: number | null;
    height: number | null;
  };
};

type ProductImageRemovalResponse = {
  status: string;
  data: {
    status: "queued" | "deleted";
    reservationId: string;
  };
};

export async function uploadSellerProductImage(
  file: File,
): Promise<UploadedSellerProductImage> {
  const signatureResponse = await apiClient<ProductImageSignatureResponse>(
    "/vendor/uploads/product-image/signature",
    {
      method: "POST",
      body: JSON.stringify({}),
      csrf: true,
    },
  );

  const uploadConfig = signatureResponse.data;
  const hasReservationId = typeof uploadConfig.reservationId === "string" && uploadConfig.reservationId.trim().length > 0;
  const hasReservedPublicId =
    typeof uploadConfig.reservedPublicId === "string" && uploadConfig.reservedPublicId.trim().length > 0;
  if (hasReservationId !== hasReservedPublicId) {
    throw new Error("Image upload reservation was incomplete. Please try again.");
  }
  const hasReservation = hasReservationId && hasReservedPublicId;

  if (file.size > uploadConfig.maxFileSize) {
    throw new Error("Image exceeds the 3MB upload limit.");
  }

  if (!isAllowedCloudinaryUploadFile(file, uploadConfig)) {
    throw new Error("This file type is not supported for product images.");
  }

  const payload = await uploadFileToCloudinary(uploadConfig, file);

  if (!payload.secure_url || !payload.public_id) {
    throw new Error("Cloudinary did not return a durable image reference.");
  }

  if (hasReservation && payload.public_id !== uploadConfig.reservedPublicId) {
    throw new Error("Uploaded image did not match the reserved image reference.");
  }

  if (!hasReservation) {
    return {
      url: payload.secure_url,
      publicId: payload.public_id,
      width: typeof payload.width === "number" ? payload.width : null,
      height: typeof payload.height === "number" ? payload.height : null,
    };
  }

  const confirmation = await apiClient<ProductImageConfirmResponse>("/vendor/uploads/product-image/confirm", {
    method: "POST",
    body: JSON.stringify({
      reservationId: uploadConfig.reservationId,
      publicId: payload.public_id,
      secureUrl: payload.secure_url,
      resourceType: payload.resource_type,
      deliveryType: uploadConfig.type ?? "upload",
      version: payload.version,
      signature: payload.signature,
      width: payload.width,
      height: payload.height,
    }),
    csrf: true,
  });

  return {
    url: confirmation.data.url,
    publicId: confirmation.data.publicId,
    uploadReservationId: confirmation.data.reservationId,
    width: typeof confirmation.data.width === "number" ? confirmation.data.width : null,
    height: typeof confirmation.data.height === "number" ? confirmation.data.height : null,
  };
}

export async function removeTemporarySellerProductImageUpload(input: {
  uploadReservationId: string;
  publicId: string;
}) {
  const response = await apiClient<ProductImageRemovalResponse>(
    "/vendor/uploads/product-image/remove",
    {
      method: "POST",
      body: JSON.stringify({
        reservationId: input.uploadReservationId,
        publicId: input.publicId,
      }),
      csrf: true,
    },
  );

  return response.data;
}
