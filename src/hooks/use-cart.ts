import { create } from "zustand";
import { persist } from "zustand/middleware";
import { migrateLocalStorageValue } from "@/lib/persisted-storage";
import { ApiError } from "@/services/api";
import {
  addBackendCartItem,
  canSyncCartItem,
  clearBackendCart,
  getBackendCart,
  removeBackendCartItem,
  updateBackendCartItem,
} from "@/services/cart";
import { getStoredAuthUser } from "@/services/auth-session";
import type { CartItem, CartItemIdentity } from "@/types/cart";

export type { CartItem, CartItemIdentity } from "@/types/cart";

type CartSyncStatus = "idle" | "syncing" | "error";

type PendingAnonymousMerge = {
  item: CartItem;
  targetQuantity: number | null;
};

interface CartStore {
  items: CartItem[];
  itemCount: number;
  totalAmount: number;
  hasHydrated: boolean;
  syncStatus: CartSyncStatus;
  syncError: string | null;
  ownerId: string | null;
  pendingDeletions: string[];
  pendingAnonymousMerge: PendingAnonymousMerge[];
  setHasHydrated: (value: boolean) => void;
  addItem: (item: CartItem) => void;
  removeItem: (identity: CartItemIdentity) => void;
  increaseQuantity: (identity: CartItemIdentity) => void;
  decreaseQuantity: (identity: CartItemIdentity) => void;
  clearCart: () => void;
  syncWithBackend: () => Promise<void>;
  pullBackendCart: () => Promise<void>;
}

type OperationContext = {
  userId: string;
  generation: number;
  revision: number;
};

const CART_STORAGE_KEY = "zogular-cart-storage";

let activeIdentityId: string | null = null;
let operationGeneration = 0;
let operationRevision = 0;
const identityQueues = new Map<string, Promise<void>>();
const activeSynchronizations = new Map<string, Promise<void>>();

function isSameCartLine(item: CartItem, identity: CartItemIdentity): boolean {
  return item.id === identity.id && (item.variant ?? null) === (identity.variant ?? null);
}

function canSyncCartLine(item: Pick<CartItem, "id" | "variant">): boolean {
  return canSyncCartItem(item) && !item.variant;
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
  return error instanceof Error ? error.message : "Cart synchronization failed.";
}

function getCurrentUserId(): string | null {
  return getStoredAuthUser()?.id ?? null;
}

function invalidateOperations(nextIdentityId: string | null): void {
  activeIdentityId = nextIdentityId;
  operationGeneration += 1;
  operationRevision += 1;
}

function captureOperation(userId: string): OperationContext {
  operationRevision += 1;
  return {
    userId,
    generation: operationGeneration,
    revision: operationRevision,
  };
}

function captureSynchronization(userId: string): OperationContext {
  return {
    userId,
    generation: operationGeneration,
    revision: operationRevision,
  };
}

function isCurrentOperation(context: OperationContext): boolean {
  return (
    activeIdentityId === context.userId &&
    getCurrentUserId() === context.userId &&
    operationGeneration === context.generation &&
    operationRevision === context.revision
  );
}

function enqueueForIdentity(userId: string, task: () => Promise<void>): Promise<void> {
  const previous = identityQueues.get(userId) ?? Promise.resolve();
  const next = previous.then(task, task);
  const tracked = next.finally(() => {
    if (identityQueues.get(userId) === tracked) identityQueues.delete(userId);
  });
  identityQueues.set(userId, tracked);
  return tracked;
}

function normalizePendingMerge(items: CartItem[]): PendingAnonymousMerge[] {
  const grouped = new Map<string, PendingAnonymousMerge>();

  for (const item of items) {
    if (!canSyncCartLine(item)) continue;
    const key = String(item.id);
    const existing = grouped.get(key);
    if (existing) {
      existing.item.quantity += Math.max(1, item.quantity);
    } else {
      grouped.set(key, {
        item: { ...item, serverCartItemId: undefined, quantity: Math.max(1, item.quantity) },
        targetQuantity: null,
      });
    }
  }

  return [...grouped.values()];
}

