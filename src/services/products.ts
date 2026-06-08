import { normalizeProduct } from "@/lib/normalizers/product";
import { apiClient } from "@/services/api";
import { getCategoryMetaBySlug } from "@/services/categories";
import type {
  CategoryFilterOption,
  CategoryPageData,
  ProductPaginationMeta,
  CategorySortOption,
} from "@/types/category";
import type { Product, ProductDetail } from "@/types/product";

const CATEGORY_DESCRIPTION_FALLBACKS: Record<string, string> = {
  "phones-and-tablets":
    "Explore top smartphones, tablets, and accessories in Lusaka with fast delivery and trusted sellers.",
  computing:
    "Discover laptops, desktops, and accessories for work, school, and everyday performance.",
  fashion:
    "Shop premium fashion, footwear, and accessories curated for your style and everyday wear.",
  electronics:
    "Find trending electronics, entertainment gear, and premium gadgets from trusted sellers.",
  supermarket:
    "Shop pantry staples, drinks, household essentials, and daily supplies with fast local delivery.",
  "health-and-beauty":
    "Discover skincare, wellness, grooming, and beauty essentials from trusted Zogular sellers.",
  "sports-and-outdoors":
    "Find fitness gear, outdoor essentials, and active lifestyle products for everyday movement.",
  "home-and-living":
    "Upgrade your home with kitchen, decor, storage, and everyday living essentials.",
};

const PRODUCT_IMAGE_PLACEHOLDER = "/file.svg";

const BACKEND_CATEGORY_BY_SLUG = {
  "phones-and-tablets": "PHONES",
  computing: "LAPTOPS",
  fashion: "FASHIONS",
  electronics: "ELECTRONICS",
  accessories: "ACCESSORIES",
  "home-and-living": "OTHERS",
} as const;

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
  batteryHealth?: string | null;
  size?: string | null;
  color?: string | null;
  material?: string | null;
  compatibility?: string | null;
  isSold?: boolean | null;
  createdAt?: string | null;
  views?: number | null;
  user?: BackendProductUser | null;
  reviews?: BackendReview[] | null;
  attributeValues?: BackendAttributeValue[] | null;
};

type BackendProductListResponse = {
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    pages?: number;
  };
  data?: {
    products?: BackendProduct[];
    product?: BackendProduct;
  };
};

function titleFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getFallbackCategoryMeta(slug: string): CategoryPageData["meta"] {
  return {
    title: titleFromSlug(slug),
    description:
      CATEGORY_DESCRIPTION_FALLBACKS[slug] ??
      `Explore the best deals on ${titleFromSlug(slug).toLowerCase()} in Lusaka. Fast delivery, trusted sellers.`,
    subcategories: [{ id: "all", slug: "all", name: "All" }],
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseBackendImages(value: unknown): string[] {
  let candidate = value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      candidate = [];
    }
  }
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((item) => {
      if (typeof item === "string") return asString(item);
      if (item && typeof item === "object" && "url" in item) {
        return asString((item as { url?: unknown }).url);
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item));
}

function getBackendCategoryMeta(category?: string | null) {
  const key = asString(category)?.toUpperCase() ?? "OTHERS";
  return FRONTEND_CATEGORY_BY_BACKEND[key] ?? FRONTEND_CATEGORY_BY_BACKEND.OTHERS;
}

function getProductCategoryMeta(product: BackendProduct) {
  const categoryRefName = asString(product.categoryRef?.name);
  const categoryRefSlug = asString(product.categoryRef?.slug);
  if (categoryRefName && categoryRefSlug) {
    return { name: categoryRefName, slug: categoryRefSlug };
  }

  const fallback = getBackendCategoryMeta(product.category);
  return {
    name: categoryRefName ?? fallback.name,
    slug: categoryRefSlug ?? fallback.slug,
  };
}

function getBackendCategoryForSlug(slug: string): string | undefined {
  return BACKEND_CATEGORY_BY_SLUG[slug as keyof typeof BACKEND_CATEGORY_BY_SLUG];
}

function getBackendPriceQuery(filter: CategoryFilterOption) {
  if (filter === "under-500") return { maxPrice: 499 };
  if (filter === "500-2000") return { minPrice: 500, maxPrice: 2000 };
  if (filter === "over-2000") return { minPrice: 2001 };
  return {};
}

function isRecentProduct(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= 14 * 24 * 60 * 60 * 1000;
}

function getAverageRating(reviews?: BackendReview[] | null): number {
  if (!reviews?.length) return 0;
  const total = reviews.reduce((sum, review) => sum + toNumber(review.rating), 0);
  return Number((total / reviews.length).toFixed(1));
}

function normalizeToSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getDisplayPricing(product: BackendProduct) {
  const regularPrice = toNumber(product.price);
  const salePrice = toNumber(product.salePrice, Number.NaN);
  const hasSalePrice = Number.isFinite(salePrice) && salePrice > 0 && salePrice < regularPrice;

  return {
    currentPrice: hasSalePrice ? salePrice : regularPrice,
    originalPrice: hasSalePrice ? regularPrice : null,
    discount: hasSalePrice ? Math.round(((regularPrice - salePrice) / regularPrice) * 100) : null,
  };
}

function normalizeAttributeValues(product: BackendProduct): ProductDetail["specs"] {
  if (!Array.isArray(product.attributeValues)) return [];

  return product.attributeValues
    .map((attribute) => {
      const label = asString(attribute.name) ?? asString(attribute.attribute?.name);
      const value = asString(attribute.value);
      return label && value ? { label, value } : null;
    })
    .filter((spec): spec is ProductDetail["specs"][number] => Boolean(spec));
}

function normalizeBackendProduct(product: BackendProduct): Product {
  const title = asString(product.title) ?? titleFromSlug(asString(product.slug) ?? "product");
  const slug = asString(product.slug) ?? normalizeToSlug(title);
  const category = getProductCategoryMeta(product);
  const images = parseBackendImages(product.images);
  const reviews = product.reviews?.length ?? 0;
  const pricing = getDisplayPricing(product);

  return normalizeProduct({
    id: asString(product.id) ?? slug,
    slug,
    title,
    name: title,
    categoryName: category.name,
    subcategoryName: asString(product.subcategorySlug)
      ? titleFromSlug(asString(product.subcategorySlug)!)
      : undefined,
    price: pricing.currentPrice,
    originalPrice: pricing.originalPrice,
    discount: pricing.discount,
    badge: pricing.discount ? `${pricing.discount}% OFF` : isRecentProduct(product.createdAt) ? "New" : null,
    isNew: isRecentProduct(product.createdAt),
    rating: getAverageRating(product.reviews),
    reviews,
    image: images[0] ?? PRODUCT_IMAGE_PLACEHOLDER,
  });
}

function getBackendProducts(payload: BackendProductListResponse): BackendProduct[] {
  return Array.isArray(payload.data?.products) ? payload.data.products : [];
}

function toPaginationMeta(
  payload: BackendProductListResponse,
  fallbackPage: number,
  fallbackPageSize: number,
  productCount: number,
): ProductPaginationMeta {
  const total = payload.pagination?.total ?? productCount;
  const page = payload.pagination?.page ?? fallbackPage;
  const pageSize = payload.pagination?.limit ?? fallbackPageSize;
  const totalPages = payload.pagination?.pages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const startItem = total ? (page - 1) * pageSize + 1 : 0;
  const endItem = total ? Math.min(startItem + productCount - 1, total) : 0;

  return {
    page,
    pageSize,
    total,
    totalPages,
    startItem,
    endItem,
  };
}

async function fetchBackendProducts(
  query: Record<string, string | number | boolean | null | undefined>,
): Promise<{ products: Product[]; pagination: ProductPaginationMeta } | null> {
  try {
    const payload = await apiClient<BackendProductListResponse>("/products", {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
      query,
    });
    const backendProducts = getBackendProducts(payload);
    const products = backendProducts.map(normalizeBackendProduct);
    const page = toNumber(query.page, 1);
    const pageSize = toNumber(query.limit, products.length || 20);

    return {
      products,
      pagination: toPaginationMeta(payload, page, pageSize, products.length),
    };
  } catch {
    return null;
  }
}

async function fetchBackendProductCollection(
  endpoint: string,
  query: Record<string, string | number | boolean | null | undefined>,
): Promise<Product[] | null> {
  try {
    const payload = await apiClient<BackendProductListResponse>(endpoint, {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
      query,
    });
    const products = getBackendProducts(payload).map(normalizeBackendProduct);
    return products.length ? products : null;
  } catch {
    return null;
  }
}

function buildBackendProductSpecs(product: BackendProduct): ProductDetail["specs"] {
  const attributeSpecs = normalizeAttributeValues(product);
  const existingLabels = new Set(attributeSpecs.map((spec) => spec.label.trim().toLowerCase()));
  const legacySpecs = [
    { label: "Category", value: getProductCategoryMeta(product).name },
    { label: "Condition", value: asString(product.condition) ?? "Seller provided" },
    { label: "Location", value: asString(product.location) ?? "Confirmed at checkout" },
    { label: "Brand", value: asString(product.brand) ?? "Not specified" },
    { label: "Model", value: asString(product.model) ?? "Not specified" },
    { label: "RAM", value: asString(product.ram) ?? "Not specified" },
    { label: "Storage", value: asString(product.storage) ?? "Not specified" },
    { label: "Size", value: asString(product.size) ?? "Not specified" },
    { label: "Color", value: asString(product.color) ?? "Not specified" },
  ].filter((spec) => spec.value !== "Not specified" && !existingLabels.has(spec.label.toLowerCase()));

  return [...attributeSpecs, ...legacySpecs];
}

function buildBackendProductVariants(product: BackendProduct): ProductDetail["variants"] {
  const variants = [
    asString(product.color)
      ? { id: "color", label: "Color", value: asString(product.color)!, swatchClass: "bg-white border-[#FF6B00]" }
      : null,
    asString(product.size)
      ? { id: "size", label: "Size", value: asString(product.size)!, swatchClass: "bg-zinc-100 border-[#FF6B00]" }
      : null,
  ].filter((variant): variant is ProductDetail["variants"][number] => Boolean(variant));

  return variants;
}

function normalizeBackendProductDetail(product: BackendProduct): ProductDetail {
  const summary = normalizeBackendProduct(product);
  const category = getProductCategoryMeta(product);
  const images = parseBackendImages(product.images);
  const title = summary.title ?? summary.name ?? titleFromSlug(summary.slug);
  const sellerName = [product.user?.firstName, product.user?.lastName]
    .map((part) => asString(part))
    .filter(Boolean)
    .join(" ");
  const brand = asString(product.brand) ?? "Zogular";

  return {
    id: summary.id,
    slug: summary.slug,
    title,
    brand,
    category: { name: category.name, href: `/category/${category.slug}` },
    subcategory: {
      name: asString(product.subcategorySlug)
        ? titleFromSlug(asString(product.subcategorySlug)!)
        : category.name,
      href: asString(product.subcategorySlug)
        ? `/category/${category.slug}?subcategory=${asString(product.subcategorySlug)!}`
        : `/category/${category.slug}`,
    },
    sku: asString(product.sku) ?? `ZM-${String(summary.id).replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || "ITEM"}`,
    price: summary.price,
    originalPrice: summary.originalPrice ?? summary.price,
    rating: summary.rating,
    reviewCount: summary.reviews,
    badge: summary.badge ?? null,
    seller: {
      name: sellerName || "Zogular Seller",
      href: `/store/${normalizeToSlug(sellerName || "zogular-seller")}`,
      avatar: "https://github.com/shadcn.png",
      verified: false,
      positiveRate: "Platform seller",
      followers: asString(product.location) ?? "Zambia",
    },
    stock: product.isSold ? 0 : toNumber(product.stock, 0),
    shippingText: "Delivery options and exact availability are confirmed at checkout.",
    images: images.length ? images : [PRODUCT_IMAGE_PLACEHOLDER],
    variants: buildBackendProductVariants(product),
    description: asString(product.description) ?? `${title} is available from a Zogular platform seller.`,
    specs: buildBackendProductSpecs(product),
    boxItems: [title, "Seller provided packaging", "Zogular order receipt"],
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
  } catch {
    return null;
  }
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
    const products = getBackendProducts(payload).map(normalizeBackendProduct);
    return products.length ? products : null;
  } catch {
    return null;
  }
}

