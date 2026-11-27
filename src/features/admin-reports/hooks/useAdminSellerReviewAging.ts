"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QueryClient, useQuery } from "@tanstack/react-query";
import {
  purgeSellerReviewAging,
  sellerReviewAgingKey,
} from "@/features/admin-reports/lib/reports-cache";
import {
  fetchAdminSellerReviewAgingReport,
  getAdminReportSafeError,
} from "@/services/admin/seller-review-aging";
import type { SafeAdminError } from "@/features/admin-platform";

export function useAdminSellerReviewAging(authority: string) {
  const [client] = useState(() => new QueryClient());
  const [terminal, setTerminal] = useState<SafeAdminError | null>(null);
  const blocked = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    client.mount();
    return () => {
      mounted.current = false;
      client.unmount();
      queueMicrotask(() => {
        if (!mounted.current) purgeSellerReviewAging(client, authority);
      });
    };
  }, [authority, client]);

  useEffect(() => {
    if (terminal) purgeSellerReviewAging(client, authority);
  }, [authority, client, terminal]);

  const result = useQuery(
    {
      queryKey: sellerReviewAgingKey(authority),
      enabled: !terminal,
      queryFn: async ({ signal }) => {
        if (blocked.current) {
          throw new Error("Seller review aging report is unavailable.");
        }
        try {
          return await fetchAdminSellerReviewAgingReport(signal);
        } catch (cause) {
          const safe = getAdminReportSafeError(cause);
          if (
            !signal.aborted &&
            (safe.kind === "unauthenticated" || safe.kind === "forbidden")
          ) {
            blocked.current = true;
            setTerminal(safe);
          }
          throw cause;
        }
      },
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
    client,
  );

  const error =
    terminal ?? (result.error ? getAdminReportSafeError(result.error) : null);
  const failClosed = Boolean(
    error && (error.kind === "unauthenticated" || error.kind === "forbidden"),
  );
  const data = failClosed ? null : (result.data ?? null);

  const refresh = useCallback(() => {
    if (mounted.current && !blocked.current) {
      return result.refetch({ cancelRefetch: false });
    }
    return undefined;
  }, [result]);

  return {
    data,
    error,
    failClosed,
    isInitialLoading: !error && result.isPending && !data,
    isRefreshing: result.isFetching && !result.isPending,
    refresh,
  };
}
