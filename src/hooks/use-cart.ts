import { create } from "zustand";
import { persist } from "zustand/middleware";
import { migrateLocalStorageValue } from "@/lib/persisted-storage";
import { ApiError } from "@/services/api";
import {
  addBackendCartItem,
  canSyncCartItem,
  CartContractError,
  clearBackendCart,
  removeBackendCartItem,
  updateBackendCartItem,
} from "@/services/cart";
import type { CartItem, CartItemIdentity } from "@/types/cart";
import { isKnownStock } from "@/lib/normalizers/cart";
import { checkoutGeneration, FRONTEND_FIRST, readCheckoutCart, type GenerationMode } from "@/services/checkout";

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
  identityResolved: boolean;
  syncStatus: CartSyncStatus;
  syncError: string | null;
  ownerId: string | null;
  checkoutOutcomeOwnerId: string | null;
  suspendedOwnerId: string | null;
  suspendedItems: CartItem[];
  pendingDeletions: string[];
  pendingClear: boolean;
  pendingAnonymousMerge: PendingAnonymousMerge[];
  setHasHydrated: (value: boolean) => void;
  suspendIdentity: () => void;
  reconcileIdentity: (ownerId: string | null) => void;
  /** A rejection carries the buyer-facing reason from the exact state evaluated. */
  addItem: (item: CartItem) => string | undefined;
  removeItem: (identity: CartItemIdentity) => void;
  increaseQuantity: (identity: CartItemIdentity) => void;
  decreaseQuantity: (identity: CartItemIdentity) => void;
  clearCart: () => void;
  clearConfirmedCart: (ownerId: string) => void;
  prepareCartAdoption: (ownerId: string, expectedHold?: string) => ((items: CartItem[]) => boolean) | null;
  refreshCartAfterReceipt: (ownerId: string) => Promise<void>;
  markCheckoutOutcomeUnknown: (ownerId: string) => void;
  resumeCheckoutAfterReview: (ownerId: string) => void;
  syncWithBackend: () => Promise<void>;
  pullBackendCart: () => Promise<void>;
}

type OperationContext = {
  userId: string;
  generation: number;
  revision: number;
};

const CART_STORAGE_KEY = "zogular-cart-storage";

// Separate from the cart snapshot: a stale tab persisting its items must not
// erase another tab's unresolved checkout. No request body is written here.
const marker = (owner: string) => "zg-checkout:" + encodeURIComponent(owner) + ":";
const changed = "zg-checkout-hold";
export const CART_REVIEW_PENDING = "Your cart changes were kept. Open your cart and review them before checking out.";
const isFenced = (prefix: string, key: string) => window.localStorage.getItem(prefix + "fenced:" + key) === key;
export function subscribeCheckoutHold(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener(changed, fn);
  return () => { window.removeEventListener("storage", fn); window.removeEventListener(changed, fn); };
}
const notifyHold = () => window.dispatchEvent(new Event(changed));
export function checkoutMode(owner: string): GenerationMode {
  return typeof window !== "undefined" && window.localStorage.getItem(marker(owner) + "issued") !== null ? "required" : FRONTEND_FIRST;
}
export function observeGeneration(owner: string, key?: string) {
  if (key) window.localStorage.setItem(marker(owner) + "issued", checkoutGeneration(key));
  else if (checkoutMode(owner) === "required") throw new CartContractError("Cart generation missing.", "MALFORMED_ITEM");
}
export function heldGeneration(owner: string | null): string | null {
  if (!owner || typeof window === "undefined") return null;
  try {
    const prefix = marker(owner);
    const pending = window.sessionStorage.getItem(prefix + "sending");
    const keys = pending === null ? [] : [checkoutGeneration(pending)];
    for (let i = 0; i < window.localStorage.length; i++) {
      const name = window.localStorage.key(i);
      if (name?.startsWith(prefix + "hold:")) keys.push(checkoutGeneration(name.slice((prefix + "hold:").length)));
    }
    return keys.find(key => !isFenced(prefix, key)) ?? null;
  } catch { return "unavailable"; }
}

