import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { sanitizeInternalNextPath } from "../src/services/auth-intent";
import { normalizeProduct } from "../src/lib/normalizers/product";
import { normalizeBackendProduct } from "../src/services/products";
import { createWishlistStore, useWishlist, type WishlistItem } from "../src/hooks/use-wishlist";
import { ApiError } from "../src/services/api";
import { getAccountErrorPresentation } from "../src/lib/account-error";
import {
  collectCompleteWishlist,
  type BackendWishlistItem,
} from "../src/services/wishlist-api";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const raceProduct: WishlistItem = {
  id: "race-product",
  slug: "race-product",
  title: "Race product",
  price: 100,
  rating: 0,
  reviews: 0,
  image: "",
};

function backendWishlistItem(id: string, productId = "race-product"): BackendWishlistItem {
  return {
    id,
    productId,
    createdAt: new Date(0).toISOString(),
    product: {
      id: productId,
      slug: productId,
      title: productId === "race-product" ? "Race product" : `Product ${productId}`,
      price: 100,
      images: [],
    },
  };
}

function wishlistPagePayload(
  allItems: BackendWishlistItem[],
  page: number,
  limit: number,
): unknown {
  const items = allItems.slice((page - 1) * limit, page * limit);
  return {
    status: "success",
    results: items.length,
    pagination: {
      total: allItems.length,
      page,
      limit,
      pages: Math.ceil(allItems.length / limit),
    },
    data: { items },
  };
}

function currentUserPayload(id: string, overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      user: {
        id,
        firstName: id === "account-b" ? "Account" : "Account",
        lastName: id === "account-b" ? "B" : "A",
        email: `${id}@example.test`,
        role: "USER",
        telephone: "0970000000",
        preferredMoMoNumber: "0960000000",
        emailVerified: true,
        ...overrides,
      },
    },
  };
}

function sellerApplicationPayload(ownerId: string, status: string) {
  return {
    status: "success",
    data: {
      application: {
        id: `application-${ownerId}`,
        userId: ownerId,
        sellerType: "INDIVIDUAL",
        ownerFullName: `Owner ${ownerId}`,
        status,
      },
    },
  };
}

async function setBrowserIdentity(page: Page, ownerId: string | null) {
  await page.evaluate((nextOwnerId) => {
    if (nextOwnerId) {
      localStorage.setItem("zogular_auth_user", JSON.stringify({
        id: nextOwnerId,
        firstName: "Account",
        lastName: nextOwnerId,
        email: `${nextOwnerId}@example.test`,
      }));
    } else {
      localStorage.removeItem("zogular_auth_user");
    }
    window.dispatchEvent(new Event("zogular:auth-session-changed"));
  }, ownerId);
}

function backendOrder(id: string, ownerId = "account-a") {
  return {
    id,
    orderNumber: id.toUpperCase(),
    userId: ownerId,
    createdAt: "2026-08-15T00:00:00.000Z",
    status: "PROCESSING",
    totalAmount: 100,
    shippingAddress: { fullName: ownerId, phone: "0970000000", addressLine: "1 Test Road", district: "Roma", city: "Lusaka" },
    items: [],
  };
}

function orderPagePayload(orders: ReturnType<typeof backendOrder>[], page: number, limit: number, total: number) {
  return {
    status: "success",
    results: orders.length,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    data: { orders },
  };
}

test("return intent accepts internal paths and rejects external or malformed destinations", () => {
  expect(sanitizeInternalNextPath("/account/saved?from=product#saved")).toBe("/account/saved?from=product#saved");
  for (const unsafe of [
    "https://example.com/account",
    "//example.com/account",
    "/\\example.com",
    "javascript:alert(1)",
    "/auth/login",
    "/%2e%2e//evil.example",
    "/safe/%2e%2e/account",
    "/%5cevil.example",
    "/account%2F%2Fevil.example",
    "/account\u0000/settings",
  ]) {
    expect(sanitizeInternalNextPath(unsafe)).toBeNull();
  }
});

test("current identity verification uses the exact backend-owned user endpoint", () => {
  const authService = readSource("src/services/auth.ts");
  const authHook = readSource("src/hooks/use-auth-session.ts");
  expect(authService).toContain('me: "/user/me"');
  expect(authService).not.toContain('me: "/users/me"');
  expect(authHook).toContain("getCurrentUser({ persist: false");
  expect(authHook).not.toContain("skipAuthRefresh:");
  expect(authHook).not.toContain("getStoredAuthUser");
});

test("guest wishlist mutations fail closed without persisted product state", async () => {
  useWishlist.getState().reconcileIdentity(null);
  await useWishlist.getState().addItem({
    id: "private-item",
    slug: "private-item",
    title: "Private item",
    price: 10,
    rating: 0,
    reviews: 0,
    image: "",
  });
  expect(useWishlist.getState().items).toEqual([]);
  expect(useWishlist.getState().ownerId).toBeNull();
});

test("complete wishlist retrieval follows pagination and includes items beyond the first page", async () => {
  const remoteItems = Array.from({ length: 101 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));
  const requestedPages: Array<{ page: number; limit: number }> = [];

  const items = await collectCompleteWishlist(async (page, limit) => {
    requestedPages.push({ page, limit });
    return wishlistPagePayload(remoteItems, page, limit);
  });

  expect(requestedPages).toEqual([{ page: 1, limit: 100 }, { page: 2, limit: 100 }]);
  expect(items).toHaveLength(101);
  expect(items.find((item) => item.productId === "product-100")?.id).toBe("remote-100");
  expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  expect(new Set(items.map((item) => item.productId)).size).toBe(items.length);
});

test("complete wishlist retrieval fails safely for malformed, repeated, or duplicate pages", async () => {
  const remoteItems = Array.from({ length: 101 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));

  await expect(collectCompleteWishlist(async (page, limit) => {
    const payload = wishlistPagePayload(remoteItems, page, limit) as {
      pagination: { page: number };
    };
    if (page === 2) payload.pagination.page = 1;
    return payload;
  })).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "MALFORMED_RESPONSE",
  });

  await expect(collectCompleteWishlist(async (page, limit) => {
    const payload = wishlistPagePayload(remoteItems, page, limit) as {
      data: { items: BackendWishlistItem[] };
    };
    if (page === 2) payload.data.items[0] = remoteItems[0];
    return payload;
  })).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "DUPLICATE_ITEM",
  });

  await expect(collectCompleteWishlist(async (_page, limit) => ({
    status: "success",
    results: limit,
    pagination: { total: 10_100, page: 1, limit, pages: 101 },
    data: { items: remoteItems.slice(0, limit) },
  }))).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "PAGINATION_LIMIT_EXCEEDED",
  });
});

test("complete wishlist retrieval rejects a changed total without returning partial data", async () => {
  const firstSnapshot = Array.from({ length: 101 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));
  const changedSnapshot = [
    ...firstSnapshot,
    backendWishlistItem("remote-101", "product-101"),
  ];

  await expect(collectCompleteWishlist(async (page, limit) => (
    wishlistPagePayload(page === 1 ? firstSnapshot : changedSnapshot, page, limit)
  ))).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "PAGINATION_CHANGED",
  });
});

test("complete wishlist retrieval rejects a changed page count without returning partial data", async () => {
  const firstSnapshot = Array.from({ length: 101 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));
  const changedSnapshot = Array.from({ length: 201 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));

  await expect(collectCompleteWishlist(async (page, limit) => (
    wishlistPagePayload(page === 1 ? firstSnapshot : changedSnapshot, page, limit)
  ))).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "PAGINATION_CHANGED",
  });
});

test("complete wishlist retrieval rejects a changed page limit without returning partial data", async () => {
  const remoteItems = Array.from({ length: 101 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));

  await expect(collectCompleteWishlist(async (page, limit) => {
    if (page === 1) return wishlistPagePayload(remoteItems, page, limit);
    const items = remoteItems.slice(99);
    return {
      status: "success",
      results: items.length,
      pagination: { total: remoteItems.length, page, limit: 99, pages: 2 },
      data: { items },
    };
  })).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "MALFORMED_RESPONSE",
  });
});

test("complete wishlist retrieval rejects incorrect page cardinality without returning partial data", async () => {
  const remoteItems = Array.from({ length: 101 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));

  await expect(collectCompleteWishlist(async (page, limit) => {
    const payload = wishlistPagePayload(remoteItems, page, limit) as {
      results: number;
    };
    payload.results -= 1;
    return payload;
  })).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "MALFORMED_RESPONSE",
  });

  await expect(collectCompleteWishlist(async (page, limit) => {
    const payload = wishlistPagePayload(remoteItems, page, limit) as {
      results: number;
      data: { items: BackendWishlistItem[] };
    };
    payload.data.items.pop();
    payload.results = payload.data.items.length;
    return payload;
  })).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "MALFORMED_RESPONSE",
  });
});

test("complete wishlist retrieval rejects distinct wishlist IDs for one product", async () => {
  const remoteItems = Array.from({ length: 101 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));

  await expect(collectCompleteWishlist(async (page, limit) => {
    const payload = wishlistPagePayload(remoteItems, page, limit) as {
      data: { items: BackendWishlistItem[] };
    };
    if (page === 2) {
      payload.data.items[0] = backendWishlistItem("remote-distinct", "product-0");
    }
    return payload;
  })).rejects.toMatchObject({
    name: "WishlistContractError",
    code: "DUPLICATE_ITEM",
  });
});

