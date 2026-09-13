"use client";

/**
 * @file use-buyers-list.ts
 * @module features/admin-buyers/hooks
 * @description
 * Custom React hook encapsulating state management, debounced search synchronization with URL params,
 * and TanStack Query data fetching for the Admin Buyers CRM list view.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { adminBuyersApi } from "@/services/admin/buyers";
import {
  applyBuyerListUrlUpdates,
  getBuyerSafeError,
  parseBuyerListQuery,
} from "../lib/buyer-list-state";
import type {
  BuyerListQueryState,
  BuyerListViewMode,
  BuyerStatusFilter,
} from "../types/admin-buyer.types";

export function useBuyersList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  const queryState = useMemo(
    () => parseBuyerListQuery(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );

  const [searchQuery, setSearchQuery] = useState(queryState.search);
  const [prevUrlSearch, setPrevUrlSearch] = useState(queryState.search);

  if (queryState.search !== prevUrlSearch) {
    setPrevUrlSearch(queryState.search);
    setSearchQuery(queryState.search);
  }

  const writeUrl = useCallback(
    (updates: Partial<Record<keyof BuyerListQueryState, string>>, history: "push" | "replace" = "push") => {
      const current = new URLSearchParams(window.location.search);
      const next = applyBuyerListUrlUpdates(current, updates);
      const queryString = next.toString();
      const href = `${pathname}${queryString ? `?${queryString}` : ""}`;
      if (history === "replace") {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
    },
    [pathname, router],
  );

  // Debounced search input sync to URL
  useEffect(() => {
    const normalized = searchQuery.trim().slice(0, 120);
    if (normalized === queryState.search) return;
    const timeout = window.setTimeout(() => {
      setPrevUrlSearch(normalized);
      writeUrl({ search: normalized, page: "" }, "replace");
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [queryState.search, searchQuery, writeUrl]);

  const activeStatusFilter =
    queryState.status === "active" ? true : queryState.status === "inactive" ? false : undefined;

  const { data, error, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin", "buyers", { search: queryState.search, status: queryState.status, page: queryState.page }],
    queryFn: async () => {
      return await adminBuyersApi.fetchBuyers({
        page: queryState.page,
        limit: 20,
        search: queryState.search || undefined,
        isActive: activeStatusFilter,
      });
    },
    // Architectural Note: Real-time SSE listener in AdminShell automatically invalidates ["admin", "buyers"]
    // upon "admin:buyer:updated" / "admin:buyer:created". Polling is relaxed to 60s as a fallback safety net.
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    buyers: data?.buyers ?? [],
    pagination: data?.pagination ?? { total: 0, page: 1, limit: 20, pages: 1 },
    isLoading,
    isInitialLoading: isLoading && !data,
    isFetching,
    error: error ? getBuyerSafeError(error) : null,
    searchQuery,
    setSearchQuery,
    statusFilter: queryState.status,
    setStatusFilter: (status: BuyerStatusFilter) => writeUrl({ status: status === "all" ? "" : status, page: "" }),
    page: queryState.page,
    setPage: (newPage: number) => writeUrl({ page: newPage <= 1 ? "" : String(newPage) }),
    view: queryState.view,
    setView: (newView: BuyerListViewMode) => writeUrl({ view: newView === "list" ? "" : newView }),
    refetch,
    dataUpdatedAt: dataUpdatedAt ?? 0,
  };
}
