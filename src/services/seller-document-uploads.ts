import { ApiError, apiClient } from "@/services/api";
import {
  isAllowedCloudinaryUploadFile,
  isSupportedCloudinaryDeliveryType,
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
  reservationId: string | null;
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

export type SellerDocumentAccess = {
  documentType: SellerDocumentType;
  signedUrl: string;
  expiresAt: number;
  ttlSeconds: number;
  resourceType: "image" | "raw" | "video";
  type: "authenticated";
};

type SellerDocumentAccessResponse = {
  status: string;
  data: unknown;
};

type SellerDocumentConfirmResponse = {
  status: string;
  data: {
    reservationId: string;
    documentType: SellerDocumentType;
    publicId: string;
    url: string;
    resourceType: string;
    type: "authenticated";
  };
};

export const SELLER_DOCUMENT_ACCESS_ERROR =
  "Document preview is not available right now. Please try again.";
const SELLER_DOCUMENT_ACCESS_TTL_SECONDS = 10 * 60;
const SELLER_DOCUMENT_ACCESS_CLOCK_SKEW_SECONDS = 30;
const CLOUDINARY_PRIVATE_DOWNLOAD_HOST = "api.cloudinary.com";
const CLOUDINARY_ACCESS_RESOURCE_TYPES = new Set(["image", "raw", "video"]);

export class SellerDocumentAccessError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SellerDocumentAccessError";
    this.status = status;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function getSellerDocumentAccessMessage(error: unknown): string {
  if (error instanceof SellerDocumentAccessError) return error.message;

  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Please sign in again to view this document.";
      case 403:
        return "You do not have access to view this document.";
      case 404:
        return "This document is not available yet.";
      case 409:
        return "This document needs to be uploaded again before it can be viewed.";
      case 408:
        return "Document preview took too long. Check your connection and try again.";
      default:
        return SELLER_DOCUMENT_ACCESS_ERROR;
    }
  }

  return SELLER_DOCUMENT_ACCESS_ERROR;
}

export function toSellerDocumentAccessError(error: unknown): SellerDocumentAccessError {
  if (error instanceof SellerDocumentAccessError) return error;
  const status = error instanceof ApiError ? error.status : 503;
  return new SellerDocumentAccessError(getSellerDocumentAccessMessage(error), status);
}

function parseIntegerQueryParam(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseSignedDocumentUrl(
  value: string,
  expectedResourceType: SellerDocumentAccess["resourceType"],
  expectedExpiresAt: number,
): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname !== CLOUDINARY_PRIVATE_DOWNLOAD_HOST
  ) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (
    segments.length !== 4 ||
    segments[0] !== "v1_1" ||
    !segments[1] ||
    segments[2] !== expectedResourceType ||
    segments[3] !== "download"
  ) {
    return null;
  }

  if (
    url.searchParams.get("type") !== "authenticated" ||
    parseIntegerQueryParam(url.searchParams.get("expires_at")) !== expectedExpiresAt ||
    !url.searchParams.get("public_id")?.trim()
  ) {
    return null;
  }

  const format = url.searchParams.get("format");
  if (format !== null && !format.trim()) {
    return null;
  }

  return url.toString();
}

export function normalizeSellerDocumentAccess(
  payload: unknown,
  expectedDocumentType: SellerDocumentType,
  nowSeconds = Math.floor(Date.now() / 1000),
): SellerDocumentAccess {
  const root = asRecord(payload);
  const data = root?.status === "success" ? asRecord(root.data) : null;
  const documentType = data?.documentType;
  const expiresAt = data?.expiresAt;
  const ttlSeconds = data?.ttlSeconds;
  const resourceType = data?.resourceType;
  const type = data?.type;
  const normalizedResourceType = typeof resourceType === "string" && CLOUDINARY_ACCESS_RESOURCE_TYPES.has(resourceType)
    ? resourceType as SellerDocumentAccess["resourceType"]
    : null;
  const signedUrl = typeof data?.signedUrl === "string" && normalizedResourceType && typeof expiresAt === "number"
    ? parseSignedDocumentUrl(data.signedUrl.trim(), normalizedResourceType, expiresAt)
    : null;
  const expiresAtDelta = typeof expiresAt === "number" ? expiresAt - nowSeconds : Number.NaN;

  if (
    documentType !== expectedDocumentType ||
    !signedUrl ||
    !normalizedResourceType ||
    typeof expiresAt !== "number" ||
    !Number.isInteger(expiresAt) ||
    !Number.isFinite(expiresAtDelta) ||
    expiresAt <= nowSeconds ||
    typeof ttlSeconds !== "number" ||
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds !== SELLER_DOCUMENT_ACCESS_TTL_SECONDS ||
    expiresAtDelta > ttlSeconds + SELLER_DOCUMENT_ACCESS_CLOCK_SKEW_SECONDS ||
    type !== "authenticated"
  ) {
    throw new SellerDocumentAccessError(SELLER_DOCUMENT_ACCESS_ERROR, 502);
  }

  return {
    documentType: expectedDocumentType,
    signedUrl,
    expiresAt,
    ttlSeconds,
    resourceType: normalizedResourceType,
    type,
  };
}

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

