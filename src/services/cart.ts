import { apiClient } from "@/services/api";
import type { CartItem } from "@/types/cart";

const PRODUCT_IMAGE_PLACEHOLDER = "/file.svg";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BackendCartProduct = {
  id?: string;
  title?: string | null;
  description?: string | null;
  price?: number | string | null;
  salePrice?: number | string | null;
  images?: unknown;
  slug?: string | null;
  isApproved?: boolean | null;
  isSold?: boolean | null;
};

type BackendCartItem = {
  id?: string;
  productId?: string;
  quantity?: number;
  product?: BackendCartProduct | null;
};

type BackendCartResponse = {
  data?: {
    cart?: {
      items?: BackendCartItem[];
    };
    cartItem?: BackendCartItem;
  };
};

export function isBackendProductId(value: string | number): boolean {
  return UUID_PATTERN.test(String(value));
}

export function canSyncCartItem(item: Pick<CartItem, "id">): boolean {
  return isBackendProductId(item.id);
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

function getEffectiveProductPrice(product: BackendCartProduct | null | undefined): number {
  const regularPrice = toNumber(product?.price);
  const salePrice = toNumber(product?.salePrice);

  if (salePrice > 0 && salePrice < regularPrice) {
    return salePrice;
  }

  return regularPrice;
}

function parseImages(value: unknown): string[] {
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
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeBackendCartItem(item: BackendCartItem): CartItem | null {
  const product = item.product;
  const productId = asString(item.productId) ?? asString(product?.id);
  const title = asString(product?.title);

  if (!productId || !title) return null;

  const images = parseImages(product?.images);

  return {
    id: productId,
    serverCartItemId: asString(item.id),
    slug: asString(product?.slug) ?? productId,
    name: title,
    price: getEffectiveProductPrice(product),
    image: images[0] ?? PRODUCT_IMAGE_PLACEHOLDER,
    quantity: Math.max(1, Math.trunc(toNumber(item.quantity, 1))),
    variant: null,
  };
}

function normalizeBackendCart(payload: BackendCartResponse): CartItem[] {
  const items = payload.data?.cart?.items ?? [];
  return items
    .map(normalizeBackendCartItem)
    .filter((item): item is CartItem => Boolean(item));
}

function groupSyncableItems(items: CartItem[]): { productId: string; quantity: number }[] {
  const grouped = new Map<string, number>();

  for (const item of items) {
    if (!canSyncCartItem(item)) continue;
    if (item.serverCartItemId) continue;

    const productId = String(item.id);
    grouped.set(productId, (grouped.get(productId) ?? 0) + Math.max(1, item.quantity));
  }

  return [...grouped.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export async function getBackendCart(): Promise<CartItem[]> {
  const payload = await apiClient<BackendCartResponse>("/cart", {
    method: "GET",
    cache: "no-store",
  });

  return normalizeBackendCart(payload);
}

export async function addBackendCartItem(input: {
  productId: string | number;
  quantity: number;
}): Promise<void> {
  await apiClient<unknown>("/cart/items", {
    method: "POST",
    csrf: true,
    body: JSON.stringify({
      productId: String(input.productId),
      quantity: Math.max(1, Math.trunc(input.quantity)),
    }),
  });
}

export async function updateBackendCartItem(input: {
  itemId: string;
  quantity: number;
}): Promise<void> {
  await apiClient<unknown>(`/cart/items/${input.itemId}`, {
    method: "PATCH",
    csrf: true,
    body: JSON.stringify({
      quantity: Math.max(1, Math.trunc(input.quantity)),
    }),
  });
}

export async function removeBackendCartItem(itemId: string): Promise<void> {
  await apiClient<unknown>(`/cart/items/${itemId}`, {
    method: "DELETE",
    csrf: true,
  });
}

export async function clearBackendCart(): Promise<void> {
  await apiClient<unknown>("/cart/clear", {
    method: "DELETE",
    csrf: true,
  });
}

export async function pushLocalCartToBackend(items: CartItem[]): Promise<void> {
  const syncableItems = groupSyncableItems(items);

  if (!syncableItems.length) return;

  await apiClient<unknown>("/cart/items/bulk", {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ items: syncableItems }),
  });
}
