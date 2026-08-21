import { apiClient } from "@/services/api";
import type { CartItem } from "@/types/cart";

const PRODUCT_IMAGE_PLACEHOLDER = "/file.svg";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_CART_QUANTITY = 99;

export type CartContractErrorCode =
  | "MALFORMED_RESPONSE"
  | "MALFORMED_ITEM"
  | "DUPLICATE_ITEM"
  | "INCONSISTENT_SUMMARY";

export class CartContractError extends Error {
  constructor(
    message: string,
    readonly code: CartContractErrorCode,
  ) {
    super(message);
    this.name = "CartContractError";
  }
}

export function isBackendProductId(value: string | number): boolean {
  return UUID_PATTERN.test(String(value));
}

export function canSyncCartItem(item: Pick<CartItem, "id">): boolean {
  return isBackendProductId(item.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new CartContractError(`Cart item has an invalid ${field}.`, "MALFORMED_ITEM");
}

function requireUuid(value: unknown, field: string): string {
  const result = requireNonEmptyString(value, field);
  if (UUID_PATTERN.test(result)) return result;
  throw new CartContractError(`Cart item has an invalid ${field}.`, "MALFORMED_ITEM");
}

function requireMoney(value: unknown, field: string, allowZero = false): number {
  const result = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim()
      ? Number(value)
      : Number.NaN;
  if (Number.isFinite(result) && (allowZero ? result >= 0 : result > 0)) return result;
  throw new CartContractError(`Cart item has an invalid ${field}.`, "MALFORMED_ITEM");
}

function requireQuantity(value: unknown): number {
  if (
    typeof value === "number"
    && Number.isInteger(value)
    && value >= 1
    && value <= MAX_CART_QUANTITY
  ) return value;
  throw new CartContractError("Cart item has an invalid quantity.", "MALFORMED_ITEM");
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.005;
}

function parseImageUrl(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!isRecord(value) || typeof value.url !== "string") return null;
  return value.url.trim() || null;
}

function parseImages(value: unknown): string[] {
  let candidate = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      throw new CartContractError("Cart item images are malformed.", "MALFORMED_ITEM");
    }
  }
  if (!Array.isArray(candidate)) {
    throw new CartContractError("Cart item images are malformed.", "MALFORMED_ITEM");
  }
  const urls = candidate.map(parseImageUrl);
  if (urls.some((url) => url === null)) {
    throw new CartContractError("Cart item images are malformed.", "MALFORMED_ITEM");
  }
  return urls as string[];
}

function parseCartItem(value: unknown): { item: CartItem; lineTotal: number } {
  if (!isRecord(value) || !isRecord(value.product)) {
    throw new CartContractError("Cart contains a malformed item.", "MALFORMED_ITEM");
  }

  const serverCartItemId = requireUuid(value.id, "cart item id");
  const productId = requireUuid(value.productId, "product id");
  const productIdFromProduct = requireUuid(value.product.id, "product identity");
  if (productId !== productIdFromProduct) {
    throw new CartContractError("Cart item product identity is inconsistent.", "MALFORMED_ITEM");
  }

  const quantity = requireQuantity(value.quantity);
  const price = requireMoney(value.product.price, "price");
  const lineTotal = requireMoney(value.itemTotal, "line total");
  if (!nearlyEqual(lineTotal, price * quantity)) {
    throw new CartContractError("Cart item total is inconsistent.", "MALFORMED_ITEM");
  }
  const images = parseImages(value.product.images);

  return {
    item: {
      id: productId,
      serverCartItemId,
      slug: requireNonEmptyString(value.product.slug, "slug"),
      name: requireNonEmptyString(value.product.title, "title"),
      price,
      image: images[0] ?? PRODUCT_IMAGE_PLACEHOLDER,
      quantity,
      variant: null,
    },
    lineTotal,
  };
}

function requireSummaryInteger(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  throw new CartContractError(`Cart summary has an invalid ${field}.`, "INCONSISTENT_SUMMARY");
}

function requireSummaryMoney(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  throw new CartContractError(`Cart summary has an invalid ${field}.`, "INCONSISTENT_SUMMARY");
}