export function beginGeneration(owner: string, key: string) {
  const prefix = marker(owner);
  if (heldGeneration(owner) || isFenced(prefix, key) || window.localStorage.getItem(prefix + "hold:" + key) !== null) throw new Error("Checkout already pending");
  window.sessionStorage.setItem(prefix + "sending", checkoutGeneration(key));
  notifyHold();
}
export function finishGeneration(owner: string, key: string, outcome: "confirmed" | "unknown" | "rejected") {
  const prefix = marker(owner);
  if (outcome === "unknown" && !isFenced(prefix, key)) {
    window.localStorage.setItem(prefix + "hold:" + key, checkoutGeneration(key));
    if (isFenced(prefix, key)) window.localStorage.removeItem(prefix + "hold:" + key);
  }
  if (outcome === "confirmed") window.localStorage.removeItem(prefix + "hold:" + key);
  if (window.sessionStorage.getItem(prefix + "sending") === key) window.sessionStorage.removeItem(prefix + "sending");
  notifyHold();
}
export function reviewChangedGeneration(owner: string, old: string, next: string) {
  if (checkoutGeneration(next) === old || heldGeneration(owner) !== old) return false;
  // Publish the fence first: another tab can still have an in-flight marker or
  // finish a lost request between these writes. Never clear by owner prefix.
  const prefix = marker(owner);
  window.localStorage.setItem(prefix + "fenced:" + old, checkoutGeneration(old));
  window.localStorage.removeItem(prefix + "hold:" + old);
  if (window.sessionStorage.getItem(prefix + "sending") === old) window.sessionStorage.removeItem(prefix + "sending");
  notifyHold();
  return true;
}

async function readCartItems(context: OperationContext) {
  const snapshot = await readCheckoutCart(checkoutMode(context.userId), false);
  if (isCurrentOperation(context)) observeGeneration(context.userId, snapshot.generation);
  return snapshot.items;
}

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

type QuantityContext = Pick<CartStore, "items" | "ownerId" | "identityResolved" | "hasHydrated">;

export const CHECK_PRODUCT_STOCK = "Check stock on product page";

/** The public snapshot limits local guest intent only. Signed-in stock belongs to the API. */
export function guestIncreaseBlock(
  state: QuantityContext, identity: CartItemIdentity, quantity = 1, observation?: { knownStock?: number },
): string | undefined {
  if (!state.identityResolved || !state.hasHydrated) return "Loading your cart";
  if (state.ownerId !== null) return;
  if (!Number.isSafeInteger(quantity) || quantity < 1) return "Choose a valid quantity";
  const rows = state.items.filter((item) => String(item.id) === String(identity.id));
  const stock = observation ? observation.knownStock : rows.reduce<number | undefined>(
    (min, row) => isKnownStock(row.knownStock) ? Math.min(min ?? row.knownStock, row.knownStock) : min, undefined,
  );
  if (!isKnownStock(stock)) return CHECK_PRODUCT_STOCK;
  if (stock === 0) return "Out of stock";
  if (rows.reduce((sum, row) => sum + row.quantity, quantity) > stock) {
    return observation ? "Not enough stock to add more" : `Only ${stock} available`;
  }
  if ((rows.find((row) => isSameCartLine(row, identity))?.quantity ?? 0) + quantity > 99) return "Limit of 99 per cart line";
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
  if (error instanceof CartContractError) {
    return "Your cart could not be refreshed. Try again.";
  }
  if (error instanceof ApiError) {
    if (error.status === 408 || error.status >= 500) {
      return "Your cart could not refresh. Please try again in a moment.";
    }
    if (error.status === 401 || error.status === 403) {
      return "Sign in again to refresh your cart.";
    }
  }
  return "Your cart could not be updated. Try again.";
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
    operationGeneration === context.generation &&
    operationRevision === context.revision && !heldGeneration(context.userId)
  );
}

function isPersistedCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<CartItem>;
  return (
    (typeof item.id === "string" || (typeof item.id === "number" && Number.isFinite(item.id)))
    && typeof item.slug === "string"
    && Boolean(item.slug.trim())
    && typeof item.name === "string"
    && Boolean(item.name.trim())
    && typeof item.image === "string"
    && typeof item.price === "number"
    && Number.isFinite(item.price)
    && item.price > 0
    && typeof item.quantity === "number"
    && Number.isInteger(item.quantity)
    && item.quantity >= 1
    && item.quantity <= 99
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

function getResolvedOwnerId(get: () => CartStore): string | null {
  const state = get();
  return state.identityResolved ? state.ownerId : null;
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
    pendingClear: false,
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
  let reconciledItems = backendItems;
  if (get().pendingClear) {
    await clearBackendCart();
    if (!isCurrentOperation(context)) return;
    reconciledItems = [];
    set({ pendingClear: false });
  }

  reconciledItems = await applyPendingDeletions(
    reconciledItems,
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
    reconciledItems = await readCartItems(context);
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
      const backendItems = await readCartItems(context);
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

migrateLocalStorageValue(CART_STORAGE_KEY, ["zamoyo-cart-storage"]);

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      itemCount: 0,
      totalAmount: 0,
      hasHydrated: false,
      identityResolved: false,
      syncStatus: "idle",
      syncError: null,
      ownerId: null,
      checkoutOutcomeOwnerId: null,
      suspendedOwnerId: null,
      suspendedItems: [],
      pendingDeletions: [],
      pendingClear: false,
      pendingAnonymousMerge: [],

      setHasHydrated: (value) => set({ hasHydrated: value }),

      suspendIdentity: () => {
        const state = get();
        if (activeIdentityId !== null || state.ownerId !== null) invalidateOperations(null);
        const isOwnedCart = state.ownerId !== null;
        const hasSuspendedCart = state.suspendedOwnerId !== null;
        set({
          ...buildCartState(!isOwnedCart && !hasSuspendedCart ? state.items : []),
          identityResolved: false,
          ownerId: null,
          checkoutOutcomeOwnerId: state.checkoutOutcomeOwnerId,
          suspendedOwnerId: isOwnedCart ? state.ownerId : state.suspendedOwnerId,
          suspendedItems: isOwnedCart ? state.items : state.suspendedItems,
          pendingDeletions: [],
          pendingClear: false,
          pendingAnonymousMerge: [],
          syncStatus: "idle",
          syncError: null,
        });
      },

      reconcileIdentity: (ownerId) => {
        const state = get();
        if (activeIdentityId !== ownerId) invalidateOperations(ownerId);

        if (ownerId === null) {
          const hasSuspendedCart = state.suspendedOwnerId !== null;
          set({
            ...buildCartState(!hasSuspendedCart && state.ownerId === null ? state.items : []),
            identityResolved: true,
            ownerId: null,
            checkoutOutcomeOwnerId: null,
            suspendedOwnerId: null,
            suspendedItems: [],
            pendingDeletions: [],
            pendingClear: false,
            pendingAnonymousMerge: [],
            syncStatus: "idle",
            syncError: null,
          });
          return;
        }

        if (state.ownerId === ownerId) {
          set({ identityResolved: true });
          return;
        }

        const hasMatchingSuspendedCart = state.suspendedOwnerId === ownerId;
        const isAnonymousCart = state.ownerId === null && state.suspendedOwnerId === null;
        const nextItems = hasMatchingSuspendedCart
          ? state.suspendedItems
          : isAnonymousCart
            ? state.items
            : [];
        set({
          ...buildCartState(nextItems),
          identityResolved: true,
          ownerId,
          checkoutOutcomeOwnerId: state.checkoutOutcomeOwnerId === ownerId ? ownerId : null,
          suspendedOwnerId: null,
          suspendedItems: [],
          pendingDeletions: [],
          pendingClear: false,
          pendingAnonymousMerge: isAnonymousCart ? normalizePendingMerge(nextItems) : [],
          syncStatus: "idle",
          syncError: null,
        });
      },

      addItem: (newItem) => {
        const userId = getResolvedOwnerId(get);
        if (heldGeneration(userId)) return "Check your order status before changing your cart.";
        const state = get();
        const blocked = guestIncreaseBlock(state, newItem, newItem.quantity, newItem);
        // Refresh matching variants even when a lower observation rejects the requested quantity.
        const refresh = state.hasHydrated && state.identityResolved && !userId && isKnownStock(newItem.knownStock)
          && state.items.some((row) => String(row.id) === String(newItem.id) && row.knownStock !== newItem.knownStock);
        const currentItems = refresh ? state.items.map((row) => String(row.id) === String(newItem.id)
          ? { ...row, knownStock: newItem.knownStock } : row) : state.items;
        if (blocked) {
          if (refresh) set({ items: currentItems });
          return blocked;
        }
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
        captureOperation(userId);
        const desiredItem = nextItems.find((item) => isSameCartLine(
          item,
          { id: newItem.id, variant: newItem.variant },
        ));
        if (!desiredItem) return;
        const pendingAnonymousMerge = existingItem
          && !existingItem.serverCartItemId
          && hasPendingMergeLine(get().pendingAnonymousMerge, {
            id: existingItem.id,
            variant: existingItem.variant,
          })
          ? updatePendingMergeQuantity(
              get().pendingAnonymousMerge,
              { id: existingItem.id, variant: existingItem.variant },
              existingItem.quantity,
              desiredItem.quantity,
            )
          : setPendingAbsoluteQuantity(
              get().pendingAnonymousMerge,
              desiredItem,
              desiredItem.quantity,
            );
        set({ pendingAnonymousMerge });
        void get().syncWithBackend();
      },

      removeItem: (identity) => {
        const userId = getResolvedOwnerId(get);
        if (heldGeneration(userId)) return;
        const currentItems = get().items;
        const targetItem = currentItems.find((item) => isSameCartLine(item, identity));
        if (!targetItem) return;
        set(buildCartState(currentItems.filter((item) => !isSameCartLine(item, identity))));

        if (!userId || !canSyncCartLine(targetItem)) return;
        captureOperation(userId);
        const pendingAnonymousMerge = !targetItem.serverCartItemId
          && hasPendingMergeLine(get().pendingAnonymousMerge, identity)
          ? removePendingMergeLine(get().pendingAnonymousMerge, identity)
          : setPendingAbsoluteQuantity(get().pendingAnonymousMerge, targetItem, 0);
        set({ pendingAnonymousMerge });
        void get().syncWithBackend();
      },

      increaseQuantity: (identity) => {
        if (guestIncreaseBlock(get(), identity)) return;
        const userId = getResolvedOwnerId(get);
        if (heldGeneration(userId)) return;
        const targetItem = get().items.find((item) => isSameCartLine(item, identity));
        if (!targetItem) return;
        const nextQuantity = targetItem.quantity + 1;
        set(buildCartState(get().items.map((item) =>
          isSameCartLine(item, identity) ? { ...item, quantity: nextQuantity } : item,
        )));

        if (!userId || !canSyncCartLine(targetItem)) return;
        captureOperation(userId);
        const pendingAnonymousMerge = !targetItem.serverCartItemId
          && hasPendingMergeLine(get().pendingAnonymousMerge, identity)
            ? updatePendingMergeQuantity(
                get().pendingAnonymousMerge,
                identity,
                targetItem.quantity,
                nextQuantity,
              )
            : setPendingAbsoluteQuantity(get().pendingAnonymousMerge, targetItem, nextQuantity);
        set({ pendingAnonymousMerge });
        void get().syncWithBackend();
      },

      decreaseQuantity: (identity) => {
        const userId = getResolvedOwnerId(get);
        if (heldGeneration(userId)) return;
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
        captureOperation(userId);
        const pendingAnonymousMerge = !targetItem.serverCartItemId
          && hasPendingMergeLine(get().pendingAnonymousMerge, identity)
            ? updatePendingMergeQuantity(
                get().pendingAnonymousMerge,
                identity,
                targetItem.quantity,
                nextQuantity,
              )
            : setPendingAbsoluteQuantity(get().pendingAnonymousMerge, targetItem, nextQuantity);
        set({ pendingAnonymousMerge });
        void get().syncWithBackend();
      },

      clearCart: () => {
        const userId = getResolvedOwnerId(get);
        if (userId && (heldGeneration(userId) || get().checkoutOutcomeOwnerId === userId)) return;
        if (userId) captureOperation(userId);
        set({
          ...buildCartState([]),
          checkoutOutcomeOwnerId: null,
          pendingDeletions: [],
          pendingClear: Boolean(userId),
          pendingAnonymousMerge: [],
        });
        if (!userId) return;
        void get().syncWithBackend();
      },

      clearConfirmedCart: (ownerId) => {
        if (!get().identityResolved || get().ownerId !== ownerId || activeIdentityId !== ownerId) return;
        captureOperation(ownerId);
        set({
          ...buildCartState([]),
          checkoutOutcomeOwnerId: null,
          pendingDeletions: [],
          pendingAnonymousMerge: [],
          syncStatus: "idle",
          syncError: null,
        });
      },

      prepareCartAdoption: (ownerId, expectedHold) => {
        const initial = get();
        const context = captureSynchronization(ownerId); // observation, not a new write revision
        const idle = () => get() === initial && activeIdentityId === ownerId && initial.ownerId === ownerId
          && initial.hasHydrated && initial.identityResolved && initial.checkoutOutcomeOwnerId === null
          && operationGeneration === context.generation && operationRevision === context.revision
          && !initial.pendingClear && !initial.pendingDeletions.length && !initial.pendingAnonymousMerge.length
          && !identityQueues.has(ownerId) && ![...activeSynchronizations.keys()].some(k => k.startsWith(ownerId + ":"))
          && (initial.syncStatus === "idle" || (Boolean(expectedHold) && initial.syncStatus === "error"
            && initial.syncError === "Check your orders before trying checkout again."));
        if (!idle() || heldGeneration(ownerId) !== (expectedHold ?? null)) return null;
        return items => {
          if (!idle() || heldGeneration(ownerId)) return false;
          set({ ...buildCartState(mergeBackendWithUnsyncableLocal(items, initial.items)), syncError: null, syncStatus: "idle" });
          return true;
        };
      },
      refreshCartAfterReceipt: async (ownerId) => {
        if (getResolvedOwnerId(get) !== ownerId || heldGeneration(ownerId)) return;
        const adopt = get().prepareCartAdoption(ownerId);
        const epoch = operationGeneration;
        const notePreserved = (message = CART_REVIEW_PENDING) => {
          if (operationGeneration === epoch && getResolvedOwnerId(get) === ownerId && !heldGeneration(ownerId)
            && get().syncStatus === "idle" && !identityQueues.has(ownerId)) {
            set({ syncStatus: "error", syncError: message });
          }
        };
        if (!adopt) { notePreserved(); return; }
        try {
          const snapshot = await readCheckoutCart("required");
          if (!adopt(snapshot.items)) notePreserved();
        } catch {
          notePreserved("Your current cart was kept. Open your cart to check its latest contents.");
        }
      },

      markCheckoutOutcomeUnknown: (ownerId) => {
        if (!get().identityResolved || get().ownerId !== ownerId || activeIdentityId !== ownerId) return;
        captureOperation(ownerId);
        set({
          checkoutOutcomeOwnerId: ownerId,
          syncStatus: "error",
          syncError: "Check your orders before trying checkout again.",
        });
      },

      resumeCheckoutAfterReview: (ownerId) => {
        if (!get().identityResolved || get().ownerId !== ownerId || activeIdentityId !== ownerId) return;
        set({ checkoutOutcomeOwnerId: null, syncStatus: "idle", syncError: null });
      },

      syncWithBackend: async () => {
        const userId = getResolvedOwnerId(get);
        if (!userId) return;
        if (get().checkoutOutcomeOwnerId === userId || heldGeneration(userId)) {
          set({
            syncStatus: "error",
            syncError: "Check your orders before trying checkout again.",
          });
          return;
        }

        const dedupeKey = `${userId}:${operationGeneration}:${operationRevision}`;
        const existing = activeSynchronizations.get(dedupeKey);
        if (existing) return existing;

        const context = captureSynchronization(userId);
        const synchronizationKey = `${userId}:${context.generation}:${context.revision}`;
        set({ syncStatus: "syncing", syncError: null });

        const synchronization = enqueueForIdentity(userId, async () => {
          try {
            if (!isCurrentOperation(context)) return;
            const backendItems = await readCartItems(context);
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
        checkoutOutcomeOwnerId: state.checkoutOutcomeOwnerId,
        suspendedOwnerId: state.suspendedOwnerId,
        suspendedItems: state.suspendedItems,
        pendingDeletions: state.pendingDeletions,
        pendingAnonymousMerge: state.pendingAnonymousMerge,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const storedOwnerId = typeof state.ownerId === "string" && state.ownerId.trim()
          ? state.ownerId
          : null;
        const storedItems = Array.isArray(state.items) && state.items.every(isPersistedCartItem)
          ? state.items
          : [];
        const storedSuspendedOwnerId = typeof state.suspendedOwnerId === "string"
          && state.suspendedOwnerId.trim()
          ? state.suspendedOwnerId
          : null;
        const storedSuspendedItems = Array.isArray(state.suspendedItems)
          && state.suspendedItems.every(isPersistedCartItem)
          ? state.suspendedItems
          : [];
        const suspendedOwnerId = storedSuspendedOwnerId ?? storedOwnerId;
        const suspendedItems = storedSuspendedOwnerId ? storedSuspendedItems : storedItems;
        // Private items remain hidden until the same account is verified. A
        // different account or a guest clears this suspended snapshot.
        const restoredState = buildCartState(suspendedOwnerId === null ? storedItems : []);
        state.items = restoredState.items;
        state.itemCount = restoredState.itemCount;
        state.totalAmount = restoredState.totalAmount;
        state.ownerId = null;
        state.suspendedOwnerId = suspendedOwnerId;
        state.suspendedItems = suspendedOwnerId === null ? [] : suspendedItems;
        state.checkoutOutcomeOwnerId = typeof state.checkoutOutcomeOwnerId === "string"
          && state.checkoutOutcomeOwnerId.trim()
          ? state.checkoutOutcomeOwnerId
          : null;
        state.pendingDeletions = [];
        state.pendingClear = false;
        state.pendingAnonymousMerge = [];
        state.identityResolved = false;
        state.setHasHydrated(true);
      },
    },
  ),
);
