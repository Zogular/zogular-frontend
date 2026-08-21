import { expect, test, type Page, type Request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  CartContractError,
  parseBackendCartResponse,
} from "../src/services/cart";
import {
  CheckoutContractError,
  CheckoutOrderOutcomeUnknownError,
  createCheckoutOrder,
  parseCheckoutQuoteResponse,
  parseCreatedOrderResponse,
  type CreateCheckoutOrderInput,
} from "../src/services/checkout";
import { useCart, type CartItem } from "../src/hooks/use-cart";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const IDS = {
  cart: "00000000-0000-4000-8000-000000000001",
  cartItem: "00000000-0000-4000-8000-000000000002",
  product: "00000000-0000-4000-8000-000000000003",
  order: "00000000-0000-4000-8000-000000000004",
  orderItem: "00000000-0000-4000-8000-000000000005",
  address: "00000000-0000-4000-8000-000000000006",
  secondCartItem: "00000000-0000-4000-8000-000000000007",
  secondProduct: "00000000-0000-4000-8000-000000000008",
} as const;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function cartPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      cart: {
        id: IDS.cart,
        items: [
          {
            id: IDS.cartItem,
            productId: IDS.product,
            quantity: 2,
            itemTotal: 500,
            product: {
              id: IDS.product,
              title: "Samsung Galaxy A55 5G",
              slug: "samsung-galaxy-a55-5g",
              price: 250,
              images: [
                { id: "image-2", url: "https://images.example.test/a55-back.webp", position: 2 },
                { id: "image-1", url: "https://images.example.test/a55-front.webp", position: 1 },
              ],
            },
          },
        ],
        summary: { subtotal: 500, totalItems: 2, uniqueItems: 1 },
        ...overrides,
      },
    },
  };
}

const cartItem: CartItem = {
  id: IDS.product,
  serverCartItemId: IDS.cartItem,
  slug: "samsung-galaxy-a55-5g",
  name: "Samsung Galaxy A55 5G",
  price: 250,
  image: "https://images.example.test/a55-front.webp",
  quantity: 2,
  variant: null,
};

const checkoutInput: CreateCheckoutOrderInput = {
  items: [cartItem],
  contact: {
    firstName: "Ada",
    lastName: "Buyer",
    email: "owner-a@example.test",
    phone: "0970000000",
  },
  delivery: { street: "15 Great East Road", area: "Rhodes Park" },
  paymentMethod: "cash_on_delivery",
};

function quotePayload(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      quote: {
        itemSubtotal: 500,
        deliveryFeeAmount: 50,
        cashDueOnDelivery: 500,
        grandTotalAmount: 550,
        paymentMethod: "CASH_ON_DELIVERY",
        paymentCollectionMode: "DELIVERY_FEE_THEN_CASH",
        commitmentFeeStatus: "PENDING",
        ...overrides,
      },
    },
  };
}

function createdOrderPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      order: {
        id: IDS.order,
        orderNumber: "ZG-2026-0001",
        createdAt: "2026-08-16T10:00:00.000Z",
        totalAmount: 500,
        deliveryFeeAmount: 50,
        cashDueOnDelivery: 500,
        grandTotalAmount: 550,
        paymentMethod: "CASH_ON_DELIVERY",
        paymentCollectionMode: "DELIVERY_FEE_THEN_CASH",
        commitmentFeeStatus: "PENDING",
        items: [{ productId: IDS.product, quantity: 2, price: 250 }],
        ...overrides,
      },
    },
  };
}

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("strict cart parser accepts one complete cart atomically", () => {
  expect(parseBackendCartResponse(cartPayload())).toEqual([
    expect.objectContaining({
      id: IDS.product,
      serverCartItemId: IDS.cartItem,
      name: "Samsung Galaxy A55 5G",
      quantity: 2,
      price: 250,
    }),
  ]);
});

for (const fixture of [
  { name: "missing envelope", value: { data: cartPayload().data } },
  { name: "missing cart", value: { status: "success", data: {} } },
  {
    name: "mixed malformed item",
    value: cartPayload({
      items: [
        ...cartPayload().data.cart.items,
        { id: "bad", productId: IDS.product, quantity: 1, itemTotal: 1, product: {} },
      ],
      summary: { subtotal: 501, totalItems: 3, uniqueItems: 2 },
    }),
  },
  {
    name: "duplicate cart item identity",
    value: cartPayload({
      items: [...cartPayload().data.cart.items, { ...cartPayload().data.cart.items[0] }],
      summary: { subtotal: 1000, totalItems: 4, uniqueItems: 2 },
    }),
  },
  {
    name: "duplicate product identity",
    value: cartPayload({
      items: [
        ...cartPayload().data.cart.items,
        { ...cartPayload().data.cart.items[0], id: "00000000-0000-4000-8000-000000000007" },
      ],
      summary: { subtotal: 1000, totalItems: 4, uniqueItems: 2 },
    }),
  },
  { name: "invalid quantity", value: cartPayload({ items: [{ ...cartPayload().data.cart.items[0], quantity: 0 }] }) },
  { name: "invalid price", value: cartPayload({ items: [{ ...cartPayload().data.cart.items[0], product: { ...cartPayload().data.cart.items[0].product, price: -1 } }] }) },
  { name: "inconsistent cardinality", value: cartPayload({ summary: { subtotal: 500, totalItems: 1, uniqueItems: 1 } }) },
  { name: "inconsistent subtotal", value: cartPayload({ summary: { subtotal: 499, totalItems: 2, uniqueItems: 1 } }) },
] as const) {
  test(`strict cart parser rejects ${fixture.name} without partial data`, () => {
    let returned: CartItem[] | undefined;
    expect(() => {
      returned = parseBackendCartResponse(structuredClone(fixture.value));
    }).toThrow(CartContractError);
    expect(returned).toBeUndefined();
  });
}

