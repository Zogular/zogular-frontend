import { ApiError, apiClient } from "@/services/api";
import {
  isAllowedCloudinaryUploadFile,
  uploadFileToCloudinary,
  type SignedCloudinaryUploadConfig,
} from "@/services/cloudinary-direct-upload";
import type { SellerDocumentType } from "@/types/seller";

type SellerDocumentSignatureResponse = {
  status: string;
  data: SignedCloudinaryUploadConfig;
};

export type UploadedSellerDocument = {
  url: string;
  publicId: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  resourceType: string | null;
  originalFilename: string | null;
};

export type SellerDocumentUploadSignature =
  SellerDocumentSignatureResponse["data"];

function toUploadMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Please sign in again before uploading your documents.";
    }

    if (error.status === 403) {
      return error.message.trim() || "Document upload is not available for this account right now.";
    }

    if (error.status === 404) {
      return "Document upload is not available right now. Please save your details and try again shortly.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Document upload could not be completed. Please try again.";
}

export async function getSellerDocumentUploadSignature(
  documentType: SellerDocumentType,
): Promise<SellerDocumentUploadSignature> {
  const response = await apiClient<SellerDocumentSignatureResponse>(
    "/vendor/uploads/seller-document/signature",
    {
      method: "POST",
      body: JSON.stringify({ documentType }),
      csrf: true,
    },
  );

  return response.data;
}

export async function uploadSellerDocument(
  file: File,
  documentType: SellerDocumentType,
  onProgress?: (progress: number) => void,
): Promise<UploadedSellerDocument> {
  try {
    const uploadConfig = await getSellerDocumentUploadSignature(documentType);

    if (file.size > uploadConfig.maxFileSize) {
      throw new Error("This file is too large. Use a file under 5MB.");
    }

    if (!isAllowedCloudinaryUploadFile(file, uploadConfig)) {
      throw new Error("This file type is not supported for this upload.");
    }

    const payload = await uploadFileToCloudinary(uploadConfig, file, onProgress);

    if (!payload.secure_url || !payload.public_id) {
      throw new Error("Upload could not be completed. Please try again.");
    }

    return {
      url: payload.secure_url,
      publicId: payload.public_id,
      format: payload.format?.trim() || null,
      bytes: typeof payload.bytes === "number" ? payload.bytes : null,
      width: typeof payload.width === "number" ? payload.width : null,
      height: typeof payload.height === "number" ? payload.height : null,
      resourceType: payload.resource_type?.trim() || null,
      originalFilename: payload.original_filename?.trim() || null,
    };
  } catch (error) {
    throw new Error(toUploadMessage(error));
  }
}
