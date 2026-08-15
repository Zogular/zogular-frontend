import type { Product, ProductDetail, ProductInput } from "@/types/product";

export class ProductContractError extends Error {
  constructor(
    message: string,
    readonly field: "id" | "slug" | "title" | "price",
  ) {
    super(message);
    this.name = "ProductContractError";
  }
}

function requireProductIdentity(value: ProductInput["id"]): ProductInput["id"] {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new ProductContractError("Product response is missing a valid id.", "id");
}

function requireProductText(value: unknown, field: "slug" | "title"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new ProductContractError(`Product response is missing a valid ${field}.`, field);
}

function requireProductPrice(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  throw new ProductContractError("Product response is missing a valid price.", "price");
}

export function normalizeProduct(input: ProductInput): Product {
  const id = requireProductIdentity(input.id);
  const slug = requireProductText(input.slug, "slug");
  const title = requireProductText(input.title, "title");
  const price = requireProductPrice(input.price);
  const originalPrice = input.oldPrice ?? input.originalPrice ?? null;
  const discount =
    input.discount ??
    (originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null);
  const hasValidRating = Number.isInteger(input.reviews)
    && Number(input.reviews) > 0
    && Number.isFinite(input.rating)
    && Number(input.rating) > 0
    && Number(input.rating) <= 5;

  return {
    id,
    slug,
    title,
    name: input.name ?? title,
    categoryName: input.categoryName,
    subcategoryName: input.subcategoryName,
    price,
    oldPrice: input.oldPrice ?? originalPrice,
    originalPrice,
    discount,
    badge: input.badge ?? (input.isNew ? "New" : null),
    isNew: input.isNew ?? false,
    rating: hasValidRating ? Number(input.rating) : 0,
    reviews: hasValidRating ? Number(input.reviews) : 0,
    image: input.image ?? "",
    imageAlt: input.imageAlt?.trim() || title,
    images: input.images,
    ownerId: input.ownerId,
    stock: input.stock,
    moderationStatus: input.moderationStatus,
    sellerVisibility: input.sellerVisibility,
    storeName: input.storeName,
  };
}

export function getProductTitle(product: Product): string {
  return requireProductText(product.title ?? product.name, "title");
}

export function getProductCategoryLabel(product: Product): string | undefined {
  return product.subcategoryName ?? product.categoryName;
}

export function getProductOldPrice(product: Product): number | null {
  return product.oldPrice ?? product.originalPrice ?? null;
}

export function toProductFromDetail(product: ProductDetail): Product {
  return normalizeProduct({
    id: product.id,
    slug: product.slug,
    title: product.title,
    categoryName: product.category.name,
    subcategoryName: product.subcategory.name,
    price: product.price,
    originalPrice: product.originalPrice,
    badge: product.badge,
    rating: product.rating,
    reviews: product.reviewCount,
    image: product.images[0] ?? "",
    imageAlt: product.title,
    ownerId: product.ownerId,
  });
}
