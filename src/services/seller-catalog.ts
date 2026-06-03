import type { Product, ProductDetail, ProductSpec, ProductVariant } from "@/types/product";
import { apiClient } from "@/services/api";
import { type ProductAttributeInput } from "@/services/categories-api";
import {
  type ProductModerationAction,
  type ProductModerationState,
  type ProductModerationStatus,
} from "@/services/product-moderation";

export type SellerProductStatus = ProductModerationStatus;
export type ProductCondition = "new" | "used-like-new" | "used-good" | "refurbished";

export interface SellerCatalogCategory {
  name: string;
  slug: string;
  subcategories: Array<{ name: string; slug: string }>;
}

export interface SellerProductImage {
  id: string;
  url: string;
  name: string;
  alt?: string;
  isPrimary: boolean;
  publicId?: string;
  sortOrder?: number;
  originalWidth?: number;
  originalHeight?: number;
  processedWidth?: number;
  processedHeight?: number;
  wasAutoCropped?: boolean;
  linkedVariantValue?: string;
  uploadStatus?: "idle" | "uploading" | "uploaded" | "failed";
  uploadError?: string;
  localPreviewUrl?: string;
}

export interface SellerProductVariant {
  id: string;
  label: "Color" | "Size" | "Option";
  value: string;
  sku: string;
  stock: number;
  swatchClass?: string;
}

export interface SellerProductSpecification {
  name: string;
  value: string;
}

export interface SellerProductListing {
  id: string;
  slug: string;
  title: string;
  brand: string;
  condition: ProductCondition;
  description: string;
  categoryName: string;
  categorySlug: string;
  subcategoryName: string;
  subcategorySlug: string;
  status: SellerProductStatus;
  price: number;
  salePrice: number | null;
  stock: number;
  lowStockThreshold: number;
  sku: string;
  images: SellerProductImage[];
  deliveryType: "standard" | "express";
  logistics: {
    weightKG: number;
    dimensions: string;
  };
  variants: SellerProductVariant[];
  attributes?: ProductAttributeInput[];
  specifications: SellerProductSpecification[];
  seo: {
    metaTitle: string;
    metaDescription: string;
  };
  seller: {
    name: string;
    slug: string;
    verified: boolean;
  };
  moderation?: ProductModerationState;
  createdAt: string;
  updatedAt: string;
}

export type CreateSellerProductInput = Omit<
  SellerProductListing,
  "id" | "slug" | "createdAt" | "updatedAt" | "seller"
> & {
  seller?: Partial<SellerProductListing["seller"]>;
};

export type UpdateSellerProductInput = Partial<
  Omit<SellerProductListing, "id" | "slug" | "createdAt" | "updatedAt" | "seller">
>;

export interface SellerProductModerationInput extends ProductModerationState {
  action?: ProductModerationAction;
  status: SellerProductStatus;
}

type BackendProductStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "PUBLISHED"
  | "PAUSED"
  | "SUSPENDED"
  | "REJECTED";

type BackendProductCondition = "NEW" | "USED";
type BackendDeliveryType = "STANDARD" | "EXPRESS";
type BackendLegacyCategory =
  | "PHONES"
  | "LAPTOPS"
  | "ACCESSORIES"
  | "FASHIONS"
  | "ELECTRONICS"
  | "OTHERS";

type BackendProductImage = {
  url: string;
  publicId?: string | null;
  alt?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
  linkedVariantValue?: string | null;
  width?: number | null;
  height?: number | null;
};

type BackendCategoryRef = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

type BackendAttributeValue = {
  id?: string;
  attributeId: string;
  slug: string;
  name: string;
  value: string;
};

type BackendVendorProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  salePrice: number | null;
  images: BackendProductImage[] | string[];
  condition: BackendProductCondition;
  category: BackendLegacyCategory;
  status: BackendProductStatus;
  location?: string | null;
  sku?: string | null;
  stock?: number | null;
  lowStockThreshold?: number | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  subcategorySlug?: string | null;
  deliveryType?: BackendDeliveryType | null;
  weightKG?: number | null;
  dimensions?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  brand?: string | null;
  model?: string | null;
  ram?: string | null;
  storage?: string | null;
  batteryHealth?: string | null;
  size?: string | null;
  color?: string | null;
  material?: string | null;
  compatibility?: string | null;
  isApproved: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  };
  categoryRef?: BackendCategoryRef | null;
  attributeValues?: BackendAttributeValue[];
};

type BackendListResponse = {
  status: string;
  results: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  data: {
    products: BackendVendorProduct[];
  };
};

type BackendDetailResponse = {
  status: string;
  data: {
    product: BackendVendorProduct;
  };
};

type SellerProductEnrichment = {
  categoryName?: string;
  subcategoryName?: string;
  condition?: ProductCondition;
  variants?: SellerProductVariant[];
  specifications?: SellerProductSpecification[];
  seo?: SellerProductListing["seo"];
  moderation?: ProductModerationState;
  seller?: SellerProductListing["seller"];
};