test("quote parser accepts exact backend-owned totals and payment state", () => {
  expect(parseCheckoutQuoteResponse(quotePayload())).toEqual({
    itemSubtotal: 500,
    deliveryFeeAmount: 50,
    cashDueOnDelivery: 500,
    grandTotalAmount: 550,
    paymentMethod: "CASH_ON_DELIVERY",
    paymentCollectionMode: "DELIVERY_FEE_THEN_CASH",
    commitmentFeeStatus: "PENDING",
  });
});

for (const fixture of [
  { name: "missing quote envelope", value: { status: "success", data: {} } },
  { name: "inconsistent quote total", value: quotePayload({ grandTotalAmount: 551 }) },
  { name: "unsupported payment mode", value: quotePayload({ paymentMethod: "MOBILE_MONEY" }) },
] as const) {
  test(`quote parser rejects ${fixture.name}`, () => {
    expect(() => parseCheckoutQuoteResponse(fixture.value)).toThrow(CheckoutContractError);
  });
}

test("create parser accepts a confirmed order only when identity, items, and totals match", () => {
  expect(parseCreatedOrderResponse(createdOrderPayload(), [{ productId: IDS.product, quantity: 2 }])).toEqual({
    id: IDS.order,
    orderNumber: "ZG-2026-0001",
  });
});

for (const fixture of [
  { name: "malformed order id", value: createdOrderPayload({ id: "order-1" }) },
  { name: "inconsistent created total", value: createdOrderPayload({ grandTotalAmount: 600 }) },
  { name: "mismatched created item", value: createdOrderPayload({ items: [{ productId: IDS.product, quantity: 1, price: 250 }] }) },
  {
    name: "duplicate created item",
    value: createdOrderPayload({ items: [{ productId: IDS.product, quantity: 2, price: 250 }, { productId: IDS.product, quantity: 2, price: 250 }] }),
  },
] as const) {
  test(`create parser rejects ${fixture.name}`, () => {
    expect(() => parseCreatedOrderResponse(fixture.value, [{ productId: IDS.product, quantity: 2 }])).toThrow(CheckoutContractError);
  });
}

test("ambiguous create failure performs exactly one POST and never fabricates confirmation", async () => {
  const originalFetch = globalThis.fetch;
  let orderPosts = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/csrf-token")) return response({ data: { csrfToken: "fixture-csrf" } });
    if (url.endsWith("/orders") && init?.method === "POST") {
      orderPosts += 1;
      throw new TypeError("response lost after commit");
    }
    throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${url}`);
  }) as typeof fetch;
  try {
    await expect(createCheckoutOrder(checkoutInput)).rejects.toBeInstanceOf(CheckoutOrderOutcomeUnknownError);
    expect(orderPosts).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("malformed apparent create success is indeterminate and cannot be treated as confirmation", async () => {
  const originalFetch = globalThis.fetch;
  let orderPosts = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/csrf-token")) return response({ data: { csrfToken: "fixture-csrf" } });
    if (url.endsWith("/orders") && init?.method === "POST") {
      orderPosts += 1;
      return response(createdOrderPayload({ id: "malformed" }));
    }
    throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${url}`);
  }) as typeof fetch;
  try {
    await expect(createCheckoutOrder(checkoutInput)).rejects.toBeInstanceOf(CheckoutOrderOutcomeUnknownError);
    expect(orderPosts).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function seedOwnedCart(ownerId: string, item: CartItem = cartItem) {
  useCart.getState().reconcileIdentity(null);
  useCart.setState({
    items: [],
    itemCount: 0,
    totalAmount: 0,
    ownerId: null,
    identityResolved: true,
    checkoutOutcomeOwnerId: null,
    pendingDeletions: [],
    pendingClear: false,
    pendingAnonymousMerge: [],
    syncStatus: "idle",
    syncError: null,
  });
  useCart.getState().reconcileIdentity(ownerId);
  useCart.setState({
    items: [item],
    itemCount: item.quantity,
    totalAmount: item.quantity * item.price,
    pendingAnonymousMerge: [],
  });
}

function cartPayloadFromItems(items: CartItem[]) {
  return {
    status: "success",
    data: {
      cart: {
        id: IDS.cart,
        items: items.map((item) => ({
          id: item.serverCartItemId,
          productId: String(item.id),
          quantity: item.quantity,
          itemTotal: item.price * item.quantity,
          product: {
            id: String(item.id),
            title: item.name,
            slug: item.slug,
            price: item.price,
            images: item.image ? [item.image] : [],
          },
        })),
        summary: {
          subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
          totalItems: items.reduce((total, item) => total + item.quantity, 0),
          uniqueItems: items.length,
        },
      },
    },
  };
}

function createCartBackendHarness(initialItems: CartItem[] = []) {
  let remoteItems = initialItems.map((item) => ({ ...item }));
  const mutations: Array<{ method: string; path: string; quantity?: number; productId?: string }> = [];
  const converged = deferred<void>();
  let expected: (items: CartItem[]) => boolean = () => false;

  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.pathname.endsWith("/auth/csrf-token")) {
      return response({ status: "success", data: { csrfToken: "fixture-csrf" } });
    }
    if (url.pathname.endsWith("/cart") && method === "GET") {
      if (expected(remoteItems)) converged.resolve();
      return response(cartPayloadFromItems(remoteItems));
    }
    if (url.pathname.endsWith("/cart/items") && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { productId: string; quantity: number };
      mutations.push({ method, path: url.pathname, ...body });
      const existing = remoteItems.find((item) => String(item.id) === body.productId);
      if (existing) existing.quantity += body.quantity;
      else {
        const source = useCart.getState().items.find((item) => String(item.id) === body.productId);
        if (!source) throw new Error(`Missing optimistic cart item ${body.productId}`);
        remoteItems.push({
          ...source,
          serverCartItemId: body.productId === IDS.product ? IDS.cartItem : IDS.secondCartItem,
          quantity: body.quantity,
        });
      }
      return response({ status: "success" });
    }
    if (url.pathname.includes("/cart/items/") && method === "PATCH") {
      const itemId = url.pathname.split("/").at(-1)!;
      const body = JSON.parse(String(init?.body)) as { quantity: number };
      mutations.push({ method, path: url.pathname, quantity: body.quantity });
      const existing = remoteItems.find((item) => item.serverCartItemId === itemId);
      if (!existing) return response({ status: "fail", message: "Missing item" }, 404);
      existing.quantity = body.quantity;
      return response({ status: "success" });
    }
    if (url.pathname.includes("/cart/items/") && method === "DELETE") {
      const itemId = url.pathname.split("/").at(-1)!;
      mutations.push({ method, path: url.pathname });
      remoteItems = remoteItems.filter((item) => item.serverCartItemId !== itemId);
      return response({ status: "success" });
    }
    if (url.pathname.endsWith("/cart/clear") && method === "DELETE") {
      mutations.push({ method, path: url.pathname });
      remoteItems = [];
      return response({ status: "success" });
    }
    throw new Error(`Unexpected fetch ${method} ${url}`);
  };

  return {
    fetchMock,
    mutations,
    setExpected(predicate: (items: CartItem[]) => boolean) {
      expected = predicate;
    },
    waitForConvergence: () => converged.promise,
    getRemoteItems: () => remoteItems.map((item) => ({ ...item })),
  };
}

