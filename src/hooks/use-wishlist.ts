import { create } from "zustand";
import type { Product } from "@/types/product";
import { getStoredAuthUser } from "@/services/auth-session";
import {
  addWishlistItem as apiAddWishlistItem,
  getWishlistItems,
  removeWishlistItem as apiRemoveWishlistItem,
  type BackendWishlistItem,
} from "@/services/wishlist-api";
import { getBackendProductImage } from "@/types/backend-order";

export type WishlistItem = Product;

export interface WishlistMutationState {
  status: "pending" | "error";
  desiredPresent: boolean;
  confirmedPresent: boolean;
}

export interface WishlistStore {
  items: WishlistItem[];
  remoteItemIds: Record<string, string>;
  itemCount: number;
  ownerId: string | null;
  hasHydrated: boolean;
  isSyncing: boolean;
  syncError: string | null;
  mutationStates: Record<string, WishlistMutationState>;
  setHasHydrated: (value: boolean) => void;
  reconcileIdentity: (ownerId: string | null) => void;
  addItem: (item: WishlistItem) => Promise<void>;
  removeItem: (id: string | number) => Promise<void>;
  toggleItem: (item: WishlistItem) => void;
  hasItem: (id: string | number) => boolean;
  getItemMutationState: (id: string | number) => WishlistMutationState | null;
  clearWishlist: () => void;
  syncBackend: () => Promise<void>;
}

interface WishlistStoreDependencies {
  getOwnerId: () => string | null;
  getItems: () => Promise<BackendWishlistItem[]>;
  addItem: (productId: string) => Promise<BackendWishlistItem>;
  removeItem: (wishlistItemId: string) => Promise<void>;
}

interface ProductMutation {
  ownerId: string;
  identityRevision: number;
  productId: string;
  item: WishlistItem;
  desiredPresent: boolean;
  revision: number;
  failureReconciliations: number;
  confirmedItem: WishlistItem | null;
  confirmedRemoteId: string | null;
  running: Promise<void> | null;
}

const WISHLIST_STORAGE_KEYS = ["zogular-wishlist-storage", "zamoyo-wishlist-storage"] as const;
const normalizeWishlistId = (id: string | number) => String(id);

function buildWishlistState(items: WishlistItem[], remoteItemIds: Record<string, string>) {
  return { items, itemCount: items.length, remoteItemIds };
}

function mapBackendWishlistItem(item: BackendWishlistItem): WishlistItem {
  return {
    id: item.product.id || item.productId,
    slug: typeof item.product.slug === "string" ? item.product.slug : String(item.product.id || item.productId),
    title: item.product.title || item.product.name,
    name: item.product.name || item.product.title,
    price: typeof item.product.price === "number" ? item.product.price : 0,
    rating: typeof item.product.rating === "number" ? item.product.rating : 0,
    reviews: typeof item.product.reviews === "number"
      ? item.product.reviews
      : typeof item.product.reviewCount === "number"
        ? item.product.reviewCount
        : 0,
    image: getBackendProductImage(item.product),
  };
}

function currentOwnerId(): string | null {
  return getStoredAuthUser()?.id ?? null;
}

