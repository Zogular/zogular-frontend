import { apiClient } from "./api";
import type { BackendProduct } from "@/types/backend-order";

export interface BackendWishlistItem {
  id: string;
  productId: string;
  createdAt: string;
  product: BackendProduct;
}

export async function getWishlistItems(): Promise<BackendWishlistItem[]> {
  const data = await apiClient<{ data: { items: BackendWishlistItem[] } }>("/wishlist");
  return data.data.items;
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