function assertSellerDocumentDeliveryType(uploadConfig: SignedCloudinaryUploadConfig) {
  if (!isSupportedCloudinaryDeliveryType(uploadConfig.type) || uploadConfig.type !== "authenticated") {
    throw new Error("Document upload is not available right now. Please try again shortly.");
  }
}

function assertCompleteSellerDocumentReservation(uploadConfig: SignedCloudinaryUploadConfig) {
  const hasReservationId = Boolean(uploadConfig.reservationId?.trim());
  const hasReservedPublicId = Boolean(uploadConfig.reservedPublicId?.trim());
  if (!hasReservationId || !hasReservedPublicId || uploadConfig.reservedPublicId !== uploadConfig.publicId) {
    throw new Error("Document upload is not available right now. Please try again shortly.");
  }
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

export async function getSellerDocumentAccess(
  documentType: SellerDocumentType,
): Promise<SellerDocumentAccess> {
  try {
    const response = await apiClient<SellerDocumentAccessResponse>(
      `/vendor/uploads/seller-documents/${encodeURIComponent(documentType)}/access`,
      { method: "GET" },
    );

    return normalizeSellerDocumentAccess(response, documentType);
  } catch (error) {
    throw toSellerDocumentAccessError(error);
  }
}

export async function uploadSellerDocument(
  file: File,
  documentType: SellerDocumentType,
  onProgress?: (progress: number) => void,
): Promise<UploadedSellerDocument> {
  try {
    const uploadConfig = await getSellerDocumentUploadSignature(documentType);
    assertSellerDocumentDeliveryType(uploadConfig);
    assertCompleteSellerDocumentReservation(uploadConfig);

    if (file.size > uploadConfig.maxFileSize) {
      throw new Error("This file is too large. Use a file under 5MB.");
    }

    if (!isAllowedCloudinaryUploadFile(file, uploadConfig)) {
      throw new Error("This file type is not supported for this upload.");
    }

    const payload = await uploadFileToCloudinary(uploadConfig, file, onProgress);

    if (!payload.secure_url || !payload.public_id || !payload.version || !payload.signature || !payload.resource_type) {
      throw new Error("Upload could not be completed. Please try again.");
    }

    const confirmed = await apiClient<SellerDocumentConfirmResponse>(
      "/vendor/uploads/seller-document/confirm",
      {
        method: "POST",
        csrf: true,
        body: JSON.stringify({
          reservationId: uploadConfig.reservationId,
          documentType,
          publicId: payload.public_id,
          secureUrl: payload.secure_url,
          resourceType: payload.resource_type,
          deliveryType: uploadConfig.type,
          version: payload.version,
          signature: payload.signature,
          format: payload.format ?? null,
          bytes: payload.bytes ?? null,
        }),
      },
    );
    if (
      confirmed.status !== "success" ||
      confirmed.data.reservationId !== uploadConfig.reservationId ||
      confirmed.data.publicId !== uploadConfig.reservedPublicId ||
      confirmed.data.type !== "authenticated" ||
      confirmed.data.resourceType !== payload.resource_type ||
      confirmed.data.url !== payload.secure_url
    ) {
      throw new Error("Upload could not be confirmed. Please try again.");
    }

    return {
      url: confirmed.data.url,
      reservationId: confirmed.data.reservationId,
      publicId: confirmed.data.publicId,
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
