"use client";

/**
 * @file use-buyer-detail.ts
 * @module features/admin-buyers/hooks
 * @description
 * Custom React hook fetching detailed profile data and linked business context (orders, spend, addresses)
 * for an individual buyer via TanStack Query.
 */

import { useQuery } from "@tanstack/react-query";
import { adminBuyersApi } from "@/services/admin/buyers";

export function useBuyerDetail(buyerId: string | null) {
  return useQuery({
    queryKey: ["admin", "buyer", buyerId],
    queryFn: async () => {
      if (!buyerId) throw new Error("Missing buyer ID");
      return await adminBuyersApi.fetchBuyerDetail(buyerId);
    },
    enabled: Boolean(buyerId),
    staleTime: 30_000,
  });
}
