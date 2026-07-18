import type { Product } from "@/types/product";
import { apiClient } from "@/services/api";
import {
  fetchSellerCatalogProductPage,
  type SellerProductFacets,
  type SellerProductListQuery,
  type SellerProductPagination,
  type SellerProductSummary,
  type SellerProductListing,
} from "@/services/seller-catalog";

export interface Category {
  id: string;
  name: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  stock: number;
}

export interface InventoryProduct
  extends Omit<
    Product,
    "id" | "title" | "name" | "categoryName" | "subcategoryName" | "image"
  > {
  id: string;
  name: string;
  image: string | null;
  category: Category;
  sku: string;
  stock: number;
  isSold: boolean;
  threshold: number;
  lastUpdated: string;
  hasVariants: boolean;
  variants: ProductVariant[];
}

export interface InventoryListResult {
  products: InventoryProduct[];
  pagination: SellerProductPagination;
  summary: SellerProductSummary;
  facets: SellerProductFacets;
}

export type InventoryListQuery = SellerProductListQuery;

export interface InventoryMutationDto {
  id: string;
  stock: number;
  isSold: boolean;
  updatedAt: string;
}

export type RawInventoryData = {
  id?: string | number;
  slug?: string;
  name?: string;
  image?: string | null;
  price?: string | number;
  oldPrice?: string | number | null;
  originalPrice?: string | number | null;
  discount?: string | number | null;
  badge?: string | null;
  rating?: string | number;
  reviews?: string | number;
  category?: { id?: string; name?: string } | string;
  categoryId?: string;
  categoryName?: string;
  sku?: string;
  stock?: string | number | null;
  isSold?: boolean;
  legacySingleItem?: boolean;
  threshold?: string | number;
  lastUpdated?: string;
  hasVariants?: boolean;
  variants?: Array<{
    id?: string | number;
    name?: string;
    sku?: string;
    stock?: string | number;
  }>;
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toSafeString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCategory(raw: RawInventoryData): Category {
  if (typeof raw.category === "object" && raw.category !== null) {
    return {
      id: toSafeString(raw.category.id, "unknown"),
      name: toSafeString(raw.category.name, "Uncategorized"),
    };
  }

  if (typeof raw.category === "string") {
    return {
      id: toSafeString(raw.categoryId, slugify(raw.category) || "unknown"),
      name: raw.category,
    };
  }

  if (raw.categoryName) {
    return {
      id: toSafeString(raw.categoryId, slugify(raw.categoryName) || "unknown"),
      name: raw.categoryName,
    };
  }

  return {
    id: toSafeString(raw.categoryId, "unknown"),
    name: "Uncategorized",
  };
}

function normalizeVariants(raw: RawInventoryData): ProductVariant[] {
  if (!Array.isArray(raw.variants)) return [];

  return raw.variants.map((variant, index) => ({
    id: String(variant.id ?? `${raw.id ?? "product"}-variant-${index + 1}`),
    name: toSafeString(variant.name, `Variant ${index + 1}`),
    sku: toSafeString(variant.sku, ""),
    stock: Math.max(0, toNumber(variant.stock, 0)),
  }));
}

export function normalizeInventoryProduct(raw: RawInventoryData): InventoryProduct {
  const category = normalizeCategory(raw);
  const name = toSafeString(raw.name, "Unknown Product");
  const id = String(raw.id ?? "");
  const variants = normalizeVariants(raw);
  const stock = raw.legacySingleItem ? 1 : Math.max(0, toNumber(raw.stock, 0));

  return {
    id,
    slug: toSafeString(raw.slug, slugify(name || id || "product")),
    name,
    image: raw.image ?? null,
    price: Math.max(0, toNumber(raw.price, 0)),
    oldPrice:
      raw.oldPrice === null || raw.oldPrice === undefined
        ? null
        : Math.max(0, toNumber(raw.oldPrice, 0)),
    originalPrice:
      raw.originalPrice === null || raw.originalPrice === undefined
        ? null
        : Math.max(0, toNumber(raw.originalPrice, 0)),
    discount:
      raw.discount === null || raw.discount === undefined
        ? null
        : Math.max(0, toNumber(raw.discount, 0)),
    badge: raw.badge ?? null,
    rating: Math.max(0, toNumber(raw.rating, 0)),
    reviews: Math.max(0, toNumber(raw.reviews, 0)),
    category,
    sku: toSafeString(raw.sku, `SKU-${id || "UNKNOWN"}`),
    stock,
    isSold: raw.isSold === true,
    threshold: Math.max(0, toNumber(raw.threshold, 5)),
    lastUpdated: toSafeString(raw.lastUpdated, new Date().toISOString()),
    hasVariants: Boolean(raw.hasVariants || variants.length > 0),
    variants,
  };
}

function mapSellerProductToInventory(product: SellerProductListing): InventoryProduct {
  return normalizeInventoryProduct({
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.title,
    category: { id: product.categorySlug, name: product.categoryName },
    image: product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? null,
    price: product.salePrice ?? product.price,
    originalPrice: product.salePrice ? product.price : null,
    stock: product.stock,
    isSold: product.isSold,
    legacySingleItem: product.isLegacySingleItem,
    threshold: product.lowStockThreshold,
    lastUpdated: product.updatedAt,
    hasVariants: product.variants.length > 1,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: `${variant.label}: ${variant.value}`,
      sku: variant.sku,
      stock: variant.stock,
    })),
    rating: 0,
    reviews: 0,
    badge: product.status === "pending_review" ? "Pending Review" : null,
  });
}

type SingleInventoryMutationResponse = {
  status: string;
  data: { inventory: InventoryMutationDto };
};

type BulkInventoryMutationResponse = {
  status: string;
  data: { inventory: InventoryMutationDto[] };
};

export const inventoryApi = {
  async fetchPage(query: InventoryListQuery): Promise<InventoryListResult> {
    const result = await fetchSellerCatalogProductPage(query);
    return {
      products: result.products.map(mapSellerProductToInventory),
      pagination: result.pagination,
      summary: result.summary,
      facets: result.facets,
    };
  },

  async fetchAll(): Promise<InventoryProduct[]> {
    const result = await this.fetchPage({ page: 1, limit: 100 });
    return result.products;
  },

  async updateStock(id: string, newStock: number): Promise<InventoryMutationDto> {
    const response = await apiClient<SingleInventoryMutationResponse>(`/vendor/products/${id}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ stock: newStock }),
      csrf: true,
    });
    return response.data.inventory;
  },

  async bulkUpdateStock(
    ids: string[],
    newStock: number,
  ): Promise<InventoryMutationDto[]> {
    const response = await apiClient<BulkInventoryMutationResponse>("/vendor/products/inventory/bulk", {
      method: "PATCH",
      body: JSON.stringify({ productIds: ids, stock: newStock }),
      csrf: true,
    });
    return response.data.inventory;
  },
};
