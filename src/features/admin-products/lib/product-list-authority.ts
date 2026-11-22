/**
 * @file product-list-authority.ts
 * @module features/admin-products/lib
 * @description
 * Authority-scoped query keys, obsolete-query predicates, and synchronous
 * terminal auth error store for the Admin Products Moderation list (PM-F1 READ).
 * Guarantees zero cross-actor or post-revocation data leakage.
 */

import type { AdminProductListSafeError } from "../types/admin-product-list.types";
import type { ProductListQueryState } from "./product-list-state";

export function buildProductAuthorityKey(
  actorId = "anonymous",
  actorRole = "unauthenticated",
  permissions: readonly string[] = [],
  sessionRevision = 0,
): string {
  const permKey = [...permissions].sort().join(",");
  return `${actorId}:${actorRole}:${permKey}:${sessionRevision}`;
}

export function adminProductsListQueryKey(
  query: ProductListQueryState,
  actorId = "anonymous",
  actorRole = "unauthenticated",
  permissions: readonly string[] = [],
  sessionRevision = 0,
) {
  const permKey = [...permissions].sort().join(",");
  return [
    "admin",
    "products",
    "list",
    actorId,
    actorRole,
    permKey,
    sessionRevision,
    {
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    },
  ] as const;
}

export function isProductQueryMatchingAuthority(
  queryKey: readonly unknown[],
  actorId: string,
  actorRole: string,
  permissions: readonly string[] = [],
  sessionRevision = 0,
): boolean {
  if (!Array.isArray(queryKey) || queryKey[0] !== "admin" || queryKey[1] !== "products") {
    return false;
  }
  const permKey = [...permissions].sort().join(",");
  if (queryKey[2] === "list") {
    return (
      queryKey[3] === actorId &&
      queryKey[4] === actorRole &&
      queryKey[5] === permKey &&
      queryKey[6] === sessionRevision
    );
  }
  return false;
}

export function isObsoleteProductQuery(
  queryKey: readonly unknown[],
  currentActorId: string,
  currentActorRole: string,
  currentPermissions: readonly string[] = [],
  currentSessionRevision = 0,
): boolean {
  if (!Array.isArray(queryKey) || queryKey[0] !== "admin" || queryKey[1] !== "products") {
    return false;
  }
  return !isProductQueryMatchingAuthority(
    queryKey,
    currentActorId,
    currentActorRole,
    currentPermissions,
    currentSessionRevision,
  );
}

export function isTerminalProductAuthError(
  error: AdminProductListSafeError | null | undefined,
): boolean {
  if (!error) return false;
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.kind === "unauthenticated" ||
    error.kind === "forbidden"
  );
}

/**
 * Ensures late 401/403 responses from an obsolete authority or aborted signal
 * never publish into the module-wide terminal store or purge the active actor's cache.
 */
export function shouldPublishTerminalProductAuthError(params: {
  error: AdminProductListSafeError | null | undefined;
  capturedAuthorityKey: string;
  latestAuthorityKey: string;
  signalAborted: boolean;
}): boolean {
  if (params.signalAborted) return false;
  if (params.capturedAuthorityKey !== params.latestAuthorityKey) return false;
  return isTerminalProductAuthError(params.error);
}

export interface ProductTerminalStore {
  getSnapshot: () => AdminProductListSafeError | null;
  subscribe: (listener: () => void) => () => void;
  setError: (error: AdminProductListSafeError | null) => void;
  clear: () => void;
}

export function createProductTerminalStore(): ProductTerminalStore {
  let currentError: AdminProductListSafeError | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => currentError,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setError: (error: AdminProductListSafeError | null) => {
      if (
        currentError?.kind === error?.kind &&
        currentError?.status === error?.status &&
        currentError?.message === error?.message
      ) {
        return;
      }
      currentError = error;
      for (const listener of listeners) {
        listener();
      }
    },
    clear: () => {
      if (currentError === null) return;
      currentError = null;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

export const adminProductListTerminalStore = createProductTerminalStore();
