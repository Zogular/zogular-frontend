/**
 * @file use-admin-products-list.ts
 * @module features/admin-products/hooks
 * @description
 * TanStack Query hook managing the bounded Admin Products Moderation queue (PM-F1 READ).
 *
 * Responsibilities:
 * - URL-backed query state (`page`, `limit`, `status`, `search`, `sortBy`, `sortOrder`, `view`).
 * - 300ms debounced search synced to URL (resets `page` to 1).
 * - Authority-scoped query key (`actorId`, `actorRole`, sorted `permissions`, `sessionRevision`).
 * - Immediate cache cancellation and purge on actor switch, permission loss, sign-out, or 401/403.
 * - Integrates shared `useAdminRefreshPolicy` and `useListScrollRestoration`.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminRefreshPolicy } from "@/features/admin-shell/hooks/useAdminRefreshPolicy";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import { adminProductsApi } from "@/services/admin/products";
import { getProductListSafeError } from "../lib/product-list-contract";
import {
  adminProductListTerminalStore,
  adminProductsListQueryKey,
  buildProductAuthorityKey,
  isObsoleteProductQuery,
  isTerminalProductAuthError,
  shouldPublishTerminalProductAuthError,
} from "../lib/product-list-authority";
import {
  PRODUCT_LIST_SEARCH_MAX_LENGTH,
  applyProductListUrlUpdates,
  parseProductListQuery,
  type ProductListQueryState,
} from "../lib/product-list-state";
import type {
  AdminProductListItem,
  AdminProductListSafeError,
  AdminProductQueueStatusFilter,
  AdminProductSortBy,
  AdminProductSortOrder,
  AdminProductViewMode,
} from "../types/admin-product-list.types";

const EMPTY_PERMISSIONS: readonly string[] = [];

export function useAdminProductsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const queryClient = useQueryClient();

  const query = useMemo<ProductListQueryState>(
    () => parseProductListQuery(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );

  const identity = useAdminIdentity();
  const actorId = identity?.id ?? "anonymous";
  const actorRole = identity?.claims?.role ?? "unauthenticated";
  const permissions = identity?.claims?.permissions;
  const sessionRevision = 0;

  const canViewProducts = Boolean(
    identity &&
      identity.sessionStatus === "authenticated" &&
      adminIdentityHasPermission(identity, "view_all_products"),
  );

  const canModerate = Boolean(
    identity &&
      identity.sessionStatus === "authenticated" &&
      adminIdentityHasPermission(identity, "approve_products"),
  );

  const currentAuthorityKey =
    identity && identity.sessionStatus === "authenticated"
      ? buildProductAuthorityKey(actorId, actorRole, permissions ?? EMPTY_PERMISSIONS, sessionRevision)
      : "unauthenticated";

  const prevAuthorityRef = useRef<string>(currentAuthorityKey);
  const latestAuthorityRef = useRef<string>(currentAuthorityKey);

  useEffect(() => {
    latestAuthorityRef.current = currentAuthorityKey;
  }, [currentAuthorityKey]);

  // Cancel and purge obsolete product list queries on actor switch or permission loss
  useEffect(() => {
    if (prevAuthorityRef.current !== currentAuthorityKey) {
      prevAuthorityRef.current = currentAuthorityKey;
      adminProductListTerminalStore.clear();

      if (!canViewProducts) {
        void queryClient.cancelQueries({ queryKey: ["admin", "products"] });
        void queryClient.removeQueries({ queryKey: ["admin", "products"] });
      } else {
        void queryClient.cancelQueries({
          queryKey: ["admin", "products"],
          predicate: (q) =>
            isObsoleteProductQuery(
              q.queryKey,
              actorId,
              actorRole,
              permissions ?? EMPTY_PERMISSIONS,
              sessionRevision,
            ),
        });
        void queryClient.removeQueries({
          queryKey: ["admin", "products"],
          predicate: (q) =>
            isObsoleteProductQuery(
              q.queryKey,
              actorId,
              actorRole,
              permissions ?? EMPTY_PERMISSIONS,
              sessionRevision,
            ),
        });
      }
    }
  }, [currentAuthorityKey, canViewProducts, actorId, actorRole, permissions, sessionRevision, queryClient]);

  useEffect(() => {
    if (!canViewProducts) {
      adminProductListTerminalStore.clear();
      void queryClient.cancelQueries({ queryKey: ["admin", "products"] });
      void queryClient.removeQueries({ queryKey: ["admin", "products"] });
    }
  }, [canViewProducts, queryClient]);

  const terminalError = useSyncExternalStore(
    adminProductListTerminalStore.subscribe,
    adminProductListTerminalStore.getSnapshot,
    () => null,
  );

  const queryKey = useMemo(
    () =>
      adminProductsListQueryKey(
        query,
        actorId,
        actorRole,
        permissions ?? EMPTY_PERMISSIONS,
        sessionRevision,
      ),
    [query, actorId, actorRole, permissions, sessionRevision],
  );

  const [searchQuery, setSearchQuery] = useState(query.search);
  const refreshPolicy = useAdminRefreshPolicy();

  // Sync local search input when URL search changes externally (e.g. Back navigation)
  const [prevQuerySearch, setPrevQuerySearch] = useState(query.search);
  if (query.search !== prevQuerySearch) {
    setPrevQuerySearch(query.search);
    setSearchQuery(query.search);
  }

  const writeUrl = useCallback(
    (
      updates: Partial<Record<string, string | null>>,
      history: "push" | "replace" = "push",
    ) => {
      const params = applyProductListUrlUpdates(
        new URLSearchParams(window.location.search),
        updates,
      );
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

  // 300ms debounce before syncing search to URL and resetting to page 1
  useEffect(() => {
    const normalized = searchQuery.trim().slice(0, PRODUCT_LIST_SEARCH_MAX_LENGTH);
    if (normalized === query.search) return;

    const timeout = window.setTimeout(() => {
      writeUrl({ search: normalized || null, page: null }, "replace");
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchQuery, query.search, writeUrl]);

  const isAuto = Boolean(
    refreshPolicy.settings.autoRefreshEnabled && refreshPolicy.settings.intervalMs > 0,
  );

  const listQuery = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const capturedAuth = currentAuthorityKey;
      try {
        const res = await adminProductsApi.fetchProductsPage(
          {
            page: query.page,
            limit: query.limit,
            search: query.search || undefined,
            status: query.status === "all" ? undefined : query.status,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
          },
          { signal },
        );
        if (signal.aborted || latestAuthorityRef.current !== capturedAuth) {
          throw new Error("Authority changed during request");
        }
        return res;
      } catch (err) {
        const safeErr = getProductListSafeError(err);
        if (
          shouldPublishTerminalProductAuthError({
            error: safeErr,
            capturedAuthorityKey: capturedAuth,
            latestAuthorityKey: latestAuthorityRef.current,
            signalAborted: signal.aborted,
          })
        ) {
          adminProductListTerminalStore.setError(safeErr);
          void queryClient.cancelQueries({ queryKey: ["admin", "products"] });
          void queryClient.removeQueries({ queryKey: ["admin", "products"] });
        }
        throw err;
      }
    },
    enabled: canViewProducts,
    placeholderData: undefined,
    staleTime: isAuto ? refreshPolicy.settings.intervalMs : Number.POSITIVE_INFINITY,
    refetchInterval: isAuto ? refreshPolicy.effectiveIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: isAuto,
    refetchOnReconnect: isAuto,
    refetchOnMount: refreshPolicy.settings.refreshOnNavigation,
    retry: false,
  });

  const rawError = listQuery.error ? getProductListSafeError(listQuery.error) : null;
  const isTerminal =
    isTerminalProductAuthError(rawError) || isTerminalProductAuthError(terminalError);
  const activeTerminalError =
    terminalError || (isTerminalProductAuthError(rawError) ? rawError : null);

  const hasRetainedData = Boolean(listQuery.data && !isTerminal && canViewProducts);
  const isRecoverableRefreshFailure = Boolean(hasRetainedData && rawError && !isTerminal);

  const safeError: AdminProductListSafeError | null = !canViewProducts
    ? {
        kind: "forbidden",
        status: 403,
        message: "You do not have permission to view the product moderation queue.",
      }
    : activeTerminalError
      ? activeTerminalError
      : isRecoverableRefreshFailure
        ? null
        : rawError;

  const refreshError: AdminProductListSafeError | null = isRecoverableRefreshFailure
    ? rawError
    : null;

  const data = isTerminal || !canViewProducts ? null : (listQuery.data ?? null);
  const loading = (listQuery.isPending && !data && !safeError) || (!identity && !safeError);
  const isRefreshing = listQuery.isFetching && !listQuery.isPending;

  const currentUrl =
    typeof window !== "undefined"
      ? `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ""}`
      : pathname;

  useListScrollRestoration(currentUrl, !loading && Boolean(data));

  const setStatusFilter = useCallback(
    (status: AdminProductQueueStatusFilter) => {
      writeUrl({
        status: status === "all" ? null : status,
        page: null,
      });
    },
    [writeUrl],
  );

  const setSort = useCallback(
    (sortBy: AdminProductSortBy, sortOrder: AdminProductSortOrder) => {
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
    (view: AdminProductViewMode) => {
      writeUrl({ view: view === "list" ? null : view }, "replace");
    },
    [writeUrl],
  );

  const refresh = useCallback(async () => {
    if (!canViewProducts) return;
    adminProductListTerminalStore.clear();
    await listQuery.refetch();
  }, [canViewProducts, listQuery]);

  return {
    items: (data?.items ?? []) as AdminProductListItem[],
    pagination: data?.pagination ?? null,
    loading,
    isRefreshing,
    error: safeError,
    refreshError,
    isStale: Boolean(refreshError),
    searchQuery,
    setSearchQuery,
    serverSearch: query.search,
    statusFilter: query.status,
    setStatusFilter,
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
    canModerate,
    currentUrl,
    currentAuthorityKey,
    queryScopeKey: JSON.stringify(queryKey),
    statusText: refreshPolicy.statusText,
  };
}
