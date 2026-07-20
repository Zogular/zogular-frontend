import type { Product, ProductDetail, ProductInput } from "@/types/product";

export function normalizeProduct(input: ProductInput): Product {
  const title = input.title ?? input.name ?? "Product Name";
  const originalPrice = input.oldPrice ?? input.originalPrice ?? null;
  const discount =
    input.discount ??
    (originalPrice && originalPrice > input.price
      ? Math.round(((originalPrice - input.price) / originalPrice) * 100)
      : null);

  return {
    id: input.id,
    slug: input.slug,
    title,
    name: input.name ?? title,
    categoryName: input.categoryName,
    subcategoryName: input.subcategoryName,
    price: input.price,
    oldPrice: input.oldPrice ?? originalPrice,
    originalPrice,
    discount,
    badge: input.badge ?? (input.isNew ? "New" : null),
    isNew: input.isNew ?? false,
    rating: input.rating ?? 0,
    reviews: input.reviews ?? 0,
    image: input.image,
    stock: input.stock,
    moderationStatus: input.moderationStatus,
    sellerVisibility: input.sellerVisibility,
    storeName: input.storeName,
  };
}

export function getProductTitle(product: Product): string {
  return product.title ?? product.name ?? "Product Name";
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
  });
}