test("rapid same-owner adds preserve every accepted product intent", async () => {
  seedOwnedCart("owner-a");
  useCart.setState({ items: [], itemCount: 0, totalAmount: 0 });
  const secondItem: CartItem = {
    ...cartItem,
    id: IDS.secondProduct,
    serverCartItemId: undefined,
    slug: "pixel-9-pro",
    name: "Pixel 9 Pro",
    quantity: 1,
  };
  const firstItem = { ...cartItem, serverCartItemId: undefined, quantity: 1 };
  const harness = createCartBackendHarness();
  harness.setExpected((items) => items.length === 2);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = harness.fetchMock as typeof fetch;
  try {
    useCart.getState().addItem(firstItem);
    useCart.getState().addItem(secondItem);
    await harness.waitForConvergence();
    await useCart.getState().syncWithBackend();

    expect(new Set(harness.getRemoteItems().map((item) => String(item.id)))).toEqual(
      new Set([IDS.product, IDS.secondProduct]),
    );
    expect(harness.mutations.filter((mutation) => mutation.method === "POST")).toHaveLength(2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rapid repeated add converges to the newest absolute quantity", async () => {
  seedOwnedCart("owner-a");
  useCart.setState({ items: [], itemCount: 0, totalAmount: 0 });
  const firstItem = { ...cartItem, serverCartItemId: undefined, quantity: 1 };
  const harness = createCartBackendHarness();
  harness.setExpected((items) => items.length === 1 && items[0].quantity === 2);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = harness.fetchMock as typeof fetch;
  try {
    useCart.getState().addItem(firstItem);
    useCart.getState().addItem(firstItem);
    await harness.waitForConvergence();
    await useCart.getState().syncWithBackend();

    expect(harness.getRemoteItems()).toEqual([
      expect.objectContaining({ id: IDS.product, quantity: 2 }),
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rapid clear then add executes in order and converges without resurrecting cleared lines", async () => {
  const secondItem: CartItem = {
    ...cartItem,
    id: IDS.secondProduct,
    serverCartItemId: IDS.secondCartItem,
    slug: "pixel-9-pro",
    name: "Pixel 9 Pro",
    quantity: 1,
  };
  seedOwnedCart("owner-a", cartItem);
  useCart.setState({
    items: [cartItem, secondItem],
    itemCount: 3,
    totalAmount: 750,
  });
  const harness = createCartBackendHarness([cartItem, secondItem]);
  harness.setExpected((items) => items.length === 1 && items[0].id === IDS.product && items[0].quantity === 1);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = harness.fetchMock as typeof fetch;
  try {
    useCart.getState().clearCart();
    useCart.getState().addItem({ ...cartItem, serverCartItemId: undefined, quantity: 1 });
    await harness.waitForConvergence();
    await useCart.getState().syncWithBackend();

    expect(harness.mutations.map(({ method, path }) => `${method} ${path}`)).toContain("DELETE /api/v1/cart/clear");
    expect(harness.getRemoteItems()).toEqual([
      expect.objectContaining({ id: IDS.product, quantity: 1 }),
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rapid increase decrease and remove converge to the newest same-owner state", async () => {
  const secondItem: CartItem = {
    ...cartItem,
    id: IDS.secondProduct,
    serverCartItemId: IDS.secondCartItem,
    slug: "pixel-9-pro",
    name: "Pixel 9 Pro",
    quantity: 1,
  };
  seedOwnedCart("owner-a", cartItem);
  useCart.setState({
    items: [cartItem, secondItem],
    itemCount: 3,
    totalAmount: 750,
  });
  const harness = createCartBackendHarness([cartItem, secondItem]);
  harness.setExpected((items) => items.length === 1 && items[0].id === IDS.product && items[0].quantity === 3);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = harness.fetchMock as typeof fetch;
  try {
    useCart.getState().increaseQuantity({ id: IDS.product, variant: null });
    useCart.getState().increaseQuantity({ id: IDS.product, variant: null });
    useCart.getState().decreaseQuantity({ id: IDS.product, variant: null });
    useCart.getState().removeItem({ id: IDS.secondProduct, variant: null });
    await harness.waitForConvergence();
    await useCart.getState().syncWithBackend();

    expect(harness.getRemoteItems()).toEqual([
      expect.objectContaining({ id: IDS.product, quantity: 3 }),
    ]);
    expect(harness.mutations).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "PATCH", quantity: 3 }),
      expect.objectContaining({ method: "DELETE", path: `/api/v1/cart/items/${IDS.secondCartItem}` }),
    ]));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("A to B and A to guest clear private cart state synchronously", () => {
  seedOwnedCart("owner-a");
  useCart.getState().reconcileIdentity("owner-b");
  expect(useCart.getState()).toMatchObject({ ownerId: "owner-b", items: [], itemCount: 0 });
  seedOwnedCart("owner-a");
  useCart.getState().reconcileIdentity(null);
  expect(useCart.getState()).toMatchObject({ ownerId: null, items: [], itemCount: 0 });
});

test("deferred owner A cart response cannot commit after B becomes current", async () => {
  seedOwnedCart("owner-a");
  const fetchStarted = deferred<void>();
  const cartResponse = deferred<Response>();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/cart")) {
      fetchStarted.resolve();
      return cartResponse.promise;
    }
    throw new Error(`Unexpected fetch ${String(input)}`);
  }) as typeof fetch;
  try {
    const staleSync = useCart.getState().syncWithBackend();
    await fetchStarted.promise;
    useCart.getState().reconcileIdentity("owner-b");
    cartResponse.resolve(response(cartPayload()));
    await staleSync;
    expect(useCart.getState()).toMatchObject({ ownerId: "owner-b", items: [], itemCount: 0, syncStatus: "idle" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("same-owner concurrent refreshes deduplicate and preserve one authoritative commit", async () => {
  seedOwnedCart("owner-a");
  const cartResponse = deferred<Response>();
  const fetchStarted = deferred<void>();
  const originalFetch = globalThis.fetch;
  let cartGets = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/cart")) {
      cartGets += 1;
      fetchStarted.resolve();
      return cartResponse.promise;
    }
    throw new Error(`Unexpected fetch ${String(input)}`);
  }) as typeof fetch;
  try {
    const first = useCart.getState().syncWithBackend();
    await fetchStarted.promise;
    const second = useCart.getState().syncWithBackend();
    cartResponse.resolve(response(cartPayload()));
    await Promise.all([first, second]);
    expect(cartGets).toBe(1);
    expect(useCart.getState().items).toHaveLength(1);
    expect(useCart.getState().items[0].serverCartItemId).toBe(IDS.cartItem);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ambiguous checkout hold survives verification for its owner and clears for another identity", () => {
  seedOwnedCart("owner-a");
  useCart.getState().markCheckoutOutcomeUnknown("owner-a");
  useCart.getState().suspendIdentity();
  expect(useCart.getState()).toMatchObject({ identityResolved: false, items: [], checkoutOutcomeOwnerId: "owner-a" });
  useCart.getState().reconcileIdentity("owner-a");
  expect(useCart.getState().checkoutOutcomeOwnerId).toBe("owner-a");
  expect(useCart.getState().items).toEqual([cartItem]);
  useCart.getState().suspendIdentity();
  useCart.getState().reconcileIdentity("owner-b");
  expect(useCart.getState().checkoutOutcomeOwnerId).toBeNull();
});

test("checkout uses a real feature boundary and removes the unused payment constant", () => {
  const bridge = readSource("src/components/cart/CartSyncBridge.tsx");
  const checkout = readSource("src/app/(consumer)/checkout/page.tsx");
  const checkoutFeature = readSource("src/features/checkout/components/CheckoutPageContent.tsx");
  const checkoutFlow = readSource("src/features/checkout/hooks/useCheckoutFlow.ts");
  const proxy = readSource("src/app/api/backend/[...path]/route.ts");
  const success = readSource("src/app/(consumer)/success/page.tsx");
  expect(bridge).toContain("useAuthSession");
  expect(bridge).not.toContain("getStoredAuthUser");
  expect(checkout).toContain("CheckoutPageContent");
  expect(checkout).not.toContain("useAuthSession");
  expect(checkoutFeature).toContain("useAuthSession");
  expect(checkoutFeature.split(/\r?\n/).length).toBeLessThanOrEqual(220);
  expect(checkoutFeature).toContain("<AddressSection");
  expect(checkoutFeature).toContain("<PaymentSection");
  expect(checkoutFeature).toContain("<OrderSummary");
  expect(checkoutFeature).toContain("<UnknownOutcomeState");
  expect(checkoutFlow).toContain("identityRef");
  expect(checkoutFlow).toContain("submitInFlightRef");
  expect(checkoutFlow).toContain("quoteCheckoutOrder");
  expect(checkoutFlow).toContain("CheckoutOrderOutcomeUnknownError");
  expect(checkoutFlow).toContain("isCurrentIdentity");
  expect(success).toContain("useAuthSession");
  expect(proxy).toContain("process.env.INTERNAL_BACKEND_URL");
  expect(proxy).toContain("isAdminBackendPath");
  expect(proxy).not.toContain("console.log");
  expect(fs.existsSync(path.join(repoRoot, "src/config/checkout.ts"))).toBe(false);
});

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  unexpectedFailedRequests: string[];
  unexpectedBadResponses: string[];
};

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

function isExpectedNextAppRouterCancellation(signature: FailedRequestSignature): boolean {
  if (!baseUrl) return false;
  const requestUrl = new URL(signature.rawUrl);
  return requestUrl.origin === new URL(baseUrl).origin
    && !requestUrl.pathname.startsWith("/api/")
    && signature.method === "GET"
    && signature.resourceType === "fetch"
    && signature.errorText === "net::ERR_ABORTED"
    && (signature.nextRouterPrefetch === "1" || signature.nextRouterPrefetch === null || signature.nextRouterPrefetch === undefined)
    && signature.purpose === undefined
    && signature.secPurpose === undefined
    && Boolean(requestUrl.searchParams.get("_rsc"));
}

function collectDiagnostics(
  page: Page,
  expected: {
    badResponses?: Array<{ method: string; path: string; status: number }>;
    failedRequests?: Array<{ method: string; path: string; errorText: string }>;
  } = {},
): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    unexpectedFailedRequests: [],
    unexpectedBadResponses: [],
  };
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    const locationPath = location ? requestPath(location) : "";
    const responseMatch = /^Failed to load resource: the server responded with a status of (\d{3}) \([^)]+\)$/.exec(message.text());
    const failureMatch = /^Failed to load resource: (net::ERR_[A-Z_]+)$/.exec(message.text());
    const exactExpectedResponse = responseMatch
      ? expected.badResponses?.some((entry) => entry.path === locationPath && entry.status === Number(responseMatch[1]))
      : false;
    const exactExpectedFailure = failureMatch
      ? expected.failedRequests?.some((entry) => entry.path === locationPath && entry.errorText === failureMatch[1])
      : false;
    if (!exactExpectedResponse && !exactExpectedFailure) {
      const text = message.text();
      diagnostics.consoleErrors.push(location ? `${text} ${location}` : text);
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const headers = request.headers();
    const signature = {
      method: request.method(),
      path: requestPath(request.url()),
      errorText: request.failure()?.errorText ?? "Unknown request failure",
    };
    const exactExpectedFailure = expected.failedRequests?.some((entry) => (
      entry.method === signature.method && entry.path === signature.path && entry.errorText === signature.errorText
    ));
    const exactPrefetchCancellation = isExpectedNextAppRouterCancellation({
      rawUrl: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      errorText: signature.errorText,
      nextRouterPrefetch: headers["next-router-prefetch"],
      purpose: headers.purpose,
      secPurpose: headers["sec-purpose"],
    });
    if (!exactExpectedFailure && !exactPrefetchCancellation) {
      diagnostics.unexpectedFailedRequests.push(JSON.stringify({
        ...signature,
        resourceType: request.resourceType(),
        nextRouterPrefetch: headers["next-router-prefetch"] ?? null,
      }));
    }
  });
  page.on("response", (responseValue) => {
    if (responseValue.status() < 400) return;
    const signature = {
      method: responseValue.request().method(),
      path: requestPath(responseValue.url()),
      status: responseValue.status(),
    };
    if (!expected.badResponses?.some((entry) => (
      entry.method === signature.method && entry.path === signature.path && entry.status === signature.status
    ))) diagnostics.unexpectedBadResponses.push(JSON.stringify(signature));
  });
  return diagnostics;
}

function userPayload(ownerId = "owner-a") {
  return {
    status: "success",
    data: {
      user: {
        id: ownerId,
        firstName: "Ada",
        lastName: ownerId === "owner-a" ? "Buyer" : "Second",
        email: `${ownerId}@example.test`,
        telephone: "0970000000",
        role: "USER",
        emailVerified: true,
      },
    },
  };
}

function addressPayload(ownerId = "owner-a") {
  return {
    status: "success",
    data: {
      addresses: [{
        id: IDS.address,
        fullName: ownerId === "owner-a" ? "Ada Buyer" : "Ada Second",
        title: "HOME",
        addressLine: "15 Great East Road",
        district: "Rhodes Park",
        city: "Lusaka",
        phone: "0970000000",
        deliveryInstructions: null,
        isDefault: true,
      }],
    },
  };
}

function detailOrderPayload(ownerId: string, orderNumber: string) {
  return {
    ...createdOrderPayload().data.order,
    orderNumber,
    userId: ownerId,
    status: "CONFIRMED",
    shippingAddress: {
      fullName: ownerId === "owner-a" ? "Ada Buyer" : "Ada Second",
      phone: "0970000000",
      addressLine: "15 Great East Road",
      district: "Rhodes Park",
      city: "Lusaka",
    },
    deliveryMethod: "standard",
    updatedAt: "2026-08-16T10:00:00.000Z",
    items: [{
      id: IDS.orderItem,
      productId: IDS.product,
      quantity: 2,
      price: 250,
      lineTotal: 500,
      vendorId: "00000000-0000-4000-8000-000000000008",
      vendorStatus: "PENDING",
      product: { id: IDS.product, title: "Samsung Galaxy A55 5G", slug: "samsung-galaxy-a55-5g", images: [] },
    }],
  };
}

async function setBrowserIdentity(page: Page, ownerId: string | null) {
  await page.evaluate((nextOwnerId) => {
    if (nextOwnerId) {
      localStorage.setItem("zogular_auth_user", JSON.stringify({
        id: nextOwnerId,
        firstName: "Ada",
        lastName: nextOwnerId === "owner-a" ? "Buyer" : "Second",
        email: `${nextOwnerId}@example.test`,
      }));
    } else {
      localStorage.removeItem("zogular_auth_user");
    }
    window.dispatchEvent(new Event("zogular:auth-session-changed"));
  }, ownerId);
}

async function fulfillStaticDependencies(page: Page) {
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/_vercel/insights/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("**/_vercel/speed-insights/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("https://images.example.test/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: pixel }));
  await page.route(/\/_next\/image\?.*/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: pixel }));
}