const SELLER_PRODUCT_ENRICHMENT_STORAGE_KEY = "zogular-seller-product-enrichments";
const DEFAULT_SELLER = { name: "Zogular Store", slug: "zogular-official", verified: true };
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1200&q=80";
const SELLER_PRODUCTS_QUERY_LIMIT = 100;

let sellerCatalogSnapshot: SellerProductListing[] = [];

export const SELLER_CATALOG_CATEGORIES: SellerCatalogCategory[] = [
  {
    name: "Phones & Tablets",
    slug: "phones-and-tablets",
    subcategories: [
      { name: "Smartphones", slug: "smartphones" },
      { name: "Tablets", slug: "tablets" },
      { name: "Accessories", slug: "accessories" },
    ],
  },
  {
    name: "Computing",
    slug: "computing",
    subcategories: [
      { name: "Laptops", slug: "laptops" },
      { name: "Desktops", slug: "desktops" },
      { name: "PC Accessories", slug: "accessories" },
    ],
  },
  {
    name: "Fashion",
    slug: "fashion",
    subcategories: [
      { name: "Men's Fashion", slug: "mens-fashion" },
      { name: "Women's Fashion", slug: "womens-fashion" },
      { name: "Footwear", slug: "footwear" },
    ],
  },
  {
    name: "Supermarket",
    slug: "supermarket",
    subcategories: [
      { name: "Beverages", slug: "beverages" },
      { name: "Snacks", slug: "snacks" },
      { name: "Pantry Staples", slug: "staples" },
    ],
  },
  {
    name: "Electronics",
    slug: "electronics",
    subcategories: [
      { name: "Audio & Headphones", slug: "audio-and-headphones" },
      { name: "TVs & Entertainment", slug: "tvs-and-entertainment" },
      { name: "Cameras", slug: "cameras" },
    ],
  },
  {
    name: "Health & Beauty",
    slug: "health-and-beauty",
    subcategories: [
      { name: "Beauty", slug: "beauty" },
      { name: "Personal Care", slug: "personal-care" },
      { name: "Vitamins", slug: "vitamins" },
    ],
  },
  {
    name: "Sports & Outdoors",
    slug: "sports-and-outdoors",
    subcategories: [
      { name: "Fitness", slug: "fitness" },
      { name: "Outdoor Gear", slug: "outdoor-gear" },
      { name: "Team Sports", slug: "team-sports" },
    ],
  },
  {
    name: "Home & Living",
    slug: "home-and-living",
    subcategories: [
      { name: "Furniture", slug: "furniture" },
      { name: "Home Decor", slug: "home-decor" },
      { name: "Kitchenware", slug: "kitchenware" },
    ],
  },
];

export const SELLER_CATEGORY_TREE = SELLER_CATALOG_CATEGORIES.reduce<Record<string, string[]>>(
  (tree, category) => {
    tree[category.name] = category.subcategories.map((subcategory) => subcategory.name);
    return tree;
  },
  {},
);

export async function fetchSellerCatalogProducts(): Promise<SellerProductListing[]> {
  const response = await apiClient<BackendListResponse>("/vendor/products", {
    method: "GET",
    query: { page: 1, limit: SELLER_PRODUCTS_QUERY_LIMIT },
  });

  const products = response.data.products.map(normalizeBackendSellerProduct);
  setSellerCatalogSnapshot(products);
  return products;
}

export async function fetchSellerCatalogProductById(
  productId: string,
): Promise<SellerProductListing> {
  const response = await apiClient<BackendDetailResponse>(`/vendor/products/${productId}`, {
    method: "GET",
  });

  const product = normalizeBackendSellerProduct(response.data.product);
  upsertSellerCatalogSnapshot(product);
  return product;
}

export async function createSellerCatalogProduct(
  input: CreateSellerProductInput,
): Promise<SellerProductListing> {
  const response = await apiClient<BackendDetailResponse>("/vendor/products", {
    method: "POST",
    body: JSON.stringify(buildBackendProductPayload(input, "create")),
    csrf: true,
  });

  persistSellerProductEnrichment(response.data.product.id, buildEnrichmentFromCreateInput(input));
  let product = normalizeBackendSellerProduct(response.data.product);

  if (input.status === "pending_review") {
    product = await submitSellerProductForReview(product.id);
  }

  upsertSellerCatalogSnapshot(product);
  return product;
}

