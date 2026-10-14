/**
 * @file buyer-list-state.ts
 * @module features/admin-buyers/lib
 * @description
 * State management, URL query serialization, safe error mapping, and cache key generation
 * for the Admin Customers list (CM-F1).
 *
 * State & Security Principles:
 * - Query key incorporates actor ID and role to automatically isolate / invalidate cached results
 *   when operator authority changes.
 * - On recoverable background refresh failures for the SAME query, previous valid data is retained.
 * - When filters/search/pagination change to a NEW query, stale data from the previous query is
 *   immediately discarded to prevent displaying outdated or mismatched results.
 * - On 401/403 or sign-out, all customer data is cleared.
 */

import { ApiError } from "@/services/api";
import {
  AdminBuyerContractError,
} from "./buyer-contract";
import type {
  AdminBuyerActiveFilter,
  AdminBuyerListResponse,
  AdminBuyerSortBy,
  AdminBuyerSortOrder,
  AdminBuyerViewMode,
} from "../types/admin-buyer.types";

export const BUYER_LIST_LIMITS = [20, 50, 100] as const;

export const BUYER_LIST_SORTS: readonly AdminBuyerSortBy[] = [
  "createdAt",
  "updatedAt",
  "firstName",
  "lastName",
  "email",
  "telephone",
  "isActive",
];

export interface BuyerListQueryState {
  page: number;
  limit: (typeof BUYER_LIST_LIMITS)[number];
  search: string;
  isActive: AdminBuyerActiveFilter;
  sortBy: AdminBuyerSortBy;
  sortOrder: AdminBuyerSortOrder;
  view: AdminBuyerViewMode;
}

export interface BuyerSafeError {
  kind: "unauthenticated" | "forbidden" | "not_found" | "timeout" | "malformed" | "unavailable";
  message: string;
  status?: number;
}