function mergeBackendWithUnsyncableLocal(
  backendItems: CartItem[],
  localItems: CartItem[],
): CartItem[] {
  const unsyncableLocal = localItems.filter((item) => !canSyncCartLine(item));
  return [...backendItems, ...unsyncableLocal];
}

function updatePendingMergeQuantity(
  pendingMerge: PendingAnonymousMerge[],
  identity: CartItemIdentity,
  previousQuantity: number,
  nextQuantity: number,
): PendingAnonymousMerge[] {
  return pendingMerge.map((entry) => {
    if (!isSameCartLine(entry.item, identity)) return entry;

    const quantityDelta = nextQuantity - previousQuantity;
    return {
      ...entry,
      item: { ...entry.item, quantity: nextQuantity },
      targetQuantity:
        entry.targetQuantity === null
          ? null
          : Math.max(0, entry.targetQuantity + quantityDelta),
    };
  });
}

function removePendingMergeLine(
  pendingMerge: PendingAnonymousMerge[],
  identity: CartItemIdentity,
): PendingAnonymousMerge[] {
  return pendingMerge.flatMap((entry) => {
    if (!isSameCartLine(entry.item, identity)) return [entry];
    if (entry.targetQuantity === null) return [];

    return [{
      ...entry,
      item: { ...entry.item, quantity: 0 },
      targetQuantity: Math.max(0, entry.targetQuantity - entry.item.quantity),
    }];
  });
}

function hasPendingMergeLine(
  pendingMerge: PendingAnonymousMerge[],
  identity: CartItemIdentity,
): boolean {
  return pendingMerge.some((entry) => isSameCartLine(entry.item, identity));
}

function setPendingAbsoluteQuantity(
  pendingMerge: PendingAnonymousMerge[],
  item: CartItem,
  quantity: number,
): PendingAnonymousMerge[] {
  const identity = { id: item.id, variant: item.variant };
  if (hasPendingMergeLine(pendingMerge, identity)) {
    return pendingMerge.map((entry) =>
      isSameCartLine(entry.item, identity)
        ? {
            ...entry,
            item: { ...entry.item, quantity },
            targetQuantity: quantity,
          }
        : entry,
    );
  }

  return [
    ...pendingMerge,
    {
      item: { ...item, serverCartItemId: undefined, quantity },
      targetQuantity: quantity,
    },
  ];
}

function associateCurrentIdentity(
  set: (partial: Partial<CartStore>) => void,
  get: () => CartStore,
): string | null {
  const userId = getCurrentUserId();
  const state = get();

  if (!userId) {
    if (state.ownerId !== null || activeIdentityId !== null) {
      invalidateOperations(null);
      set({
        ...buildCartState(state.ownerId === null ? state.items : []),
        ownerId: null,
        pendingDeletions: [],
        pendingAnonymousMerge: [],
        syncStatus: "idle",
        syncError: null,
      });
    }
    return null;
  }

  if (activeIdentityId !== userId) invalidateOperations(userId);

  if (state.ownerId === userId) return userId;

  const isAnonymousCart = state.ownerId === null;
  const pendingAnonymousMerge = isAnonymousCart
    ? normalizePendingMerge(state.items)
    : [];
  const nextItems = isAnonymousCart ? state.items : [];

  // Ownership is established before the first account-bound request. A failed
  // first sync can therefore never become anonymous cart state on sign-out.
  set({
    ...buildCartState(nextItems),
    ownerId: userId,
    pendingDeletions: [],
    pendingAnonymousMerge,
    syncStatus: "idle",
    syncError: null,
  });

  return userId;
}

