import { getProductTitle, normalizeProduct } from "@/lib/normalizers/product";
import { apiClient, ApiError } from "@/services/api";
import { getCategoryMetaBySlug } from "@/services/categories";
import { parseDiscoveryQuery } from "@/features/consumer-discovery/lib/discovery-query";
import type {
  DiscoveryQueryState,
  DiscoverySort,
} from "@/features/consumer-discovery/types/discovery.types";
import type {
  CategoryFilterOption,
  CategoryPageData,
  ProductPaginationMeta,
  CategorySortOption,
} from "@/types/category";
import type { Product, ProductDetail, ProductImage } from "@/types/product";

const PRODUCT_IMAGE_PLACEHOLDER = "/file.svg";

const FRONTEND_CATEGORY_BY_BACKEND: Record<string, { name: string; slug: string }> = {
  PHONES: { name: "Phones & Tablets", slug: "phones-and-tablets" },
  LAPTOPS: { name: "Computing", slug: "computing" },
  ACCESSORIES: { name: "Accessories", slug: "accessories" },
  FASHIONS: { name: "Fashion", slug: "fashion" },
  ELECTRONICS: { name: "Electronics", slug: "electronics" },
  OTHERS: { name: "Other Finds", slug: "products" },
};

const BACKEND_SORT_BY_CATEGORY_SORT: Record<CategorySortOption, "newest" | "price_asc" | "price_desc" | "popular"> = {
  recommended: "newest",
  "price-low": "price_asc",
  "price-high": "price_desc",
  "top-rated": "popular",
};

export type BackendProductUser = {
  id?: string;
};

type BackendReviewAuthor = {
  firstName?: string | null;
  lastName?: string | null;
};

type BackendReview = {
  rating?: number | null;
  user?: BackendReviewAuthor | null;
};

export type BackendProductImage = {
  url?: string | null;
  alt?: string | null;
  isPrimary?: boolean | null;
  sortOrder?: number | string | null;
  linkedVariantValue?: string | null;
  width?: number | string | null;
  height?: number | string | null;
};

type BackendCategoryRef = {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  parentId?: string | null;
};

type BackendAttributeValue = {
  id?: string | null;
  attributeId?: string | null;
  slug?: string | null;
  name?: string | null;
  value?: string | null;
  attribute?: {
    id?: string | null;
    name?: string | null;
    slug?: string | null;
    type?: string | null;
    isRequired?: boolean | null;
    sortOrder?: number | null;
  } | null;
};

export type BackendProduct = {
  id?: string;
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  price?: number | string | null;
  salePrice?: number | string | null;
  images?: unknown;
  condition?: string | null;
  category?: string | null;
  categoryRef?: BackendCategoryRef | null;
  categorySlug?: string | null;
  subcategorySlug?: string | null;
  location?: string | null;
  sku?: string | null;
  stock?: number | string | null;
  brand?: string | null;
  model?: string | null;
  ram?: string | null;
  storage?: string | null;
  size?: string | null;
  color?: string | null;
  status?: string | null;
  moderationStatus?: string | null;
  sellerVisibility?: string | null;
  isSold?: boolean | null;
  user?: BackendProductUser | null;
  reviews?: BackendReview[] | null;
  attributeValues?: BackendAttributeValue[] | null;
  attributes?: BackendAttributeValue[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BackendProductListResponse = {
  status?: string;
  results?: number;
  data?: {
    products?: BackendProduct[];
    product?: BackendProduct;
    days?: number;
  };
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    pages?: number;
  };
};

export class ProductListContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductListContractError";
  }
}

const PUBLIC_ALLOWED_PRODUCT_STATUSES = new Set(["APPROVED", "PUBLISHED"]);
const PUBLIC_NON_PUBLIC_PRODUCT_STATUSES = new Set([
  "DRAFT",
  "PENDING",
  "PENDING_REVIEW",
  "NEEDS_CHANGES",
  "REJECTED",
  "PAUSED",
  "SUSPENDED",
  "HIDDEN",
]);

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function normalizeStatusToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function getPublicProductStatusResolution(product: BackendProduct): "public" | "non-public" {
  const statusValues = [
    ["status", product.status],
    ["moderationStatus", product.moderationStatus],
    ["sellerVisibility", product.sellerVisibility],
  ] as const;

  for (const [field, rawValue] of statusValues) {
    if (rawValue === undefined) continue;
    if (typeof rawValue !== "string") {
      throw new ProductListContractError(`Public product ${field} has an invalid status.`);
    }

    const normalized = normalizeStatusToken(rawValue);
    if (!normalized) {
      throw new ProductListContractError(`Public product ${field} has an invalid status.`);
    }

    if (PUBLIC_ALLOWED_PRODUCT_STATUSES.has(normalized) || normalized === "VISIBLE") continue;
    if (PUBLIC_NON_PUBLIC_PRODUCT_STATUSES.has(normalized)) return "non-public";

    throw new ProductListContractError(`Public product ${field} has an unknown status.`);
  }

  return "public";
}