export interface BuyerListRequestState {
  data: AdminBuyerListResponse | null;
  dataQueryKey: string | null;
  error: BuyerSafeError | null;
  activeRequestId: number;
  requestedQueryKey: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export type BuyerListRequestAction =
  | { type: "request-started"; requestId: number; queryKey: string }
  | {
      type: "request-succeeded";
      requestId: number;
      queryKey: string;
      data: AdminBuyerListResponse;
    }
  | {
      type: "request-failed";
      requestId: number;
      queryKey: string;
      error: BuyerSafeError;
    }
  | { type: "clear" };

export const INITIAL_BUYER_LIST_REQUEST_STATE: BuyerListRequestState = {
  data: null,
  dataQueryKey: null,
  error: null,
  activeRequestId: 0,
  requestedQueryKey: null,
  isLoading: true,
  isRefreshing: false,
};

function positiveInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Parses query parameters from URLSearchParams into typed BuyerListQueryState.
 */
export function parseBuyerListQuery(params: URLSearchParams): BuyerListQueryState {
  const rawLimit = positiveInteger(params.get("limit"), 20);
  const rawIsActive = params.get("isActive") ?? params.get("status");
  const rawSortBy = params.get("sortBy") as AdminBuyerSortBy | null;
  const rawSortOrder = params.get("sortOrder") as AdminBuyerSortOrder | null;
  const rawView = params.get("view") as AdminBuyerViewMode | null;

  let activeFilter: AdminBuyerActiveFilter = "all";
  if (rawIsActive === "true" || rawIsActive === "active") {
    activeFilter = "active";
  } else if (rawIsActive === "false" || rawIsActive === "inactive") {
    activeFilter = "inactive";
  }

  const limit = BUYER_LIST_LIMITS.includes(rawLimit as (typeof BUYER_LIST_LIMITS)[number])
    ? (rawLimit as BuyerListQueryState["limit"])
    : 20;

  const sortBy = rawSortBy && BUYER_LIST_SORTS.includes(rawSortBy)
    ? rawSortBy
    : "createdAt";

  const sortOrder = rawSortOrder === "asc" ? "asc" : "desc";
  const view = rawView === "grid" ? "grid" : "list";

  return {
    page: positiveInteger(params.get("page"), 1),
    limit,
    search: (params.get("search") ?? "").trim().slice(0, 120),
    isActive: activeFilter,
    sortBy,
    sortOrder,
    view,
  };
}

/**
 * Updates URL search params with partial state, removing empty/default values for clean URLs.
 */
export function applyBuyerListUrlUpdates(
  currentParams: URLSearchParams,
  updates: Partial<Record<string, string | null>>,
): URLSearchParams {
  const next = new URLSearchParams(currentParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }

  return next;
}

/**
 * Builds a deterministic query key tuple for TanStack Query.
 * Scopes to: ["admin", "customers", "list", actorId, actorRole, permissionsHash, query]
 */
export function adminCustomersListQueryKey(
  query: BuyerListQueryState,
  actorId = "anonymous",
  actorRole = "unauthenticated",
  permissions: readonly string[] = [],
) {
  const permKey = [...permissions].sort().join(",");
  return [
    "admin",
    "customers",
    "list",
    actorId,
    actorRole,
    permKey,
    {
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    },
  ] as const;
}

export function adminCustomerDetailQueryKey(
  customerId: string,
  actorId = "anonymous",
  actorRole = "unauthenticated",
  permissions: readonly string[] = [],
) {
  const permKey = [...permissions].sort().join(",");
  return [
    "admin",
    "customers",
    "detail",
    customerId,
    actorId,
    actorRole,
    permKey,
  ] as const;
}

/**
 * Builds a canonical authority key string for comparing operator sessions.
 */
export function buildAuthorityKey(
  actorId = "anonymous",
  actorRole = "unauthenticated",
  permissions: readonly string[] = [],
): string {
  const permKey = [...permissions].sort().join(",");
  return `${actorId}:${actorRole}:${permKey}`;
}

/**
 * Validates whether a given queryKey belongs to the specified authority.
 */
export function isCustomerQueryMatchingAuthority(
  queryKey: readonly unknown[],
  actorId: string,
  actorRole: string,
  permissions: readonly string[] = [],
): boolean {
  if (!Array.isArray(queryKey) || queryKey[0] !== "admin" || queryKey[1] !== "customers") {
    return false;
  }
  const permKey = [...permissions].sort().join(",");
  if (queryKey[2] === "list") {
    return (
      queryKey[3] === actorId &&
      queryKey[4] === actorRole &&
      queryKey[5] === permKey
    );
  }
  if (queryKey[2] === "detail") {
    return (
      queryKey[4] === actorId &&
      queryKey[5] === actorRole &&
      queryKey[6] === permKey
    );
  }
  return false;
}

/**
 * Predicate to identify obsolete customer queries when operator authority changes.
 * Returns true if the query belongs to any prior or mismatched operator authority.
 */
export function isObsoleteCustomerQuery(
  queryKey: readonly unknown[],
  currentActorId: string,
  currentActorRole: string,
  currentPermissions: readonly string[] = [],
): boolean {
  if (!Array.isArray(queryKey) || queryKey[0] !== "admin" || queryKey[1] !== "customers") {
    return false;
  }
  return !isCustomerQueryMatchingAuthority(
    queryKey,
    currentActorId,
    currentActorRole,
    currentPermissions,
  );
}

/**
 * Identifies terminal authorization/authentication errors (401, 403, unauthenticated, forbidden).
 */
export function isTerminalAuthError(
  error: BuyerSafeError | null | undefined,
): boolean {
  if (!error) return false;
  return (
    error.status === 401 ||
    error.status === 403 ||
    error.kind === "unauthenticated" ||
    error.kind === "forbidden"
  );
}

export interface CustomerTerminalStore {
  getSnapshot: () => BuyerSafeError | null;
  subscribe: (listener: () => void) => () => void;
  setError: (error: BuyerSafeError | null) => void;
  clear: () => void;
}

/**
 * External synchronous store to preserve truthful terminal errors across TanStack Query cache purging
 * without violating React Compiler ref rules or triggering synchronous setState-in-effect warnings.
 */
export function createCustomerTerminalStore(): CustomerTerminalStore {
  let currentError: BuyerSafeError | null = null;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => currentError,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setError: (error: BuyerSafeError | null) => {
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

export const adminCustomerListTerminalStore = createCustomerTerminalStore();
export const adminCustomerDetailTerminalStore = createCustomerTerminalStore();

/**
 * Builds a deterministic cache query key that includes actor identity & normalized parameters.
 */
export function buyerListQueryKey(
  query: BuyerListQueryState,
  actorId = "anonymous",
  actorRole = "unauthenticated",
): string {
  return [
    `actor:${actorId}`,
    `role:${actorRole}`,
    `p:${query.page}`,
    `l:${query.limit}`,
    `s:${encodeURIComponent(query.search)}`,
    `active:${query.isActive}`,
    `by:${query.sortBy}`,
    `ord:${query.sortOrder}`,
  ].join("|");
}

export const ADMIN_BUYERS_QUEUE_PATH = "/admin/buyers";

/**
 * Validates a return target string to ensure it strictly points to the Customer queue route.
 * Rejects external hosts, open redirects, non-customer routes, or malformed URLs.
 */
export function validateAdminBuyersReturnTarget(
  target: string | null | undefined,
  fallback: string = ADMIN_BUYERS_QUEUE_PATH,
): string {
  if (!target || typeof target !== "string") return fallback;
  const trimmed = target.trim();
  if (!trimmed) return fallback;

  try {
    // Relative target starting with /admin/buyers
    if (trimmed.startsWith(ADMIN_BUYERS_QUEUE_PATH)) {
      // Must not be a subpath like /admin/buyers/something unless it's strictly query params
      const separator = trimmed.charAt(ADMIN_BUYERS_QUEUE_PATH.length);
      if (separator !== "" && separator !== "?" && separator !== "#") {
        return fallback;
      }
      const parsed = new URL(trimmed, "http://127.0.0.1");
      if (parsed.pathname !== ADMIN_BUYERS_QUEUE_PATH) {
        return fallback;
      }
      return `${parsed.pathname}${parsed.search}`;
    }

    // Absolute URL: verify host matches current origin if running in browser
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const parsed = new URL(trimmed);
      if (typeof window !== "undefined" && window.location?.origin) {
        if (parsed.origin !== window.location.origin) {
          return fallback;
        }
      }
      if (parsed.pathname !== ADMIN_BUYERS_QUEUE_PATH) {
        return fallback;
      }
      return `${parsed.pathname}${parsed.search}`;
    }

    return fallback;
  } catch {
    return fallback;
  }
}

let inMemoryReturnTarget = ADMIN_BUYERS_QUEUE_PATH;

/**
 * Persists the validated queue return target in memory and sessionStorage.
 */
export function setAdminBuyersReturnTarget(target: string): void {
  const validated = validateAdminBuyersReturnTarget(target);
  inMemoryReturnTarget = validated;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem("zogular:admin-buyers-return-target", validated);
    } catch {
      // Ignore storage write failure
    }
  }
}

