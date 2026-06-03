"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { saveSellerOnboardingDraft, uploadSellerOnboardingDocument, type SellerOnboardingApiResponse } from "../api/seller-onboarding.api";
import type {
  SaveSellerOnboardingPayload,
  SellerOnboardingDocumentConfig,
} from "../types/seller-onboarding.types";
import { sellerOnboardingQueryKey } from "./query-key";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);

function getFileExtension(file: File) {
  return file.name.toLowerCase().split(".").pop() ?? "";
}

function validateSellerDocumentFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    return "This file is too large. Please upload a file under 5MB.";
  }

  if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase()) && !ALLOWED_EXTENSIONS.has(getFileExtension(file))) {
    return "Please upload a JPG, PNG, WEBP, or PDF file.";
  }

  return null;
}

async function saveDraftWithSingleRetry(payload: SaveSellerOnboardingPayload) {
  try {
    return await saveSellerOnboardingDraft(payload);
  } catch {
    return saveSellerOnboardingDraft(payload);
  }
}

export function useUploadSellerDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      config,
      payload,
      onProgress,
    }: {
      file: File;
      config: SellerOnboardingDocumentConfig;
      payload: SaveSellerOnboardingPayload;
      onProgress?: (progress: number) => void;
    }) => {
      const validationError = validateSellerDocumentFile(file);
      if (validationError) throw new Error(validationError);

      await saveSellerOnboardingDraft(payload);

      const uploaded = await uploadSellerOnboardingDocument({
        documentType: config.documentType,
        file,
        onProgress,
      });

      let updatedApplication;
      try {
        updatedApplication = await saveDraftWithSingleRetry({
          ...payload,
          [config.field]: uploaded.url,
        });
      } catch (error) {
        await queryClient.invalidateQueries({ queryKey: sellerOnboardingQueryKey });
        throw new Error(
          error instanceof Error && error.message.trim()
            ? `File uploaded, but we couldn't save it to your application. ${error.message}`
            : "File uploaded, but we couldn't save it to your application. Please try again.",
        );
      }

      return { uploaded, config, updatedApplication };
    },
    onSuccess: ({ config, updatedApplication }) => {
      queryClient.setQueryData<SellerOnboardingApiResponse>(
        sellerOnboardingQueryKey,
        (current) => {
          if (!current) return current;
          return {
            ...current,
            application: updatedApplication,
          };
        },
      );
      toast.success(`${config.title} uploaded.`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Upload failed. Please try again.");
    },
  });
}