function normalizePublicBackendProduct(product: BackendProduct): Product | null {
  if (getPublicProductStatusResolution(product) === "non-public") return null;
  return normalizeBackendProduct(product);
}

function normalizePublicBackendProductDetail(product: BackendProduct): ProductDetail | null {
  if (getPublicProductStatusResolution(product) === "non-public") return null;
  return normalizeBackendProductDetail(product);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function positiveDimension(value: unknown): number | null {
  const parsed = toNumber(value, 0);
  return parsed > 0 ? parsed : null;
}

function parseBackendImageEntry(
  value: unknown,
  sourceIndex: number,
): (ProductImage & { sourceIndex: number }) | null {
  if (typeof value === "string") {
    const url = value.trim();
    if (!url) return null;
    return {
      url,
      alt: null,
      isPrimary: sourceIndex === 0,
      sortOrder: sourceIndex,
      linkedVariantValue: null,
      width: null,
      height: null,
      sourceIndex,
    };
  }

  if (!value || typeof value !== "object") return null;
  const image = value as BackendProductImage;
  const url = asString(image.url);
  if (!url) return null;

  return {
    url,
    alt: asString(image.alt) ?? null,
    isPrimary: image.isPrimary === true,
    sortOrder: toNumber(image.sortOrder, sourceIndex),
    linkedVariantValue: asString(image.linkedVariantValue) ?? null,
    width: positiveDimension(image.width),
    height: positiveDimension(image.height),
    sourceIndex,
  };
}

function parseBackendImages(images: unknown): ProductImage[] {
  let source: unknown[] = [];

  if (Array.isArray(images)) {
    source = images;
  } else if (typeof images === "string" && images.trim()) {
    const trimmed = images.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        source = Array.isArray(parsed) ? parsed : [];
      } catch {
        source = [];
      }
    } else {
      source = trimmed.split(",");
    }
  }

  return source
    .map(parseBackendImageEntry)
    .filter((image): image is ProductImage & { sourceIndex: number } => image !== null)
    .sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      return left.sourceIndex - right.sourceIndex;
    })
    .map((image): ProductImage => ({
      url: image.url,
      alt: image.alt,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
      linkedVariantValue: image.linkedVariantValue,
      width: image.width,
      height: image.height,
    }));
}

function getProductCategoryMeta(product: BackendProduct): { name: string; slug: string } {
  if (product.categoryRef?.name && product.categoryRef?.slug) {
    return { name: product.categoryRef.name, slug: product.categoryRef.slug };
  }

  if (product.categorySlug) {
    const matchedFallback = Object.values(FRONTEND_CATEGORY_BY_BACKEND).find(
      (cat) => cat.slug === product.categorySlug,
    );
    if (matchedFallback) return matchedFallback;

    const formattedName = product.categorySlug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return { name: formattedName, slug: product.categorySlug };
  }

  if (product.category && FRONTEND_CATEGORY_BY_BACKEND[product.category]) {
    return FRONTEND_CATEGORY_BY_BACKEND[product.category];
  }

  return { name: "Other Finds", slug: "products" };
}

function calculateRatingSummary(reviews?: BackendReview[] | null): { rating: number; reviewCount: number } {
  if (!reviews || reviews.length === 0) return { rating: 0, reviewCount: 0 };
  const validRatings = reviews
    .map((r) => r.rating)
    .filter((rating): rating is number => typeof rating === "number" && Number.isFinite(rating) && rating >= 1 && rating <= 5);
  if (validRatings.length === 0) return { rating: 0, reviewCount: 0 };
  const sum = validRatings.reduce((acc, curr) => acc + curr, 0);
  return {
    rating: Math.round((sum / validRatings.length) * 10) / 10,
    reviewCount: validRatings.length,
  };
}