export async function updateSellerProductStatus(
  productId: string,
  status: SellerProductStatus,
): Promise<SellerProductListing> {
  if (status === "pending_review") {
    return submitSellerProductForReview(productId);
  }

  if (status === "paused") {
    return pauseSellerProduct(productId);
  }

  if (status === "draft") {
    const currentProduct = await fetchSellerCatalogProductById(productId);

    if (currentProduct.status === "pending_review") {
      return withdrawSellerProductReview(productId);
    }

    if (
      currentProduct.status === "approved" ||
      currentProduct.status === "published"
    ) {
      return unpublishSellerProduct(productId);
    }

    return updateSellerCatalogProduct(productId, { status: "draft" });
  }

  throw new Error(`Unsupported seller status transition: ${status}`);
}

export async function updateSellerCatalogProduct(
  productId: string,
  input: UpdateSellerProductInput,
): Promise<SellerProductListing> {
  const currentProduct = await fetchSellerCatalogProductById(productId);
  const persistStatus = resolvePersistStatus(input.status ?? currentProduct.status);
  const response = await apiClient<BackendDetailResponse>(`/vendor/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(buildBackendProductPayload({ ...currentProduct, ...input, status: persistStatus }, "update")),
    csrf: true,
  });

  persistSellerProductEnrichment(
    productId,
    mergeSellerProductEnrichment(
      readSellerProductEnrichment(productId),
      buildEnrichmentFromUpdateInput(currentProduct, input),
    ),
  );

  let product = normalizeBackendSellerProduct(response.data.product);

  if (input.status === "pending_review") {
    product = await submitSellerProductForReview(product.id);
  }

  upsertSellerCatalogSnapshot(product);
  return product;
}

export async function updateSellerProductModeration(
  productId: string,
  input: SellerProductModerationInput,
): Promise<SellerProductListing> {
  if (!input.action) {
    return updateSellerProductStatus(productId, input.status);
  }

  if (input.action === "approve") {
    const response = await apiClient<BackendDetailResponse>(`/admin/products/${productId}/approve`, {
      method: "PATCH",
      body: JSON.stringify({}),
      csrf: true,
    });
    const product = normalizeBackendSellerProduct(response.data.product);
    upsertSellerCatalogSnapshot(product);
    return product;
  }

  const response = await apiClient<BackendDetailResponse>(`/admin/products/${productId}/reject`, {
    method: "PATCH",
    body: JSON.stringify({
      reason: input.moderationNotes?.trim() || "Admin requested changes before approval.",
    }),
    csrf: true,
  });

  persistSellerProductEnrichment(
    productId,
    mergeSellerProductEnrichment(readSellerProductEnrichment(productId), {
      moderation: {
        ...input,
        moderationNotes: input.moderationNotes?.trim() || "Admin requested changes before approval.",
      },
    }),
  );

  const product = normalizeBackendSellerProduct(response.data.product);
  upsertSellerCatalogSnapshot(product);
  return product;
}

export async function duplicateSellerProduct(
  productId: string,
): Promise<SellerProductListing> {
  const sourceProduct = await fetchSellerCatalogProductById(productId);
  const response = await apiClient<BackendDetailResponse>(`/vendor/products/${productId}/duplicate`, {
    method: "POST",
    body: JSON.stringify({}),
    csrf: true,
  });

  const sourceEnrichment = readSellerProductEnrichment(sourceProduct.id);
  persistSellerProductEnrichment(
    response.data.product.id,
    sourceEnrichment
      ? {
          ...sourceEnrichment,
          moderation: undefined,
        }
      : {
          categoryName: sourceProduct.categoryName,
          subcategoryName: sourceProduct.subcategoryName,
          condition: sourceProduct.condition,
          variants: sourceProduct.variants,
          specifications: sourceProduct.specifications,
          seo: sourceProduct.seo,
          seller: sourceProduct.seller,
        },
  );

  const product = normalizeBackendSellerProduct(response.data.product);
  upsertSellerCatalogSnapshot(product, { prepend: true });
  return product;
}

export async function submitSellerProductForReview(
  productId: string,
): Promise<SellerProductListing> {
  const response = await apiClient<BackendDetailResponse>(`/vendor/products/${productId}/submit-review`, {
    method: "PATCH",
    body: JSON.stringify({}),
    csrf: true,
  });

  const product = normalizeBackendSellerProduct(response.data.product);
  upsertSellerCatalogSnapshot(product);
  return product;
}

export async function withdrawSellerProductReview(
  productId: string,
): Promise<SellerProductListing> {
  const response = await apiClient<BackendDetailResponse>(`/vendor/products/${productId}/withdraw-review`, {
    method: "PATCH",
    body: JSON.stringify({}),
    csrf: true,
  });

  const product = normalizeBackendSellerProduct(response.data.product);
  upsertSellerCatalogSnapshot(product);
  return product;
}

export async function pauseSellerProduct(
  productId: string,
): Promise<SellerProductListing> {
  const response = await apiClient<BackendDetailResponse>(`/vendor/products/${productId}/pause`, {
    method: "PATCH",
    body: JSON.stringify({}),
    csrf: true,
  });

  const product = normalizeBackendSellerProduct(response.data.product);
  upsertSellerCatalogSnapshot(product);
  return product;
}

export async function unpublishSellerProduct(
  productId: string,
): Promise<SellerProductListing> {
  const response = await apiClient<BackendDetailResponse>(`/vendor/products/${productId}/unpublish`, {
    method: "PATCH",
    body: JSON.stringify({}),
    csrf: true,
  });

  const product = normalizeBackendSellerProduct(response.data.product);
  upsertSellerCatalogSnapshot(product);
  return product;
}

export async function removeSellerProduct(productId: string): Promise<void> {
  await apiClient(`/vendor/products/${productId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
    csrf: true,
  });

  deleteSellerProductEnrichment(productId);
  sellerCatalogSnapshot = sellerCatalogSnapshot.filter((product) => product.id !== productId);
}