/**
 * Retrieves the validated queue return target with fallback to /admin/buyers.
 */
export function getAdminBuyersReturnTarget(fallback: string = ADMIN_BUYERS_QUEUE_PATH): string {
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem("zogular:admin-buyers-return-target");
      if (stored) return validateAdminBuyersReturnTarget(stored, fallback);
    } catch {
      // Ignore storage read failure
    }
  }
  return validateAdminBuyersReturnTarget(inMemoryReturnTarget, fallback);
}

/**
 * Validates whether the document referrer represents an approved same-origin Customer queue route.
 * Prevents external open redirects or navigating back to arbitrary pages.
 */
export function canReturnToAdminBuyersQueue(
  referrer: string,
  currentOrigin: string,
  historyLength: number,
): boolean {
  if (historyLength <= 1 || !referrer || !currentOrigin) return false;

  try {
    const previousUrl = new URL(referrer);
    return (
      previousUrl.origin === currentOrigin &&
      previousUrl.pathname === ADMIN_BUYERS_QUEUE_PATH
    );
  } catch {
    return false;
  }
}

/**
 * Maps arbitrary errors to honest, safe user-facing errors.
 */
export function getBuyerSafeError(error: unknown): BuyerSafeError {
  if (error instanceof AdminBuyerContractError) {
    if (error.kind === "non_customer") {
      return {
        kind: "malformed",
        message: "Customer list received non-customer records. Access restricted.",
      };
    }
    return {
      kind: "malformed",
      message: "Customer data was in an unexpected format. Please contact engineering.",
    };
  }

  if (error instanceof ApiError) {
    if (error.status === 400) {
      return {
        kind: "malformed",
        status: 400,
        message: "Invalid query parameters provided. Please adjust your search or filters.",
      };
    }
    if (error.status === 401) {
      return {
        kind: "unauthenticated",
        status: 401,
        message: "Your session has expired. Please sign in again.",
      };
    }
    if (error.status === 403) {
      return {
        kind: "forbidden",
        status: 403,
        message: "You do not have permission to view customer accounts.",
      };
    }
    if (error.status === 404) {
      return {
        kind: "not_found",
        status: 404,
        message: "The requested customer was not found.",
      };
    }
    if (error.status === 408 || error.status === 504) {
      return {
        kind: "timeout",
        status: error.status,
        message: "The server took too long to respond. Please try again.",
      };
    }
    if (error.status === 409) {
      return {
        kind: "unavailable",
        status: 409,
        message: "A conflict occurred while retrieving this record. Please refresh.",
      };
    }
    if (error.status === 429) {
      return {
        kind: "unavailable",
        status: 429,
        message: "Too many requests. Please wait a moment before retrying.",
      };
    }
    if (error.status >= 500) {
      return {
        kind: "unavailable",
        status: error.status,
        message: "Customer services are temporarily unavailable. Please retry shortly.",
      };
    }
    return {
      kind: "unavailable",
      status: error.status,
      message: error.message || "Failed to load customer data.",
    };
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return {
        kind: "timeout",
        message: "Request was cancelled.",
      };
    }
    if (error.message.includes("fetch") || error.message.includes("network")) {
      return {
        kind: "unavailable",
        message: "Network connection lost. Please check your network and retry.",
      };
    }
  }

  return {
    kind: "unavailable",
    message: "An unexpected error occurred while loading customer accounts.",
  };
}

