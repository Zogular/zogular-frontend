/**
 * @file use-buyer-detail.ts
 * @module features/admin-buyers/hooks
 * @description
 * Custom React hook for loading individual customer details via GET /api/v1/admin/users/:id.
 *
 * Guarantees:
 * - Direct HTTP fetch rather than trusting a potentially stale list row.
 * - Strict DTO contract validation via `validateBuyerDetailResponse`.
 * - Handles 404 (not found), 403 (forbidden), 401 (expired session), and server error states.
 * - TanStack Query integration scoped to customer ID, actor identity, and verified authority.
 * - Purges sensitive detail data upon 401/403 or actor changes without retaining stale state across IDs.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminRefreshPolicy } from "@/features/admin-shell/hooks/useAdminRefreshPolicy";
import { fetchAdminBuyerById } from "@/services/admin/buyers";
import {
  adminCustomerDetailTerminalStore,
  adminCustomerDetailQueryKey,
  buildAuthorityKey,
  getBuyerSafeError,
  isObsoleteCustomerQuery,
  isTerminalAuthError,
  type BuyerSafeError,
} from "../lib/buyer-list-state";
import type { AdminBuyerDetailRecord } from "../types/admin-buyer.types";

const EMPTY_PERMISSIONS: readonly string[] = [];

export function useBuyerDetail(id: string) {
  const queryClient = useQueryClient();
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

  // When detail ID changes, clear the detail terminal error store
  const prevIdRef = useRef<string>(id);
  useEffect(() => {
    if (prevIdRef.current !== id) {
      prevIdRef.current = id;
      adminCustomerDetailTerminalStore.clear();
    }
  }, [id]);

  // Authority changes, permission reductions, or sign-out: cancel and purge ONLY obsolete customer queries
  useEffect(() => {
    if (prevAuthorityRef.current !== currentAuthorityKey) {
      prevAuthorityRef.current = currentAuthorityKey;
      adminCustomerDetailTerminalStore.clear();

      if (!canViewAllUsers) {
        // Full loss of access: cancel and purge all customer queries immediately
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
      adminCustomerDetailTerminalStore.clear();
      void queryClient.cancelQueries({ queryKey: ["admin", "customers"] });
      void queryClient.removeQueries({ queryKey: ["admin", "customers"] });
    }
  }, [canViewAllUsers, queryClient]);

  const terminalError = useSyncExternalStore(
    adminCustomerDetailTerminalStore.subscribe,
    adminCustomerDetailTerminalStore.getSnapshot,
    () => null,
  );

  const queryKey = useMemo(
    () => adminCustomerDetailQueryKey(id, actorId, actorRole, permissions ?? EMPTY_PERMISSIONS),
    [id, actorId, actorRole, permissions],
  );

  const refreshPolicy = useAdminRefreshPolicy();
  const isAuto = Boolean(refreshPolicy.settings.autoRefreshEnabled && refreshPolicy.settings.intervalMs > 0);

  const detailQuery = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const capturedAuth = currentAuthorityKey;
      try {
        const res = await fetchAdminBuyerById(id, { signal });
        if (latestAuthorityRef.current !== capturedAuth) {
          throw new Error("Authority changed during request");
        }
        return res;
      } catch (err) {
        const safeErr = getBuyerSafeError(err);
        if (isTerminalAuthError(safeErr)) {
          adminCustomerDetailTerminalStore.setError(safeErr);
          void queryClient.cancelQueries({ queryKey: ["admin", "customers"] });
          void queryClient.removeQueries({ queryKey: ["admin", "customers"] });
        }
        throw err;
      }
    },
    enabled: Boolean(id) && canViewAllUsers,
    placeholderData: undefined, // No stale detail data reuse across customer IDs
    staleTime: isAuto ? refreshPolicy.settings.intervalMs : Number.POSITIVE_INFINITY,
    refetchInterval: isAuto ? refreshPolicy.effectiveIntervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: isAuto,
    refetchOnReconnect: isAuto,
    refetchOnMount: refreshPolicy.settings.refreshOnNavigation,
    retry: false,
  });

  const rawError = detailQuery.error ? getBuyerSafeError(detailQuery.error) : null;
  const isTerminal = isTerminalAuthError(rawError) || isTerminalAuthError(terminalError);
  const activeTerminalError = terminalError || (isTerminalAuthError(rawError) ? rawError : null);

  const hasRetainedData = Boolean(detailQuery.data?.data?.user && !isTerminal && canViewAllUsers);
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

  const buyer = isTerminal || !canViewAllUsers
    ? null
    : (detailQuery.data?.data.user as AdminBuyerDetailRecord ?? null);

  const loading = (detailQuery.isPending && !buyer && !safeError) || (!identity && !safeError);
  const isRefreshing = detailQuery.isFetching && !detailQuery.isPending;

  // Manual retry is strictly permission-aware; resets terminal error store before refetch
  const refresh = useCallback(() => {
    if (!canViewAllUsers || !id) return;
    adminCustomerDetailTerminalStore.clear();
    void detailQuery.refetch();
  }, [canViewAllUsers, id, detailQuery]);

  return {
    buyer,
    loading,
    isRefreshing,
    error: safeError,
    refreshError,
    isStale: Boolean(refreshError),
    refresh,
    canViewSensitiveFields,
  };
}