function titleFromSlug(slug?: string | null): string {
  if (!slug) return "Marketplace Item";
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeAttributeValues(product: BackendProduct): Array<{ label: string; value: string }> {
  const source = product.attributeValues ?? product.attributes;
  if (!Array.isArray(source)) return [];

  const specs: Array<{ label: string; value: string }> = [];

  for (const item of source) {
    const rawLabel = item.attribute?.name ?? item.name;
    const rawValue = item.value ?? item.name;
    const label = asString(rawLabel);
    const value = asString(rawValue);

    if (label && value) {
      specs.push({ label, value });
    }
  }

  return specs;
}

function parseModerationStatus(status?: string | null): "approved" | "pending" | "rejected" | undefined {
  const str = asString(status);
  if (str === "approved" || str === "pending" || str === "rejected") return str;
  return undefined;
}

function parseSellerVisibility(visibility?: string | null): "visible" | "hidden" | undefined {
  const str = asString(visibility);
  if (str === "visible" || str === "hidden") return str;
  return undefined;
}

export function normalizeBackendProduct(product: BackendProduct): Product {
  const category = getProductCategoryMeta(product);
  const images = parseBackendImages(product.images);
  const mainImage = images[0];
  const rawPrice = toNumber(product.price, 0);
  const rawSalePrice = product.salePrice !== null && product.salePrice !== undefined
    ? toNumber(product.salePrice, rawPrice)
    : rawPrice;
  const currentPrice = rawSalePrice > 0 && rawSalePrice < rawPrice ? rawSalePrice : rawPrice;
  const originalPrice = rawSalePrice > 0 && rawSalePrice < rawPrice ? rawPrice : undefined;
  const discount = originalPrice && originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : undefined;

  const { rating, reviewCount } = calculateRatingSummary(product.reviews);
  const idStr = asString(product.id) ?? "";
  const slugStr = asString(product.slug) ?? "";
  const title = asString(product.title) ?? "";
  const ownerId = asString(product.user?.id);

  return normalizeProduct({
    id: idStr,
    slug: slugStr,
    title,
    name: title,
    price: currentPrice,
    originalPrice,
    discount,
    rating,
    reviews: reviewCount,
    image: mainImage?.url ?? "",
    imageAlt: mainImage?.alt ?? title,
    images,
    ownerId,
    categoryName: category.name,
    categorySlug: category.slug,
    subcategorySlug: asString(product.subcategorySlug),
    badge: discount && discount > 0 ? `${discount}% OFF` : undefined,
    isNew: false,
    storeName: undefined,
    stock: product.isSold ? 0 : toNumber(product.stock, 0),
    moderationStatus: parseModerationStatus(product.moderationStatus),
    sellerVisibility: parseSellerVisibility(product.sellerVisibility),
  });
}

function buildBackendProductSpecs(product: BackendProduct): ProductDetail["specs"] {
  const attributeSpecs = normalizeAttributeValues(product);
  const existingLabels = new Set(attributeSpecs.map((spec) => spec.label.trim().toLowerCase()));
  const legacySpecs = [
    { label: "Category", value: getProductCategoryMeta(product).name },
    { label: "Condition", value: asString(product.condition) },
    { label: "Location", value: asString(product.location) },
    { label: "Brand", value: asString(product.brand) },
    { label: "Model", value: asString(product.model) },
    { label: "RAM", value: asString(product.ram) },
    { label: "Storage", value: asString(product.storage) },
    { label: "Size", value: asString(product.size) },
    { label: "Color", value: asString(product.color) },
  ].filter((spec): spec is { label: string; value: string } => Boolean(spec.value) && !existingLabels.has(spec.label.toLowerCase()));

  return [...attributeSpecs, ...legacySpecs];
}

function buildBackendProductVariants(): ProductDetail["variants"] {
  // Variant Rule: Backend schema currently uses scalar fields for color/size.
  // Do not synthesize fake variants from scalar fields.
  // Return empty array until authoritative backend variant model exists.
  return [];
}

export function normalizeBackendProductDetail(product: BackendProduct): ProductDetail {
  const summary = normalizeBackendProduct(product);
  const category = getProductCategoryMeta(product);
  const images = parseBackendImages(product.images);
  const title = getProductTitle(summary);
  const brand = asString(product.brand);
  const sku = asString(product.sku);

  return {
    id: summary.id,
    title,
    brand,
    slug: summary.slug,
    category: {
      name: category.name,
      href: `/category/${category.slug}`,
    },
    subcategory: product.subcategorySlug
      ? {
          name: titleFromSlug(product.subcategorySlug),
          href: `/category/${category.slug}?subcategory=${asString(product.subcategorySlug)!}`,
        }
      : {
          name: category.name,
          href: `/category/${category.slug}`,
        },
    sku,
    price: summary.price,
    originalPrice: summary.originalPrice ?? summary.price,
    rating: summary.rating,
    reviewCount: summary.reviews,
    badge: summary.badge ?? null,
    ownerId: summary.ownerId,
    seller: undefined,
    condition: asString(product.condition),
    stock: product.isSold ? 0 : toNumber(product.stock, 0),
    images: images.length ? images.map((image) => image.url) : [PRODUCT_IMAGE_PLACEHOLDER],
    variants: buildBackendProductVariants(),
    description: asString(product.description) ?? "No description provided.",
    specs: buildBackendProductSpecs(product),
    boxItems: [],
  };
}



async function fetchBackendProductDetailBySlug(slug: string): Promise<ProductDetail | null> {


  try {
    const payload = await apiClient<BackendProductListResponse>(`/products/${encodeURIComponent(slug)}`, {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
    });
    const product = payload.data?.product;
    return product ? normalizePublicBackendProductDetail(product) : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function extractBackendProducts(payload?: BackendProductListResponse | null): BackendProduct[] {
  if (!payload?.data) return [];
  if (Array.isArray(payload.data.products)) return payload.data.products;
  if (payload.data.product) return [payload.data.product];
  return [];
}

type FetchBackendProductsParams = {
  page?: number;
  limit?: number;
  sort?: DiscoverySort;
  categorySlug?: string;
  subcategorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  timeout?: number;
};

function requirePaginationInteger(
  value: unknown,
  field: "page" | "limit" | "total" | "pages",
  minimum: number,
): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= minimum) {
    return value;
  }
  throw new ProductListContractError(`Product list pagination has an invalid ${field}.`);
}

function parseProductListPayload(
  payload: BackendProductListResponse,
): {
  rawProducts: BackendProduct[];
  page: number;
  limit: number;
  total: number;
  pages: number;
} {
  if (!payload?.data || !Array.isArray(payload.data.products)) {
    throw new ProductListContractError("Product list response is missing its products array.");
  }
  if (!payload.pagination) {
    throw new ProductListContractError("Product list response is missing pagination metadata.");
  }

  const page = requirePaginationInteger(payload.pagination.page, "page", 1);
  const limit = requirePaginationInteger(payload.pagination.limit, "limit", 1);
  const total = requirePaginationInteger(payload.pagination.total, "total", 0);
  const derivedPages = Math.ceil(total / limit);
  const pages = payload.pagination.pages === undefined
    ? derivedPages
    : requirePaginationInteger(payload.pagination.pages, "pages", 0);

  if (pages !== derivedPages) {
    throw new ProductListContractError("Product list pagination page count is inconsistent.");
  }

  return { rawProducts: payload.data.products, page, limit, total, pages };
}

async function fetchBackendProducts(params: FetchBackendProductsParams = {}): Promise<{
  products: Product[];
  pagination: ProductPaginationMeta;
}> {

  const payload = await apiClient<BackendProductListResponse>("/products", {
    method: "GET",
    authMode: "omit",
    cache: "no-store",
    timeout: params.timeout,
    query: {
      page: params.page ?? 1,
      limit: params.limit ?? 24,
      sort: params.sort,
      categorySlug: params.categorySlug,
      subcategorySlug: params.subcategorySlug,
      search: params.search,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
    },
  });

  const {
    rawProducts,
    page,
    limit,
    total,
    pages,
  } = parseProductListPayload(payload);
  const products = rawProducts
    .map(normalizePublicBackendProduct)
    .filter((product): product is Product => product !== null);
  const totalPages = Math.max(1, pages);
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return {
    products,
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages,
      startItem,
      endItem,
    },
  };
}