/**
 * Reducer function managing customer list request states, eliminating stale response races.
 */
export function reduceBuyerListRequestState(
  state: BuyerListRequestState,
  action: BuyerListRequestAction,
): BuyerListRequestState {
  switch (action.type) {
    case "request-started": {
      const isSameQuery = state.dataQueryKey === action.queryKey;
      return {
        ...state,
        activeRequestId: action.requestId,
        requestedQueryKey: action.queryKey,
        isLoading: !isSameQuery,
        isRefreshing: isSameQuery,
        error: null,
        // If different query, clear previous data immediately to prevent stale data display
        data: isSameQuery ? state.data : null,
      };
    }

    case "request-succeeded": {
      if (action.requestId !== state.activeRequestId) {
        // Discard stale response race
        return state;
      }
      return {
        ...state,
        data: action.data,
        dataQueryKey: action.queryKey,
        error: null,
        isLoading: false,
        isRefreshing: false,
      };
    }

    case "request-failed": {
      if (action.requestId !== state.activeRequestId) {
        return state;
      }
      const isSameQuery = state.dataQueryKey === action.queryKey;
      return {
        ...state,
        error: action.error,
        isLoading: false,
        isRefreshing: false,
        // Preserve same-query data on recoverable refresh failure, clear on different query
        data: isSameQuery ? state.data : null,
      };
    }

    case "clear":
      return INITIAL_BUYER_LIST_REQUEST_STATE;

    default:
      return state;
  }
}