test("a rejected page-two delete that did not commit retains authoritative remote presence", async () => {
  const remoteItems = Array.from({ length: 101 }, (_, index) => (
    backendWishlistItem(`remote-${index}`, `product-${index}`)
  ));
  const targetProductId = "product-100";
  const removeCalls: string[] = [];
  const getCompleteItems = () => collectCompleteWishlist(async (page, limit) => (
    wishlistPagePayload(remoteItems, page, limit)
  ));
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: getCompleteItems,
    addItem: async (productId) => backendWishlistItem("unexpected-add", productId),
    removeItem: async (remoteId) => {
      removeCalls.push(remoteId);
      throw new ApiError("Response was rejected before delete", 503);
    },
  });

  await store.getState().syncBackend();
  expect(store.getState().remoteItemIds[targetProductId]).toBe("remote-100");
  await store.getState().removeItem(targetProductId);

  expect(removeCalls).toEqual(["remote-100", "remote-100"]);
  expect(remoteItems.find((item) => item.productId === targetProductId)?.id).toBe("remote-100");
  expect(store.getState().items.filter((item) => item.id === targetProductId)).toHaveLength(1);
  expect(store.getState().remoteItemIds[targetProductId]).toBe("remote-100");
  expect(store.getState().syncError).toBe("This item could not be removed. Try again.");
  expect(store.getState().mutationStates[targetProductId]).toEqual({
    status: "error",
    desiredPresent: false,
    confirmedPresent: true,
  });

  await store.getState().syncBackend();
  expect(store.getState().items.filter((item) => item.id === targetProductId)).toHaveLength(1);
  expect(store.getState().remoteItemIds[targetProductId]).toBe("remote-100");
  expect(new Set(Object.values(store.getState().remoteItemIds)).size).toBe(101);
});

test("pending add followed by remove converges absent locally and after backend sync", async () => {
  let ownerId: string | null = "owner-a";
  let remoteItems: BackendWishlistItem[] = [];
  const pendingAdd = deferred<BackendWishlistItem>();
  const removeCalls: string[] = [];
  const store = createWishlistStore({
    getOwnerId: () => ownerId,
    getItems: async () => remoteItems,
    addItem: async () => {
      const added = await pendingAdd.promise;
      remoteItems = [added];
      return added;
    },
    removeItem: async (remoteId) => {
      removeCalls.push(remoteId);
      remoteItems = remoteItems.filter((item) => item.id !== remoteId);
    },
  });

  const addPromise = store.getState().addItem(raceProduct);
  const removePromise = store.getState().removeItem(raceProduct.id);
  pendingAdd.resolve(backendWishlistItem("remote-add"));
  await Promise.all([addPromise, removePromise]);

  expect(removeCalls).toEqual(["remote-add"]);
  expect(store.getState().items).toEqual([]);
  await store.getState().syncBackend();
  expect(store.getState().items).toEqual([]);
  expect(store.getState().remoteItemIds).toEqual({});
  ownerId = null;
});

test("a stale same-owner sync cannot overwrite a successfully added item", async () => {
  const staleSync = deferred<BackendWishlistItem[]>();
  let getItemsCalls = 0;
  let remoteItems: BackendWishlistItem[] = [];
  const added = backendWishlistItem("remote-added-after-sync");
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: async () => {
      getItemsCalls += 1;
      return getItemsCalls === 1 ? staleSync.promise : remoteItems;
    },
    addItem: async () => {
      remoteItems = [added];
      return added;
    },
    removeItem: async () => undefined,
  });

  const syncPromise = store.getState().syncBackend();
  await store.getState().addItem(raceProduct);
  staleSync.resolve([]);
  await syncPromise;

  expect(getItemsCalls).toBe(1);
  expect(store.getState().items.map((item) => item.id)).toEqual(["race-product"]);
  expect(store.getState().remoteItemIds).toEqual({ "race-product": "remote-added-after-sync" });
  expect(store.getState().isSyncing).toBe(false);
});

test("a stale same-owner sync cannot restore a successfully removed item or remote ID", async () => {
  const original = backendWishlistItem("remote-removed-after-sync");
  const staleSync = deferred<BackendWishlistItem[]>();
  let getItemsCalls = 0;
  let remoteItems = [original];
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: async () => {
      getItemsCalls += 1;
      if (getItemsCalls === 1) return remoteItems;
      if (getItemsCalls === 2) return staleSync.promise;
      return remoteItems;
    },
    addItem: async () => backendWishlistItem("unexpected-add"),
    removeItem: async (remoteId) => {
      remoteItems = remoteItems.filter((item) => item.id !== remoteId);
    },
  });
  await store.getState().syncBackend();

  const syncPromise = store.getState().syncBackend();
  await store.getState().removeItem(raceProduct.id);
  staleSync.resolve([original]);
  await syncPromise;

  expect(getItemsCalls).toBe(2);
  expect(remoteItems).toEqual([]);
  expect(store.getState().items).toEqual([]);
  expect(store.getState().remoteItemIds).toEqual({});
  expect(store.getState().isSyncing).toBe(false);
});

test("pending remove followed by re-add keeps one item and its authoritative remote identity", async () => {
  const pendingRemove = deferred<void>();
  let remoteItems = [backendWishlistItem("remote-current")];
  let addCalls = 0;
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: async () => remoteItems,
    addItem: async () => {
      addCalls += 1;
      return backendWishlistItem("unexpected-duplicate");
    },
    removeItem: async () => pendingRemove.promise,
  });
  await store.getState().syncBackend();

  const removePromise = store.getState().removeItem(raceProduct.id);
  const reAddPromise = store.getState().addItem(raceProduct);
  pendingRemove.reject(new ApiError("Temporary failure", 503));
  await Promise.all([removePromise, reAddPromise]);

  expect(addCalls).toBe(0);
  expect(store.getState().items.map((item) => item.id)).toEqual(["race-product"]);
  expect(store.getState().remoteItemIds).toEqual({ "race-product": "remote-current" });
  remoteItems = [backendWishlistItem("remote-current")];
  await store.getState().syncBackend();
  expect(store.getState().items).toHaveLength(1);
});

test("rapid add remove add converges to the newest desired state after a rejected stale operation", async () => {
  const firstAdd = deferred<BackendWishlistItem>();
  let addCalls = 0;
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: async () => [],
    addItem: async () => {
      addCalls += 1;
      if (addCalls === 1) return firstAdd.promise;
      throw new ApiError("Ambiguous response", 503);
    },
    removeItem: async () => undefined,
  });

  const first = store.getState().addItem(raceProduct);
  const second = store.getState().removeItem(raceProduct.id);
  const third = store.getState().addItem(raceProduct);
  firstAdd.resolve(backendWishlistItem("remote-newest"));
  await Promise.all([first, second, third]);

  expect(addCalls).toBe(1);
  expect(store.getState().items.map((item) => item.id)).toEqual(["race-product"]);
  expect(store.getState().remoteItemIds).toEqual({ "race-product": "remote-newest" });
});

test("an ambiguous add response reconciles against backend truth without duplicating the item", async () => {
  const committed = backendWishlistItem("remote-after-ambiguous-add");
  let remoteItems: BackendWishlistItem[] = [];
  let addCalls = 0;
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: async () => remoteItems,
    addItem: async () => {
      addCalls += 1;
      remoteItems = [committed];
      throw new ApiError("Response was lost", 503);
    },
    removeItem: async () => undefined,
  });

  await store.getState().addItem(raceProduct);
  expect(store.getState().items.map((item) => item.id)).toEqual(["race-product"]);
  expect(store.getState().syncError).toBeNull();

  await store.getState().syncBackend();
  await expect.poll(() => store.getState().items.length).toBe(1);
  expect(store.getState().remoteItemIds).toEqual({ "race-product": "remote-after-ambiguous-add" });
  expect(addCalls).toBe(1);
});

test("an ambiguous committed add followed by remove converges absent locally and remotely", async () => {
  const commitAdd = deferred<void>();
  let remoteItems: BackendWishlistItem[] = [];
  const removeCalls: string[] = [];
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: async () => remoteItems,
    addItem: async () => {
      await commitAdd.promise;
      remoteItems = [backendWishlistItem("remote-ambiguous-add")];
      throw new ApiError("Response was lost after commit", 503);
    },
    removeItem: async (remoteId) => {
      removeCalls.push(remoteId);
      remoteItems = remoteItems.filter((item) => item.id !== remoteId);
    },
  });

  const addPromise = store.getState().addItem(raceProduct);
  const removePromise = store.getState().removeItem(raceProduct.id);
  commitAdd.resolve();
  await Promise.all([addPromise, removePromise]);

  expect(removeCalls).toEqual(["remote-ambiguous-add"]);
  expect(remoteItems).toEqual([]);
  expect(store.getState().items).toEqual([]);
  expect(store.getState().remoteItemIds).toEqual({});
  await store.getState().syncBackend();
  expect(store.getState().items).toEqual([]);
});

