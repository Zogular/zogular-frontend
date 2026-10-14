/**
 * @file use-buyers-list.ts
 * @module features/admin-buyers/hooks
 * @description
 * Custom React hook managing the Customer list workspace (CM-F1).
 *
 * Responsibilities:
 * - URL-backed query state: page, limit, search, isActive, sortBy, sortOrder, view mode.
 * - Search debounce: 300ms delay before synchronizing to URL parameters.
 * - Authority identity: queries include actor ID, role, and canonical permissions in query key.
 * - Purges protected Customer data and clears UI cache on access loss or actor changes.
 * - TanStack Query integration: placeholderData, staleTime from refreshPolicy, visible-tab interval.
 * - Container scroll restoration: integrates `useListScrollRestoration` with exact list URL.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminRefreshPolicy } from "@/features/admin-shell/hooks/useAdminRefreshPolicy";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import { fetchAdminBuyers } from "@/services/admin/buyers";
import {
  adminCustomerListTerminalStore,
  adminCustomersListQueryKey,
  applyBuyerListUrlUpdates,
  buildAuthorityKey,
  getBuyerSafeError,
  isObsoleteCustomerQuery,
  isTerminalAuthError,
  parseBuyerListQuery,
  type BuyerListQueryState,
  type BuyerSafeError,
} from "../lib/buyer-list-state";
import type {
  AdminBuyerActiveFilter,
  AdminBuyerRecord,
  AdminBuyerSortBy,
  AdminBuyerSortOrder,
  AdminBuyerViewMode,
} from "../types/admin-buyer.types";

const EMPTY_PERMISSIONS: readonly string[] = [];

export function useBuyersList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const queryClient = useQueryClient();

  const query = useMemo<BuyerListQueryState>(
    () => parseBuyerListQuery(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );

  const identity = useAdminIdentity();
  const actorId = identity?.id ?? "anonymous";
  const actorRole = identity?.claims?.role ?? "unauthenticated";
  const permissions = identity?.claims?.permissions;

  const canViewAllUsers = Boolean(
    identity &&
      identity.sessionStatus === "authenticated" &&
      adminIdentityHasPermission(identity, "view_all_users"),
  );

  const canViewSensitiveFields = Boolean(
    identity &&
      identity.sessionStatus === "authenticated" &&
      adminIdentityHasPermission(identity, "view_user_sensitive_fields"),
  );

  const currentAuthorityKey = identity && identity.sessionStatus === "authenticated"
    ? buildAuthorityKey(actorId, actorRole, permissions ?? EMPTY_PERMISSIONS)
    : "unauthenticated";

  const prevAuthorityRef = useRef<string>(currentAuthorityKey);
  const latestAuthorityRef = useRef<string>(currentAuthorityKey);

  useEffect(() => {
    latestAuthorityRef.current = currentAuthorityKey;
  }, [currentAuthorityKey]);

  // Authority changes or permission loss: cancel and purge ONLY obsolete customer queries
  useEffect(() => {
    if (prevAuthorityRef.current !== currentAuthorityKey) {
      prevAuthorityRef.current = currentAuthorityKey;
      adminCustomerListTerminalStore.clear();

      if (!canViewAllUsers) {
        // Complete loss of access: purge all customer queries immediately
        void queryClient.cancelQueries({ queryKey: ["admin", "customers"] });
        void queryClient.removeQueries({ queryKey: ["admin", "customers"] });
      } else {
        // Selective cancellation & purge: cancel & remove only queries belonging to obsolete authority
        void queryClient.cancelQueries({
          queryKey: ["admin", "customers"],
          predicate: (q) =>
            isObsoleteCustomerQuery(
              q.queryKey,
              actorId,
              actorRole,
              permissions ?? EMPTY_PERMISSIONS,
            ),
        });
        void queryClient.removeQueries({
          queryKey: ["admin", "customers"],
          predicate: (q) =>
            isObsoleteCustomerQuery(
              q.queryKey,
              actorId,
              actorRole,
              permissions ?? EMPTY_PERMISSIONS,
            ),
        });
      }
    }
  }, [currentAuthorityKey, canViewAllUsers, actorId, actorRole, permissions, queryClient]);

  // If permission revoked, cancel and purge customer cache immediately
  useEffect(() => {
    if (!canViewAllUsers) {
      adminCustomerListTerminalStore.clear();
      void queryClient.cancelQueries({ queryKey: ["admin", "customers"] });
      void queryClient.removeQueries({ queryKey: ["admin", "customers"] });
    }
  }, [canViewAllUsers, queryClient]);

  const terminalError = useSyncExternalStore(
    adminCustomerListTerminalStore.subscribe,
    adminCustomerListTerminalStore.getSnapshot,
    () => null,
  );

  const queryKey = useMemo(
    () => adminCustomersListQueryKey(query, actorId, actorRole, permissions ?? EMPTY_PERMISSIONS),
    [query, actorId, actorRole, permissions],
  );

  const [searchQuery, setSearchQuery] = useState(query.search);
  const refreshPolicy = useAdminRefreshPolicy();

  // Synchronize internal search input with external URL search param changes during render
  const [prevQuerySearch, setPrevQuerySearch] = useState(query.search);
  if (query.search !== prevQuerySearch) {
    setPrevQuerySearch(query.search);
    setSearchQuery(query.search);
  }

  // Write changes to URL query
  const writeUrl = useCallback(
    (
      updates: Partial<Record<string, string | null>>,
      history: "push" | "replace" = "push",
    ) => {
      const params = applyBuyerListUrlUpdates(new URLSearchParams(window.location.search), updates);
      const nextQuery = params.toString();
      const href = `${pathname}${nextQuery ? `?${nextQuery}` : ""}`;
      if (history === "replace") {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
    },
    [pathname, router],
  );

  // 300ms Debounce on search changes
  useEffect(() => {
    const normalized = searchQuery.trim().slice(0, 120);
    if (normalized === query.search) return;

    const timeout = window.setTimeout(() => {
      writeUrl({ search: normalized || null, page: null }, "replace");
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery, query.search, writeUrl]);

  const activeFilterParam =
    query.isActive === "active"
      ? true
      : query.isActive === "inactive"
      ? false
      : undefined;

  const isAuto = Boolean(refreshPolicy.settings.autoRefreshEnabled && refreshPolicy.settings.intervalMs > 0);

  const listQuery = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const capturedAuth = currentAuthorityKey;
      try {
        const res = await fetchAdminBuyers(
          {
            page: query.page,
            limit: query.limit,
            search: query.search || undefined,
            isActive: activeFilterParam,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
          },
          { signal },
        );
        if (latestAuthorityRef.current !== capturedAuth) {
          throw new Error("Authority changed during request");
        }
        return res;
      } catch (err) {
        const safeErr = getBuyerSafeError(err);
        if (isTerminalAuthError(safeErr)) {
          adminCustomerListTerminalStore.setError(safeErr);
          void queryClient.cancelQueries({ queryKey: ["admin", "customers"] });
          void queryClient.removeQueries({ queryKey: ["admin", "customers"] });
        }
        throw err;
      }
    },
    enabled: canViewAllUsers,
    // Explicitly NO previous-query data reuse across different queries
    placeholderData: undefined,
    staleTime: isAuto ? refreshPolicy.settings.intervalMs : Number.POSITIVE_INFINITY,
    refetchInterval: isAuto ? refreshPolicy.effectiveIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: isAuto,
    refetchOnReconnect: isAuto,
    refetchOnMount: refreshPolicy.settings.refreshOnNavigation,
    retry: false,
  });

  const rawError = listQuery.error ? getBuyerSafeError(listQuery.error) : null;
  const isTerminal = isTerminalAuthError(rawError) || isTerminalAuthError(terminalError);
  const activeTerminalError = terminalError || (isTerminalAuthError(rawError) ? rawError : null);

  const hasRetainedData = Boolean(listQuery.data && !isTerminal && canViewAllUsers);
  const isRecoverableRefreshFailure = Boolean(hasRetainedData && rawError && !isTerminal);

  const safeError: BuyerSafeError | null = !canViewAllUsers
    ? {
        kind: "forbidden",
        status: 403,
        message: "You do not have permission to view customer accounts.",
      }
    : activeTerminalError
    ? activeTerminalError
    : (isRecoverableRefreshFailure ? null : rawError);

  const refreshError: BuyerSafeError | null = isRecoverableRefreshFailure ? rawError : null;

  const data = isTerminal || !canViewAllUsers ? null : (listQuery.data ?? null);
  const loading = (listQuery.isPending && !data && !safeError) || (!identity && !safeError);
  const isRefreshing = listQuery.isFetching && !listQuery.isPending;

  // Scroll restoration on return navigation
  const currentUrl = typeof window !== "undefined" ? `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ""}` : pathname;
  useListScrollRestoration(currentUrl, !loading && Boolean(data));

  const setActiveFilter = useCallback(
    (value: AdminBuyerActiveFilter) => {
      writeUrl({
        isActive: value === "all" ? null : value,
        page: null,
      });
    },
    [writeUrl],
  );

  const setSort = useCallback(
    (sortBy: AdminBuyerSortBy, sortOrder: AdminBuyerSortOrder) => {
      writeUrl({
        sortBy: sortBy === "createdAt" ? null : sortBy,
        sortOrder: sortOrder === "desc" ? null : sortOrder,
        page: null,
      });
    },
    [writeUrl],
  );

  const setPage = useCallback(
    (page: number) => {
      writeUrl({ page: page <= 1 ? null : String(page) });
    },
    [writeUrl],
  );

  const setLimit = useCallback(
    (limit: number) => {
      writeUrl({
        limit: limit === 20 ? null : String(limit),
        page: null,
      });
    },
    [writeUrl],
  );

  const setViewMode = useCallback(
    (view: AdminBuyerViewMode) => {
      writeUrl({ view: view === "list" ? null : view }, "replace");
    },
    [writeUrl],
  );

  // Manual retry is strictly permission-aware; resets terminal error store before refetch
  const refresh = useCallback(() => {
    if (!canViewAllUsers) return;
    adminCustomerListTerminalStore.clear();
    void listQuery.refetch();
  }, [canViewAllUsers, listQuery]);

  return {
    buyers: (data?.data.users ?? []) as AdminBuyerRecord[],
    pagination: data?.pagination ?? null,
    loading,
    isRefreshing,
    error: safeError,
    refreshError,
    isStale: Boolean(refreshError),
    searchQuery,
    setSearchQuery,
    activeFilter: query.isActive,
    setActiveFilter,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    setSort,
    page: query.page,
    setPage,
    limit: query.limit,
    setLimit,
    viewMode: query.view,
    setViewMode,
    refresh,
    canViewSensitiveFields,
    statusText: refreshPolicy.statusText,
  };
}
