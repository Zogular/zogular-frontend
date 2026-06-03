"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  saveSellerOnboardingDraft,
  startSellerOnboardingDraft,
  type SellerOnboardingApiResponse,
} from "../api/seller-onboarding.api";
import type { SaveSellerOnboardingPayload } from "../types/seller-onboarding.types";
import { sellerOnboardingQueryKey } from "./query-key";

function getFriendlyError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "We couldn't save your changes. Please try again.";
}

export function useSaveSellerOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveSellerOnboardingPayload) =>
      saveSellerOnboardingDraft(payload),
    onSuccess: (application) => {
      queryClient.setQueryData<SellerOnboardingApiResponse>(
        sellerOnboardingQueryKey,
        (current) => ({
          application,
          user: current?.user ?? null,
        }),
      );
      toast.success("Changes saved.");
    },
    onError: (error) => {
      toast.error(getFriendlyError(error));
    },
  });
}

export function useStartSellerOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startSellerOnboardingDraft,
    onSuccess: (application) => {
      queryClient.setQueryData<SellerOnboardingApiResponse>(
        sellerOnboardingQueryKey,
        (current) => ({
          application,
          user: current?.user ?? null,
        }),
      );
      toast.success("Your application is ready.");
    },
    onError: (error) => {
      toast.error(getFriendlyError(error));
    },
  });
}