test("an ambiguous committed delete followed by re-add creates one fresh authoritative item", async () => {
  const commitDelete = deferred<void>();
  let remoteItems = [backendWishlistItem("remote-before-delete")];
  let addSequence = 0;
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: async () => remoteItems,
    addItem: async () => {
      addSequence += 1;
      const fresh = backendWishlistItem(`remote-after-delete-${addSequence}`);
      remoteItems = [fresh];
      return fresh;
    },
    removeItem: async (remoteId) => {
      await commitDelete.promise;
      remoteItems = remoteItems.filter((item) => item.id !== remoteId);
      throw new ApiError("Response was lost after delete", 503);
    },
  });
  await store.getState().syncBackend();

  const removePromise = store.getState().removeItem(raceProduct.id);
  const addPromise = store.getState().addItem(raceProduct);
  commitDelete.resolve();
  await Promise.all([removePromise, addPromise]);

  expect(remoteItems).toHaveLength(1);
  expect(remoteItems[0].id).toBe("remote-after-delete-1");
  expect(store.getState().items.map((item) => item.id)).toEqual(["race-product"]);
  expect(store.getState().remoteItemIds).toEqual({ "race-product": "remote-after-delete-1" });
  expect(store.getState().remoteItemIds["race-product"]).not.toBe("remote-before-delete");
  await store.getState().syncBackend();
  expect(store.getState().items).toHaveLength(1);
  expect(store.getState().remoteItemIds).toEqual({ "race-product": "remote-after-delete-1" });
});

test("logout and login as the same owner invalidates an older pending mutation", async () => {
  let ownerId: string | null = "owner-a";
  const pendingAdd = deferred<BackendWishlistItem>();
  const store = createWishlistStore({
    getOwnerId: () => ownerId,
    getItems: async () => [],
    addItem: async () => pendingAdd.promise,
    removeItem: async () => undefined,
  });

  const oldOperation = store.getState().addItem(raceProduct);
  ownerId = null;
  store.getState().reconcileIdentity(null);
  ownerId = "owner-a";
  store.getState().reconcileIdentity(ownerId);
  pendingAdd.resolve(backendWishlistItem("stale-remote"));
  await oldOperation;

  expect(store.getState().items).toEqual([]);
  expect(store.getState().remoteItemIds).toEqual({});
});

test("account failures distinguish sign-in, inaccessible resources, and temporary service errors", () => {
  expect(getAccountErrorPresentation(new ApiError("Unauthorized", 401), "orders")).toMatchObject({
    kind: "sign-in",
    title: "Please sign in again",
  });
  expect(getAccountErrorPresentation(new ApiError("Forbidden", 403), "orders")).toEqual({
    kind: "unavailable",
    title: "Orders unavailable",
    description: "Your order history is not available.",
  });
  expect(getAccountErrorPresentation(new ApiError("Missing", 404), "order")).toEqual({
    kind: "unavailable",
    title: "Order not found",
    description: "This order is not available.",
  });
  for (const error of [new ApiError("Unavailable", 503), new ApiError("Timeout", 408), new TypeError("network")]) {
    expect(getAccountErrorPresentation(error, "order")).toEqual({
      kind: "temporary",
      title: "Order could not load",
      description: "Please try again in a moment.",
    });
  }
});

test("rating evidence renders only when normalized review data is valid", () => {
  const invalid = normalizeProduct({
    id: "invalid-rating",
    slug: "invalid-rating",
    title: "Invalid rating",
    price: 10,
    rating: 5,
    reviews: 0,
  });
  expect(invalid).toMatchObject({ rating: 0, reviews: 0 });

  const backend = normalizeBackendProduct({
    id: "mixed-rating",
    slug: "mixed-rating",
    title: "Mixed rating",
    price: 10,
    reviews: [{ rating: 4 }, { rating: 8 }, { rating: Number.NaN }],
  });
  expect(backend).toMatchObject({ rating: 4, reviews: 1 });
});

test("protected account shell and navigation share one auth policy", () => {
  const layout = readSource("src/app/(consumer)/account/layout.tsx");
  const navigation = readSource("src/components/layout/MobileBottomNavigation.tsx");
  const button = readSource("src/components/WishlistButton.tsx");
  const wishlist = readSource("src/hooks/use-wishlist.ts");

  expect(layout).toContain('auth.status !== "authenticated"');
  expect(layout.indexOf('auth.status !== "authenticated"')).toBeLessThan(layout.indexOf("My Account"));
  expect(navigation).toContain('appendNextPath("/auth/login", "/account/saved")');
  expect(button).toContain('router.push(appendNextPath("/auth/login", pathname))');
  expect(wishlist).not.toContain('persist(');
  expect(wishlist).toContain("removePersistedWishlistData");
  expect(wishlist).toContain("requestVersion !== syncVersion");
  expect(layout).toContain("key={auth.user.id}");
  expect(layout).toContain('auth.status === "unavailable"');
});

test("unresolved wishlist mutations restore the last confirmed state and expose retry truth", async () => {
  let readFails = false;
  const store = createWishlistStore({
    getOwnerId: () => "owner-a",
    getItems: async () => {
      if (readFails) throw new ApiError("Reconciliation unavailable", 503);
      return [];
    },
    addItem: async () => {
      readFails = true;
      throw new ApiError("Ambiguous add", 503);
    },
    removeItem: async () => undefined,
  });

  await store.getState().syncBackend();
  await store.getState().addItem(raceProduct);

  expect(store.getState().items).toEqual([]);
  expect(store.getState().remoteItemIds).toEqual({});
  expect(store.getState().mutationStates[raceProduct.id]).toEqual({
    status: "error",
    desiredPresent: true,
    confirmedPresent: false,
  });
  expect(store.getState().syncError).toBe("This item could not be saved. Try again.");
});

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  unexpectedFailedRequests: string[];
  unexpectedBadResponses: string[];
};

interface ExpectedDiagnostics {
  failedRequests?: ReadonlyArray<{ method: string; path: string; errorText?: string }>;
  badResponses?: ReadonlyArray<{ method: string; path: string; status: number }>;
}

function requestPath(rawUrl: string): string {
  const url = new URL(rawUrl);
  return `${url.pathname}${url.search}`;
}

type FailedRequestSignature = {
  rawUrl: string;
  method: string;
  resourceType: string;
  errorText: string;
  nextRouterPrefetch: string | undefined;
  purpose: string | undefined;
  secPurpose: string | undefined;
};

function isExpectedNextPrefetchCancellation(signature: FailedRequestSignature): boolean {
  if (!baseUrl) return false;
  const requestUrl = new URL(signature.rawUrl);
  const fixtureOrigin = new URL(baseUrl).origin;
  return requestUrl.origin === fixtureOrigin
    && !requestUrl.pathname.startsWith("/api/")
    && signature.method === "GET"
    && signature.resourceType === "fetch"
    && signature.errorText === "net::ERR_ABORTED"
    && signature.nextRouterPrefetch === "1"
    && signature.purpose === undefined
    && signature.secPurpose === undefined
    && requestUrl.searchParams.size === 1
    && Boolean(requestUrl.searchParams.get("_rsc"));
}

function expectedConsoleFailure(
  text: string,
  rawUrl: string,
  expected: ExpectedDiagnostics,
): boolean {
  const path = requestPath(rawUrl);
  const responseMatch = /^Failed to load resource: the server responded with a status of (\d{3}) \([^)]+\)$/.exec(text);
  if (responseMatch) {
    const status = Number(responseMatch[1]);
    return expected.badResponses?.some((entry) => entry.path === path && entry.status === status) ?? false;
  }

  const failureMatch = /^Failed to load resource: (net::ERR_[A-Z_]+)$/.exec(text);
  if (failureMatch) {
    return expected.failedRequests?.some((entry) => (
      entry.path === path && entry.errorText === failureMatch[1]
    )) ?? false;
  }
  return false;
}

