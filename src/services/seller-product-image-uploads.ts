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
  width: number | null;
  height: number | null;
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

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
    width: typeof payload.width === "number" ? payload.width : null,
    height: typeof payload.height === "number" ? payload.height : null,
  };
}
