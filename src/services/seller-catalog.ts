import type { Product, ProductDetail, ProductSpec, ProductVariant } from "@/types/product";
import { readLocalStorageValue } from "@/lib/persisted-storage";
import { type ProductAttributeInput } from "@/services/categories-api";
import {
  type ProductModerationState,
  type ProductModerationStatus,
  getModerationActionTargetStatus,
  type ProductModerationAction,
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
  isPrimary: boolean;
  originalWidth?: number;
  originalHeight?: number;
  processedWidth?: number;
  processedHeight?: number;
  wasAutoCropped?: boolean;
  linkedVariantValue?: string;
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

const SELLER_PRODUCTS_STORAGE_KEY = "zogular-seller-products";
const LEGACY_SELLER_PRODUCTS_STORAGE_KEYS = ["zamoyo-seller-products"];
const DEFAULT_SELLER = { name: "Zogular Store", slug: "zogular-official", verified: true };
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1200&q=80";

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

const SELLER_SEED_PRODUCTS: SellerProductListing[] = [
  buildSeedProduct({
    id: "ZM-P-101",
    title: "MacBook Air M2 - 256GB Midnight",
    brand: "Apple",
    categoryName: "Computing",
    subcategoryName: "Laptops",
    price: 18500,
    salePrice: null,
    stock: 12,
    lowStockThreshold: 5,
    status: "published",
    sku: "MAC-AIR-M2-MID",
    image: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=1200&q=80",
  }),
  buildSeedProduct({
    id: "ZM-P-102",
    title: "Samsung 45W Fast Charger Type-C",
    brand: "Samsung",
    categoryName: "Phones & Tablets",
    subcategoryName: "Accessories",
    price: 450,
    salePrice: null,
    stock: 0,
    lowStockThreshold: 10,
    status: "published",
    sku: "SAM-45W-CHG",
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=80",
  }),
  buildSeedProduct({
    id: "ZM-P-103",
    title: "Apple AirPods Pro (2nd Generation)",
    brand: "Apple",
    categoryName: "Electronics",
    subcategoryName: "Audio & Headphones",
    price: 4200,
    salePrice: null,
    stock: 2,
    lowStockThreshold: 5,
    status: "published",
    sku: "APP-AIRPODS-PRO2",
    image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=1200&q=80",
  }),
  buildSeedProduct({
    id: "ZM-P-104",
    title: "JBL Flip 6 Portable Bluetooth Speaker",
    brand: "JBL",
    categoryName: "Electronics",
    subcategoryName: "Audio & Headphones",
    price: 2100,
    salePrice: null,
    stock: 45,
    lowStockThreshold: 5,
    status: "pending_review",
    sku: "JBL-FLIP-6",
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=1200&q=80",
  }),
  buildSeedProduct({
    id: "ZM-P-105",
    title: "PlayStation 5 DualSense Controller",
    brand: "Sony",
    categoryName: "Electronics",
    subcategoryName: "TVs & Entertainment",
    price: 1450,
    salePrice: null,
    stock: 8,
    lowStockThreshold: 4,
    status: "draft",
    sku: "SONY-DS5-WHT",
    image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80",
  }),
  buildSeedProduct({
    id: "ZM-P-106",
    title: "Nike Air Max 270",
    brand: "Nike",
    categoryName: "Fashion",
    subcategoryName: "Footwear",
    price: 1850,
    salePrice: null,
    stock: 3,
    lowStockThreshold: 6,
    status: "needs_changes",
    sku: "NKE-AM270-BLK",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
  }),
];

export async function fetchSellerCatalogProducts(): Promise<SellerProductListing[]> {
  await delay(300);
  return getSellerCatalogProducts();
}

export async function fetchSellerCatalogProductById(productId: string): Promise<SellerProductListing> {
  await delay(200);
  const product = getSellerCatalogProducts().find((item) => item.id === productId);
  if (!product) throw new Error("Product not found.");
  return product;
}

export async function createSellerCatalogProduct(input: CreateSellerProductInput): Promise<SellerProductListing> {
  await delay(500);
  const now = new Date().toISOString();
  const id = buildProductId(input.sku);
  const product: SellerProductListing = {
    ...input,
    id,
    slug: buildUniqueSlug(input.title, id),
    seller: { ...DEFAULT_SELLER, ...input.seller },
    moderation: normalizeModerationState(input.status, input.moderation, now),
    createdAt: now,
    updatedAt: now,
  };

  writeStoredSellerProducts([product, ...getSellerCatalogProducts()]);
  return product;
}

export async function updateSellerProductStatus(
  productId: string,
  status: SellerProductStatus,
): Promise<SellerProductListing> {
  return updateSellerProductModeration(productId, { status });
}

export async function updateSellerCatalogProduct(
  productId: string,
  input: UpdateSellerProductInput,
): Promise<SellerProductListing> {
  await delay(300);
  const products = getSellerCatalogProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error("Product not found.");

  const now = new Date().toISOString();
  const nextStatus = input.status ?? product.status;
  const updatedProduct: SellerProductListing = {
    ...product,
    ...input,
    id: product.id,
    slug: input.title && input.title !== product.title ? buildUniqueSlug(input.title, product.id) : product.slug,
    seller: product.seller,
    moderation: normalizeModerationState(nextStatus, input.moderation ?? product.moderation, now),
    updatedAt: now,
  };

  writeStoredSellerProducts(products.map((item) => (item.id === productId ? updatedProduct : item)));
  return updatedProduct;
}

export async function updateSellerProductModeration(
  productId: string,
  input: SellerProductModerationInput,
): Promise<SellerProductListing> {
  await delay(250);
  const products = getSellerCatalogProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error("Product not found.");

  const now = new Date().toISOString();
  const nextStatus = input.action ? getModerationActionTargetStatus(input.action) : input.status;
  const updatedProduct = {
    ...product,
    status: nextStatus,
    moderation: normalizeModerationState(nextStatus, { ...product.moderation, ...input }, now),
    updatedAt: now,
  };
  writeStoredSellerProducts(products.map((item) => (item.id === productId ? updatedProduct : item)));
  return updatedProduct;
}

export async function duplicateSellerProduct(productId: string): Promise<SellerProductListing> {
  await delay(250);
  const products = getSellerCatalogProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) throw new Error("Product not found.");

  const now = new Date().toISOString();
  const duplicateId = `${product.id}-copy-${Date.now().toString().slice(-5)}`;
  const duplicate = {
    ...product,
    id: duplicateId,
    slug: buildUniqueSlug(`${product.title} Copy`, duplicateId),
    title: `${product.title} Copy`,
    status: "draft" as const,
    moderation: {},
    createdAt: now,
    updatedAt: now,
  };

  writeStoredSellerProducts([duplicate, ...products]);
  return duplicate;
}

