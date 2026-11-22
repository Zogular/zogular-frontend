import {
  fetchAdminCatalogProductById,
  fetchAdminCatalogProducts,
  updateSellerProductModeration,
  updateAdminCatalogProductStatus,
  type SellerProductListing,
} from "@/services/seller-catalog";
import { apiClient } from "@/services/api";
import {
  type ProductModerationAction,
  type ProductModerationSignals,
  type ProductModerationStatus,
} from "@/services/product-moderation";
import { parseAdminProductListResponse } from "@/features/admin-products/lib/product-list-contract";
import type {
  AdminProductListResponse,
  AdminProductQueueStatusFilter,
  AdminProductSortBy,
  AdminProductSortOrder,
} from "@/features/admin-products/types/admin-product-list.types";

export type AdminProductStatus = ProductModerationStatus;

export interface AdminProductRecord extends ProductModerationSignals {
  id: string;
  sellerProductId: string;
  name: string;
  sellerStore: string;
  sellerSlug: string;
  categoryName: string;
  subcategoryName: string;
  price: number;
  stock: number;
  status: AdminProductStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  imageUrl: string | null;
  moderationNotes: string | null;
  flags: number;
}

export interface AdminProductReviewInput {
  action: ProductModerationAction;
  note?: string;
}

interface AdminBulkModerationResult {
  count: number;
}

export interface FetchAdminProductsPageInput {
  page?: number;
  limit?: number;
  search?: string;
  status?: AdminProductQueueStatusFilter;
  sortBy?: AdminProductSortBy;
  sortOrder?: AdminProductSortOrder;
}

export const adminProductsApi = {
  /**
   * Fetches a single bounded server page from `/admin/products` matching PR #80.
   * Uses `excludeDrafts=true`, `statusMode=exact` when an explicit status is set,
   * and strict Zod response validation without reading or writing seller-local enrichment.
   */
  async fetchProductsPage(
    params: FetchAdminProductsPageInput = {},
    options: { signal?: AbortSignal } = {},
  ): Promise<AdminProductListResponse> {
    const page = Number.isInteger(params.page) && (params.page ?? 0) > 0 ? params.page! : 1;
    const rawLimit = Number.isInteger(params.limit) ? params.limit! : 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const trimmedSearch = params.search?.trim().slice(0, 120);

    const query: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      excludeDrafts: "true",
      sortBy: params.sortBy ?? "createdAt",
      sortOrder: params.sortOrder ?? "desc",
    };

    if (params.status && params.status !== "all") {
      query.status = params.status;
      query.statusMode = "exact";
    }

    if (trimmedSearch) {
      query.search = trimmedSearch;
    }

    const response = await apiClient<unknown>("/admin/products", {
      method: "GET",
      query,
      cache: "no-store",
      signal: options.signal,
    });

    return parseAdminProductListResponse(response, { excludeDrafts: true });
  },

  async fetchProducts(): Promise<AdminProductRecord[]> {
    const products = await fetchAdminCatalogProducts();
    return products
      .filter((product) => product.status !== "draft")
      .map(toAdminProductRecord)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  async fetchProductsCount(): Promise<number> {
    const response = await apiClient<{ pagination?: { total: number } }>("/admin/products", {
      method: "GET",
      query: { page: 1, limit: 1, excludeDrafts: "true" },
      cache: "no-store",
    });
    return response.pagination?.total ?? 0;
  },

  async fetchProductById(productId: string): Promise<SellerProductListing> {
    const product = await fetchAdminCatalogProductById(productId);
    return product;
  },

  async reviewProduct(
    productId: string,
    input: AdminProductReviewInput,
  ): Promise<AdminProductRecord> {
    const updated = await updateSellerProductModeration(productId, {
      action: input.action,
      status: "pending_review",
      moderationNotes: input.note?.trim() || null,
      reviewedBy: "admin",
    });

    return toAdminProductRecord(updated);
  },

  async updateProductStatus(
    productId: string,
    status: ProductModerationStatus,
  ): Promise<AdminProductRecord> {
    const backendStatus = status === "published" ? "PUBLISHED" : status === "suspended" ? "SUSPENDED" : status.toUpperCase();
    const updated = await updateAdminCatalogProductStatus(productId, backendStatus);
    return toAdminProductRecord(updated);
  },

  async bulkReviewProducts(
    productIds: string[],
    input: AdminProductReviewInput,
  ): Promise<AdminBulkModerationResult> {
    if (input.action === "approve") {
      const response = await apiClient<{ data?: { count?: number } }>("/admin/products/bulk-approve", {
        method: "POST",
        body: JSON.stringify({ productIds }),
        csrf: true,
      });

      return { count: response.data?.count ?? 0 };
    }

    const reason =
      input.note?.trim() ||
      (input.action === "request_changes"
        ? "Admin requested changes before approval."
        : "Product rejected during bulk moderation.");

    const response = await apiClient<{ data?: { count?: number } }>("/admin/products/bulk-reject", {
      method: "POST",
      body: JSON.stringify({ productIds, reason }),
      csrf: true,
    });

    return { count: response.data?.count ?? 0 };
  },
};

function toAdminProductRecord(product: SellerProductListing): AdminProductRecord {
  const moderation = product.moderation;
  return {
    id: product.id,
    sellerProductId: product.id,
    name: product.title,
    sellerStore: product.seller.name,
    sellerSlug: product.seller.slug,
    categoryName: product.categoryName,
    subcategoryName: product.subcategoryName,
    price: product.salePrice ?? product.price,
    stock: product.stock,
    status: product.status,
    submittedAt: moderation?.submittedAt ?? null,
    reviewedAt: moderation?.reviewedAt ?? null,
    updatedAt: product.updatedAt,
    imageUrl: product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? null,
    moderationNotes: moderation?.moderationNotes ?? null,
    moderationFlags: moderation?.moderationFlags ?? [],
    riskScore: moderation?.riskScore ?? null,
    duplicateWarnings: moderation?.duplicateWarnings ?? [],
    categorySuggestions: moderation?.categorySuggestions ?? [],
    imageSafetyWarnings: moderation?.imageSafetyWarnings ?? [],
    flags:
      (moderation?.moderationFlags?.length ?? 0) +
      (moderation?.duplicateWarnings?.length ?? 0) +
      (moderation?.imageSafetyWarnings?.length ?? 0),
  };
}