export type DiscoveryListingPageResolution = "requested" | "last-page" | "empty-first-page";

export type DiscoveryListingPageResult = {
  requestedQuery: DiscoveryQueryState;
  query: DiscoveryQueryState;
  products: Product[];
  pagination: ProductPaginationMeta;
  pageResolution: DiscoveryListingPageResolution;
  approvedPublicProductCount?: number;
};

type DiscoveryListingPageOptions = {
  pageSize?: number;
  orderingContext?: "listing" | "most-viewed";
  approvedPublicProductCount?: number;
  timeout?: number;
};

function clampListingPageSize(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || (value ?? 0) < 1) return 24;
  return Math.min(value!, 100);
}

function resolveListingSort(
  sort: DiscoverySort,
  orderingContext: DiscoveryListingPageOptions["orderingContext"],
): DiscoverySort {
  return sort === "popular" && orderingContext !== "most-viewed"
    ? "newest"
    : sort;
}

export async function getDiscoveryListingPageData(
  requestedQuery: DiscoveryQueryState,
  options: DiscoveryListingPageOptions = {},
): Promise<DiscoveryListingPageResult> {
  const pageSize = clampListingPageSize(options.pageSize);
  const parsedQuery = parseDiscoveryQuery(
    {
      page: String(requestedQuery.page),
      sort: requestedQuery.sort,
      categorySlug: requestedQuery.categorySlug,
      subcategorySlug: requestedQuery.subcategorySlug,
      search: requestedQuery.search,
    },
    { allowPopular: options.orderingContext === "most-viewed" },
  );
  const sort = resolveListingSort(parsedQuery.sort, options.orderingContext);
  const query: DiscoveryQueryState = { ...parsedQuery, sort };
  const fetchPage = (page: number) => fetchBackendProducts({
    page,
    limit: pageSize,
    sort,
    categorySlug: query.categorySlug,
    subcategorySlug: query.subcategorySlug,
    search: query.search,
    timeout: options.timeout,
  });

  let result = await fetchPage(query.page);
  let resolvedPage = query.page;
  let pageResolution: DiscoveryListingPageResolution = "requested";

  if (query.page > result.pagination.totalPages) {
    if (result.pagination.total === 0) {
      resolvedPage = 1;
      pageResolution = "empty-first-page";
      result = {
        ...result,
        pagination: {
          ...result.pagination,
          page: 1,
          startItem: 0,
          endItem: 0,
        },
      };
    } else {
      resolvedPage = result.pagination.totalPages;
      pageResolution = "last-page";
      result = await fetchPage(resolvedPage);
    }
  }

  return {
    requestedQuery: query,
    query: { ...query, page: resolvedPage },
    products: result.products,
    pagination: result.pagination,
    pageResolution,
    approvedPublicProductCount: options.approvedPublicProductCount,
  };
}