function collectDiagnostics(page: Page, expected: ExpectedDiagnostics = {}): Diagnostics {
  const diagnostics: Diagnostics = { consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] };
  page.on("console", (message) => {
    const source = message.location().url;
    const isExpected = source ? expectedConsoleFailure(message.text(), source, expected) : false;
    if (message.type() === "error" && !isExpected) {
      diagnostics.consoleErrors.push(source ? `${message.text()} ${source}` : message.text());
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const errorText = request.failure()?.errorText ?? "Unknown request failure";
    const path = requestPath(request.url());
    const headers = request.headers();
    const isExpected = expected.failedRequests?.some((entry) => (
      entry.method === request.method()
      && entry.path === path
      && (!entry.errorText || entry.errorText === errorText)
      )) || isExpectedNextPrefetchCancellation({
        rawUrl: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        errorText,
        nextRouterPrefetch: headers["next-router-prefetch"],
        purpose: headers.purpose,
        secPurpose: headers["sec-purpose"],
      });
    if (!isExpected) {
      diagnostics.unexpectedFailedRequests.push(JSON.stringify({
        errorText,
        method: request.method(),
        resourceType: request.resourceType(),
        path,
        nextRouterPrefetch: headers["next-router-prefetch"] ?? null,
        purpose: headers.purpose ?? null,
        secPurpose: headers["sec-purpose"] ?? null,
      }));
    }
  });
  page.on("response", (response) => {
    const isExpected = expected.badResponses?.some((entry) => (
      entry.method === response.request().method()
      && entry.path === requestPath(response.url())
      && entry.status === response.status()
    ));
    if (response.status() >= 400 && !isExpected) {
      diagnostics.unexpectedBadResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return diagnostics;
}

const baseUrl = process.env.CONSUMER_AUTH_BASE_URL;
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

test("diagnostics accept only the exact framework prefetch cancellation signature", () => {
  if (!baseUrl) return;
  const valid: FailedRequestSignature = {
    rawUrl: `${baseUrl}/account?_rsc=fixture`,
    method: "GET",
    resourceType: "fetch",
    errorText: "net::ERR_ABORTED",
    nextRouterPrefetch: "1",
    purpose: undefined,
    secPurpose: undefined,
  };
  expect(isExpectedNextPrefetchCancellation(valid)).toBe(true);
  expect(isExpectedNextPrefetchCancellation({ ...valid, rawUrl: `${baseUrl}/api/backend/user/me?_rsc=fixture` })).toBe(false);
  expect(isExpectedNextPrefetchCancellation({ ...valid, nextRouterPrefetch: undefined })).toBe(false);
  expect(isExpectedNextPrefetchCancellation({ ...valid, resourceType: "script" })).toBe(false);
  expect(isExpectedNextPrefetchCancellation({ ...valid, errorText: "net::ERR_CONNECTION_FAILED" })).toBe(false);
  expect(isExpectedNextPrefetchCancellation({ ...valid, rawUrl: `${baseUrl}/account?_rsc=fixture&extra=1` })).toBe(false);
  expect(isExpectedNextPrefetchCancellation({ ...valid, rawUrl: "https://example.test/account?_rsc=fixture" })).toBe(false);
});

test.describe("consumer auth and wishlist browser acceptance", () => {
  test.skip(!baseUrl, "CONSUMER_AUTH_BASE_URL is required for fixture-based visual QA.");
  test.beforeEach(async ({ page }) => {
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await page.route("**/_vercel/insights/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
    await page.route("**/_vercel/speed-insights/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
    await page.route(/\/_next\/image\?url=%2Fplaceholder\.png&w=256&q=75$/, (route) => (
      route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng })
    ));
    await page.route("https://images.unsplash.com/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng });
    });
  });

  for (const viewport of viewports) {
    test(`${viewport.name} fresh guests never receive protected account content`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => localStorage.clear());
      await page.route("**/api/backend/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith("/user/me")) {
          await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
          return;
        }
        if (url.pathname.endsWith("/auth/csrf-token")) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
          return;
        }
        if (url.pathname.endsWith("/auth/refresh-token")) {
          await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
      });
      const diagnostics = collectDiagnostics(page, {
        badResponses: [
          { method: "GET", path: "/api/backend/user/me", status: 401 },
          { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
        ],
      });
      const protectedRequests: string[] = [];
      const verificationRequests: string[] = [];
      const refreshRequests: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname.endsWith("/api/backend/user/me")) verificationRequests.push(url.pathname);
        if (url.pathname.endsWith("/api/backend/auth/refresh-token")) refreshRequests.push(url.pathname);
        if (url.pathname.startsWith("/api/backend/") && /\/(wishlist|orders|user\/addresses)(?:[/?]|$)/.test(url.pathname)) {
          protectedRequests.push(request.url());
        }
      });

      for (const route of ["/account", "/account/orders", "/account/orders/order-1", "/account/saved", "/account/addresses", "/account/settings"]) {
        await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
        await expect(page).toHaveURL(new RegExp(`/auth/login\\?next=${encodeURIComponent(route)}`));
        await expect(page.getByText("My Account", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Your wishlist is empty", { exact: true })).toHaveCount(0);
      }

      expect(protectedRequests).toEqual([]);
      expect(verificationRequests).toHaveLength(6);
      expect(new Set(verificationRequests)).toEqual(new Set(["/api/backend/user/me"]));
      expect(refreshRequests).toHaveLength(6);
      expect(new Set(refreshRequests)).toEqual(new Set(["/api/backend/auth/refresh-token"]));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
      await page.screenshot({ path: path.resolve(`output/playwright/consumer-auth-wishlist/guest-${viewport.name}.png`) });
    });
  }

  for (const destination of [
    { label: "Wishlist", nextPath: "/account/saved" },
    { label: "Orders", nextPath: "/account/orders" },
    { label: "Account", nextPath: "/account" },
  ] as const) {
    test(`mobile ${destination.label} navigation preserves sanitized return intent across browser history`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => localStorage.clear());
      const diagnostics = collectDiagnostics(page, {
        failedRequests: [{ method: "GET", path: "/api/backend/categories", errorText: "net::ERR_ABORTED" }],
        badResponses: [
          { method: "GET", path: "/api/backend/user/me", status: 401 },
          { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
        ],
      });
      await page.route("**/api/backend/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith("/user/me")) {
          await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
          return;
        }
        if (url.pathname.endsWith("/auth/csrf-token")) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
          return;
        }
        if (url.pathname.endsWith("/auth/refresh-token")) {
          await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
          return;
        }
        await route.continue();
      });

      await page.goto(baseUrl!, { waitUntil: "networkidle" });
      const nav = page.getByRole("navigation", { name: "Mobile navigation" });
      await expect(nav).toBeVisible();
      await nav.getByRole("link", { name: destination.label }).click();
      const expectedLoginUrl = `${baseUrl}/auth/login?next=${encodeURIComponent(destination.nextPath)}`;
      await expect(page).toHaveURL(expectedLoginUrl);
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await page.waitForLoadState("networkidle");

      await page.goBack({ waitUntil: "networkidle" });
      await expect(page).toHaveURL(`${baseUrl}/`);
      await page.goForward({ waitUntil: "networkidle" });
      await expect(page).toHaveURL(expectedLoginUrl);
      await expect(page.getByText("My Account", { exact: true })).toBeHidden();
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    });
  }

  test("signed-out product cards keep wishlist private and render only valid rating evidence", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.clear());
    const diagnostics = collectDiagnostics(page, {
      badResponses: [{ method: "GET", path: "/api/backend/user/me", status: 401 }],
    });
    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    const ratedCard = page.getByTestId("product-card").filter({ hasText: "Samsung Galaxy A55 5G" }).first();
    const unratedCard = page.getByTestId("product-card").filter({ hasText: "Product Without Reviews" }).first();
    await expect(ratedCard).toBeVisible();
    await expect(ratedCard.getByText("5", { exact: true })).toBeVisible();
    await expect(ratedCard.getByText("(1)", { exact: true })).toBeVisible();
    await expect(unratedCard).toBeVisible();
    await expect(unratedCard.locator("svg.lucide-star")).toHaveCount(0);
    await expect(unratedCard.getByText(/^\(\d+\)$/)).toHaveCount(0);

    const wishlistAction = ratedCard.getByRole("button", { name: "Add to wishlist" });
    await expect(wishlistAction).toBeEnabled();
    await wishlistAction.click();
    await expect(page).toHaveURL(/\/auth\/login\?next=%2F$/);
    expect(await page.evaluate(() => ({
      authUser: localStorage.getItem("zogular_auth_user"),
      currentWishlist: localStorage.getItem("zogular-wishlist-storage"),
      legacyWishlist: localStorage.getItem("zamoyo-wishlist-storage"),
    }))).toEqual({ authUser: null, currentWishlist: null, legacyWishlist: null });
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("an HttpOnly refresh cookie restores identity when local storage is empty", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.clear());
    await context.addCookies([{
      name: "refreshToken",
      value: "fixture-refresh-cookie",
      url: baseUrl!,
      httpOnly: true,
      sameSite: "Lax",
    }]);
    const authSequence: string[] = [];
    let currentUserRequests = 0;
    const diagnostics = collectDiagnostics(page, {
      badResponses: [{ method: "GET", path: "/api/backend/user/me", status: 401 }],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) {
        currentUserRequests += 1;
        authSequence.push(`${request.method()} ${url.pathname} ${currentUserRequests === 1 ? 401 : 200}`);
        await route.fulfill({
          status: currentUserRequests === 1 ? 401 : 200,
          contentType: "application/json",
          body: JSON.stringify(currentUserRequests === 1
            ? { message: "Access token expired" }
            : currentUserPayload("cookie-owner")),
        });
        return;
      }
      if (url.pathname.endsWith("/auth/csrf-token")) {
        authSequence.push(`${request.method()} ${url.pathname} 200`);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      if (url.pathname.endsWith("/auth/refresh-token")) {
        expect(request.headers().cookie).toContain("refreshToken=fixture-refresh-cookie");
        authSequence.push(`${request.method()} ${url.pathname} 200`);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("cookie-owner")) });
        return;
      }
      if (url.pathname.endsWith("/wishlist")) {
        const pageNumber = Number(url.searchParams.get("page"));
        const limit = Number(url.searchParams.get("limit"));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload([], pageNumber, limit)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account/saved`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Saved Items" })).toBeVisible();
    await expect(page.getByText("Your wishlist is empty", { exact: true })).toBeVisible();
    expect(authSequence).toEqual([
      "GET /api/backend/user/me 401",
      "GET /api/backend/auth/csrf-token 200",
      "POST /api/backend/auth/refresh-token 200",
      "GET /api/backend/user/me 200",
    ]);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("zogular_auth_user") ?? "null")?.id)).toBe("cookie-owner");
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("a fresh guest attempts refresh once, does not loop, and receives guest sign-in copy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.clear());
    const authSequence: string[] = [];
    const diagnostics = collectDiagnostics(page, {
      badResponses: [
        { method: "GET", path: "/api/backend/user/me", status: 401 },
        { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
      ],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) {
        authSequence.push(`${request.method()} ${url.pathname}`);
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
        return;
      }
      if (url.pathname.endsWith("/auth/csrf-token")) {
        authSequence.push(`${request.method()} ${url.pathname}`);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      if (url.pathname.endsWith("/auth/refresh-token")) {
        authSequence.push(`${request.method()} ${url.pathname}`);
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Faccount$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Please sign in again to continue.", { exact: true })).toHaveCount(0);
    expect(authSequence).toEqual([
      "GET /api/backend/user/me",
      "GET /api/backend/auth/csrf-token",
      "POST /api/backend/auth/refresh-token",
    ]);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("desktop account menu has deterministic complete keyboard navigation and keeps guest orders behind sign in", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => localStorage.clear());
    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
        return;
      }
      if (url.pathname.endsWith("/auth/csrf-token")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      if (url.pathname.endsWith("/auth/refresh-token")) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });
    const diagnostics = collectDiagnostics(page, {
      badResponses: [
        { method: "GET", path: "/api/backend/user/me", status: 401 },
        { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
      ],
    });

    await page.goto(baseUrl!, { waitUntil: "networkidle" });
    const accountTrigger = page.getByRole("button", { name: "Open sign in menu" });
    const menu = page.getByRole("menu", { name: "Account options" });
    const signIn = menu.getByRole("menuitem", { name: /sign in/i });
    const register = menu.getByRole("menuitem", { name: "Register" });
    const orders = menu.getByRole("menuitem", { name: "My Orders" });
    const help = menu.getByRole("menuitem", { name: "Help Center" });

    for (let iteration = 0; iteration < 10; iteration += 1) {
      await accountTrigger.focus();
      await accountTrigger.press("ArrowDown");
      await expect(signIn).toBeFocused();
      await signIn.press("ArrowDown");
      await expect(register).toBeFocused();
      await register.press("End");
      await expect(help).toBeFocused();
      await help.press("ArrowDown");
      await expect(signIn).toBeFocused();
      await signIn.press("Home");
      await expect(signIn).toBeFocused();
      await signIn.press("ArrowUp");
      await expect(help).toBeFocused();
      await help.press("Escape");
      await expect(menu).toBeHidden();
      await expect(accountTrigger).toBeFocused();
    }

    await accountTrigger.press("ArrowUp");
    await expect(help).toBeFocused();
    await help.press("Tab");
    await expect(menu).toBeHidden();
    await expect(page.locator("[role='menuitem']:focus")).toHaveCount(0);

    await accountTrigger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(accountTrigger).toBeFocused();

    await accountTrigger.press("Enter");
    await expect(signIn).toBeFocused();
    await signIn.press("End");
    await expect(help).toBeFocused();
    await help.press("Home");
    await expect(signIn).toBeFocused();
    await signIn.press("ArrowDown");
    await expect(register).toBeFocused();
    await register.press("ArrowDown");
    await expect(orders).toBeFocused();
    await menu.getByRole("menuitem", { name: "My Orders" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Faccount%2Forders$/);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("seller dashboard state clears while Account B application status is pending", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "account-a@example.test" }));
    });
    let currentOwner = "account-a";
    const applicationCalls: string[] = [];
    const pendingApplication = deferred<void>();
    const pendingApplicationStarted = deferred<void>();
    const diagnostics = collectDiagnostics(page);

    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      const requestOwner = currentOwner;
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload(requestOwner, { role: "SELLER" })) });
        return;
      }
      if (url.pathname.endsWith("/vendor/applications/me")) {
        applicationCalls.push(requestOwner);
        if (requestOwner === "account-b") {
          pendingApplicationStarted.resolve();
          await pendingApplication.promise;
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sellerApplicationPayload(requestOwner, "DRAFT")) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sellerApplicationPayload(requestOwner, "APPROVED")) });
        return;
      }
      if (url.pathname.endsWith("/wishlist")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload([], 1, 100)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(baseUrl!, { waitUntil: "networkidle" });
    const dashboardLink = page.getByRole("link", { name: "Seller Dashboard", exact: true });
    await expect(dashboardLink).toBeVisible();

    currentOwner = "account-b";
    await setBrowserIdentity(page, currentOwner);
    await pendingApplicationStarted.promise;
    await expect(dashboardLink).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sell on Zogular", exact: true })).toBeVisible();

    const accountTrigger = page.getByRole("button", { name: "Open account menu" });
    await accountTrigger.click();
    await expect(page.getByRole("menu", { name: "Account options" })).toBeVisible();
    await expect(page.getByText("account-b@example.test", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(accountTrigger).toBeFocused();

    pendingApplication.resolve();
    await expect.poll(() => applicationCalls).toEqual(["account-a", "account-b"]);
    await expect(dashboardLink).toHaveCount(0);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("seller dashboard fails closed for Account B missing, malformed, and unavailable applications", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "account-a@example.test" }));
    });
    let currentOwner = "account-a";
    const applicationCalls = new Map<string, number>();
    const applicationPath = "/api/backend/vendor/applications/me";
    const diagnostics = collectDiagnostics(page, {
      badResponses: [
        { method: "GET", path: applicationPath, status: 404 },
        { method: "GET", path: applicationPath, status: 503 },
      ],
    });

    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      const requestOwner = currentOwner;
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload(requestOwner, { role: "SELLER" })) });
        return;
      }
      if (url.pathname.endsWith("/vendor/applications/me")) {
        applicationCalls.set(requestOwner, (applicationCalls.get(requestOwner) ?? 0) + 1);
        if (requestOwner === "account-b") {
          await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Application not found" }) });
          return;
        }
        if (requestOwner === "account-c") {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { application: null } }) });
          return;
        }
        if (requestOwner === "account-d") {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Temporarily unavailable" }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sellerApplicationPayload(requestOwner, "APPROVED")) });
        return;
      }
      if (url.pathname.endsWith("/wishlist")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload([], 1, 100)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(baseUrl!, { waitUntil: "networkidle" });
    const dashboardLink = page.getByRole("link", { name: "Seller Dashboard", exact: true });
    await expect(dashboardLink).toBeVisible();

    for (const nextOwner of ["account-b", "account-c", "account-d"]) {
      const responseFinished = page.waitForResponse((response) => (
        response.request().method() === "GET"
        && new URL(response.url()).pathname.endsWith("/vendor/applications/me")
      ));
      currentOwner = nextOwner;
      await setBrowserIdentity(page, nextOwner);
      await responseFinished;
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(dashboardLink).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Sell on Zogular", exact: true })).toBeVisible();
      expect(applicationCalls.get(nextOwner)).toBe(1);
    }

    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("a deferred Account A application cannot overwrite Account B seller status", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "account-a@example.test" }));
    });
    let currentOwner = "account-a";
    const applicationCalls: string[] = [];
    const accountAResponseGate = deferred<void>();
    const accountARequestStarted = deferred<void>();
    const diagnostics = collectDiagnostics(page);

    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      const requestOwner = currentOwner;
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload(requestOwner, { role: "SELLER" })) });
        return;
      }
      if (url.pathname.endsWith("/vendor/applications/me")) {
        applicationCalls.push(requestOwner);
        if (requestOwner === "account-a") {
          accountARequestStarted.resolve();
          await accountAResponseGate.promise;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sellerApplicationPayload(requestOwner, "APPROVED")) });
        return;
      }
      if (url.pathname.endsWith("/wishlist")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload([], 1, 100)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(baseUrl!, { waitUntil: "domcontentloaded" });
    await accountARequestStarted.promise;
    currentOwner = "account-b";
    await setBrowserIdentity(page, currentOwner);
    const dashboardLink = page.getByRole("link", { name: "Seller Dashboard", exact: true });
    await expect(dashboardLink).toBeVisible();
    expect(applicationCalls).toEqual(["account-a", "account-b"]);

    accountAResponseGate.resolve();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(dashboardLink).toBeVisible();
    expect(applicationCalls).toEqual(["account-a", "account-b"]);

    const navbarSource = readSource("src/components/layout/Navbar.tsx");
    expect(navbarSource).toContain("sellerRequestEpochRef.current !== requestEpoch");
    expect(navbarSource).toContain("current.ownerId === sellerOwnerId");
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("seller dashboard clears immediately when an approved seller becomes a guest", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "account-a@example.test" }));
    });
    let currentOwner: string | null = "account-a";
    const guestVerificationGate = deferred<void>();
    const guestVerificationStarted = deferred<void>();
    let applicationCalls = 0;
    const diagnostics = collectDiagnostics(page, {
      badResponses: [
        { method: "GET", path: "/api/backend/user/me", status: 401 },
        { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
      ],
    });

    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      const requestOwner = currentOwner;
      if (url.pathname.endsWith("/user/me")) {
        if (!requestOwner) {
          guestVerificationStarted.resolve();
          await guestVerificationGate.promise;
          await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload(requestOwner, { role: "SELLER" })) });
        return;
      }
      if (url.pathname.endsWith("/auth/csrf-token")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      if (url.pathname.endsWith("/auth/refresh-token")) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
        return;
      }
      if (url.pathname.endsWith("/vendor/applications/me")) {
        applicationCalls += 1;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sellerApplicationPayload(requestOwner ?? "unknown", "APPROVED")) });
        return;
      }
      if (url.pathname.endsWith("/wishlist")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload([], 1, 100)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(baseUrl!, { waitUntil: "networkidle" });
    const dashboardLink = page.getByRole("link", { name: "Seller Dashboard", exact: true });
    await expect(dashboardLink).toBeVisible();

    currentOwner = null;
    await setBrowserIdentity(page, null);
    await guestVerificationStarted.promise;
    await expect(dashboardLink).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sell on Zogular", exact: true })).toBeVisible();
    expect(applicationCalls).toBe(1);

    guestVerificationGate.resolve();
    await expect(page.getByRole("button", { name: "Open sign in menu" })).toBeVisible();
    await expect(dashboardLink).toHaveCount(0);
    expect(applicationCalls).toBe(1);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("same seller rerenders retain confirmed status without duplicate application requests", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "account-a@example.test" }));
    });
    let applicationCalls = 0;
    const diagnostics = collectDiagnostics(page);

    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("account-a", { role: "SELLER" })) });
        return;
      }
      if (url.pathname.endsWith("/vendor/applications/me")) {
        applicationCalls += 1;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sellerApplicationPayload("account-a", "APPROVED")) });
        return;
      }
      if (url.pathname.endsWith("/wishlist")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload([], 1, 100)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(baseUrl!, { waitUntil: "networkidle" });
    const dashboardLink = page.getByRole("link", { name: "Seller Dashboard", exact: true });
    const accountTrigger = page.getByRole("button", { name: "Open account menu" });
    const menu = page.getByRole("menu", { name: "Account options" });
    await expect(dashboardLink).toBeVisible();
    expect(applicationCalls).toBe(1);

    await accountTrigger.click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(accountTrigger).toBeFocused();
    await expect(dashboardLink).toBeVisible();

    await accountTrigger.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Account Overview" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(accountTrigger).toBeFocused();
    await page.setViewportSize({ width: 1439, height: 900 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      window.dispatchEvent(new Event("zogular:auth-session-changed"));
      return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });

    await expect(dashboardLink).toBeVisible();
    expect(applicationCalls).toBe(1);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("orders preserve backend pagination and load every requested page without duplication", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "account-a@example.test" }));
    });
    const requestedOrderPages: string[] = [];
    const diagnostics = collectDiagnostics(page);
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("account-a")) });
        return;
      }
      if (url.pathname.endsWith("/orders") && request.method() === "GET") {
        requestedOrderPages.push(`${url.searchParams.get("page")}:${url.searchParams.get("limit")}`);
        const pageNumber = Number(url.searchParams.get("page"));
        const limit = Number(url.searchParams.get("limit"));
        const start = (pageNumber - 1) * limit;
        const count = pageNumber === 1 ? 20 : 5;
        const orders = Array.from({ length: count }, (_, index) => backendOrder(`order-${start + index + 1}`));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(orderPagePayload(orders, pageNumber, limit, 25)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account/orders`, { waitUntil: "networkidle" });
    await expect(page.getByText("Showing 20 of 25 orders", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Load More Orders" }).dblclick();
    await expect(page.getByText("Showing 25 of 25 orders", { exact: true })).toBeVisible();
    await expect(page.getByText("ORDER-25", { exact: true })).toBeVisible();
    expect(requestedOrderPages).toEqual(["1:20", "2:20"]);
    expect(await page.locator("[href^='/account/orders/order-']").count()).toBe(25);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("duplicate orders across pages stay explicitly incomplete and retryable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "account-a@example.test" }));
    });
    const requestedOrderPages: string[] = [];
    const diagnostics = collectDiagnostics(page);
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("account-a")) });
        return;
      }
      if (url.pathname.endsWith("/orders") && request.method() === "GET") {
        const pageNumber = Number(url.searchParams.get("page"));
        const limit = Number(url.searchParams.get("limit"));
        requestedOrderPages.push(`${pageNumber}:${limit}`);
        const orders = pageNumber === 1
          ? Array.from({ length: 20 }, (_, index) => backendOrder(`order-${index + 1}`))
          : [20, 21, 22, 23, 24].map((index) => backendOrder(`order-${index}`));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(orderPagePayload(orders, pageNumber, limit, 25)) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account/orders`, { waitUntil: "networkidle" });
    await expect(page.getByText("Showing 20 of 25 orders", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Load More Orders" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "More orders could not load. Please try again." })).toHaveText("More orders could not load. Please try again.");
    await expect(page.getByText("Showing 20 of 25 orders", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load More Orders" })).toBeEnabled();
    expect(await page.locator("[href^='/account/orders/order-']").count()).toBe(20);
    expect(requestedOrderPages).toEqual(["1:20", "2:20"]);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("an arbitrary stored user remains private until the backend verifies identity", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "forged-user", firstName: "Forged", lastName: "User", email: "forged@example.test" }));
    });
    const verificationGate = deferred<void>();
    const protectedRequests: string[] = [];
    const diagnostics = collectDiagnostics(page, {
      badResponses: [
        { method: "GET", path: "/api/backend/user/me", status: 401 },
        { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
      ],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (/\/(orders|wishlist|user\/addresses)(?:\/|$)/.test(url.pathname)) protectedRequests.push(request.url());
      if (url.pathname.endsWith("/user/me")) {
        await verificationGate.promise;
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) });
        return;
      }
      if (url.pathname.endsWith("/auth/refresh-token")) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) });
        return;
      }
      if (url.pathname.endsWith("/auth/csrf-token")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Checking your account…", { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByText("My Account", { exact: true })).toHaveCount(0);
    expect(protectedRequests).toEqual([]);
    verificationGate.resolve();
    await expect(page).toHaveURL(/\/auth\/login\?reason=signin-again&next=%2Faccount$/);
    await expect(page.getByText("Please sign in again to continue.", { exact: true })).toBeVisible();
    expect(protectedRequests).toEqual([]);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("settings keep email read-only and save only supported profile fields safely", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "account-a@example.test" }));
    });
    let updateAttempts = 0;
    const updateBodies: Array<Record<string, unknown>> = [];
    const diagnostics = collectDiagnostics(page, {
      badResponses: [{ method: "PATCH", path: "/api/backend/user/update-me", status: 503 }],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("account-a")) });
        return;
      }
      if (url.pathname.endsWith("/auth/csrf-token")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      if (url.pathname.endsWith("/user/update-me")) {
        updateAttempts += 1;
        updateBodies.push(request.postDataJSON() as Record<string, unknown>);
        if (updateAttempts === 1) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Unavailable" }) });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(currentUserPayload("account-a", { preferredMoMoNumber: "0955000000" })),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account/settings`, { waitUntil: "networkidle" });
    const email = page.getByLabel("Email Address");
    await expect(email).toHaveAttribute("readonly", "");
    await expect(page.getByText("Email changes are not available here.", { exact: true })).toBeVisible();
    await page.getByLabel("Preferred MoMo Number").fill("0955000000");
    await page.getByRole("button", { name: "Save Changes" }).dblclick();
    await expect(page.getByText("Your changes could not be saved. Please try again.", { exact: true })).toBeVisible();
    expect(updateAttempts).toBe(1);
    expect(updateBodies[0]).toEqual({
      firstName: "Account",
      lastName: "A",
      telephone: "0970000000",
      preferredMoMoNumber: "0955000000",
    });
    expect(updateBodies[0]).not.toHaveProperty("email");

    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Your profile was updated.", { exact: true })).toBeVisible();
    expect(updateAttempts).toBe(2);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  const identitySwitchCases = [
    { name: "overview", route: "/account", target: "/orders", expected: "Welcome back, Bob!" },
    { name: "orders", route: "/account/orders", target: "/orders", expected: "B-ORDER" },
    { name: "order detail", route: "/account/orders/order-switch", target: "/orders/order-switch", expected: "#B-DETAIL" },
    { name: "addresses", route: "/account/addresses", target: "/user/addresses", expected: "B Recipient" },
    { name: "settings", route: "/account/settings", target: "/user/me", expected: "Bob" },
    { name: "saved items", route: "/account/saved", target: "/wishlist", expected: "B saved item" },
  ] as const;

  for (const identityCase of identitySwitchCases) {
    test(`${identityCase.name} rejects a deferred Account A response after switching to Account B`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Alice", lastName: "A", email: "account-a@example.test" }));
      });
      let currentOwner: "account-a" | "account-b" = "account-a";
      let currentUserCalls = 0;
      const staleResponseGate = deferred<void>();
      const staleRequestStarted = deferred<void>();
      let staleRequestObserved = false;
      const diagnostics = collectDiagnostics(page);

      const maybeWaitForStaleRequest = async (pathname: string, requestOwner: string) => {
        const isSettingsIdentityRead = identityCase.name === "settings"
          && pathname.endsWith("/user/me")
          && currentUserCalls > 1;
        const isTarget = identityCase.name === "settings"
          ? isSettingsIdentityRead
          : pathname.endsWith(identityCase.target);
        if (requestOwner === "account-a" && isTarget && !staleRequestObserved) {
          staleRequestObserved = true;
          staleRequestStarted.resolve();
          await staleResponseGate.promise;
        }
      };

      await page.route("**/api/backend/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const requestOwner = currentOwner;
        if (url.pathname.endsWith("/user/me")) currentUserCalls += 1;
        await maybeWaitForStaleRequest(url.pathname, requestOwner);

        const isB = requestOwner === "account-b";
        if (url.pathname.endsWith("/user/me")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(currentUserPayload(requestOwner, { firstName: isB ? "Bob" : "Alice", lastName: isB ? "B" : "A" })),
          });
          return;
        }
        if (url.pathname.endsWith("/wishlist")) {
          const items = [backendWishlistItem(isB ? "wish-b" : "wish-a", isB ? "b-saved" : "a-saved")];
          items[0].product.title = isB ? "B saved item" : "A saved item";
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload(items, 1, 100)) });
          return;
        }
        if (url.pathname.endsWith("/user/addresses")) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ data: { addresses: [{ id: isB ? "address-b" : "address-a", fullName: isB ? "B Recipient" : "A Recipient", title: "Home", addressLine: "1 Test Road", district: "Roma", city: "Lusaka", phone: "0970000000", isDefault: true }] } }),
          });
          return;
        }
        if (url.pathname.endsWith("/orders/order-switch")) {
          const order = backendOrder("order-switch", requestOwner);
          order.orderNumber = isB ? "B-DETAIL" : "A-DETAIL";
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { order } }) });
          return;
        }
        if (url.pathname.endsWith("/orders")) {
          const pageNumber = Number(url.searchParams.get("page") ?? 1);
          const limit = Number(url.searchParams.get("limit") ?? 20);
          const order = backendOrder(isB ? "b-order" : "a-order", requestOwner);
          order.orderNumber = isB ? "B-ORDER" : "A-ORDER";
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(orderPagePayload([order], pageNumber, limit, 1)) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
      });

      await page.goto(`${baseUrl}${identityCase.route}`, { waitUntil: "domcontentloaded" });
      await staleRequestStarted.promise;
      currentOwner = "account-b";
      await page.evaluate(() => {
        localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-b", firstName: "Bob", lastName: "B", email: "account-b@example.test" }));
        window.dispatchEvent(new Event("zogular:auth-session-changed"));
      });
      const expectedIdentity = identityCase.name === "settings"
        ? page.getByLabel("First Name")
        : page.getByText(identityCase.expected, { exact: true });
      if (identityCase.name === "settings") {
        await expect(expectedIdentity).toHaveValue(identityCase.expected);
      } else {
        await expect(expectedIdentity).toBeVisible();
      }
      staleResponseGate.resolve();
      if (identityCase.name === "settings") {
        await expect(expectedIdentity).toHaveValue(identityCase.expected);
      } else {
        await expect(expectedIdentity).toBeVisible();
      }
      await expect(page.getByText(/A Recipient|A saved item|A-ORDER|A-DETAIL|Welcome back, Alice!/)).toHaveCount(0);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    });
  }

  for (const identityCase of identitySwitchCases) {
    test(`${identityCase.name} rejects a deferred Account A response after becoming a guest`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Alice", lastName: "A", email: "account-a@example.test" }));
      });
      let currentOwner: "account-a" | null = "account-a";
      let currentUserCalls = 0;
      const staleResponseGate = deferred<void>();
      const staleRequestStarted = deferred<void>();
      const initialOverviewRequestsStarted = deferred<void>();
      const initialOverviewPaths = new Set<string>();
      let staleRequestObserved = false;
      const diagnostics = collectDiagnostics(page, {
        badResponses: [
          { method: "GET", path: "/api/backend/user/me", status: 401 },
          { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
        ],
      });

      const maybeWaitForStaleRequest = async (pathname: string, requestOwner: string | null) => {
        const isSettingsIdentityRead = identityCase.name === "settings"
          && pathname.endsWith("/user/me")
          && currentUserCalls > 1;
        const isTarget = identityCase.name === "settings"
          ? isSettingsIdentityRead
          : pathname.endsWith(identityCase.target);
        if (requestOwner === "account-a" && isTarget && !staleRequestObserved) {
          staleRequestObserved = true;
          staleRequestStarted.resolve();
          await staleResponseGate.promise;
        }
      };

      await page.route("**/api/backend/**", async (route) => {
        const url = new URL(route.request().url());
        const requestOwner = currentOwner;
        if (identityCase.name === "overview" && requestOwner === "account-a") {
          if (url.pathname.endsWith("/user/me")) initialOverviewPaths.add("user");
          if (url.pathname.endsWith("/orders")) initialOverviewPaths.add("orders");
          if (url.pathname.endsWith("/user/addresses")) initialOverviewPaths.add("addresses");
          if (initialOverviewPaths.size === 3) initialOverviewRequestsStarted.resolve();
        }
        if (url.pathname.endsWith("/user/me")) currentUserCalls += 1;
        await maybeWaitForStaleRequest(url.pathname, requestOwner);

        if (url.pathname.endsWith("/auth/csrf-token")) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
          return;
        }
        if (url.pathname.endsWith("/auth/refresh-token")) {
          await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
          return;
        }

        if (!requestOwner) {
          if (url.pathname.endsWith("/user/me")) {
            await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
            return;
          }
          await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "Forbidden" }) });
          return;
        }
        if (url.pathname.endsWith("/user/me")) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("account-a", { firstName: "Alice", lastName: "A" })) });
          return;
        }
        if (url.pathname.endsWith("/wishlist")) {
          const items = [backendWishlistItem("wish-a", "a-saved")];
          items[0].product.title = "A saved item";
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload(items, 1, 100)) });
          return;
        }
        if (url.pathname.endsWith("/user/addresses")) {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { addresses: [{ id: "address-a", fullName: "A Recipient", title: "Home", addressLine: "1 Test Road", district: "Roma", city: "Lusaka", phone: "0970000000", isDefault: true }] } }) });
          return;
        }
        if (url.pathname.endsWith("/orders/order-switch")) {
          const order = backendOrder("order-switch", "account-a");
          order.orderNumber = "A-DETAIL";
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { order } }) });
          return;
        }
        if (url.pathname.endsWith("/orders")) {
          const pageNumber = Number(url.searchParams.get("page") ?? 1);
          const limit = Number(url.searchParams.get("limit") ?? 20);
          const order = backendOrder("a-order", "account-a");
          order.orderNumber = "A-ORDER";
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(orderPagePayload([order], pageNumber, limit, 1)) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
      });

      await page.goto(`${baseUrl}${identityCase.route}`, { waitUntil: "domcontentloaded" });
      await staleRequestStarted.promise;
      if (identityCase.name === "overview") await initialOverviewRequestsStarted.promise;
      currentOwner = null;
      await page.evaluate(() => {
        localStorage.removeItem("zogular_auth_user");
        window.dispatchEvent(new Event("zogular:auth-session-changed"));
      });
      await expect(page).toHaveURL(new RegExp(`/auth/login\\?next=${encodeURIComponent(identityCase.route).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      staleResponseGate.resolve();
      await expect(page).toHaveURL(/\/auth\/login\?next=/);
      await expect(page.getByText(/A Recipient|A saved item|A-ORDER|A-DETAIL|Welcome back, Alice!/)).toHaveCount(0);
      await expect(page.getByRole("main").getByText("My Account", { exact: true })).toHaveCount(0);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    });
  }

  test("order detail distinguishes forbidden, missing, and temporary failures with recovery", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "a@example.test" }));
    });
    const orderPath = "/api/backend/orders/order-fixture";
    const diagnostics = collectDiagnostics(page, {
      failedRequests: [{ method: "GET", path: orderPath, errorText: "net::ERR_CONNECTION_FAILED" }],
      badResponses: [403, 404, 503].map((status) => ({ method: "GET", path: orderPath, status })),
    });

    let responseMode: "403" | "404" | "503" | "network" | "success" = "403";
    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("account-a")) });
        return;
      }
      if (!url.pathname.endsWith("/orders/order-fixture")) {
        const data = url.pathname.endsWith("/categories") ? { categories: [] } : {};
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
        return;
      }
      if (responseMode === "network") {
        await route.abort("connectionfailed");
        return;
      }
      if (responseMode !== "success") {
        await route.fulfill({ status: Number(responseMode), contentType: "application/json", body: JSON.stringify({ message: "Internal fixture detail" }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            order: {
              id: "order-fixture",
              orderNumber: "ZG-1001",
              createdAt: "2026-08-15T00:00:00.000Z",
              status: "PROCESSING",
              totalAmount: 100,
              items: [],
            },
          },
        }),
      });
    });

    await page.goto(`${baseUrl}/account/orders/order-fixture`, { waitUntil: "networkidle" });
    await expect(page.getByText("Order unavailable", { exact: true })).toBeVisible();
    await expect(page.getByText("This order is not available.", { exact: true })).toBeVisible();
    await expect(page.getByText(/check your connection/i)).toHaveCount(0);

    responseMode = "404";
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Order not found", { exact: true })).toBeVisible();

    responseMode = "503";
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText("Order could not load", { exact: true })).toBeVisible();
    await expect(page.getByText("Please try again in a moment.", { exact: true })).toBeVisible();

    responseMode = "network";
    await page.getByRole("button", { name: "Try Again" }).click();
    await expect(page.getByText("Order could not load", { exact: true })).toBeVisible();

    responseMode = "success";
    await page.getByRole("button", { name: "Try Again" }).click();
    await expect(page.getByText("#ZG-1001", { exact: true })).toBeVisible();
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("address mutation failures preserve loaded addresses and recover in place", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "a@example.test" }));
    });
    const addressPath = "/api/backend/user/addresses";
    const deletePath = `${addressPath}/addr-home`;
    const defaultPath = `${addressPath}/addr-work/default`;
    const diagnostics = collectDiagnostics(page, {
      failedRequests: [{ method: "DELETE", path: deletePath, errorText: "net::ERR_ABORTED" }],
      badResponses: [
        { method: "PATCH", path: defaultPath, status: 503 },
        { method: "DELETE", path: deletePath, status: 503 },
        { method: "POST", path: addressPath, status: 503 },
      ],
    });

    let defaultFails = true;
    let deleteFails = true;
    let saveFails = true;
    const addresses = [
      { id: "addr-home", fullName: "Home Person", title: "Home", addressLine: "1 Home Road", district: "Kabulonga", city: "Lusaka", phone: "0970000001", isDefault: true },
      { id: "addr-work", fullName: "Work Person", title: "Work", addressLine: "2 Work Road", district: "Woodlands", city: "Lusaka", phone: "0970000002", isDefault: false },
    ];
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("account-a")) });
        return;
      }
      if (url.pathname.endsWith("/auth/csrf-token")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      if (url.pathname.endsWith("/user/addresses") && request.method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { addresses } }) });
        return;
      }
      if (url.pathname.endsWith("/user/addresses/addr-work/default")) {
        if (defaultFails) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Fixture default failure" }) });
        } else {
          addresses.forEach((address) => { address.isDefault = address.id === "addr-work"; });
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) });
        }
        return;
      }
      if (url.pathname.endsWith("/user/addresses/addr-home") && request.method() === "DELETE") {
        if (deleteFails) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Fixture delete failure" }) });
        } else {
          addresses.splice(addresses.findIndex((address) => address.id === "addr-home"), 1);
          await route.fulfill({ status: 204, body: "" });
        }
        return;
      }
      if (url.pathname.endsWith("/user/addresses") && request.method() === "POST") {
        if (saveFails) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Fixture save failure" }) });
        } else {
          const created = { id: "addr-new", fullName: "New Person", title: "Home", addressLine: "3 New Road", district: "Roma", city: "Lusaka", phone: "0970000003", isDefault: false };
          addresses.push(created);
          await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { address: created } }) });
        }
        return;
      }
      if (url.pathname.endsWith("/categories")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) });
    });

    await page.goto(`${baseUrl}/account/addresses`, { waitUntil: "networkidle" });
    const homeCard = page.locator('[data-address-id="addr-home"]');
    const workCard = page.locator('[data-address-id="addr-work"]');
    await expect(homeCard).toBeVisible();
    await expect(workCard).toBeVisible();

    await workCard.getByRole("button", { name: "Set Default" }).click();
    await expect(workCard.getByRole("alert")).toHaveText("Default address could not be changed. Try again.");
    await expect(page.getByText("Addresses could not load", { exact: true })).toHaveCount(0);
    await expect(homeCard).toContainText("Default");
    defaultFails = false;
    await workCard.getByRole("button", { name: "Set Default" }).click();
    await expect(workCard).toContainText("Default");

    await homeCard.getByRole("button", { name: "Delete address" }).click();
    await expect(homeCard.getByRole("alert")).toHaveText("Address could not be deleted. Try again.");
    await expect(homeCard).toBeVisible();
    deleteFails = false;
    await homeCard.getByRole("button", { name: "Delete address" }).click();
    await expect(homeCard).toHaveCount(0);

    await page.getByRole("button", { name: "Add New Address" }).click();
    await page.getByLabel("Recipient Name").fill("New Person");
    await page.getByLabel("Phone").fill("0970000003");
    await page.getByLabel("Street Address").fill("3 New Road");
    await page.getByLabel("Area").fill("Roma");
    await page.getByRole("button", { name: "Save Address" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("Address could not be saved. Try again.");
    await expect(workCard).toBeVisible();
    await page.screenshot({ path: path.resolve("output/playwright/consumer-auth-wishlist/address-save-failure-390x844.png") });
    saveFails = false;
    await page.getByRole("button", { name: "Save Address" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator('[data-address-id="addr-new"]')).toBeVisible();

    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });

  test("wishlist state is replaced across authenticated identities and cleared on logout", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    let remoteOwner: "account-a" | "account-b" | null = "account-a";
    let logoutRequests = 0;
    const logoutStarted = deferred<void>();
    const releaseLogout = deferred<void>();
    const diagnostics = collectDiagnostics(page, {
      badResponses: [{ method: "GET", path: "/api/backend/user/me", status: 401 }],
    });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "a@example.test" }));
      localStorage.setItem("zogular-wishlist-storage", JSON.stringify({ state: { items: [{ id: "leaked-item" }] } }));
    });
    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/user/me")) {
        if (!remoteOwner) {
          await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload(remoteOwner)) });
        return;
      }
      if (url.pathname.endsWith("/auth/csrf-token")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      if (/\/auth\/logout\/?$/.test(url.pathname) && route.request().method() === "POST") {
        logoutRequests += 1;
        remoteOwner = null;
        logoutStarted.resolve();
        await releaseLogout.promise;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
        return;
      }
      if (url.pathname.endsWith("/wishlist")) {
        const items = remoteOwner === "account-a"
          ? [{ id: "wish-a", productId: "product-a", createdAt: new Date(0).toISOString(), product: { id: "product-a", slug: "account-a-product", title: "Account A product", price: 100, stock: 1, images: ["/images/discovery/home-editorial-mobile.webp"] } }]
          : [];
        const page = Number(url.searchParams.get("page"));
        const limit = Number(url.searchParams.get("limit"));
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(wishlistPagePayload(items, page, limit)) });
        return;
      }
      if (url.pathname.endsWith("/categories")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: {} }) });
    });

    await page.goto(`${baseUrl}/account/saved`, { waitUntil: "networkidle" });
    await expect(page.getByText("Account A product", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("zogular-wishlist-storage"))).toBeNull();

    remoteOwner = "account-b";
    await page.evaluate(() => {
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-b", firstName: "Account", lastName: "B", email: "b@example.test" }));
      window.dispatchEvent(new Event("zogular:auth-session-changed"));
    });
    await expect(page.getByText("Account A product", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Your wishlist is empty", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Sign Out" }).click();
    await logoutStarted.promise;
    await expect.poll(() => page.evaluate(() => ({
      user: localStorage.getItem("zogular_auth_user"),
      wishlist: localStorage.getItem("zogular-wishlist-storage"),
    }))).toEqual({ user: null, wishlist: null });
    await expect(page.getByRole("main").getByText("My Account", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Your wishlist is empty", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Signing out…", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(`${baseUrl}/account/saved`);
    releaseLogout.resolve();
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(logoutRequests).toBe(1);
    await expect.poll(() => page.evaluate(() => ({ user: localStorage.getItem("zogular_auth_user"), wishlist: localStorage.getItem("zogular-wishlist-storage") }))).toEqual({ user: null, wishlist: null });
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("authenticated wishlist failure stays recoverable and is not shown as empty", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "a@example.test" }));
    });
    const wishlistPath = "/api/backend/wishlist?page=1&limit=100";
    const diagnostics = collectDiagnostics(page, {
      badResponses: [{ method: "GET", path: wishlistPath, status: 503 }],
    });
    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/user/me")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentUserPayload("account-a")) });
        return;
      }
      if (url.pathname.endsWith("/wishlist")) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Unavailable" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account/saved`, { waitUntil: "networkidle" });
    await expect(page.getByText("Saved items could not load", { exact: true })).toBeVisible();
    await expect(page.getByText("Please try again in a moment.", { exact: true })).toBeVisible();
    await expect(page.getByText(/check your connection/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
    await expect(page.getByText("Your wishlist is empty", { exact: true })).toHaveCount(0);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    await page.screenshot({ path: path.resolve("output/playwright/consumer-auth-wishlist/authenticated-wishlist-failure-390x844.png") });
  });

  test("expired authenticated access clears local identity and returns to sign in", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "expired-account", firstName: "Expired", lastName: "Account", email: "expired@example.test" }));
    });
    const diagnostics = collectDiagnostics(page, {
      badResponses: [
        { method: "GET", path: "/api/backend/user/me", status: 401 },
        { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
      ],
    });
    let refreshRequests = 0;
    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/auth/csrf-token")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return;
      }
      if (url.pathname.endsWith("/auth/refresh-token")) {
        refreshRequests += 1;
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) });
        return;
      }
      if (url.pathname.endsWith("/user/me") || url.pathname.endsWith("/wishlist")) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account/saved`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/auth\/login\?reason=signin-again&next=%2Faccount%2Fsaved$/);
    expect(await page.evaluate(() => localStorage.getItem("zogular_auth_user"))).toBeNull();
    expect(refreshRequests).toBe(1);
    await expect(page.getByText(/session expired/i)).toHaveCount(0);
    await expect(page.getByText("Please sign in again to continue.", { exact: true })).toBeVisible();
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });
});
