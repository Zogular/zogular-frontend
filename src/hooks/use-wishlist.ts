import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/product";
import { migrateLocalStorageValue } from "@/lib/persisted-storage";

import { getStoredAuthUser } from "@/services/auth-session";
import { getWishlistItems, addWishlistItem as apiAddWishlistItem, removeWishlistItem as apiRemoveWishlistItem } from "@/services/wishlist-api";
import { getBackendProductImage } from "@/types/backend-order";

export type WishlistItem = Product;

interface WishlistStore {
  items: WishlistItem[];
  remoteItemIds: Record<string, string>;
  itemCount: number;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  addItem: (item: WishlistItem) => Promise<void>;
  removeItem: (id: string | number) => Promise<void>;
  toggleItem: (item: WishlistItem) => void;
  hasItem: (id: string | number) => boolean;
  clearWishlist: () => void;
  syncBackend: () => Promise<void>;
}

const normalizeWishlistId = (id: string | number) => String(id);

function buildWishlistState(items: WishlistItem[], remoteItemIds: Record<string, string>) {
  return {
    items,
    itemCount: items.length,
    remoteItemIds,
  };
}

const WISHLIST_STORAGE_KEY = "zogular-wishlist-storage";

migrateLocalStorageValue(WISHLIST_STORAGE_KEY, ["zamoyo-wishlist-storage"]);

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      remoteItemIds: {},
      itemCount: 0,
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      syncBackend: async () => {
        const user = getStoredAuthUser();
        if (!user) return;
        try {
          const remoteItems = await getWishlistItems();
          const items: WishlistItem[] = remoteItems.map((ri) => ({
            id: ri.product.id || ri.productId,
            slug: typeof ri.product.slug === "string" ? ri.product.slug : String(ri.product.id || ri.productId),
            title: ri.product.title || ri.product.name,
            name: ri.product.name || ri.product.title,
            price: typeof ri.product.price === "number" ? ri.product.price : 0,
            rating: typeof ri.product.rating === "number" ? ri.product.rating : 0,
            reviews: typeof ri.product.reviews === "number" ? ri.product.reviews : (typeof ri.product.reviewCount === "number" ? ri.product.reviewCount : 0),
            image: getBackendProductImage(ri.product),
          }));
          const remoteItemIds: Record<string, string> = {};
          remoteItems.forEach((ri) => {
            remoteItemIds[normalizeWishlistId(ri.productId)] = ri.id;
          });
          set(buildWishlistState(items, remoteItemIds));
        } catch (e) {
          console.error("Failed to sync wishlist", e);
        }
      },

      addItem: async (item) => {
        const normalizedId = normalizeWishlistId(item.id);
        const currentItems = get().items;
        const exists = currentItems.some((wishlistItem) => normalizeWishlistId(wishlistItem.id) === normalizedId);
        if (exists) return;

        const currentRemoteItemIds = get().remoteItemIds;
        set(buildWishlistState([...currentItems, item], currentRemoteItemIds));

        const user = getStoredAuthUser();
        if (user) {
          try {
            const added = await apiAddWishlistItem(normalizedId);
            set(
              buildWishlistState([...currentItems, item], {
                ...get().remoteItemIds,
                [normalizedId]: added.id,
              })
            );
          } catch (e) {
            console.error("Failed to add to remote wishlist", e);
            const rolledBackItems = get().items.filter((i) => normalizeWishlistId(i.id) !== normalizedId);
            set(buildWishlistState(rolledBackItems, get().remoteItemIds));
          }
        }
      },

      removeItem: async (id) => {
        const normalizedId = normalizeWishlistId(id);
        const currentItems = get().items;
        const itemToRemove = currentItems.find((i) => normalizeWishlistId(i.id) === normalizedId);
        if (!itemToRemove) return;

        const currentRemoteItemIds = get().remoteItemIds;
        const nextItems = currentItems.filter((item) => normalizeWishlistId(item.id) !== normalizedId);
        set(buildWishlistState(nextItems, currentRemoteItemIds));

        const user = getStoredAuthUser();
        if (user) {
          try {
            const remoteId = currentRemoteItemIds[normalizedId];
            if (remoteId) {
              await apiRemoveWishlistItem(remoteId);
              const nextRemoteIds = { ...get().remoteItemIds };
              delete nextRemoteIds[normalizedId];
              set(buildWishlistState(get().items, nextRemoteIds));
            }
          } catch (e) {
            console.error("Failed to remove from remote wishlist", e);
            const rolledBackItems = [...get().items, itemToRemove];
            set(buildWishlistState(rolledBackItems, get().remoteItemIds));
          }
        }
      },

      toggleItem: (item) => {
        const normalizedId = normalizeWishlistId(item.id);
        const exists = get().items.some((wishlistItem) => normalizeWishlistId(wishlistItem.id) === normalizedId);
        if (exists) {
          void get().removeItem(item.id);
          return;
        }
        void get().addItem(item);
      },

      hasItem: (id) => {
        const normalizedId = normalizeWishlistId(id);
        return get().items.some((item) => normalizeWishlistId(item.id) === normalizedId);
      },

      clearWishlist: () => set(buildWishlistState([], {})),
    }),
    {
      name: WISHLIST_STORAGE_KEY,
      partialize: (state) => ({ items: state.items, remoteItemIds: state.remoteItemIds }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const restoredState = buildWishlistState(state.items || [], state.remoteItemIds || {});
        state.items = restoredState.items;
        state.itemCount = restoredState.itemCount;
        state.remoteItemIds = restoredState.remoteItemIds;
        state.setHasHydrated(true);
      },
    },
  ),
);
