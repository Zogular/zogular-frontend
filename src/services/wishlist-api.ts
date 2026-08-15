import { apiClient } from "./api";
import type { BackendProduct } from "@/types/backend-order";

const WISHLIST_PAGE_LIMIT = 100;
const WISHLIST_MAX_PAGES = 100;

export type WishlistContractErrorCode =
  | "MALFORMED_RESPONSE"
  | "PAGINATION_LIMIT_EXCEEDED"
  | "PAGINATION_CHANGED"
  | "DUPLICATE_ITEM";

export class WishlistContractError extends Error {
  constructor(
    public readonly code: WishlistContractErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "WishlistContractError";
  }
}

export interface BackendWishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: BackendProduct;
}

interface WishlistPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface WishlistPage {
  items: BackendWishlistItem[];
  pagination: WishlistPagination;
}

export type WishlistPageFetcher = (page: number, limit: number) => Promise<unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const isNonNegativeInteger = (value: unknown): value is number => (
  typeof value === "number" && Number.isInteger(value) && value >= 0
);

function malformed(message: string): never {
  throw new WishlistContractError("MALFORMED_RESPONSE", message);
}

function parseWishlistItem(value: unknown): BackendWishlistItem {
  if (!isRecord(value)) malformed("Wishlist response contained an invalid item.");
  if (typeof value.id !== "string" || !value.id) malformed("Wishlist item ID is missing.");
  if (typeof value.productId !== "string" || !value.productId) malformed("Wishlist product ID is missing.");
  if (typeof value.createdAt !== "string" || !value.createdAt) malformed("Wishlist creation date is missing.");
  if (!isRecord(value.product) || typeof value.product.id !== "string" || !value.product.id) {
    malformed("Wishlist product data is invalid.");
  }
  return value as unknown as BackendWishlistItem;
}

function parseWishlistPage(value: unknown, requestedPage: number): WishlistPage {
  if (!isRecord(value) || value.status !== "success") malformed("Wishlist response status is invalid.");
  if (!isNonNegativeInteger(value.results)) malformed("Wishlist result count is invalid.");
  if (!isRecord(value.pagination)) malformed("Wishlist pagination is missing.");
  if (!isRecord(value.data) || !Array.isArray(value.data.items)) malformed("Wishlist items are missing.");

  const { total, page, limit, pages } = value.pagination;
  if (
    !isNonNegativeInteger(total)
    || !isNonNegativeInteger(page)
    || !isNonNegativeInteger(limit)
    || !isNonNegativeInteger(pages)
    || page !== requestedPage
    || limit !== WISHLIST_PAGE_LIMIT
    || pages !== Math.ceil(total / limit)
  ) {
    malformed("Wishlist pagination metadata is invalid.");
  }

  const items = value.data.items.map(parseWishlistItem);
  const expectedPageResults = pages === 0
    ? 0
    : requestedPage < pages
      ? limit
      : total - ((requestedPage - 1) * limit);
  if (value.results !== items.length || items.length !== expectedPageResults) {
    malformed("Wishlist page results do not match pagination metadata.");
  }

  return { items, pagination: { total, page, limit, pages } };
}

async function fetchWishlistPage(page: number, limit: number): Promise<unknown> {
  return apiClient<unknown>("/wishlist", { query: { page, limit } });
}

export async function collectCompleteWishlist(
  fetchPage: WishlistPageFetcher = fetchWishlistPage,
): Promise<BackendWishlistItem[]> {
  const firstPage = parseWishlistPage(await fetchPage(1, WISHLIST_PAGE_LIMIT), 1);
  const expected = firstPage.pagination;
  if (expected.pages > WISHLIST_MAX_PAGES) {
    throw new WishlistContractError(
      "PAGINATION_LIMIT_EXCEEDED",
      `Wishlist exceeds the ${WISHLIST_MAX_PAGES * WISHLIST_PAGE_LIMIT}-item synchronization limit.`,
    );
  }

  const items = [...firstPage.items];
  const itemIds = new Set<string>();
  const productIds = new Set<string>();
  const recordUniqueItems = (pageItems: BackendWishlistItem[]) => {
    for (const item of pageItems) {
      if (itemIds.has(item.id) || productIds.has(item.productId)) {
        throw new WishlistContractError("DUPLICATE_ITEM", "Wishlist pagination returned a duplicate item.");
      }
      itemIds.add(item.id);
      productIds.add(item.productId);
    }
  };
  recordUniqueItems(firstPage.items);

  for (let page = 2; page <= expected.pages; page += 1) {
    const nextPage = parseWishlistPage(await fetchPage(page, WISHLIST_PAGE_LIMIT), page);
    if (
      nextPage.pagination.total !== expected.total
      || nextPage.pagination.limit !== expected.limit
      || nextPage.pagination.pages !== expected.pages
    ) {
      throw new WishlistContractError("PAGINATION_CHANGED", "Wishlist pagination changed during synchronization.");
    }
    recordUniqueItems(nextPage.items);
    items.push(...nextPage.items);
  }

  if (items.length !== expected.total) malformed("Wishlist retrieval did not return every item.");
  return items;
}

export async function getWishlistItems(): Promise<BackendWishlistItem[]> {
  return collectCompleteWishlist();
}

export async function addWishlistItem(productId: string): Promise<BackendWishlistItem> {
  const data = await apiClient<{ data: { item: BackendWishlistItem } }>("/wishlist/items", {
    method: "POST",
    body: JSON.stringify({ productId }),
    csrf: true,
  });
  return data.data.item;
}

export async function removeWishlistItem(wishlistItemId: string): Promise<void> {
  await apiClient(`/wishlist/items/${wishlistItemId}`, {
    method: "DELETE",
    csrf: true,
  });
}