export async function getTrendingProducts(): Promise<Product[]> {
  const backendProducts = await fetchBackendProductCollection("/products/featured", { limit: 10 });
  return backendProducts ?? [];
}

export async function getFlashSaleProducts(): Promise<Product[]> {
  const backendProducts = await fetchBackendProductCollection("/products", {
    limit: 50,
    sort: "newest",
  });
  return backendProducts?.filter((product) => (product.discount ?? 0) > 0).slice(0, 8) ?? [];
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

  const backendData =
    (await fetchBackendProducts({
      categorySlug: slug,
      subcategorySlug: activeSubcategory,
      sort: BACKEND_SORT_BY_CATEGORY_SORT[activeSort],
      page: activePage,
      limit: activePageSize,
      ...backendPriceQuery,
    })) ??
    (getBackendCategoryForSlug(slug)
      ? await fetchBackendProducts({
          category: getBackendCategoryForSlug(slug),
          sort: BACKEND_SORT_BY_CATEGORY_SORT[activeSort],
          page: activePage,
          limit: activePageSize,
          ...backendPriceQuery,
        })
      : null);

  if (backendData) {
    return {
      slug,
      meta,
      products: backendData.products,
      pagination: backendData.pagination,
    };
  }

  // Fallback to empty if not found
  return {
    slug,
    meta,
    products: [],
    pagination: {
      page: 1,
      pageSize: activePageSize,
      total: 0,
      totalPages: 1,
      startItem: 0,
      endItem: 0,
    },
  };
}

