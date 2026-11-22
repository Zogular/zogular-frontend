/**
 * @file admin-product-list.types.ts
 * @module features/admin-products/types
 * @description
 * Types for the bounded Admin Product Moderation list workspace (PM-F1 READ).
 * Strictly models the PR #80 `getAllProductsAdmin` and `serializeAdminProductRecord`
 * response contracts without relying on seller-local enrichment or fabricated fields.
 */

export type AdminProductBackendStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "PUBLISHED"
  | "PAUSED"
  | "SUSPENDED";

export type AdminProductQueueStatusFilter =
  | "all"
  | "PENDING_REVIEW"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "PUBLISHED"
  | "PAUSED"
  | "SUSPENDED";

export type AdminProductSortBy =
  | "createdAt"
  | "updatedAt"
  | "price"
  | "views"
  | "title";

export type AdminProductSortOrder = "asc" | "desc";

export type AdminProductViewMode = "list" | "grid";

export interface AdminProductListPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminProductListSeller {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  telephone: string | null;
  /** True when the backend omitted firstName/lastName due to permission masking. */
  identityMasked: boolean;
  /** True when the backend omitted email/telephone due to permission masking. */
  contactMasked: boolean;
}

export interface AdminProductListItem {
  id: string;
  userId: string;
  title: string;
  slug: string;
  sku: string | null;
  status: AdminProductBackendStatus;
  price: number;
  salePrice: number | null;
  stock: number | null;
  isSold: boolean;
  isApproved: boolean;
  categoryLabel: string;
  subcategoryLabel: string | null;
  primaryImageUrl: string | null;
  seller: AdminProductListSeller;
  rejectionReason: string | null;
  reviewNotes: string | null;
  views: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

export interface AdminProductListResponse {
  status: "success";
  results: number;
  pagination: AdminProductListPagination;
  items: AdminProductListItem[];
}

export interface AdminProductListQueryParams {
  page: number;
  limit: number;
  search?: string;
  status?: Exclude<AdminProductQueueStatusFilter, "all">;
  statusMode?: "exact";
  excludeDrafts: true;
  sortBy: AdminProductSortBy;
  sortOrder: AdminProductSortOrder;
}

export type AdminProductListSafeErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "timeout"
  | "malformed"
  | "rate_limited"
  | "unavailable";

export interface AdminProductListSafeError {
  kind: AdminProductListSafeErrorKind;
  message: string;
  status?: number;
}