export async function removeSellerProduct(productId: string): Promise<void> {
  await delay(250);
  writeStoredSellerProducts(getSellerCatalogProducts().filter((product) => product.id !== productId));
}

export function getSellerConsumerCatalogProducts(): Product[] {
  return getSellerCatalogProducts().filter((product) => product.status === "published").map(
    sellerProductToConsumerProduct,
  );
}

export function getSellerConsumerProductDetailBySlug(slug: string): ProductDetail | null {
  const product = getSellerCatalogProducts().find((item) => item.slug === slug);
  return product ? sellerProductToProductDetail(product) : null;
}

export function sellerProductToConsumerProduct(product: SellerProductListing): Product {
  const image = product.images.find((item) => item.isPrimary)?.url ?? product.images[0]?.url ?? FALLBACK_IMAGE;
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
    discount: product.salePrice ? Math.round(((product.price - product.salePrice) / product.price) * 100) : null,
    badge: product.status === "published" ? "Seller Pick" : null,
    rating: 4.7,
    reviews: 42,
    image,
  };
}

export function sellerProductToProductDetail(product: SellerProductListing): ProductDetail {
  const consumerProduct = sellerProductToConsumerProduct(product);
  const images = product.images.length ? product.images.map((image) => image.url) : [FALLBACK_IMAGE];

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
    variants: product.variants.length ? product.variants.map(toProductVariant) : defaultVariants(product),
    description: product.description,
    specs: [
      ...product.specifications.map<ProductSpec>((spec) => ({ label: spec.name, value: spec.value })),
      { label: "Condition", value: formatCondition(product.condition) },
      { label: "Category", value: product.categoryName },
      { label: "SKU", value: product.sku },
    ],
    boxItems: [product.title, "Receipt", "Seller packaging"],
  };
}

export function getCategoryMetaByName(categoryName: string) {
  return SELLER_CATALOG_CATEGORIES.find((category) => category.name === categoryName) ?? SELLER_CATALOG_CATEGORIES[0];
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

function getSellerCatalogProducts(): SellerProductListing[] {
  const stored = readStoredSellerProducts();
  return (stored.length ? stored : SELLER_SEED_PRODUCTS).map(normalizeSellerProductRecord);
}

function readStoredSellerProducts(): SellerProductListing[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = readLocalStorageValue(SELLER_PRODUCTS_STORAGE_KEY, LEGACY_SELLER_PRODUCTS_STORAGE_KEYS);
    return raw ? (JSON.parse(raw) as SellerProductListing[]) : [];
  } catch {
    return [];
  }
}

