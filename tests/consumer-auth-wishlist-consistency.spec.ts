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

test("return intent accepts internal paths and rejects external or malformed destinations", () => {
  expect(sanitizeInternalNextPath("/account/saved?from=product#saved")).toBe("/account/saved?from=product#saved");
  for (const unsafe of ["https://example.com/account", "//example.com/account", "/\\example.com", "javascript:alert(1)", "/auth/login"]) {
    expect(sanitizeInternalNextPath(unsafe)).toBeNull();
  }
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

function isLocalTelemetry(rawUrl: string): boolean {
  const pathname = new URL(rawUrl).pathname;
  return pathname.startsWith("/_vercel/insights/") || pathname.startsWith("/_vercel/speed-insights/");
}

function expectedConsoleFailure(
  text: string,
  rawUrl: string,
  expected: ExpectedDiagnostics,
): boolean {
  const path = requestPath(rawUrl);
  if (
    isLocalTelemetry(rawUrl)
    && text === "Failed to load resource: the server responded with a status of 404 (Not Found)"
  ) return true;

  const responseMatch = /^Failed to load resource: the server responded with a status of (\d{3}) \([^)]+\)$/.exec(text);
  if (responseMatch) {
    const status = Number(responseMatch[1]);
    return expected.badResponses?.some((entry) => entry.path === path && entry.status === status) ?? false;
  }

  const failureMatch = /^Failed to load resource: (net::ERR_[A-Z_]+)$/.exec(text);
  if (failureMatch) {
    return expected.failedRequests?.some((entry) => (
      entry.path === path && entry.errorText === failureMatch[1]
    )) ?? isLocalTelemetry(rawUrl);
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
    const isExpected = isLocalTelemetry(request.url())
      || expected.failedRequests?.some((entry) => (
      entry.method === request.method()
      && entry.path === path
      && (!entry.errorText || entry.errorText === errorText)
      ));
    if (!isExpected) {
      const headers = request.headers();
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
    const isExpected = isLocalTelemetry(response.url()) || expected.badResponses?.some((entry) => (
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
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

test.describe("consumer auth and wishlist browser acceptance", () => {
  test.skip(!baseUrl, "CONSUMER_AUTH_BASE_URL is required for fixture-based visual QA.");
  test.beforeEach(async ({ page }) => {
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await page.addInitScript(() => {
      const NativeIntersectionObserver = window.IntersectionObserver;
      window.IntersectionObserver = class FixtureIntersectionObserver {
        private readonly nativeObserver: IntersectionObserver;
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          this.nativeObserver = new NativeIntersectionObserver(callback, options);
        }
        get root() { return this.nativeObserver.root; }
        get rootMargin() { return this.nativeObserver.rootMargin; }
        get thresholds() { return this.nativeObserver.thresholds; }
        disconnect() { this.nativeObserver.disconnect(); }
        observe(target: Element) {
          if (!(target instanceof HTMLAnchorElement)) this.nativeObserver.observe(target);
        }
        takeRecords() { return this.nativeObserver.takeRecords(); }
        unobserve(target: Element) {
          if (!(target instanceof HTMLAnchorElement)) this.nativeObserver.unobserve(target);
        }
      } as typeof IntersectionObserver;
    });
    await page.route("https://images.unsplash.com/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng });
    });
  });

  for (const viewport of viewports) {
    test(`${viewport.name} fresh guests never receive protected account content`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => localStorage.clear());
      await page.route("**/api/backend/**", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
      });
      const diagnostics = collectDiagnostics(page);
      const protectedRequests: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname.startsWith("/api/backend/") && /\/(wishlist|orders|user\/addresses|users\/me)(?:[/?]|$)/.test(url.pathname)) {
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
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
      await page.screenshot({ path: path.resolve(`output/playwright/consumer-auth-wishlist/guest-${viewport.name}.png`) });
    });
  }

  test("mobile Wishlist, Orders, and Account navigation preserve sanitized return intent across browser history", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.clear());
    const diagnostics = collectDiagnostics(page, {
      failedRequests: [{ method: "GET", path: "/api/backend/categories", errorText: "net::ERR_ABORTED" }],
    });
    await page.goto(baseUrl!, { waitUntil: "networkidle" });
    const nav = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Wishlist" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Faccount%2Fsaved$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.goBack({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(`${baseUrl}/`);
    await page.goForward({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(`${baseUrl}/auth/login?next=%2Faccount%2Fsaved`);
    await expect(page.getByText("My Account", { exact: true })).toBeHidden();
    await page.goto(baseUrl!, { waitUntil: "networkidle" });
    await nav.getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Faccount%2Forders$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.goBack({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(`${baseUrl}/`);
    await page.goForward({ waitUntil: "networkidle" });
    await expect(page).toHaveURL(`${baseUrl}/auth/login?next=%2Faccount%2Forders`);
    await expect(page.getByText("My Account", { exact: true })).toBeHidden();
    await page.goto(baseUrl!, { waitUntil: "networkidle" });
    await nav.getByRole("link", { name: "Account" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Faccount$/);
    await page.waitForLoadState("networkidle");
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

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
    let remoteOwner = "account-a";
    const diagnostics = collectDiagnostics(page);
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "account-a", firstName: "Account", lastName: "A", email: "a@example.test" }));
      localStorage.setItem("zogular-wishlist-storage", JSON.stringify({ state: { items: [{ id: "leaked-item" }] } }));
    });
    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
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
    await expect(page).toHaveURL(/\/auth\/login$/);
    expect(await page.evaluate(() => ({ user: localStorage.getItem("zogular_auth_user"), wishlist: localStorage.getItem("zogular-wishlist-storage") }))).toEqual({ user: null, wishlist: null });
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
    const wishlistPath = "/api/backend/wishlist?page=1&limit=100";
    const diagnostics = collectDiagnostics(page, {
      badResponses: [{ method: "GET", path: wishlistPath, status: 401 }],
    });
    await page.route("**/api/backend/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/wishlist") || url.pathname.includes("/auth/refresh")) {
        await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Unauthorized" }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/account/saved`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Faccount%2Fsaved$/);
    expect(await page.evaluate(() => localStorage.getItem("zogular_auth_user"))).toBeNull();
    await expect(page.getByText(/session expired/i)).toHaveCount(0);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });
});