export function removePersistedWishlistData(): void {
  if (typeof window === "undefined") return;
  WISHLIST_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

export function createWishlistStore(
  dependencies: WishlistStoreDependencies = {
    getOwnerId: currentOwnerId,
    getItems: getWishlistItems,
    addItem: apiAddWishlistItem,
    removeItem: apiRemoveWishlistItem,
  },
) {
  let syncVersion = 0;
  let identityRevision = 0;
  let ownerStateRevision = 0;
  const mutations = new Map<string, ProductMutation>();

  return create<WishlistStore>()((set, get) => {
    const mutationKey = (ownerId: string, productId: string) => `${ownerId}:${productId}`;
    const isCurrentIdentity = (mutation: ProductMutation) => (
      mutation.identityRevision === identityRevision
      && dependencies.getOwnerId() === mutation.ownerId
      && get().ownerId === mutation.ownerId
    );

    const setItemPresence = (mutation: ProductMutation, present: boolean, error: string | null = null) => {
      set((state) => {
        const withoutProduct = state.items.filter(
          (item) => normalizeWishlistId(item.id) !== mutation.productId,
        );
        return {
          ...buildWishlistState(present ? [...withoutProduct, mutation.item] : withoutProduct, state.remoteItemIds),
          syncError: error,
        };
      });
    };

    const setRemoteId = (productId: string, remoteId: string | null) => {
      set((state) => {
        const remoteItemIds = { ...state.remoteItemIds };
        if (remoteId) remoteItemIds[productId] = remoteId;
        else delete remoteItemIds[productId];
        return { ...buildWishlistState(state.items, remoteItemIds) };
      });
    };

    const setMutationState = (mutation: ProductMutation, state: WishlistMutationState | null) => {
      set((current) => {
        const mutationStates = { ...current.mutationStates };
        if (state) mutationStates[mutation.productId] = state;
        else delete mutationStates[mutation.productId];
        return { mutationStates };
      });
    };

    const restoreConfirmedState = (mutation: ProductMutation, error: string) => {
      set((state) => {
        const items = state.items.filter((item) => normalizeWishlistId(item.id) !== mutation.productId);
        if (mutation.confirmedItem) items.push(mutation.confirmedItem);
        const remoteItemIds = { ...state.remoteItemIds };
        if (mutation.confirmedRemoteId) remoteItemIds[mutation.productId] = mutation.confirmedRemoteId;
        else delete remoteItemIds[mutation.productId];
        return {
          ...buildWishlistState(items, remoteItemIds),
          syncError: error,
          mutationStates: {
            ...state.mutationStates,
            [mutation.productId]: {
              status: "error",
              desiredPresent: mutation.desiredPresent,
              confirmedPresent: mutation.confirmedItem !== null,
            },
          },
        };
      });
    };

    const readAuthoritativeProduct = async (
      mutation: ProductMutation,
    ): Promise<BackendWishlistItem | null> => {
      const remoteItems = await dependencies.getItems();
      if (!isCurrentIdentity(mutation)) return null;
      const remoteItem = remoteItems.find(
        (item) => normalizeWishlistId(item.productId) === mutation.productId,
      ) ?? null;

      mutation.confirmedItem = remoteItem ? mapBackendWishlistItem(remoteItem) : null;
      mutation.confirmedRemoteId = remoteItem?.id ?? null;

      ownerStateRevision += 1;
      set((state) => {
        const withoutProduct = state.items.filter(
          (item) => normalizeWishlistId(item.id) !== mutation.productId,
        );
        const remoteItemIds = { ...state.remoteItemIds };
        if (remoteItem) remoteItemIds[mutation.productId] = remoteItem.id;
        else delete remoteItemIds[mutation.productId];
        return {
          ...buildWishlistState(
            remoteItem ? [...withoutProduct, mapBackendWishlistItem(remoteItem)] : withoutProduct,
            remoteItemIds,
          ),
        };
      });
      return remoteItem;
    };

    const reconcileAmbiguousFailure = async (
      mutation: ProductMutation,
      failureMessage: string,
    ): Promise<"converged" | "retry" | "stale" | "failed"> => {
      mutation.failureReconciliations += 1;
      let authoritativeItem: BackendWishlistItem | null;
      try {
        authoritativeItem = await readAuthoritativeProduct(mutation);
      } catch {
        if (!isCurrentIdentity(mutation)) return "stale";
        restoreConfirmedState(mutation, failureMessage);
        return "failed";
      }

      if (!isCurrentIdentity(mutation)) return "stale";
      const backendPresent = authoritativeItem !== null;
      if (backendPresent === mutation.desiredPresent) {
        setItemPresence(mutation, mutation.desiredPresent);
        setMutationState(mutation, null);
        return "converged";
      }

      if (mutation.failureReconciliations > 1) {
        restoreConfirmedState(mutation, failureMessage);
        return "failed";
      }
      return "retry";
    };

    const reconcileProduct = async (mutation: ProductMutation): Promise<void> => {
      while (isCurrentIdentity(mutation)) {
        const operationRevision = mutation.revision;

        if (mutation.desiredPresent) {
          if (get().remoteItemIds[mutation.productId]) {
            mutation.confirmedItem = get().items.find(
              (item) => normalizeWishlistId(item.id) === mutation.productId,
            ) ?? mutation.item;
            mutation.confirmedRemoteId = get().remoteItemIds[mutation.productId] ?? null;
            setItemPresence(mutation, true);
            if (operationRevision === mutation.revision) {
              setMutationState(mutation, null);
              return;
            }
            continue;
          }

          try {
            const added = await dependencies.addItem(mutation.productId);
            if (!isCurrentIdentity(mutation)) return;
            mutation.failureReconciliations = 0;
            ownerStateRevision += 1;
            setRemoteId(mutation.productId, added.id);
            mutation.confirmedItem = mutation.item;
            mutation.confirmedRemoteId = added.id;
            if (mutation.desiredPresent) setItemPresence(mutation, true);
          } catch {
            if (!isCurrentIdentity(mutation)) return;
            const outcome = await reconcileAmbiguousFailure(
              mutation,
              "This item could not be saved. Try again.",
            );
            if (outcome === "retry") continue;
            return;
          }
        } else {
          setItemPresence(mutation, false);
          const remoteId = get().remoteItemIds[mutation.productId];
          if (!remoteId) {
            mutation.confirmedItem = null;
            mutation.confirmedRemoteId = null;
            if (operationRevision === mutation.revision) {
              setMutationState(mutation, null);
              return;
            }
            continue;
          }

          try {
            await dependencies.removeItem(remoteId);
            if (!isCurrentIdentity(mutation)) return;
            mutation.failureReconciliations = 0;
            ownerStateRevision += 1;
            mutation.confirmedItem = null;
            mutation.confirmedRemoteId = null;
            if (get().remoteItemIds[mutation.productId] === remoteId) {
              setRemoteId(mutation.productId, null);
            }
          } catch {
            if (!isCurrentIdentity(mutation)) return;
            const outcome = await reconcileAmbiguousFailure(
              mutation,
              "This item could not be removed. Try again.",
            );
            if (outcome === "retry") continue;
            return;
          }
        }

        if (operationRevision === mutation.revision) {
          setMutationState(mutation, null);
          return;
        }
      }
    };

    const ensureMutationRunning = (mutation: ProductMutation): Promise<void> => {
      if (!mutation.running) {
        mutation.running = reconcileProduct(mutation).finally(() => {
          mutation.running = null;
          const key = mutationKey(mutation.ownerId, mutation.productId);
          if (mutations.get(key) === mutation) mutations.delete(key);
        });
      }
      return mutation.running;
    };

    const setDesiredPresence = async (item: WishlistItem, desiredPresent: boolean): Promise<void> => {
      const ownerId = dependencies.getOwnerId();
      if (!ownerId) return;
      get().reconcileIdentity(ownerId);
      const productId = normalizeWishlistId(item.id);
      const key = mutationKey(ownerId, productId);
      let mutation = mutations.get(key);

      if (!mutation || mutation.identityRevision !== identityRevision) {
        const confirmedItem = get().items.find(
          (candidate) => normalizeWishlistId(candidate.id) === productId,
        ) ?? null;
        mutation = {
          ownerId,
          identityRevision,
          productId,
          item,
          desiredPresent,
          revision: 0,
          failureReconciliations: 0,
          confirmedItem,
          confirmedRemoteId: get().remoteItemIds[productId] ?? null,
          running: null,
        };
        mutations.set(key, mutation);
      }

      mutation.item = item;
      mutation.desiredPresent = desiredPresent;
      mutation.revision += 1;
      mutation.failureReconciliations = 0;
      ownerStateRevision += 1;
      setMutationState(mutation, {
        status: "pending",
        desiredPresent,
        confirmedPresent: mutation.confirmedItem !== null,
      });
      setItemPresence(mutation, desiredPresent);
      await ensureMutationRunning(mutation);
    };

    return {
      items: [],
      remoteItemIds: {},
      itemCount: 0,
      ownerId: null,
      hasHydrated: false,
      isSyncing: false,
      syncError: null,
      mutationStates: {},
      setHasHydrated: (value) => set({ hasHydrated: value }),

      reconcileIdentity: (ownerId) => {
        if (get().ownerId === ownerId) return;
        identityRevision += 1;
        syncVersion += 1;
        ownerStateRevision += 1;
        mutations.clear();
        set({ ...buildWishlistState([], {}), ownerId, hasHydrated: true, isSyncing: false, syncError: null, mutationStates: {} });
      },

      syncBackend: async () => {
        const ownerId = dependencies.getOwnerId();
        get().reconcileIdentity(ownerId);
        if (!ownerId) return;
        const requestVersion = ++syncVersion;
        const requestIdentityRevision = identityRevision;
        const requestOwnerStateRevision = ownerStateRevision;
        set({ isSyncing: true, syncError: null });
        try {
          const remoteItems = await dependencies.getItems();
          if (
            requestVersion !== syncVersion
            || requestIdentityRevision !== identityRevision
            || dependencies.getOwnerId() !== ownerId
          ) return;
          if (requestOwnerStateRevision !== ownerStateRevision) {
            set({ isSyncing: false });
            return;
          }

          let items = remoteItems.map(mapBackendWishlistItem);
          const remoteItemIds = Object.fromEntries(
            remoteItems.map((item) => [normalizeWishlistId(item.productId), item.id]),
          );

          for (const mutation of mutations.values()) {
            if (!isCurrentIdentity(mutation)) continue;
            items = items.filter((item) => normalizeWishlistId(item.id) !== mutation.productId);
            if (mutation.desiredPresent) items.push(mutation.item);
          }

          const activeMutationStates = Object.fromEntries(
            [...mutations.values()]
              .filter(isCurrentIdentity)
              .map((mutation) => [mutation.productId, {
                status: "pending" as const,
                desiredPresent: mutation.desiredPresent,
                confirmedPresent: mutation.confirmedItem !== null,
              }]),
          );
          set({
            ...buildWishlistState(items, remoteItemIds),
            ownerId,
            isSyncing: false,
            syncError: null,
            mutationStates: activeMutationStates,
          });
          for (const mutation of mutations.values()) {
            if (isCurrentIdentity(mutation)) void ensureMutationRunning(mutation);
          }
        } catch {
          if (
            requestVersion !== syncVersion
            || requestIdentityRevision !== identityRevision
            || dependencies.getOwnerId() !== ownerId
          ) return;
          if (requestOwnerStateRevision !== ownerStateRevision) {
            set({ isSyncing: false });
            return;
          }
          set({ isSyncing: false, syncError: "Saved items could not load." });
        }
      },

      addItem: async (item) => {
        const ownerId = dependencies.getOwnerId();
        if (!ownerId) return;
        get().reconcileIdentity(ownerId);
        const productId = normalizeWishlistId(item.id);
        const existingMutation = mutations.get(mutationKey(ownerId, productId));
        if (
          get().items.some((wishlistItem) => normalizeWishlistId(wishlistItem.id) === productId)
          && existingMutation?.desiredPresent !== false
        ) return;
        await setDesiredPresence(item, true);
      },

      removeItem: async (id) => {
        const ownerId = dependencies.getOwnerId();
        if (!ownerId || get().ownerId !== ownerId) return;
        const productId = normalizeWishlistId(id);
        const existingMutation = mutations.get(mutationKey(ownerId, productId));
        const item = get().items.find((candidate) => normalizeWishlistId(candidate.id) === productId)
          ?? existingMutation?.item;
        if (!item) return;
        await setDesiredPresence(item, false);
      },

      toggleItem: (item) => {
        if (!dependencies.getOwnerId()) return;
        const exists = get().items.some(
          (wishlistItem) => normalizeWishlistId(wishlistItem.id) === normalizeWishlistId(item.id),
        );
        void (exists ? get().removeItem(item.id) : get().addItem(item));
      },
      hasItem: (id) => {
        const ownerId = dependencies.getOwnerId();
        if (!ownerId || get().ownerId !== ownerId) return false;
        return get().items.some((item) => normalizeWishlistId(item.id) === normalizeWishlistId(id));
      },
      getItemMutationState: (id) => get().mutationStates[normalizeWishlistId(id)] ?? null,
      clearWishlist: () => {
        identityRevision += 1;
        syncVersion += 1;
        ownerStateRevision += 1;
        mutations.clear();
        set({ ...buildWishlistState([], {}), syncError: null, isSyncing: false, mutationStates: {} });
      },
    };
  });
}

export const useWishlist = createWishlistStore();