async function applyPendingDeletions(
  backendItems: CartItem[],
  pendingProductIds: string[],
  context: OperationContext,
): Promise<CartItem[]> {
  if (!pendingProductIds.length) return backendItems;
  const pending = new Set(pendingProductIds);

  for (const item of backendItems) {
    if (!pending.has(String(item.id)) || !item.serverCartItemId) continue;
    await removeBackendCartItem(item.serverCartItemId);
    if (!isCurrentOperation(context)) return backendItems;
  }

  return backendItems.filter((item) => !pending.has(String(item.id)));
}

async function applyAnonymousMerge(
  backendItems: CartItem[],
  pendingMerge: PendingAnonymousMerge[],
  context: OperationContext,
  set: (partial: Partial<CartStore>) => void,
): Promise<void> {
  if (!pendingMerge.length) return;
  const backendByProduct = new Map(backendItems.map((item) => [String(item.id), item]));
  const mergeWithTargets = pendingMerge.map((entry) => {
    if (entry.targetQuantity !== null) return entry;
    const backendQuantity = backendByProduct.get(String(entry.item.id))?.quantity ?? 0;
    return { ...entry, targetQuantity: backendQuantity + entry.item.quantity };
  });

  if (!isCurrentOperation(context)) return;
  set({ pendingAnonymousMerge: mergeWithTargets });

  for (const entry of mergeWithTargets) {
    const backendItem = backendByProduct.get(String(entry.item.id));
    const quantity = entry.targetQuantity ?? entry.item.quantity;
    if (backendItem?.serverCartItemId) {
      if (quantity > 0) {
        await updateBackendCartItem({ itemId: backendItem.serverCartItemId, quantity });
      } else {
        await removeBackendCartItem(backendItem.serverCartItemId);
      }
    } else if (quantity > 0) {
      await addBackendCartItem({ productId: entry.item.id, quantity });
    }
    if (!isCurrentOperation(context)) return;
  }
}

function commitBackendItems(
  set: (partial: Partial<CartStore>) => void,
  get: () => CartStore,
  backendItems: CartItem[],
  context: OperationContext,
  syncStatus: CartSyncStatus = "idle",
  syncError: string | null = null,
): void {
  if (!isCurrentOperation(context)) return;
  set({
    ...buildCartState(mergeBackendWithUnsyncableLocal(backendItems, get().items)),
    pendingDeletions: [],
    pendingAnonymousMerge: [],
    syncStatus,
    syncError,
  });
}

async function reconcileDesiredCart(
  backendItems: CartItem[],
  context: OperationContext,
  set: (partial: Partial<CartStore>) => void,
  get: () => CartStore,
): Promise<void> {
  let reconciledItems = await applyPendingDeletions(
    backendItems,
    get().pendingDeletions,
    context,
  );
  if (!isCurrentOperation(context)) return;

  await applyAnonymousMerge(
    reconciledItems,
    get().pendingAnonymousMerge,
    context,
    set,
  );
  if (!isCurrentOperation(context)) return;

  if (get().pendingAnonymousMerge.length) {
    reconciledItems = await getBackendCart();
    if (!isCurrentOperation(context)) return;
  }

  commitBackendItems(set, get, reconciledItems, context);
}

async function handleOperationFailure(
  error: unknown,
  context: OperationContext,
  set: (partial: Partial<CartStore>) => void,
  get: () => CartStore,
): Promise<void> {
  if (!isCurrentOperation(context)) return;

  if (error instanceof ApiError && error.status === 409) {
    try {
      const backendItems = await getBackendCart();
      if (!isCurrentOperation(context)) return;
      commitBackendItems(set, get, backendItems, context, "error", getSyncErrorMessage(error));
      return;
    } catch (reconciliationError) {
      if (!isCurrentOperation(context)) return;
      set({ syncStatus: "error", syncError: getSyncErrorMessage(reconciliationError) });
      return;
    }
  }

  set({ syncStatus: "error", syncError: getSyncErrorMessage(error) });
  if (!(error instanceof ApiError)) {
    console.error("Unexpected cart operation failure", error);
  }
}