export async function getProductDetailBySlug(slug: string): Promise<ProductDetail> {
  const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const backendProductDetail = await fetchBackendProductDetailBySlug(normalizedSlug);
  if (backendProductDetail) return backendProductDetail;

  throw new Error(`Product ${slug} not found`);
}

export async function getSellerProducts(options: { excludeSlug?: string } = {}): Promise<Product[]> {
  const backendData = await fetchBackendProducts({
    page: 1,
    limit: 8,
    sort: "newest",
  });
  if (backendData?.products) {
      return backendData.products.filter(p => p.slug !== options.excludeSlug);
  }
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

export async function getSearchableProducts(): Promise<Product[]> {
  const backendData = await fetchBackendProducts({
    page: 1,
    limit: 100,
    sort: "newest",
  });
  return backendData?.products ?? [];
}

export async function searchProducts(query: string, limit = 24): Promise<Product[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const backendData = await fetchBackendProducts({
    page: 1,
    limit,
    sort: "newest",
    search: trimmedQuery,
  });

  return backendData?.products ?? [];
}

export async function getAllProductsPageData(
  options: {
    filter?: CategoryFilterOption;
    sort?: CategorySortOption;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ products: Product[]; pagination: ProductPaginationMeta }> {
  const activeFilter = options.filter ?? "all";
  const activeSort = options.sort ?? "recommended";
  const activePage = options.page ?? 1;
  const activePageSize = options.pageSize ?? 50;
  const backendPriceQuery = getBackendPriceQuery(activeFilter);

  const backendData = await fetchBackendProducts({
    page: activePage,
    limit: activePageSize,
    sort: BACKEND_SORT_BY_CATEGORY_SORT[activeSort],
    ...backendPriceQuery,
  });

  if (backendData) return backendData;

  return {
    products: [],
    pagination: {
      page: 1,
      pageSize: activePageSize,
      total: 0,
      totalPages: 1,
      startItem: 0,
      endItem: 0,
    },
  };
}
