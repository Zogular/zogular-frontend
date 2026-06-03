"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/services/api";
import { appendNextPath } from "@/services/auth-intent";
import { submitSellerOnboarding, type SellerOnboardingApiResponse } from "../api/seller-onboarding.api";
import type { SellerOnboardingViewModel } from "../types/seller-onboarding.types";
import { sellerOnboardingQueryKey } from "./query-key";

function isTrustGateError(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    error.message.toLowerCase().includes("verified email") &&
    error.message.toLowerCase().includes("verified phone")
  );
}

function hasPendingTrustCheck(
  viewModel: SellerOnboardingViewModel | null | undefined,
  label: "Email" | "Phone",
) {
  return viewModel?.trustControls.some(
    (item) => item.label === label && item.status !== "verified",
  ) ?? false;
}

type MissingRequirement = {
  field?: unknown;
  label?: unknown;
  message?: unknown;
};

function getMissingRequirements(error: ApiError) {
  const details = error.details && typeof error.details === "object"
    ? error.details as { errors?: unknown; data?: { missingFields?: unknown } }
    : null;
  const fields = Array.isArray(details?.data?.missingFields)
    ? details.data.missingFields
    : Array.isArray(details?.errors)
      ? details.errors
      : [];

  return fields
    .filter((item): item is MissingRequirement => Boolean(item) && typeof item === "object")
    .map((item) => ({
      field: typeof item.field === "string" ? item.field : "",
      label: typeof item.label === "string" ? item.label : "",
      message: typeof item.message === "string" ? item.message : "",
    }));
}

function formatMissingRequirements(requirements: ReturnType<typeof getMissingRequirements>) {
  const labels = requirements
    .map((item) => item.label || item.message)
    .filter(Boolean)
    .slice(0, 3);

  if (labels.length === 0) return "Finish the missing items before sending your application.";
  const suffix = requirements.length > labels.length ? ` and ${requirements.length - labels.length} more` : "";
  return `Finish these before sending: ${labels.join(", ")}${suffix}.`;
}

export function useSubmitSellerOnboarding(viewModel?: SellerOnboardingViewModel | null) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      return submitSellerOnboarding();
    },
    onSuccess: (application) => {
      queryClient.setQueryData<SellerOnboardingApiResponse>(
        sellerOnboardingQueryKey,
        (current) => ({
          application,
          user: current?.user ?? null,
        }),
      );
      toast.success("Your application has been sent.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 400) {
        const missingRequirements = getMissingRequirements(error);
        const hasPhoneRequirement = missingRequirements.some((item) => item.field === "phoneVerifiedAt");
        const hasEmailRequirement = missingRequirements.some((item) => item.field === "emailVerified");

        toast.error(formatMissingRequirements(missingRequirements));

        if (hasPhoneRequirement) {
          router.push("/seller/verify-phone");
          return;
        }

        if (hasEmailRequirement) {
          router.push(appendNextPath("/auth/check-email", "/seller/onboarding"));
        }

        return;
      }

      if (isTrustGateError(error)) {
        const phonePending = hasPendingTrustCheck(viewModel, "Phone");
        const emailPending = hasPendingTrustCheck(viewModel, "Email");

        if (phonePending) {
          toast.error("Verify your phone number before sending your seller application.");
          router.push("/seller/verify-phone");
          return;
        }

        if (emailPending) {
          toast.error("Confirm your email before sending your seller application.");
          router.push(appendNextPath("/auth/check-email", "/seller/onboarding"));
          return;
        }

        toast.error("Confirm your email and phone before sending your seller application.");
        return;
      }

      toast.error(error instanceof Error ? error.message : "We couldn't send your application. Please try again.");
    },
  });
}