function scheduleMutation(
  operation: () => Promise<void>,
  context: OperationContext,
  set: (partial: Partial<CartStore>) => void,
  get: () => CartStore,
): void {
  set({ syncStatus: "syncing", syncError: null });

  void enqueueForIdentity(context.userId, async () => {
    try {
      if (!isCurrentOperation(context)) return;
      await operation();
      if (!isCurrentOperation(context)) return;
      const backendItems = await getBackendCart();
      if (!isCurrentOperation(context)) return;
      await reconcileDesiredCart(backendItems, context, set, get);
    } catch (error) {
      await handleOperationFailure(error, context, set, get);
    }
  });
}

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
      ownerId: null,
      pendingDeletions: [],
      pendingAnonymousMerge: [],

      setHasHydrated: (value) => set({ hasHydrated: value }),

      addItem: (newItem) => {
        const userId = associateCurrentIdentity(set, get);
        const currentItems = get().items;
        const normalizedQuantity = Math.max(1, newItem.quantity || 1);
        const existingItem = currentItems.find((item) =>
          isSameCartLine(item, { id: newItem.id, variant: newItem.variant }),
        );
        const nextItems = existingItem
          ? currentItems.map((item) =>
              isSameCartLine(item, { id: newItem.id, variant: newItem.variant })
                ? { ...item, quantity: item.quantity + normalizedQuantity }
                : item,
            )
          : [...currentItems, { ...newItem, quantity: normalizedQuantity, variant: newItem.variant ?? null }];

        set(buildCartState(nextItems));
        if (!userId || !canSyncCartLine(newItem)) return;
        const context = captureOperation(userId);
        if (existingItem && !existingItem.serverCartItemId && hasPendingMergeLine(
          get().pendingAnonymousMerge,
          { id: existingItem.id, variant: existingItem.variant },
        )) {
          set({
            pendingAnonymousMerge: updatePendingMergeQuantity(
              get().pendingAnonymousMerge,
              { id: existingItem.id, variant: existingItem.variant },
              existingItem.quantity,
              existingItem.quantity + normalizedQuantity,
            ),
          });
          void get().syncWithBackend();
          return;
        }
        scheduleMutation(
          () => addBackendCartItem({ productId: newItem.id, quantity: normalizedQuantity }),
          context,
          set,
          get,
        );
      },

      removeItem: (identity) => {
        const userId = associateCurrentIdentity(set, get);
        const currentItems = get().items;
        const targetItem = currentItems.find((item) => isSameCartLine(item, identity));
        if (!targetItem) return;
        set(buildCartState(currentItems.filter((item) => !isSameCartLine(item, identity))));

        if (!userId || !canSyncCartLine(targetItem)) return;
        if (!targetItem.serverCartItemId) {
          captureOperation(userId);
          const pendingAnonymousMerge = hasPendingMergeLine(get().pendingAnonymousMerge, identity)
            ? removePendingMergeLine(get().pendingAnonymousMerge, identity)
            : setPendingAbsoluteQuantity(get().pendingAnonymousMerge, targetItem, 0);
          set({ pendingAnonymousMerge });
          void get().syncWithBackend();
          return;
        }
        const context = captureOperation(userId);
        scheduleMutation(() => removeBackendCartItem(targetItem.serverCartItemId!), context, set, get);
      },

      increaseQuantity: (identity) => {
        const userId = associateCurrentIdentity(set, get);
        const targetItem = get().items.find((item) => isSameCartLine(item, identity));
        if (!targetItem) return;
        const nextQuantity = targetItem.quantity + 1;
        set(buildCartState(get().items.map((item) =>
          isSameCartLine(item, identity) ? { ...item, quantity: nextQuantity } : item,
        )));

        if (!userId || !canSyncCartLine(targetItem)) return;
        const context = captureOperation(userId);
        if (!targetItem.serverCartItemId) {
          const pendingAnonymousMerge = hasPendingMergeLine(get().pendingAnonymousMerge, identity)
            ? updatePendingMergeQuantity(
                get().pendingAnonymousMerge,
                identity,
                targetItem.quantity,
                nextQuantity,
              )
            : setPendingAbsoluteQuantity(get().pendingAnonymousMerge, targetItem, nextQuantity);
          set({
            pendingAnonymousMerge,
          });
          void get().syncWithBackend();
          return;
        }
        scheduleMutation(
          () => updateBackendCartItem({ itemId: targetItem.serverCartItemId!, quantity: nextQuantity }),
          context,
          set,
          get,
        );
      },

      decreaseQuantity: (identity) => {
        const userId = associateCurrentIdentity(set, get);
        const targetItem = get().items.find((item) => isSameCartLine(item, identity));
        if (!targetItem) return;
        if (targetItem.quantity <= 1) {
          get().removeItem(identity);
          return;
        }

        const nextQuantity = targetItem.quantity - 1;
        set(buildCartState(get().items.map((item) =>
          isSameCartLine(item, identity) ? { ...item, quantity: nextQuantity } : item,
        )));
        if (!userId || !canSyncCartLine(targetItem)) return;
        const context = captureOperation(userId);
        if (!targetItem.serverCartItemId) {
          const pendingAnonymousMerge = hasPendingMergeLine(get().pendingAnonymousMerge, identity)
            ? updatePendingMergeQuantity(
                get().pendingAnonymousMerge,
                identity,
                targetItem.quantity,
                nextQuantity,
              )
            : setPendingAbsoluteQuantity(get().pendingAnonymousMerge, targetItem, nextQuantity);
          set({
            pendingAnonymousMerge,
          });
          void get().syncWithBackend();
          return;
        }
        scheduleMutation(
          () => updateBackendCartItem({ itemId: targetItem.serverCartItemId!, quantity: nextQuantity }),
          context,
          set,
          get,
        );
      },

      clearCart: () => {
        const userId = associateCurrentIdentity(set, get);
        const context = userId ? captureOperation(userId) : null;
        set({
          ...buildCartState([]),
          pendingDeletions: [],
          pendingAnonymousMerge: [],
        });
        if (!context) return;
        scheduleMutation(clearBackendCart, context, set, get);
      },

      syncWithBackend: async () => {
        const userId = associateCurrentIdentity(set, get);
        if (!userId) return;

        const dedupeKey = `${userId}:${operationGeneration}:${operationRevision}`;
        const existing = activeSynchronizations.get(dedupeKey);
        if (existing) return existing;

        const context = captureSynchronization(userId);
        const synchronizationKey = `${userId}:${context.generation}:${context.revision}`;
        set({ syncStatus: "syncing", syncError: null });

        const synchronization = enqueueForIdentity(userId, async () => {
          try {
            if (!isCurrentOperation(context)) return;
            const backendItems = await getBackendCart();
            if (!isCurrentOperation(context)) return;
            await reconcileDesiredCart(backendItems, context, set, get);
          } catch (error) {
            await handleOperationFailure(error, context, set, get);
          }
        });

        activeSynchronizations.set(synchronizationKey, synchronization);
        await synchronization.finally(() => {
          if (activeSynchronizations.get(synchronizationKey) === synchronization) {
            activeSynchronizations.delete(synchronizationKey);
          }
        });
      },

      pullBackendCart: async () => get().syncWithBackend(),
    }),
    {
      name: CART_STORAGE_KEY,
      partialize: (state) => ({
        items: state.items,
        ownerId: state.ownerId,
        pendingDeletions: state.pendingDeletions,
        pendingAnonymousMerge: state.pendingAnonymousMerge,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const restoredState = buildCartState(state.items ?? []);
        state.items = restoredState.items;
        state.itemCount = restoredState.itemCount;
        state.totalAmount = restoredState.totalAmount;
        state.ownerId = state.ownerId ?? null;
        state.pendingDeletions = state.pendingDeletions ?? [];
        state.pendingAnonymousMerge = state.pendingAnonymousMerge ?? [];
        state.setHasHydrated(true);
      },
    },
  ),
);