export function getSellerConsumerCatalogProducts(): Product[] {
  return sellerCatalogSnapshot
    .filter((product) => product.status === "published" || product.status === "approved")
    .map(sellerProductToConsumerProduct);
}

export function getSellerConsumerProductDetailBySlug(slug: string): ProductDetail | null {
  const product = sellerCatalogSnapshot.find((item) => item.slug === slug);
  return product ? sellerProductToProductDetail(product) : null;
}

export function sellerProductToConsumerProduct(product: SellerProductListing): Product {
  const image =
    product.images.find((item) => item.isPrimary)?.url ??
    product.images[0]?.url ??
    FALLBACK_IMAGE;
  const displayPrice = product.salePrice ?? product.price;

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    name: product.title,
    categoryName: product.categoryName,
    subcategoryName: product.subcategoryName,
    price: displayPrice,
    originalPrice: product.salePrice ? product.price : Math.round(product.price * 1.08),
    oldPrice: product.salePrice ? product.price : null,
    discount: product.salePrice
      ? Math.round(((product.price - product.salePrice) / product.price) * 100)
      : null,
    badge:
      product.status === "published" || product.status === "approved"
        ? "Seller Pick"
        : null,
    rating: 4.7,
    reviews: 42,
    image,
  };
}

export function sellerProductToProductDetail(product: SellerProductListing): ProductDetail {
  const consumerProduct = sellerProductToConsumerProduct(product);
  const images = product.images.length
    ? product.images.map((image) => image.url)
    : [FALLBACK_IMAGE];

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand || "Zogular",
    category: { name: product.categoryName, href: `/category/${product.categorySlug}` },
    subcategory: {
      name: product.subcategoryName,
      href: `/category/${product.categorySlug}?subcategory=${product.subcategorySlug}`,
    },
    sku: product.sku,
    price: consumerProduct.price,
    originalPrice: consumerProduct.originalPrice ?? product.price,
    rating: consumerProduct.rating,
    reviewCount: consumerProduct.reviews,
    badge: consumerProduct.badge ?? null,
    seller: {
      name: product.seller.name,
      href: `/store/${product.seller.slug}`,
      avatar: "https://github.com/shadcn.png",
      verified: product.seller.verified,
      positiveRate: "98% Positive",
      followers: "1.2k Followers",
    },
    stock: product.stock,
    shippingText:
      product.deliveryType === "express"
        ? "Express delivery available in supported Zambia delivery zones."
        : "Standard Zogular delivery or pickup is available after checkout.",
    images,
    variants: product.variants.length
      ? product.variants.map(toProductVariant)
      : defaultVariants(product),
    description: product.description,
    specs: [
      ...product.specifications.map<ProductSpec>((spec) => ({
        label: spec.name,
        value: spec.value,
      })),
      { label: "Condition", value: formatCondition(product.condition) },
      { label: "Category", value: product.categoryName },
      { label: "SKU", value: product.sku },
    ],
    boxItems: [product.title, "Receipt", "Seller packaging"],
  };
}

export function getCategoryMetaByName(categoryName: string) {
  return (
    SELLER_CATALOG_CATEGORIES.find((category) => category.name === categoryName) ??
    SELLER_CATALOG_CATEGORIES[0]
  );
}

export function getSubcategoryMeta(categoryName: string, subcategoryName: string) {
  const category = getCategoryMetaByName(categoryName);
  return (
    category.subcategories.find((subcategory) => subcategory.name === subcategoryName) ??
    category.subcategories[0]
  );
}

