import { normalizeProduct } from "@/lib/normalizers/product";
import { apiClient, ApiError } from "@/services/api";
import { getCategoryMetaBySlug } from "@/services/categories";
import type {
  CategoryFilterOption,
  CategoryPageData,
  ProductPaginationMeta,
  CategorySortOption,
} from "@/types/category";
import type { Product, ProductDetail, ProductSeller } from "@/types/product";

const CATEGORY_DESCRIPTION_FALLBACKS: Record<string, string> = {
  "phones-and-tablets":
    "Explore top smartphones, tablets, and accessories in Lusaka with fast delivery and trusted sellers.",
  computing:
    "Discover laptops, desktops, and accessories for work, school, and everyday performance.",
  fashion:
    "Shop premium fashion, footwear, and accessories curated for your style and everyday wear.",
  electronics:
    "Browse current electronics, entertainment gear, and buyer-visible gadgets.",
  supermarket:
    "Shop buyer-visible pantry staples, drinks, household essentials, and daily supplies.",
  "health-and-beauty":
    "Discover buyer-visible skincare, wellness, grooming, and beauty essentials.",
  "sports-and-outdoors":
    "Find fitness gear, outdoor essentials, and active lifestyle products for everyday movement.",
  "home-and-living":
    "Upgrade your home with kitchen, decor, storage, and everyday living essentials.",
};

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

type BackendProductUser = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  telephone?: string | null;
};

type BackendReview = {
  rating?: number | null;
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

type BackendProduct = {
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
  data?: {
    products?: BackendProduct[];
    product?: BackendProduct;
  };
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
  };
};

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseBackendImages(images: unknown): string[] {
  if (Array.isArray(images)) {
    return images
      .map((img) => (typeof img === "string" ? img.trim() : ""))
      .filter((img) => img.length > 0);
  }

  if (typeof images === "string" && images.trim().length > 0) {
    const trimmed = images.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((img) => (typeof img === "string" ? img.trim() : ""))
            .filter((img) => img.length > 0);
        }
      } catch {
        // Fall back to raw string split if JSON parsing fails
      }
    }
    return trimmed
      .split(",")
      .map((img) => img.trim())
      .filter((img) => img.length > 0);
  }

  return [];
}

function normalizeToSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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

function calculateAverageRating(reviews?: BackendReview[] | null): number {
  if (!reviews || reviews.length === 0) return 0;
  const valid = reviews
    .map((r) => r.rating)
    .filter((rating): rating is number => typeof rating === "number" && Number.isFinite(rating));
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / valid.length) * 10) / 10;
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

function normalizeBackendProduct(product: BackendProduct): Product {
  const category = getProductCategoryMeta(product);
  const images = parseBackendImages(product.images);
  const mainImage = images[0] ?? PRODUCT_IMAGE_PLACEHOLDER;
  const rawPrice = toNumber(product.price, 0);
  const rawSalePrice = product.salePrice !== null && product.salePrice !== undefined
    ? toNumber(product.salePrice, rawPrice)
    : rawPrice;
  const currentPrice = rawSalePrice > 0 && rawSalePrice < rawPrice ? rawSalePrice : rawPrice;
  const originalPrice = rawSalePrice > 0 && rawSalePrice < rawPrice ? rawPrice : undefined;
  const discount = originalPrice && originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : undefined;

  const sellerName = [product.user?.firstName, product.user?.lastName]
    .map((part) => asString(part))
    .filter(Boolean)
    .join(" ");

  const rawReviews = product.reviews ?? [];
  const reviewCount = rawReviews.length;
  const rating = calculateAverageRating(rawReviews);
  const idStr = String(product.id ?? "item");
  const slugStr = asString(product.slug) ?? normalizeToSlug(asString(product.title) ?? `item-${idStr}`);

  return normalizeProduct({
    id: idStr,
    name: asString(product.title) ?? titleFromSlug(slugStr),
    price: currentPrice,
    originalPrice,
    discount,
    rating,
    reviews: reviewCount,
    image: mainImage,
    images: images.length ? images : [PRODUCT_IMAGE_PLACEHOLDER],
    categoryName: category.name,
    categorySlug: category.slug,
    subcategorySlug: asString(product.subcategorySlug),
    slug: slugStr,
    badge: discount && discount > 0 ? `${discount}% OFF` : undefined,
    isNew: false,
    storeName: sellerName || undefined,
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

function normalizeBackendProductDetail(product: BackendProduct): ProductDetail {
  const summary = normalizeBackendProduct(product);
  const category = getProductCategoryMeta(product);
  const images = parseBackendImages(product.images);
  const title = summary.title ?? summary.name ?? titleFromSlug(summary.slug);
  const brand = asString(product.brand);
  const sku = asString(product.sku);

  const sellerName = [product.user?.firstName, product.user?.lastName]
    .map((part) => asString(part))
    .filter(Boolean)
    .join(" ");

  const seller: ProductSeller | undefined = sellerName
    ? {
        name: sellerName,
      }
    : undefined;

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
    seller,
    condition: asString(product.condition),
    stock: product.isSold ? 0 : toNumber(product.stock, 0),
    images: images.length ? images : [PRODUCT_IMAGE_PLACEHOLDER],
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
    return product ? normalizeBackendProductDetail(product) : null;
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
  sort?: string;
  categorySlug?: string;
  subcategorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
};

async function fetchBackendProducts(params: FetchBackendProductsParams = {}): Promise<{
  products: Product[];
  pagination: ProductPaginationMeta;
}> {

  const payload = await apiClient<BackendProductListResponse>("/products", {
    method: "GET",
    authMode: "omit",
    cache: "no-store",
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

  const rawProducts = extractBackendProducts(payload);
  const products = rawProducts.map(normalizeBackendProduct);
  const paginationRaw = payload.data?.products ? payload.pagination : undefined;
  const page = paginationRaw?.page ?? params.page ?? 1;
  const limit = paginationRaw?.limit ?? params.limit ?? 24;
  const total = paginationRaw?.total ?? products.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
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
    const products = extractBackendProducts(payload).map(normalizeBackendProduct);
    return products.length ? products : null;
  } catch {
    return null;
  }
}

async function fetchBackendProductCollection(
  endpoint: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): Promise<Product[]> {
  const payload = await apiClient<BackendProductListResponse>(endpoint, {
    method: "GET",
    authMode: "omit",
    cache: "no-store",
    query,
  });
  return extractBackendProducts(payload).map(normalizeBackendProduct);
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

function getFallbackCategoryMeta(slug: string) {
  const formattedName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: formattedName,
    description: CATEGORY_DESCRIPTION_FALLBACKS[slug] ?? `Browse ${formattedName} on Zogular.`,
    subcategories: [],
  };
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
  const meta = await getCategoryMetaBySlug(slug).catch(() => getFallbackCategoryMeta(slug));

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
