import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/product";
import { migrateLocalStorageValue } from "@/lib/persisted-storage";

import { getStoredAuthUser } from "@/services/auth-session";
import { getWishlistItems, addWishlistItem as apiAddWishlistItem, removeWishlistItem as apiRemoveWishlistItem } from "@/services/wishlist-api";

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
          const items = remoteItems.map((ri) => ({
            ...(ri.product as unknown as WishlistItem),
            image: ri.product.images?.[0] || ri.product.image || "/placeholder.png",
          }));
          const remoteItemIds: Record<string, string> = {};
          remoteItems.forEach((ri) => {
            remoteItemIds[ri.productId] = ri.id;
          });
          set(buildWishlistState(items, remoteItemIds));
        } catch (e) {
          console.error("Failed to sync wishlist", e);
        }
      },

      addItem: async (item) => {
        const currentItems = get().items;
        const exists = currentItems.some((wishlistItem) => wishlistItem.id === item.id);
        if (exists) return;

        const currentRemoteItemIds = get().remoteItemIds;
        set(buildWishlistState([...currentItems, item], currentRemoteItemIds));

        const user = getStoredAuthUser();
        if (user) {
          try {
            const added = await apiAddWishlistItem(String(item.id));
            set(
              buildWishlistState([...currentItems, item], {
                ...get().remoteItemIds,
                [item.id]: added.id,
              })
            );
          } catch (e) {
            console.error("Failed to add to remote wishlist", e);
            const rolledBackItems = get().items.filter((i) => i.id !== item.id);
            set(buildWishlistState(rolledBackItems, get().remoteItemIds));
          }
        }
      },

      removeItem: async (id) => {
        const currentItems = get().items;
        const itemToRemove = currentItems.find((i) => i.id === id);
        if (!itemToRemove) return;

        const currentRemoteItemIds = get().remoteItemIds;
        const nextItems = currentItems.filter((item) => item.id !== id);
        set(buildWishlistState(nextItems, currentRemoteItemIds));

        const user = getStoredAuthUser();
        if (user) {
          try {
            const remoteId = currentRemoteItemIds[String(id)];
            if (remoteId) {
              await apiRemoveWishlistItem(remoteId);
              const nextRemoteIds = { ...get().remoteItemIds };
              delete nextRemoteIds[String(id)];
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
        const exists = get().items.some((wishlistItem) => wishlistItem.id === item.id);
        if (exists) {
          void get().removeItem(item.id);
          return;
        }
        void get().addItem(item);
      },

      hasItem: (id) => get().items.some((item) => item.id === id),

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
