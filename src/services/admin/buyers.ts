/**
 * @file buyers.ts
 * @module services/admin/buyers
 * @description
 * HTTP client service layer for the Admin Customers management workspace (CM-F1).
 * Calls the authoritative backend routes:
 * - GET /api/v1/admin/users (filtered by role=CUSTOMER)
 * - GET /api/v1/admin/users/:id
 *
 * Runtime Validation & Safety:
 * - Employs strict response validation via `validateBuyerListResponse` and `validateBuyerDetailResponse`.
 * - Rejects non-customer records with `AdminBuyerContractError`.
 * - Supports request cancellation via `AbortSignal`.
 */

import { apiClient } from "@/services/api";
import {
  validateBuyerListResponse,
  validateBuyerDetailResponse,
} from "@/features/admin-buyers/lib/buyer-contract";
import type {
  AdminBuyerRecord,
  AdminBuyerDetailRecord,
  AdminBuyersPagination,
  AdminBuyerListResponse,
  AdminBuyerDetailResponse,
  AdminBuyerListQueryParams,
} from "@/features/admin-buyers/types/admin-buyer.types";

export type {
  AdminBuyerRecord,
  AdminBuyerDetailRecord,
  AdminBuyersPagination,
  AdminBuyerListResponse,
  AdminBuyerDetailResponse,
  AdminBuyerListQueryParams,
};

// Backwards-compatible type alias for previous consumers
export type BuyersPagination = AdminBuyersPagination;

/**
 * Fetches the paginated customer list with server-side search, filtering, and sorting.
 */
export async function fetchAdminBuyers(
  queryParams: AdminBuyerListQueryParams,
  options?: { signal?: AbortSignal },
): Promise<AdminBuyerListResponse> {
  const query: Record<string, string | number | boolean | undefined> = {
    role: "CUSTOMER",
    page: Math.max(1, queryParams.page),
    limit: Math.min(100, Math.max(1, queryParams.limit)),
  };

  if (queryParams.search && queryParams.search.trim().length > 0) {
    query.search = queryParams.search.trim().slice(0, 120);
  }

  if (queryParams.isActive !== undefined) {
    query.isActive = queryParams.isActive;
  }

  if (queryParams.sortBy) {
    query.sortBy = queryParams.sortBy;
  }

  if (queryParams.sortOrder) {
    query.sortOrder = queryParams.sortOrder;
  }

  const response = await apiClient<unknown>("/admin/users", {
    method: "GET",
    query,
    signal: options?.signal,
  });

  return validateBuyerListResponse(response);
}

/**
 * Fetches a single customer record by ID.
 */
export async function fetchAdminBuyerById(
  id: string,
  options?: { signal?: AbortSignal },
): Promise<AdminBuyerDetailResponse> {
  const cleanId = id.trim();
  if (!cleanId) {
    throw new Error("Customer ID is required");
  }

  const response = await apiClient<unknown>(`/admin/users/${encodeURIComponent(cleanId)}`, {
    method: "GET",
    signal: options?.signal,
  });

  return validateBuyerDetailResponse(response);
}

/**
 * Legacy wrapper object maintained for backwards compatibility.
 */
export const adminBuyersApi = {
  async fetchBuyers(
    page = 1,
    limit = 20,
    options?: { signal?: AbortSignal },
  ): Promise<{ buyers: AdminBuyerRecord[]; pagination: AdminBuyersPagination }> {
    const result = await fetchAdminBuyers({ page, limit }, options);
    return {
      buyers: result.data.users,
      pagination: result.pagination,
    };
  },
  fetchBuyerById: fetchAdminBuyerById,
};
