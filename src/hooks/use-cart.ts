import { create } from "zustand";
import { persist } from "zustand/middleware";
import { migrateLocalStorageValue } from "@/lib/persisted-storage";
import {
  addBackendCartItem,
  canSyncCartItem,
  clearBackendCart,
  getBackendCart,
  pushLocalCartToBackend,
  removeBackendCartItem,
  updateBackendCartItem,
} from "@/services/cart";
import { getStoredAuthUser } from "@/services/auth-session";
import type { CartItem, CartItemIdentity } from "@/types/cart";

export type { CartItem, CartItemIdentity } from "@/types/cart";

type CartSyncStatus = "idle" | "syncing" | "error";

interface CartStore {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  hasHydrated: boolean;
  syncStatus: CartSyncStatus;
  syncError: string | null;
  setHasHydrated: (value: boolean) => void;
  addItem: (item: CartItem) => void;
  removeItem: (identity: CartItemIdentity) => void;
  increaseQuantity: (identity: CartItemIdentity) => void;
  decreaseQuantity: (identity: CartItemIdentity) => void;
  clearCart: () => void;
  syncWithBackend: () => Promise<void>;
  pullBackendCart: () => Promise<void>;
}

function isSameCartLine(
  item: CartItem,
  identity: CartItemIdentity,
): boolean {
  return item.id === identity.id && (item.variant ?? null) === (identity.variant ?? null);
}

function calculateItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function calculateTotalAmount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function buildCartState(items: CartItem[]) {
  return {
    items,
    itemCount: calculateItemCount(items),
    totalAmount: calculateTotalAmount(items),
  };
}

function getSyncErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Cart sync failed.";
}

function canUseBackendCart(): boolean {
  return Boolean(getStoredAuthUser());
}

function reconcileBackendItems(
  backendItems: CartItem[],
  localItems: CartItem[],
): CartItem[] {
  const localByProductId = new Map(localItems.map((item) => [String(item.id), item]));
  const backendProductIds = new Set(backendItems.map((item) => String(item.id)));

  const reconciledBackendItems = backendItems.map((item) => {
    const localItem = localByProductId.get(String(item.id));
    return {
      ...item,
      variant: localItem?.variant ?? item.variant ?? null,
    };
  });

  const localOnlyItems = localItems.filter((item) => {
    if (!canSyncCartItem(item)) return true;
    return !backendProductIds.has(String(item.id));
  });

  return [...reconciledBackendItems, ...localOnlyItems];
}

async function pullBackendCartIntoStore(
  set: (partial: Partial<CartStore>) => void,
  get: () => CartStore,
): Promise<void> {
  const backendItems = await getBackendCart();
  const nextItems = reconcileBackendItems(backendItems, get().items);
  set({
    ...buildCartState(nextItems),
    syncStatus: "idle",
    syncError: null,
  });
}

function runBackendMutation(
  set: (partial: Partial<CartStore>) => void,
  get: () => CartStore,
  operation: () => Promise<void>,
): void {
  if (!canUseBackendCart()) return;

  set({ syncStatus: "syncing", syncError: null });

  void operation()
    .then(() => pullBackendCartIntoStore(set, get))
    .catch((error) => {
      set({
        syncStatus: "error",
        syncError: getSyncErrorMessage(error),
      });
    });
}

const CART_STORAGE_KEY = "zogular-cart-storage";