export function slugifySellerValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBackendSellerProduct(product: BackendVendorProduct): SellerProductListing {
  const enrichment = readSellerProductEnrichment(product.id);
  const status = normalizeBackendStatus(product.status);
  const seller = enrichment?.seller ?? buildSellerProfile(product.user);
  const categoryName =
    enrichment?.categoryName ??
    product.categoryRef?.name ??
    getStaticCategoryNameFromSlug(product.categorySlug) ??
    humanizeLegacyCategory(product.category);
  const subcategoryName =
    enrichment?.subcategoryName ??
    getStaticSubcategoryNameFromSlug(categoryName, product.subcategorySlug) ??
    humanizeSlug(product.subcategorySlug || product.categorySlug || categoryName);
  const attributes = (product.attributeValues ?? []).map((attribute) => ({
    attributeId: attribute.attributeId,
    slug: attribute.slug,
    name: attribute.name,
    value: attribute.value,
  }));
  const specifications =
    enrichment?.specifications?.length
      ? enrichment.specifications
      : buildSpecificationFallback(product, categoryName);
  const moderation = normalizeModerationStateFromBackend(product, status, enrichment?.moderation);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    brand: product.brand?.trim() || extractSpecificationValue(specifications, "Brand") || "",
    condition: enrichment?.condition ?? mapBackendCondition(product.condition),
    description: product.description,
    categoryName,
    categorySlug: product.categorySlug || slugifySellerValue(categoryName),
    subcategoryName,
    subcategorySlug:
      product.subcategorySlug || slugifySellerValue(subcategoryName),
    status,
    price: product.price,
    salePrice: product.salePrice ?? null,
    stock: product.stock ?? 0,
    lowStockThreshold: product.lowStockThreshold ?? 0,
    sku: product.sku ?? "",
    images: normalizeBackendImages(product),
    deliveryType: normalizeBackendDeliveryType(product.deliveryType),
    logistics: {
      weightKG: product.weightKG ?? 1,
      dimensions: product.dimensions?.trim() || "Standard Box",
    },
    variants: enrichment?.variants ?? [],
    attributes,
    specifications,
    seo: {
      metaTitle:
        enrichment?.seo?.metaTitle ||
        product.seoTitle?.trim() ||
        `${product.title} | Zogular`,
      metaDescription:
        enrichment?.seo?.metaDescription ||
        product.seoDescription?.trim() ||
        `Buy ${product.title} in Zambia on Zogular.`,
    },
    seller,
    moderation,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function normalizeBackendImages(product: BackendVendorProduct): SellerProductImage[] {
  if (!Array.isArray(product.images) || product.images.length === 0) {
    return [
      {
        id: `${product.id}-fallback-image`,
        url: FALLBACK_IMAGE,
        name: "Fallback product image",
        isPrimary: true,
      },
    ];
  }

  const normalizedImages = product.images.map((image, index) => {
    if (typeof image === "string") {
      return {
        id: `${product.id}-image-${index + 1}`,
        url: image,
        name: `Product image ${index + 1}`,
        alt: `Product image ${index + 1}`,
        isPrimary: index === 0,
        sortOrder: index,
        uploadStatus: "uploaded",
      } satisfies SellerProductImage;
    }

    return {
      id: `${product.id}-image-${index + 1}`,
      url: image.url,
      name: image.alt?.trim() || `Product image ${index + 1}`,
      alt: image.alt?.trim() || `Product image ${index + 1}`,
      publicId: image.publicId ?? undefined,
      isPrimary: image.isPrimary === true || index === 0,
      sortOrder: image.sortOrder ?? index,
      originalWidth: image.width ?? undefined,
      originalHeight: image.height ?? undefined,
      processedWidth: image.width ?? undefined,
      processedHeight: image.height ?? undefined,
      linkedVariantValue: image.linkedVariantValue ?? undefined,
      uploadStatus: "uploaded",
    } satisfies SellerProductImage;
  });

  if (normalizedImages.some((image) => image.isPrimary)) {
    return normalizedImages;
  }

  return normalizedImages.map((image, index) => ({
    ...image,
    isPrimary: index === 0,
  }));
}

function normalizeBackendStatus(status: BackendProductStatus): SellerProductStatus {
  if (status === "DRAFT") return "draft";
  if (status === "PENDING_REVIEW") return "pending_review";
  if (status === "NEEDS_CHANGES" || status === "REJECTED") return "needs_changes";
  if (status === "APPROVED") return "approved";
  if (status === "PUBLISHED") return "published";
  if (status === "PAUSED") return "paused";
  if (status === "SUSPENDED") return "suspended";
  return "draft";
}

function normalizeBackendDeliveryType(
  deliveryType?: BackendDeliveryType | null,
): "standard" | "express" {
  return deliveryType === "EXPRESS" ? "express" : "standard";
}

function mapBackendCondition(condition: BackendProductCondition): ProductCondition {
  return condition === "USED" ? "used-good" : "new";
}

function buildSellerProfile(
  user?: BackendVendorProduct["user"],
): SellerProductListing["seller"] {
  const firstName = user?.firstName?.trim() || "";
  const lastName = user?.lastName?.trim() || "";
  const displayName = `${firstName} ${lastName}`.trim();

  if (!displayName) {
    return DEFAULT_SELLER;
  }

  return {
    name: displayName,
    slug: slugifySellerValue(displayName),
    verified: true,
  };
}

function normalizeModerationStateFromBackend(
  product: BackendVendorProduct,
  status: SellerProductStatus,
  enrichment: ProductModerationState | undefined,
): ProductModerationState {
  const moderationNotes =
    product.rejectionReason?.trim() ||
    product.reviewNotes?.trim() ||
    enrichment?.moderationNotes ||
    null;

  const submittedAt =
    status === "draft"
      ? null
      : enrichment?.submittedAt || product.updatedAt || product.createdAt;

  let reviewedAt: string | null = enrichment?.reviewedAt || null;
  if (!reviewedAt) {
    if (
      status === "approved" ||
      status === "published" ||
      status === "paused"
    ) {
      reviewedAt = product.approvedAt || product.updatedAt;
    } else if (status === "needs_changes" || status === "suspended") {
      reviewedAt = product.updatedAt;
    }
  }

  return {
    submittedAt,
    reviewedAt,
    reviewedBy: reviewedAt ? product.approvedBy || enrichment?.reviewedBy || null : null,
    moderationNotes,
    moderationFlags: enrichment?.moderationFlags ?? [],
    riskScore: enrichment?.riskScore ?? null,
    duplicateWarnings: enrichment?.duplicateWarnings ?? [],
    categorySuggestions: enrichment?.categorySuggestions ?? [],
    imageSafetyWarnings: enrichment?.imageSafetyWarnings ?? [],
  };
}

function buildSpecificationFallback(
  product: BackendVendorProduct,
  categoryName: string,
): SellerProductSpecification[] {
  const specs: SellerProductSpecification[] = [];
  pushSpec(specs, "Brand", product.brand);
  pushSpec(specs, "Model", product.model);
  pushSpec(specs, "RAM", product.ram);
  pushSpec(specs, "Storage", product.storage);
  pushSpec(specs, "Battery Health", product.batteryHealth);
  pushSpec(specs, "Size", product.size);
  pushSpec(specs, "Color", product.color);
  pushSpec(specs, "Material", product.material);
  pushSpec(specs, "Compatibility", product.compatibility);

  if (specs.length > 0) {
    return specs;
  }

  return [
    { name: "Condition", value: product.condition === "USED" ? "Used" : "Brand New" },
    { name: "Category", value: categoryName },
  ];
}

function pushSpec(
  specifications: SellerProductSpecification[],
  name: string,
  value?: string | null,
) {
  if (!value || !value.trim()) return;
  specifications.push({ name, value: value.trim() });
}

function extractSpecificationValue(
  specifications: SellerProductSpecification[],
  name: string,
) {
  const match = specifications.find((specification) => specification.name === name);
  return match?.value ?? "";
}

function buildBackendProductPayload(
  input: CreateSellerProductInput | UpdateSellerProductInput,
  mode: "create" | "update",
) {
  const condition = mapFrontendConditionToBackend(input.condition);
  const normalizedCategoryName =
    input.categoryName && input.categoryName.trim()
      ? input.categoryName.trim()
      : humanizeSlug(input.categorySlug || "others");
  const normalizedCategorySlug =
    input.categorySlug && input.categorySlug.trim()
      ? input.categorySlug.trim()
      : slugifySellerValue(normalizedCategoryName);
  const normalizedSubcategorySlug =
    input.subcategorySlug && input.subcategorySlug.trim()
      ? input.subcategorySlug.trim()
      : normalizedCategorySlug;
  const normalizedAttributes = (input.attributes ?? []).map((attribute) => ({
    attributeId: attribute.attributeId,
    slug: attribute.slug,
    name: attribute.name,
    value: attribute.value,
  }));
  const derivedLegacyFields = deriveLegacyFields(input);

  return removeUndefinedValues({
    title: input.title,
    description: input.description,
    price: input.price,
    salePrice: input.salePrice,
    images: normalizePayloadImages(input.images),
    condition,
    category: mapLegacyCategory(normalizedCategoryName, normalizedCategorySlug, normalizedSubcategorySlug),
    categorySlug: normalizedCategorySlug,
    subcategorySlug: normalizedSubcategorySlug,
    status: mode === "create" ? "DRAFT" : mapFrontendStatusToBackend(resolvePersistStatus(input.status)),
    sku: input.sku,
    stock: input.stock,
    lowStockThreshold: input.lowStockThreshold,
    deliveryType: mapFrontendDeliveryTypeToBackend(input.deliveryType),
    weightKG: input.logistics?.weightKG,
    dimensions: input.logistics?.dimensions,
    seoTitle: input.seo?.metaTitle,
    seoDescription: input.seo?.metaDescription,
    reviewNotes: input.moderation?.moderationNotes,
    attributes: normalizedAttributes,
    brand: input.brand?.trim() || derivedLegacyFields.brand,
    model: derivedLegacyFields.model,
    ram: derivedLegacyFields.ram,
    storage: derivedLegacyFields.storage,
    batteryHealth: derivedLegacyFields.batteryHealth,
    size: derivedLegacyFields.size,
    color: derivedLegacyFields.color,
    material: derivedLegacyFields.material,
    compatibility: derivedLegacyFields.compatibility,
  });
}

function normalizePayloadImages(images?: SellerProductImage[]) {
  return (images ?? []).map((image, index) => ({
    url: image.url,
    publicId: image.publicId ?? null,
    alt: image.alt?.trim() || image.name,
    isPrimary: image.isPrimary || index === 0,
    sortOrder: index,
    linkedVariantValue: image.linkedVariantValue ?? null,
    width: image.processedWidth ?? image.originalWidth ?? null,
    height: image.processedHeight ?? image.originalHeight ?? null,
  }));
}

function deriveLegacyFields(
  input: CreateSellerProductInput | UpdateSellerProductInput,
) {
  const attributes = input.attributes ?? [];
  const specifications = input.specifications ?? [];
  return {
    brand: findValue(attributes, specifications, ["brand"]),
    model: findValue(attributes, specifications, ["model"]),
    ram: findValue(attributes, specifications, ["ram", "memory"]),
    storage: findValue(attributes, specifications, ["storage", "capacity"]),
    batteryHealth: findValue(attributes, specifications, ["battery-health", "battery", "battery-capacity"]),
    size: findValue(attributes, specifications, ["size", "shoe-size"]),
    color: findValue(attributes, specifications, ["color", "colour"]),
    material: findValue(attributes, specifications, ["material"]),
    compatibility: findValue(attributes, specifications, ["compatibility"]),
  };
}

function findValue(
  attributes: ProductAttributeInput[],
  specifications: SellerProductSpecification[],
  aliases: string[],
) {
  const normalizedAliases = aliases.map((alias) => slugifySellerValue(alias));
  const attributeMatch = attributes.find((attribute) =>
    normalizedAliases.includes(slugifySellerValue(attribute.slug || attribute.name)),
  );
  if (attributeMatch?.value.trim()) return attributeMatch.value.trim();

  const specificationMatch = specifications.find((specification) =>
    normalizedAliases.includes(slugifySellerValue(specification.name)),
  );
  if (specificationMatch?.value.trim()) return specificationMatch.value.trim();

  return undefined;
}

function mapFrontendConditionToBackend(
  condition?: ProductCondition,
): BackendProductCondition | undefined {
  if (!condition) return undefined;
  return condition === "new" ? "NEW" : "USED";
}

function mapFrontendDeliveryTypeToBackend(
  deliveryType?: SellerProductListing["deliveryType"],
): BackendDeliveryType | undefined {
  if (!deliveryType) return undefined;
  return deliveryType === "express" ? "EXPRESS" : "STANDARD";
}

function mapFrontendStatusToBackend(
  status?: SellerProductStatus,
): BackendProductStatus | undefined {
  if (!status) return undefined;
  if (status === "draft") return "DRAFT";
  if (status === "pending_review") return "PENDING_REVIEW";
  if (status === "needs_changes" || status === "rejected") return "NEEDS_CHANGES";
  if (status === "approved") return "APPROVED";
  if (status === "published") return "PUBLISHED";
  if (status === "paused") return "PAUSED";
  if (status === "suspended") return "SUSPENDED";
  return undefined;
}

function resolvePersistStatus(status?: SellerProductStatus) {
  if (status === "needs_changes" || status === "rejected") {
    return "needs_changes" as const;
  }

  return "draft" as const;
}

function mapLegacyCategory(
  categoryName: string,
  categorySlug: string,
  subcategorySlug: string,
): BackendLegacyCategory {
  const combinedValue = `${categoryName} ${categorySlug} ${subcategorySlug}`.toLowerCase();

  if (combinedValue.includes("phone") || combinedValue.includes("tablet")) {
    return "PHONES";
  }
  if (combinedValue.includes("laptop") || combinedValue.includes("comput")) {
    return "LAPTOPS";
  }
  if (combinedValue.includes("accessor")) {
    return "ACCESSORIES";
  }
  if (combinedValue.includes("fashion") || combinedValue.includes("footwear") || combinedValue.includes("shoe")) {
    return "FASHIONS";
  }
  if (combinedValue.includes("electronic") || combinedValue.includes("audio") || combinedValue.includes("tv")) {
    return "ELECTRONICS";
  }

  return "OTHERS";
}

function buildEnrichmentFromCreateInput(
  input: CreateSellerProductInput,
): SellerProductEnrichment {
  return {
    categoryName: input.categoryName,
    subcategoryName: input.subcategoryName,
    condition: input.condition,
    variants: input.variants,
    specifications: input.specifications,
    seo: input.seo,
    moderation: input.moderation,
    seller: { ...DEFAULT_SELLER, ...input.seller },
  };
}

function buildEnrichmentFromUpdateInput(
  currentProduct: SellerProductListing,
  input: UpdateSellerProductInput,
): SellerProductEnrichment {
  return {
    categoryName: input.categoryName ?? currentProduct.categoryName,
    subcategoryName: input.subcategoryName ?? currentProduct.subcategoryName,
    condition: input.condition ?? currentProduct.condition,
    variants: input.variants ?? currentProduct.variants,
    specifications: input.specifications ?? currentProduct.specifications,
    seo: input.seo ?? currentProduct.seo,
    moderation: input.moderation ?? currentProduct.moderation,
    seller: currentProduct.seller,
  };
}

function mergeSellerProductEnrichment(
  base: SellerProductEnrichment | undefined,
  next: SellerProductEnrichment,
) {
  return {
    categoryName: next.categoryName ?? base?.categoryName,
    subcategoryName: next.subcategoryName ?? base?.subcategoryName,
    condition: next.condition ?? base?.condition,
    variants: next.variants ?? base?.variants,
    specifications: next.specifications ?? base?.specifications,
    seo: next.seo ?? base?.seo,
    moderation: next.moderation ?? base?.moderation,
    seller: next.seller ?? base?.seller,
  };
}

function toProductVariant(variant: SellerProductVariant): ProductVariant {
  return {
    id: variant.id,
    label: variant.label,
    value: variant.value,
    swatchClass: variant.swatchClass ?? "bg-zinc-200 border-zinc-200",
  };
}

function defaultVariants(product: SellerProductListing): ProductVariant[] {
  return [
    {
      id: `${product.id}-default`,
      label: "Option",
      value: "Default",
      swatchClass: "bg-zinc-200 border-zinc-200",
    },
  ];
}

function formatCondition(condition: ProductCondition): string {
  if (condition === "new") return "Brand New";
  if (condition === "used-like-new") return "Used - Like New";
  if (condition === "used-good") return "Used - Good";
  return "Refurbished";
}

function getStaticCategoryNameFromSlug(categorySlug?: string | null) {
  if (!categorySlug) return null;
  const category = SELLER_CATALOG_CATEGORIES.find((item) => item.slug === categorySlug);
  return category?.name ?? null;
}

function getStaticSubcategoryNameFromSlug(categoryName: string, subcategorySlug?: string | null) {
  if (!subcategorySlug) return null;
  const category = getCategoryMetaByName(categoryName);
  const subcategory = category.subcategories.find((item) => item.slug === subcategorySlug);
  return subcategory?.name ?? null;
}

function humanizeLegacyCategory(category: BackendLegacyCategory) {
  if (category === "PHONES") return "Phones & Tablets";
  if (category === "LAPTOPS") return "Computing";
  if (category === "ACCESSORIES") return "Accessories";
  if (category === "FASHIONS") return "Fashion";
  if (category === "ELECTRONICS") return "Electronics";
  return "Other";
}

function humanizeSlug(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function setSellerCatalogSnapshot(products: SellerProductListing[]) {
  sellerCatalogSnapshot = products;
}

function upsertSellerCatalogSnapshot(
  product: SellerProductListing,
  options?: { prepend?: boolean },
) {
  const remainingProducts = sellerCatalogSnapshot.filter((item) => item.id !== product.id);
  sellerCatalogSnapshot = options?.prepend
    ? [product, ...remainingProducts]
    : [product, ...remainingProducts].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
}

function readSellerProductEnrichment(productId: string) {
  const enrichments = readSellerProductEnrichments();
  return enrichments.get(productId);
}

function persistSellerProductEnrichment(
  productId: string,
  enrichment: SellerProductEnrichment,
) {
  const enrichments = readSellerProductEnrichments();
  enrichments.set(productId, enrichment);
  writeSellerProductEnrichments(enrichments);
}

function deleteSellerProductEnrichment(productId: string) {
  const enrichments = readSellerProductEnrichments();
  enrichments.delete(productId);
  writeSellerProductEnrichments(enrichments);
}

function readSellerProductEnrichments() {
  const storage = getStorage();
  if (!storage) {
    return new Map<string, SellerProductEnrichment>();
  }

  const rawValue = storage.getItem(SELLER_PRODUCT_ENRICHMENT_STORAGE_KEY);
  if (!rawValue) {
    return new Map<string, SellerProductEnrichment>();
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, SellerProductEnrichment>;
    return new Map<string, SellerProductEnrichment>(Object.entries(parsed));
  } catch {
    return new Map<string, SellerProductEnrichment>();
  }
}

function writeSellerProductEnrichments(
  enrichments: Map<string, SellerProductEnrichment>,
) {
  const storage = getStorage();
  if (!storage) return;
  const serializable = Object.fromEntries(enrichments.entries());
  storage.setItem(SELLER_PRODUCT_ENRICHMENT_STORAGE_KEY, JSON.stringify(serializable));
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function removeUndefinedValues<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined),
  ) as T;
}
