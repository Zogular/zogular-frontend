"use client";

import { useQuery } from "@tanstack/react-query";
import { getSellerOnboarding } from "../api/seller-onboarding.api";
import { mapSellerOnboardingToViewModel } from "../utils/seller-onboarding.mapper";
import { sellerOnboardingQueryKey } from "./query-key";

export function useSellerOnboarding() {
  return useQuery({
    queryKey: sellerOnboardingQueryKey,
    queryFn: getSellerOnboarding,
    select: (response) =>
      mapSellerOnboardingToViewModel(response.application, response.user),
  });
}