async function advanceMobileCheckoutToReview(page: Page) {
  const continueToReview = page.getByRole("button", { name: "Continue to order review" });
  if (await continueToReview.isVisible()) await continueToReview.click();
  const reviewOrder = page.getByRole("button", { name: "Review Order" });
  if (await reviewOrder.isVisible()) await reviewOrder.click();
}

function isProtectedCheckoutRequest(request: Request): boolean {
  const url = new URL(request.url());
  return url.pathname.endsWith("/user/addresses")
    || url.pathname.endsWith("/orders/quote")
    || (url.pathname.endsWith("/orders") && request.method() === "POST")
    || /\/orders\/[0-9a-f-]+$/i.test(url.pathname)
    || url.pathname.endsWith("/cart");
}

const baseUrl = process.env.CONSUMER_CART_CHECKOUT_BASE_URL;
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

test("diagnostics accept only the exact same-origin Next prefetch cancellation", () => {
  if (!baseUrl) return;
  const valid: FailedRequestSignature = {
    rawUrl: `${baseUrl}/products?_rsc=fixture`,
    method: "GET",
    resourceType: "fetch",
    errorText: "net::ERR_ABORTED",
    nextRouterPrefetch: "1",
    purpose: undefined,
    secPurpose: undefined,
  };
  expect(isExpectedNextAppRouterCancellation(valid)).toBe(true);
  expect(isExpectedNextAppRouterCancellation({ ...valid, rawUrl: `${baseUrl}/api/backend/cart?_rsc=fixture` })).toBe(false);
  expect(isExpectedNextAppRouterCancellation({ ...valid, rawUrl: "https://example.test/products?_rsc=fixture" })).toBe(false);
  expect(isExpectedNextAppRouterCancellation({ ...valid, nextRouterPrefetch: "2" })).toBe(false);
  expect(isExpectedNextAppRouterCancellation({ ...valid, resourceType: "script" })).toBe(false);
  expect(isExpectedNextAppRouterCancellation({ ...valid, errorText: "net::ERR_CONNECTION_FAILED" })).toBe(false);
});

