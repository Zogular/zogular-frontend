/**
 * @file product-list-state.ts
 * @module features/admin-products/lib
 * @description
 * URL query-state parsing, serialization, and return-target sanitization
 * for the Admin Products Moderation queue (PM-F1 READ).
 *
 * Contract bounds (PR #80):
 * - limit: 1..100 (allowed presets: 20, 50, 100; default 20)
 * - page: positive safe integer with (page - 1) * limit <= 4_294_967_295
 * - search: trimmed string <= 120 chars
 * - status: canonical non-draft status with statusMode=exact; omitted for "all"
 * - sortBy: createdAt | updatedAt | price | views | title (default createdAt)
 * - sortOrder: asc | desc (default desc)
 */

import type {
  AdminProductQueueStatusFilter,
  AdminProductSortBy,
  AdminProductSortOrder,
  AdminProductViewMode,
} from "../types/admin-product-list.types";

export const ADMIN_PRODUCTS_QUEUE_PATH = "/admin/products" as const;
export const MAX_PRISMA_SKIP = 4_294_967_295;
export const PRODUCT_LIST_LIMITS = [20, 50, 100] as const;
export const PRODUCT_LIST_SEARCH_MAX_LENGTH = 120;

export const PRODUCT_LIST_STATUS_OPTIONS: ReadonlyArray<{
  value: AdminProductQueueStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All Non-Draft" },
  { value: "PENDING_REVIEW", label: "Pending Review" },
  { value: "NEEDS_CHANGES", label: "Needs Changes" },
  { value: "APPROVED", label: "Approved" },
  { value: "PUBLISHED", label: "Published" },
  { value: "PAUSED", label: "Paused" },
  { value: "SUSPENDED", label: "Suspended" },
] as const;

export const PRODUCT_LIST_SORTS: readonly AdminProductSortBy[] = [
  "createdAt",
  "updatedAt",
  "price",
  "views",
  "title",
];

export interface ProductListQueryState {
  page: number;
  limit: (typeof PRODUCT_LIST_LIMITS)[number];
  search: string;
  status: AdminProductQueueStatusFilter;
  sortBy: AdminProductSortBy;
  sortOrder: AdminProductSortOrder;
  view: AdminProductViewMode;
}

const VALID_EXACT_STATUSES = new Set<string>([
  "PENDING_REVIEW",
  "NEEDS_CHANGES",
  "APPROVED",
  "PUBLISHED",
  "PAUSED",
  "SUSPENDED",
]);

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value || !/^[1-9]\d*$/.test(value.trim())) return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseProductListQuery(params: URLSearchParams): ProductListQueryState {
  const rawLimit = parsePositiveInteger(params.get("limit"), 20);
  const limit = PRODUCT_LIST_LIMITS.includes(rawLimit as (typeof PRODUCT_LIST_LIMITS)[number])
    ? (rawLimit as ProductListQueryState["limit"])
    : 20;

  const rawPage = parsePositiveInteger(params.get("page"), 1);
  const maxSafePage = Math.floor(MAX_PRISMA_SKIP / limit) + 1;
  const page = rawPage <= maxSafePage ? rawPage : 1;

  const rawStatus = params.get("status")?.trim().toUpperCase() ?? "all";
  const status: AdminProductQueueStatusFilter = VALID_EXACT_STATUSES.has(rawStatus)
    ? (rawStatus as AdminProductQueueStatusFilter)
    : "all";

  const rawSortBy = params.get("sortBy") as AdminProductSortBy | null;
  const sortBy: AdminProductSortBy =
    rawSortBy && PRODUCT_LIST_SORTS.includes(rawSortBy) ? rawSortBy : "createdAt";

  const sortOrder: AdminProductSortOrder =
    params.get("sortOrder") === "asc" ? "asc" : "desc";

  const view: AdminProductViewMode =
    params.get("view") === "grid" ? "grid" : "list";

  const search = (params.get("search") ?? "")
    .trim()
    .slice(0, PRODUCT_LIST_SEARCH_MAX_LENGTH);

  return {
    page,
    limit,
    search,
    status,
    sortBy,
    sortOrder,
    view,
  };
}

export function applyProductListUrlUpdates(
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

function serializeProductListQuery(state: ProductListQueryState): string {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.limit !== 20) params.set("limit", String(state.limit));
  if (state.status !== "all") params.set("status", state.status);
  if (state.search) params.set("search", state.search);
  if (state.sortBy !== "createdAt") params.set("sortBy", state.sortBy);
  if (state.sortOrder !== "desc") params.set("sortOrder", state.sortOrder);
  if (state.view !== "list") params.set("view", state.view);
  const query = params.toString();
  return query ? `${ADMIN_PRODUCTS_QUEUE_PATH}?${query}` : ADMIN_PRODUCTS_QUEUE_PATH;
}

/**
 * Sanitizes a returnTo parameter so navigation back from product detail can ONLY
 * target the same-origin `/admin/products` queue with validated query parameters.
 * Rejects foreign origins, protocol-relative URLs (`//...`), nested paths, and schemes.
 */
export function validateAdminProductsReturnTarget(
  target: string | null | undefined,
  fallback: string = ADMIN_PRODUCTS_QUEUE_PATH,
): string {
  if (!target || typeof target !== "string") return fallback;
  const trimmed = target.trim();
  if (!trimmed) return fallback;

  // Reject protocol-relative or backslash-escaped targets immediately
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("\\")) {
    return fallback;
  }

  // Only allow relative `/admin/products` or `/admin/products?...`
  if (!trimmed.startsWith(ADMIN_PRODUCTS_QUEUE_PATH)) {
    return fallback;
  }

  const nextChar = trimmed.charAt(ADMIN_PRODUCTS_QUEUE_PATH.length);
  if (nextChar !== "" && nextChar !== "?" && nextChar !== "#") {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, "http://127.0.0.1");
    if (parsed.origin !== "http://127.0.0.1" || parsed.pathname !== ADMIN_PRODUCTS_QUEUE_PATH) {
      return fallback;
    }
    const normalizedState = parseProductListQuery(parsed.searchParams);
    return serializeProductListQuery(normalizedState);
  } catch {
    return fallback;
  }
}

export function buildProductDetailHref(productId: string, returnTo: string): string {
  const safeId = encodeURIComponent(productId);
  const safeReturnTo = validateAdminProductsReturnTarget(returnTo);
  if (safeReturnTo === ADMIN_PRODUCTS_QUEUE_PATH) {
    return `/admin/products/${safeId}`;
  }
  return `/admin/products/${safeId}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