migrateLocalStorageValue(CART_STORAGE_KEY, ["zamoyo-cart-storage"]);

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      itemCount: 0,
      totalAmount: 0,
      hasHydrated: false,
      syncStatus: "idle",
      syncError: null,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      addItem: (newItem) => {
        const currentItems = get().items;
        const normalizedQuantity = Math.max(1, newItem.quantity || 1);

        const existingItem = currentItems.find((item) =>
          isSameCartLine(item, {
            id: newItem.id,
            variant: newItem.variant,
          }),
        );

        if (existingItem) {
          const nextItems = currentItems.map((item) =>
            isSameCartLine(item, { id: newItem.id, variant: newItem.variant })
              ? { ...item, quantity: item.quantity + normalizedQuantity }
              : item,
          );

          set(buildCartState(nextItems));
        } else {
          const nextItems = [
            ...currentItems,
            {
              ...newItem,
              quantity: normalizedQuantity,
              variant: newItem.variant ?? null,
            },
          ];

          set(buildCartState(nextItems));
        }

        if (canSyncCartItem(newItem)) {
          runBackendMutation(set, get, () =>
            addBackendCartItem({
              productId: newItem.id,
              quantity: normalizedQuantity,
            }),
          );
        }
      },

      removeItem: (identity) => {
        const currentItems = get().items;
        const targetItem = currentItems.find((item) => isSameCartLine(item, identity));
        const nextItems = currentItems.filter(
          (item) => !isSameCartLine(item, identity),
        );

        set(buildCartState(nextItems));

        if (targetItem?.serverCartItemId) {
          runBackendMutation(set, get, () =>
            removeBackendCartItem(targetItem.serverCartItemId!),
          );
        }
      },

      increaseQuantity: (identity) => {
        const currentItems = get().items;
        const targetItem = currentItems.find((item) => isSameCartLine(item, identity));

        const nextItems = currentItems.map((item) =>
          isSameCartLine(item, identity)
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );

        set(buildCartState(nextItems));

        if (targetItem?.serverCartItemId) {
          runBackendMutation(set, get, () =>
            updateBackendCartItem({
              itemId: targetItem.serverCartItemId!,
              quantity: targetItem.quantity + 1,
            }),
          );
        } else if (targetItem && canSyncCartItem(targetItem)) {
          runBackendMutation(set, get, () =>
            addBackendCartItem({
              productId: targetItem.id,
              quantity: 1,
            }),
          );
        }
      },

      decreaseQuantity: (identity) => {
        const currentItems = get().items;
        const targetItem = currentItems.find((item) =>
          isSameCartLine(item, identity),
        );

        if (!targetItem) return;

        if (targetItem.quantity <= 1) {
          const nextItems = currentItems.filter(
            (item) => !isSameCartLine(item, identity),
          );
          set(buildCartState(nextItems));

          if (targetItem.serverCartItemId) {
            runBackendMutation(set, get, () =>
              removeBackendCartItem(targetItem.serverCartItemId!),
            );
          }
          return;
        }

        const nextQuantity = targetItem.quantity - 1;
        const nextItems = currentItems.map((item) =>
          isSameCartLine(item, identity)
            ? { ...item, quantity: nextQuantity }
            : item,
        );

        set(buildCartState(nextItems));

        if (targetItem.serverCartItemId) {
          runBackendMutation(set, get, () =>
            updateBackendCartItem({
              itemId: targetItem.serverCartItemId!,
              quantity: nextQuantity,
            }),
          );
        }
      },

      clearCart: () => {
        set(buildCartState([]));
        runBackendMutation(set, get, clearBackendCart);
      },

      syncWithBackend: async () => {
        if (!canUseBackendCart()) return;

        try {
          set({ syncStatus: "syncing", syncError: null });
          await pushLocalCartToBackend(get().items);
          await pullBackendCartIntoStore(set, get);
        } catch (error) {
          set({
            syncStatus: "error",
            syncError: getSyncErrorMessage(error),
          });
          throw error;
        }
      },

      pullBackendCart: async () => {
        if (!canUseBackendCart()) return;

        try {
          set({ syncStatus: "syncing", syncError: null });
          await pullBackendCartIntoStore(set, get);
        } catch (error) {
          set({
            syncStatus: "error",
            syncError: getSyncErrorMessage(error),
          });
          throw error;
        }
      },
    }),
    {
      name: CART_STORAGE_KEY,
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const restoredState = buildCartState(state.items);
        state.items = restoredState.items;
        state.itemCount = restoredState.itemCount;
        state.totalAmount = restoredState.totalAmount;
        state.setHasHydrated(true);
      },
    },
  ),
);