async function fetchBackendRelatedProducts(
  productId: string | number,
  limit: number,
): Promise<Product[] | null> {
  try {
    const payload = await apiClient<BackendProductListResponse>(`/products/${productId}/related`, {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
      query: { limit },
    });
    const products = extractBackendProducts(payload)
      .map(normalizePublicBackendProduct)
      .filter((product): product is Product => product !== null);
    return products.length ? products : null;
  } catch (error) {
    if (error instanceof ProductListContractError) throw error;
    return null;
  }
}

async function fetchBackendProductCollection(
  endpoint: string,
  query?: Record<string, string | number | boolean | null | undefined>,
  options: { timeout?: number } = {},
): Promise<Product[]> {
  const payload = await apiClient<unknown>(endpoint, {
    method: "GET",
    authMode: "omit",
    cache: "no-store",
    timeout: options.timeout,
    query,
  });

  if (!payload || typeof payload !== "object") {
    throw new ProductListContractError("Product collection response must be an object.");
  }

  const response = payload as BackendProductListResponse;
  if (
    response.status !== "success" ||
    !response.data ||
    !Array.isArray(response.data.products) ||
    !Number.isSafeInteger(response.results) ||
    response.results !== response.data.products.length
  ) {
    throw new ProductListContractError("Product collection response has an invalid shape.");
  }

  try {
    return response.data.products
      .map(normalizePublicBackendProduct)
      .filter((product): product is Product => product !== null);
  } catch {
    throw new ProductListContractError("Product collection contains an invalid product.");
  }
}

export async function getHomeNewArrivals(
  limit = 10,
  options: { timeout?: number } = {},
): Promise<Product[]> {
  return fetchBackendProductCollection("/products/new-arrivals", { limit }, options);
}

export async function getHomeMostViewed(limit = 10): Promise<Product[]> {
  const result = await fetchBackendProducts({ page: 1, limit, sort: "popular" });
  return result.products;
}

export async function getHomeExploreMore(limit = 10): Promise<Product[]> {
  const result = await fetchBackendProducts({ page: 1, limit, sort: "newest" });
  return result.products;
}