export function parseBackendCartResponse(payload: unknown): CartItem[] {
  if (!isRecord(payload) || payload.status !== "success" || !isRecord(payload.data)) {
    throw new CartContractError("Cart response is malformed.", "MALFORMED_RESPONSE");
  }
  const cart = payload.data.cart;
  if (!isRecord(cart) || !UUID_PATTERN.test(String(cart.id ?? "")) || !Array.isArray(cart.items)) {
    throw new CartContractError("Cart response is missing a valid cart.", "MALFORMED_RESPONSE");
  }
  if (!isRecord(cart.summary)) {
    throw new CartContractError("Cart response is missing its summary.", "INCONSISTENT_SUMMARY");
  }

  const parsed = cart.items.map(parseCartItem);
  const cartItemIds = parsed.map(({ item }) => item.serverCartItemId!);
  const productIds = parsed.map(({ item }) => String(item.id));
  if (
    new Set(cartItemIds).size !== cartItemIds.length
    || new Set(productIds).size !== productIds.length
  ) {
    throw new CartContractError("Cart contains duplicate items.", "DUPLICATE_ITEM");
  }

  const itemCount = parsed.reduce((total, { item }) => total + item.quantity, 0);
  const subtotal = parsed.reduce((total, item) => total + item.lineTotal, 0);
  const summaryTotalItems = requireSummaryInteger(cart.summary.totalItems, "item count");
  const summaryUniqueItems = requireSummaryInteger(cart.summary.uniqueItems, "unique item count");
  const summarySubtotal = requireSummaryMoney(cart.summary.subtotal, "subtotal");
  if (
    summaryTotalItems !== itemCount
    || summaryUniqueItems !== parsed.length
    || !nearlyEqual(summarySubtotal, subtotal)
  ) {
    throw new CartContractError("Cart summary does not match its items.", "INCONSISTENT_SUMMARY");
  }

  return parsed.map(({ item }) => item);
}

function assertMutationSuccess(payload: unknown): void {
  if (!isRecord(payload) || payload.status !== "success") {
    throw new CartContractError("Cart update response is malformed.", "MALFORMED_RESPONSE");
  }
}

function normalizeMutationQuantity(value: number): number {
  if (Number.isInteger(value) && value >= 1 && value <= MAX_CART_QUANTITY) return value;
  throw new CartContractError("Cart quantity is invalid.", "MALFORMED_ITEM");
}

export async function getBackendCart(): Promise<CartItem[]> {
  const payload = await apiClient<unknown>("/cart", {
    method: "GET",
    cache: "no-store",
  });
  return parseBackendCartResponse(payload);
}

export async function addBackendCartItem(input: {
  productId: string | number;
  quantity: number;
}): Promise<void> {
  if (!isBackendProductId(input.productId)) {
    throw new CartContractError("Cart product identity is invalid.", "MALFORMED_ITEM");
  }
  const payload = await apiClient<unknown>("/cart/items", {
    method: "POST",
    csrf: true,
    body: JSON.stringify({
      productId: String(input.productId),
      quantity: normalizeMutationQuantity(input.quantity),
    }),
  });
  assertMutationSuccess(payload);
}

export async function updateBackendCartItem(input: {
  itemId: string;
  quantity: number;
}): Promise<void> {
  if (!UUID_PATTERN.test(input.itemId)) {
    throw new CartContractError("Cart item identity is invalid.", "MALFORMED_ITEM");
  }
  const payload = await apiClient<unknown>(`/cart/items/${input.itemId}`, {
    method: "PATCH",
    csrf: true,
    body: JSON.stringify({ quantity: normalizeMutationQuantity(input.quantity) }),
  });
  assertMutationSuccess(payload);
}

export async function removeBackendCartItem(itemId: string): Promise<void> {
  if (!UUID_PATTERN.test(itemId)) {
    throw new CartContractError("Cart item identity is invalid.", "MALFORMED_ITEM");
  }
  const payload = await apiClient<unknown>(`/cart/items/${itemId}`, {
    method: "DELETE",
    csrf: true,
  });
  assertMutationSuccess(payload);
}

export async function clearBackendCart(): Promise<void> {
  const payload = await apiClient<unknown>("/cart/clear", {
    method: "DELETE",
    csrf: true,
  });
  assertMutationSuccess(payload);
}
