import type { CartItem } from "@/types/cart";
import type { Product } from "@/types/product";
import { getProductTitle } from "@/lib/normalizers/product";

export function isKnownStock(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;
}

export function toCartItem(
  product: Product,
  options?: { quantity?: number; variant?: string | null },
): CartItem {
  return {
    id: product.id,
    slug: product.slug,
    name: getProductTitle(product),
    price: product.price,
    image: product.image,
    quantity: options?.quantity ?? 1,
    ...(isKnownStock(product.stock) ? { knownStock: product.stock } : {}),
    variant: options?.variant ?? null,
  };
}