test.describe("consumer cart and checkout production-route acceptance", () => {
  test.skip(!baseUrl, "CONSUMER_CART_CHECKOUT_BASE_URL is required for fixture-based visual QA.");

  test.beforeEach(async ({ page }) => fulfillStaticDependencies(page));

  for (const viewport of viewports) {
    test(`${viewport.name} guest checkout and confirmation issue zero protected requests`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => localStorage.clear());
      const protectedRequests: string[] = [];
      page.on("request", (request) => {
        if (isProtectedCheckoutRequest(request)) protectedRequests.push(`${request.method()} ${request.url()}`);
      });
      const diagnostics = collectDiagnostics(page, {
        badResponses: [
          { method: "GET", path: "/api/backend/user/me", status: 401 },
          { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
        ],
      });
      await page.route("**/api/backend/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
        if (url.pathname.endsWith("/auth/csrf-token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        if (url.pathname.endsWith("/auth/refresh-token")) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
      });

      await page.goto(`${baseUrl}/checkout`, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcheckout$/);
      await page.goto(`${baseUrl}/success?orderId=${IDS.order}`, { waitUntil: "networkidle" }).catch((e) => {
        console.error("GOTO ERROR:", e);
        throw e;
      });
      await expect(page).toHaveURL(new RegExp(`/auth/login\\?next=${encodeURIComponent(`/success?orderId=${IDS.order}`)}`));
      expect(protectedRequests).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
      await page.screenshot({ path: path.resolve(`output/playwright/consumer-cart-checkout-integrity/guest-${viewport.name}.png`) });
    });
  }

  for (const viewport of viewports) {
    test(`${viewport.name} authenticated cart and checkout remain contained with 44px controls`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
      });
      const diagnostics = collectDiagnostics(page);
      await page.route("**/api/backend/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload()) });
        if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
        if (url.pathname.endsWith("/user/addresses")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(addressPayload()) });
        if (url.pathname.endsWith("/orders/quote")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quotePayload()) });
        if (url.pathname.endsWith("/wishlist")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", results: 0, pagination: { total: 0, page: 1, limit: 100, pages: 0 }, data: { items: [] } }) });
        if (url.pathname.endsWith("/auth/csrf-token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
      });

      await page.goto(`${baseUrl}/cart`, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
      for (const control of ["Decrease quantity", "Increase quantity"]) {
        const box = await page.getByRole("button", { name: control }).boundingBox();
        expect(box, control).not.toBeNull();
        expect(box!.width, control).toBeGreaterThanOrEqual(44);
        expect(box!.height, control).toBeGreaterThanOrEqual(44);
      }
      await page.getByRole("link", { name: "Proceed to Checkout" }).focus();
      await expect(page.getByRole("link", { name: "Proceed to Checkout" })).toBeFocused();
      await page.goto(`${baseUrl}/checkout`, { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
      await advanceMobileCheckoutToReview(page);
      await expect.poll(async () => page.getByText("K550", { exact: true }).evaluateAll((elements) => (
        elements.filter((element) => {
          const rectangle = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rectangle.width > 0 && rectangle.height > 0 && style.visibility !== "hidden";
        }).length
      ))).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
      await page.screenshot({ path: path.resolve(`output/playwright/consumer-cart-checkout-integrity/checkout-${viewport.name}.png`), fullPage: true });
    });
  }

  test("committed-but-lost create response shows indeterminate recovery, retains cart, and never retries POST", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      if (sessionStorage.getItem("cart-checkout-fixture-initialized")) return;
      sessionStorage.setItem("cart-checkout-fixture-initialized", "1");
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
    });
    let orderPosts = 0;
    const diagnostics = collectDiagnostics(page, {
      failedRequests: [{ method: "POST", path: "/api/backend/orders", errorText: "net::ERR_FAILED" }],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload()) });
      if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
      if (url.pathname.endsWith("/user/addresses")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(addressPayload()) });
      if (url.pathname.endsWith("/orders/quote")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quotePayload()) });
      if (url.pathname.endsWith("/auth/csrf-token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
      if (url.pathname.endsWith("/orders") && request.method() === "POST") {
        orderPosts += 1;
        return route.abort("failed");
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/checkout`, { waitUntil: "networkidle" });
    await advanceMobileCheckoutToReview(page);
    await page.getByRole("button", { name: "Place Order Now" }).click();
    await expect(page.getByRole("heading", { name: "Order outcome not confirmed" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Check my orders" })).toHaveAttribute("href", "/account/orders");
    await page.waitForTimeout(250);
    expect(orderPosts).toBe(1);
    await expect(page.getByText("Samsung Galaxy A55 5G", { exact: true })).toBeVisible();
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    await page.screenshot({ path: path.resolve("output/playwright/consumer-cart-checkout-integrity/indeterminate-390x844.png"), fullPage: true });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Order outcome not confirmed" })).toBeVisible();
    expect(await page.evaluate(() => {
      const stored = localStorage.getItem("zogular-cart-storage");
      return stored ? JSON.parse(stored).state.items : null;
    })).toEqual(expect.arrayContaining([expect.objectContaining({ id: IDS.product })]));
    await advanceMobileCheckoutToReview(page);
    await expect(page.getByText("Samsung Galaxy A55 5G", { exact: true })).toBeVisible();
    expect(orderPosts).toBe(1);
  });

  test("validated create posts once, clears current cart, and navigates to verified confirmation once", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
    });
    let orderPosts = 0;
    let orderDetailGets = 0;
    const diagnostics = collectDiagnostics(page);
    const detailOrder = detailOrderPayload("owner-a", "ZG-2026-0001");
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload()) });
      if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
      if (url.pathname.endsWith("/user/addresses")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(addressPayload()) });
      if (url.pathname.endsWith("/orders/quote")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quotePayload()) });
      if (url.pathname.endsWith("/auth/csrf-token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
      if (url.pathname.endsWith("/orders") && request.method() === "POST") {
        orderPosts += 1;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdOrderPayload()) });
      }
      if (url.pathname.endsWith(`/orders/${IDS.order}`)) {
        orderDetailGets += 1;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { order: detailOrder } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/checkout`, { waitUntil: "networkidle" });
    await advanceMobileCheckoutToReview(page);
    await page.getByRole("button", { name: "Place Order Now" }).click();
    await expect(page).toHaveURL(new RegExp(`/success\\?orderId=${IDS.order}$`));
    await expect(page.getByRole("heading", { name: "Order confirmed by Zogular" })).toBeVisible();
    await page.screenshot({
      path: path.resolve("output/playwright/consumer-cart-checkout-integrity/confirmed-390x844.png"),
      fullPage: true,
    });
    expect(orderPosts).toBe(1);
    expect(orderDetailGets).toBe(1);
    expect(await page.evaluate(() => {
      const stored = localStorage.getItem("zogular-cart-storage");
      return stored ? JSON.parse(stored).state.items : null;
    })).toEqual([]);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    await page.goBack();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
    expect(orderPosts).toBe(1);
  });

  test("deferred address response for A cannot replace B checkout state", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
    });
    let currentOwner = "owner-a";
    const addressStarted = deferred<void>();
    const releaseAddressA = deferred<void>();
    const diagnostics = collectDiagnostics(page);
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload(currentOwner)) });
      if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
      if (url.pathname.endsWith("/user/addresses")) {
        const requestOwner = currentOwner;
        if (requestOwner === "owner-a") {
          addressStarted.resolve();
          await releaseAddressA.promise;
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(addressPayload(requestOwner)) });
      }
      if (url.pathname.endsWith("/orders/quote")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quotePayload()) });
      if (url.pathname.endsWith("/auth/csrf-token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/checkout`, { waitUntil: "domcontentloaded" });
    await addressStarted.promise;
    currentOwner = "owner-b";
    await setBrowserIdentity(page, "owner-b");
    await expect(page.getByText("Ada Second", { exact: true })).toBeVisible();
    releaseAddressA.resolve();
    await page.waitForTimeout(100);
    await expect(page.getByText("Ada Buyer", { exact: true })).toHaveCount(0);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("logout during a deferred quote clears checkout and ignores the stale response", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
    });
    let signedIn = true;
    const quoteStarted = deferred<void>();
    const releaseQuote = deferred<void>();
    const diagnostics = collectDiagnostics(page, {
      badResponses: [
        { method: "GET", path: "/api/backend/user/me", status: 401 },
        { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
      ],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: signedIn ? 200 : 401, contentType: "application/json", body: JSON.stringify(signedIn ? userPayload() : { message: "Sign in required" }) });
      if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
      if (url.pathname.endsWith("/user/addresses")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(addressPayload()) });
      if (url.pathname.endsWith("/orders/quote")) {
        quoteStarted.resolve();
        await releaseQuote.promise;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quotePayload()) });
      }
      if (url.pathname.endsWith("/auth/csrf-token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
      if (url.pathname.endsWith("/auth/refresh-token")) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/checkout`, { waitUntil: "domcontentloaded" });
    await quoteStarted.promise;
    signedIn = false;
    await setBrowserIdentity(page, null);
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcheckout$/);
    releaseQuote.resolve();
    await page.waitForTimeout(100);
    await expect(page.getByText("K550", { exact: true })).toHaveCount(0);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("logout during create prevents stale confirmation and duplicate order submission", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
    });
    let signedIn = true;
    let orderPosts = 0;
    const createStarted = deferred<void>();
    const releaseCreate = deferred<void>();
    const diagnostics = collectDiagnostics(page, {
      badResponses: [
        { method: "GET", path: "/api/backend/user/me", status: 401 },
        { method: "POST", path: "/api/backend/auth/refresh-token", status: 401 },
      ],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: signedIn ? 200 : 401, contentType: "application/json", body: JSON.stringify(signedIn ? userPayload() : { message: "Sign in required" }) });
      if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
      if (url.pathname.endsWith("/user/addresses")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(addressPayload()) });
      if (url.pathname.endsWith("/orders/quote")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quotePayload()) });
      if (url.pathname.endsWith("/auth/csrf-token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "fixture-csrf" } }) });
      if (url.pathname.endsWith("/auth/refresh-token")) return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
      if (url.pathname.endsWith("/orders") && request.method() === "POST") {
        orderPosts += 1;
        createStarted.resolve();
        await releaseCreate.promise;
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdOrderPayload()) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/checkout`, { waitUntil: "networkidle" });
    await advanceMobileCheckoutToReview(page);
    await page.getByRole("button", { name: "Place Order Now" }).click();
    await createStarted.promise;
    signedIn = false;
    await setBrowserIdentity(page, null);
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcheckout$/);
    releaseCreate.resolve();
    await page.waitForTimeout(100);
    expect(page.url()).not.toContain("/success");
    expect(orderPosts).toBe(1);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });

  test("deferred A confirmation cannot replace B confirmation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
    });
    let currentOwner = "owner-a";
    const confirmationAStarted = deferred<void>();
    const releaseConfirmationA = deferred<void>();
    const diagnostics = collectDiagnostics(page, {
      failedRequests: [
        { method: "GET", path: `/api/backend/orders/${IDS.order}`, errorText: "net::ERR_ABORTED" },
      ],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload(currentOwner)) });
      if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
      if (url.pathname.endsWith(`/orders/${IDS.order}`)) {
        const requestOwner = currentOwner;
        if (requestOwner === "owner-a") {
          confirmationAStarted.resolve();
          await releaseConfirmationA.promise;
        }
        const orderNumber = requestOwner === "owner-a" ? "ZG-A" : "ZG-B";
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { order: detailOrderPayload(requestOwner, orderNumber) } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
    });

    await page.goto(`${baseUrl}/success?orderId=${IDS.order}`, { waitUntil: "domcontentloaded" });
    await confirmationAStarted.promise;
    currentOwner = "owner-b";
    await setBrowserIdentity(page, "owner-b");
    await expect(page.getByText("Order ZG-B", { exact: true })).toBeVisible();
    releaseConfirmationA.resolve();
    await page.waitForTimeout(100);
    await expect(page.getByText("Order ZG-A", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Order ZG-B", { exact: true })).toBeVisible();
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
  });
});
