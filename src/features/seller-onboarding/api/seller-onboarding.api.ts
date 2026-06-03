import { ApiError } from "@/services/api";
import { createVendorApplication, getMyVendorApplication, submitMyVendorApplication, updateMyVendorApplication } from "@/services/vendor-application";
import { getCurrentUser } from "@/services/auth";
import { uploadSellerDocument as uploadSellerDocumentToStorage } from "@/services/seller-document-uploads";
import type { AuthUser } from "@/types/auth";
import type { VendorApplication } from "@/types/seller";
import type {
  SaveSellerOnboardingPayload,
  SellerOnboardingDocumentType,
} from "../types/seller-onboarding.types";

export type SellerOnboardingApiResponse = {
  application: VendorApplication | null;
  user: AuthUser | null;
};

export async function getSellerOnboarding(): Promise<SellerOnboardingApiResponse> {
  const [applicationResult, userResult] = await Promise.allSettled([
    getMyVendorApplication(),
    getCurrentUser(),
  ]);

  const application =
    applicationResult.status === "fulfilled" ? applicationResult.value : null;
  const user = userResult.status === "fulfilled" ? userResult.value : null;

  if (
    applicationResult.status === "rejected" &&
    applicationResult.reason instanceof ApiError &&
    applicationResult.reason.status !== 404
  ) {
    throw applicationResult.reason;
  }

  if (
    userResult.status === "rejected" &&
    userResult.reason instanceof ApiError &&
    userResult.reason.status === 401
  ) {
    throw userResult.reason;
  }

  return { application, user };
}

export async function startSellerOnboardingDraft() {
  return createVendorApplication({ sellerType: "INDIVIDUAL" });
}

function normalizeSellerOnboardingError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;

  const message = error.message.trim().toLowerCase();

  if (
    message.includes("submitted seller applications cannot be edited") ||
    message.includes("approved seller applications cannot be edited") ||
    message.includes("cannot be edited")
  ) {
    return new Error("Your application is already under review.");
  }

  return error;
}

export async function saveSellerOnboardingDraft(
  payload: SaveSellerOnboardingPayload,
): Promise<VendorApplication> {
  try {
    return await updateMyVendorApplication(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return createVendorApplication(payload);
    }
    throw normalizeSellerOnboardingError(error);
  }
}

export async function uploadSellerOnboardingDocument({
  documentType,
  file,
  onProgress,
}: {
  documentType: SellerOnboardingDocumentType;
  file: File;
  onProgress?: (progress: number) => void;
}) {
  return uploadSellerDocumentToStorage(file, documentType, onProgress);
}

export async function submitSellerOnboarding(): Promise<VendorApplication> {
  return submitMyVendorApplication();
}