function writeStoredSellerProducts(products: SellerProductListing[]) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(SELLER_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function buildSeedProduct(input: {
  id: string;
  title: string;
  brand: string;
  categoryName: string;
  subcategoryName: string;
  price: number;
  salePrice: number | null;
  stock: number;
  lowStockThreshold: number;
  status: SellerProductStatus;
  sku: string;
  image: string;
}): SellerProductListing {
  const category = getCategoryMetaByName(input.categoryName);
  const subcategory = getSubcategoryMeta(input.categoryName, input.subcategoryName);
  const now = "2026-04-18T10:00:00Z";

  return {
    id: input.id,
    slug: slugifySellerValue(input.title),
    title: input.title,
    brand: input.brand,
    condition: "new",
    description: `${input.title} from ${input.brand}, listed by a verified Zogular seller for Zambia shoppers.`,
    categoryName: category.name,
    categorySlug: category.slug,
    subcategoryName: subcategory.name,
    subcategorySlug: subcategory.slug,
    status: input.status,
    price: input.price,
    salePrice: input.salePrice,
    stock: input.stock,
    lowStockThreshold: input.lowStockThreshold,
    sku: input.sku,
    images: [{ id: `${input.id}-image-1`, url: input.image, name: "Primary product image", isPrimary: true }],
    deliveryType: "standard",
    logistics: { weightKG: 1, dimensions: "Standard Box" },
    variants: [{ id: `${input.id}-default`, label: "Option", value: "Default", sku: input.sku, stock: input.stock }],
    specifications: [
      { name: "Brand", value: input.brand },
      { name: "Condition", value: "Brand New" },
    ],
    seo: {
      metaTitle: `${input.title} | Zogular`,
      metaDescription: `Buy ${input.title} in Zambia through Zogular.`,
    },
    seller: DEFAULT_SELLER,
    moderation: normalizeModerationState(input.status, undefined, now),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeSellerProductRecord(product: SellerProductListing): SellerProductListing {
  const normalizedStatus = normalizeLegacyStatus(product.status);
  return {
    ...product,
    images: normalizeSellerProductImages(product.images),
    status: normalizedStatus,
    moderation: normalizeModerationState(normalizedStatus, product.moderation, product.updatedAt),
  };
}

function normalizeSellerProductImages(images: SellerProductImage[]): SellerProductImage[] {
  if (!images.length) {
    return [{ id: "fallback-image-1", url: FALLBACK_IMAGE, name: "Fallback product image", isPrimary: true }];
  }

  const normalizedImages = images.map((image, index) => {
    const nextUrl =
      image.url.startsWith("http://") ||
      image.url.startsWith("https://") ||
      image.url.startsWith("data:image/")
        ? image.url
        : FALLBACK_IMAGE;

    return {
      ...image,
      url: nextUrl,
      isPrimary: index === 0 ? true : image.isPrimary,
    };
  });

  if (normalizedImages.some((image) => image.isPrimary)) return normalizedImages;

  return normalizedImages.map((image, index) => ({
    ...image,
    isPrimary: index === 0,
  }));
}

function normalizeLegacyStatus(status: SellerProductStatus | "active" | "review"): SellerProductStatus {
  if (status === "active") return "published";
  if (status === "review") return "pending_review";
  return status;
}

function normalizeModerationState(
  status: SellerProductStatus,
  moderation: ProductModerationState | undefined,
  timestamp: string,
): ProductModerationState {
  const submittedAt =
    status === "draft"
      ? null
      : moderation?.submittedAt ??
        (status === "pending_review" || status === "approved" || status === "rejected" || status === "needs_changes" || status === "published" || status === "suspended"
          ? timestamp
          : null);
  const reviewedAt =
    status === "pending_review" || status === "draft"
      ? null
      : moderation?.reviewedAt ??
        (status === "approved" || status === "rejected" || status === "needs_changes" || status === "published" || status === "suspended"
          ? timestamp
          : null);

  return {
    submittedAt,
    reviewedAt,
    reviewedBy: reviewedAt ? moderation?.reviewedBy ?? null : null,
    moderationNotes: moderation?.moderationNotes ?? null,
    moderationFlags: moderation?.moderationFlags ?? [],
    riskScore: moderation?.riskScore ?? null,
    duplicateWarnings: moderation?.duplicateWarnings ?? [],
    categorySuggestions: moderation?.categorySuggestions ?? [],
    imageSafetyWarnings: moderation?.imageSafetyWarnings ?? [],
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
  return [{ id: `${product.id}-default`, label: "Option", value: "Default", swatchClass: "bg-zinc-200 border-zinc-200" }];
}

function buildProductId(sku: string): string {
  return `ZM-P-${slugifySellerValue(sku).slice(0, 12).toUpperCase()}-${Date.now().toString().slice(-4)}`;
}

function buildUniqueSlug(title: string, id: string): string {
  return `${slugifySellerValue(title)}-${id.toLowerCase()}`;
}

function formatCondition(condition: ProductCondition): string {
  const labels: Record<ProductCondition, string> = {
    new: "Brand New",
    "used-like-new": "Used - Like New",
    "used-good": "Used - Good",
    refurbished: "Refurbished",
  };
  return labels[condition];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
