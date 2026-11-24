import { ApiError } from "@/services/api";
import {
  AdminVendorApplicationListContractError,
  type AdminVendorApplicationListResponse,
  type AdminVendorApplicationSort,
  type AdminVendorApplicationSortDirection,
} from "@/services/admin/vendor-applications";
import type { SellerApplicationStatus, SellerType } from "@/types/seller";

export const SELLER_LIST_LIMITS = [20, 40, 60] as const;
export const SELLER_LIST_SORTS: readonly AdminVendorApplicationSort[] = [
  "submittedAt",
  "createdAt",
  "updatedAt",
  "storeName",
];
export const SELLER_LIST_STATUSES: readonly SellerApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "NEEDS_INFO",
  "PROVISIONAL",
  "APPROVED",
  "RESTRICTED",
  "SUSPENDED",
  "REJECTED",
];
export const SELLER_LIST_TYPES: readonly SellerType[] = [
  "INDIVIDUAL",
  "REGISTERED_BUSINESS",
];

export interface SellerListQueryState {
  page: number;
  limit: (typeof SELLER_LIST_LIMITS)[number];
  search: string;
  status: SellerApplicationStatus | "all";
  sellerType: SellerType | "all";
  sort: AdminVendorApplicationSort;
  direction: AdminVendorApplicationSortDirection;
}

export interface SellerListSafeError {
  kind: "unauthenticated" | "forbidden" | "timeout" | "unavailable" | "malformed";
  message: string;
}

export interface SellerListRequestState {
  data: AdminVendorApplicationListResponse | null;
  dataQueryKey: string | null;
  error: SellerListSafeError | null;
  activeRequestId: number;
  requestedQueryKey: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
}

export type SellerListRequestAction =
  | { type: "request-started"; requestId: number; queryKey: string }
  | {
      type: "request-succeeded";
      requestId: number;
      queryKey: string;
      data: AdminVendorApplicationListResponse;
    }
  | {
      type: "request-failed";
      requestId: number;
      queryKey: string;
      error: SellerListSafeError;
    };

export const INITIAL_SELLER_LIST_REQUEST_STATE: SellerListRequestState = {
  data: null,
  dataQueryKey: null,
  error: null,
  activeRequestId: 0,
  requestedQueryKey: null,
  isLoading: true,
  isRefreshing: false,
};

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseSellerListQuery(params: URLSearchParams): SellerListQueryState {
  const requestedLimit = positiveInteger(params.get("limit"), 20);
  const requestedStatus = params.get("status") as SellerApplicationStatus | null;
  const requestedSellerType = params.get("sellerType") as SellerType | null;
  const requestedSort = params.get("sort") as AdminVendorApplicationSort | null;
  const requestedDirection = params.get("direction") as AdminVendorApplicationSortDirection | null;

  return {
    page: positiveInteger(params.get("page"), 1),
    limit: SELLER_LIST_LIMITS.includes(requestedLimit as (typeof SELLER_LIST_LIMITS)[number])
      ? requestedLimit as SellerListQueryState["limit"]
      : 20,
    search: (params.get("search") ?? "").trim().slice(0, 120),
    status: requestedStatus && SELLER_LIST_STATUSES.includes(requestedStatus)
      ? requestedStatus
      : "all",
    sellerType: requestedSellerType && SELLER_LIST_TYPES.includes(requestedSellerType)
      ? requestedSellerType
      : "all",
    sort: requestedSort && SELLER_LIST_SORTS.includes(requestedSort)
      ? requestedSort
      : "submittedAt",
    direction: requestedDirection === "asc" ? "asc" : "desc",
  };
}

export function sellerListQueryKey(query: SellerListQueryState): string {
  return [
    query.search,
    query.status,
    query.sellerType,
    query.sort,
    query.direction,
    query.page,
    query.limit,
  ].join("|");
}

export function applySellerListUrlUpdates(
  current: URLSearchParams,
  updates: Partial<Record<keyof SellerListQueryState, string>>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (!value) next.delete(key);
    else next.set(key, value);
  }
  return next;
}

export function getSellerListSafeError(error: unknown): SellerListSafeError {
  if (error instanceof AdminVendorApplicationListContractError) {
    return {
      kind: "malformed",
      message: "The seller queue could not be verified. Try again.",
    };
  }
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        kind: "unauthenticated",
        message: "Your admin access could not be confirmed. Sign in again.",
      };
    }
    if (error.status === 403) {
      return { kind: "forbidden", message: "You do not have access to the seller queue." };
    }
    if (error.status === 408) {
      return { kind: "timeout", message: "The seller queue is taking too long to load. Try again." };
    }
  }
  return { kind: "unavailable", message: "The seller queue is temporarily unavailable. Try again." };
}

export function reduceSellerListRequestState(
  state: SellerListRequestState,
  action: SellerListRequestAction,
): SellerListRequestState {
  if (action.type === "request-started") {
    const refresh = state.dataQueryKey === action.queryKey && state.data !== null;
    return {
      ...state,
      error: null,
      activeRequestId: action.requestId,
      requestedQueryKey: action.queryKey,
      isLoading: !refresh,
      isRefreshing: refresh,
    };
  }

  if (action.requestId !== state.activeRequestId || action.queryKey !== state.requestedQueryKey) {
    return state;
  }

  if (action.type === "request-succeeded") {
    return {
      ...state,
      data: action.data,
      dataQueryKey: action.queryKey,
      error: null,
      isLoading: false,
      isRefreshing: false,
    };
  }

  return {
    ...state,
    error: action.error,
    isLoading: false,
    isRefreshing: false,
  };
}