export async function getTrendingProducts(options: { allowOptionalFallback?: boolean } = {}): Promise<Product[]> {
  try {
    const backendProducts = await fetchBackendProductCollection("/products/featured", { limit: 10 });
    return backendProducts;
  } catch (error) {
    if (options.allowOptionalFallback) return [];
    throw error;
  }
}

export async function getFlashSaleProducts(options: { allowOptionalFallback?: boolean } = {}): Promise<Product[]> {
  try {
    const backendProducts = await fetchBackendProductCollection("/products", {
      limit: 50,
      sort: "newest",
    });
    return backendProducts.filter((product) => (product.discount ?? 0) > 0).slice(0, 8);
  } catch (error) {
    if (options.allowOptionalFallback) return [];
    throw error;
  }
}

function getBackendPriceQuery(filter: CategoryFilterOption) {
  if (filter === "under-500") return { maxPrice: 500 };
  if (filter === "500-2000") return { minPrice: 500, maxPrice: 2000 };
  if (filter === "over-2000") return { minPrice: 2000 };
  return {};
}

export async function getCategoryPageData(
  slug: string,
  options: {
    subcategory?: string;
    filter?: CategoryFilterOption;
    sort?: CategorySortOption;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<CategoryPageData> {
  const activeFilter = options.filter ?? "all";
  const activeSort = options.sort ?? "recommended";
  const activePage = options.page ?? 1;
  const activePageSize = options.pageSize ?? 50;
  const backendPriceQuery = getBackendPriceQuery(activeFilter);
  const activeSubcategory =
    options.subcategory && options.subcategory !== "all"
      ? options.subcategory
      : undefined;
  const meta = await getCategoryMetaBySlug(slug);

  const backendData = await fetchBackendProducts({
    categorySlug: slug,
    subcategorySlug: activeSubcategory,
    sort: BACKEND_SORT_BY_CATEGORY_SORT[activeSort],
    page: activePage,
    limit: activePageSize,
    ...backendPriceQuery,
  });

  return {
    slug,
    meta,
    products: backendData.products,
    pagination: backendData.pagination,
    approvedPublicProductCount: meta.approvedPublicProductCount,
  };
}

export async function getProductDetailBySlug(slug: string): Promise<ProductDetail | null> {
  const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const backendProductDetail = await fetchBackendProductDetailBySlug(normalizedSlug);
  return backendProductDetail;
}

export async function getSellerProducts(_options?: { excludeSlug?: string }): Promise<Product[]> {
  // Seller product filtering is not currently supported in backend schema API contract.
  // Return empty array to prevent displaying general marketplace products under a false seller label.
  void _options;
  return [];
}

export async function getRelatedProducts(
  options: { excludeSlug?: string; categoryName?: string } = {},
): Promise<Product[]> {
  if (options.excludeSlug) {
    const currentProduct = await fetchBackendProductDetailBySlug(options.excludeSlug);
    if (currentProduct) {
      const backendRelated = await fetchBackendRelatedProducts(currentProduct.id, 8);
      if (backendRelated) return backendRelated.filter((product) => product.slug !== options.excludeSlug);
    }
  }

  return [];
}

export async function searchProducts(query: string, limit = 50): Promise<Product[]> {
  const backendData = await fetchBackendProducts({ search: query, limit });
  return backendData.products;
}

export async function getSearchableProducts(): Promise<Product[]> {
  const backendData = await fetchBackendProducts({ limit: 100 });
  return backendData.products;
}

export async function getAllProductsPageData(options: {
  filter?: CategoryFilterOption;
  sort?: CategorySortOption;
  page?: number;
  pageSize?: number;
} = {}): Promise<CategoryPageData> {
  const activeFilter = options.filter ?? "all";
  const activeSort = options.sort ?? "recommended";
  const activePage = options.page ?? 1;
  const activePageSize = options.pageSize ?? 50;
  const backendPriceQuery = getBackendPriceQuery(activeFilter);

  const backendData = await fetchBackendProducts({
    sort: BACKEND_SORT_BY_CATEGORY_SORT[activeSort],
    page: activePage,
    limit: activePageSize,
    ...backendPriceQuery,
  });

  return {
    slug: "products",
    meta: {
      title: "All Products",
      description: "Browse all items available on Zogular.",
      subcategories: [],
    },
    products: backendData.products,
    pagination: backendData.pagination,
  };
}
