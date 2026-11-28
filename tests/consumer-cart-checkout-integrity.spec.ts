import { expect, test, type Locator, type Page, type Request } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import {
  CartContractError,
  parseBackendCartResponse,
} from "../src/services/cart";
import { ApiError, resetApiClientSecurityStateForTests } from "../src/services/api";
import { getCheckoutErrorMessage } from "../src/features/checkout/lib/checkout-presentation";
import {
  CheckoutContractError,
  CheckoutOrderOutcomeUnknownError,
  createCheckoutOrder,
  inspectCheckoutOutcome,
  prepareCheckoutOrder,
  parseCheckoutReceipt,
  parseCheckoutQuoteResponse,
  parseCreatedOrderResponse,
  type CreateCheckoutOrderInput,
} from "../src/services/checkout";
import { beginGeneration, checkoutMode, preserveLegacySending, settleGeneration, rejectGenerationAttempt, heldGeneration, observeGeneration,
  reviewChangedGeneration, useCart, type CartItem } from "../src/hooks/use-cart";

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

const acceptedQuote = { itemSubtotal: 500, deliveryFeeAmount: 50, grandTotalAmount: 550 };

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

const receiptFor = (key: string, owner = "owner-a") => ({ status: "success", data: {
  cartGeneration: key, order: { ...createdOrderPayload({ userId: owner }).data.order, status: "DELIVERED", commitmentFeeStatus: "PAID" },
} });

test("generation: strict UUIDv4, omitted legacy field only and independent current-state receipt identity", () => {
  expect(parseCheckoutQuoteResponse(quotePayload(), "frontend-first").cartGeneration).toBeUndefined();
  expect(() => parseCheckoutQuoteResponse(quotePayload(), "required")).toThrow();
  for (const key of [null, undefined, "", IDS.cart.replace("-4000-", "-1000-"), " " + IDS.cart]) {
    expect(() => parseCheckoutQuoteResponse(quotePayload({ cartGeneration: key }), "frontend-first")).toThrow();
  }
  expect(parseCheckoutReceipt(receiptFor(IDS.cart), "owner-a", IDS.cart).id).toBe(IDS.order);
  expect(() => parseCheckoutReceipt(receiptFor(IDS.cart), "owner-b", IDS.cart)).toThrow();
  expect(() => parseCheckoutReceipt(receiptFor(IDS.order), "owner-a", IDS.cart)).toThrow();
  expect(() => prepareCheckoutOrder(checkoutInput, acceptedQuote, "owner-a", "required")).toThrow();
});

test("generation: explicit retry preserves exact body and 200 replay uses the same owner and key as 201", async () => {
  const previous = globalThis.fetch, bodies: string[] = [];
  const input = structuredClone(checkoutInput);
  const send = prepareCheckoutOrder(input, { ...acceptedQuote, cartGeneration: IDS.cart }, "owner-a");
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith("/auth/csrf-token")) return response({ data: { csrfToken: "synthetic" } });
    expect(init?.method).toBe("POST");
    bodies.push(String(init?.body));
    const payload = { status: "success", data: { ...createdOrderPayload({ userId: "owner-a", status: "CONFIRMED" }).data, cartGeneration: IDS.cart } };
    return response(payload, bodies.length === 1 ? 201 : 200);
  };
  try {
    await send();
    input.delivery.street = "Changed street";
    await send();
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toBe(bodies[1]);
    expect(JSON.parse(bodies[0])).toMatchObject({ cartGeneration: IDS.cart, expectedQuote: acceptedQuote });
  } finally { globalThis.fetch = previous; }
});

test("generation: a receipt miss is rechecked after a changed authoritative cart, with GET only", async () => {
  const previous = globalThis.fetch;
  const reads: string[] = [];
  globalThis.fetch = async (url, init) => {
    expect(init?.method).toBe("GET");
    expect(init?.cache).toBe("no-store");
    const tail = String(url).split("/").pop()!;
    reads.push(tail);
    if (tail === "cart") return response(cartPayload({ generation: IDS.secondProduct }));
    return reads.length === 1 ? response({},404) : response(receiptFor(IDS.cart));
  };
  try {
    const result = await inspectCheckoutOutcome("owner-a", IDS.cart, () => true);
    expect(result?.receipt?.id).toBe(IDS.order);
    expect(reads).toEqual([IDS.cart,"cart",IDS.cart]);
    let current = true;
    globalThis.fetch = async () => { current = false; return response(receiptFor(IDS.cart)); };
    expect(await inspectCheckoutOutcome("owner-a", IDS.cart, () => current)).toBeNull();
  } finally { globalThis.fetch = previous; }
});

test("generation: explicit fenced review survives reload and stale competing tabs without clearing unrelated holds", async () => {
  function storage() {
    const map = new Map<string,string>();
    return { get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null, setItem: (k: string,v: string) => map.set(k,v),
      removeItem: (k: string) => map.delete(k), map };
  }
  const previous = (globalThis as { window?: unknown }).window;
  const previousFetch = globalThis.fetch;
  const localStorage = storage(), a = storage(), b = storage(), late = storage();
  let notices = 0;
  const tab = (sessionStorage: typeof a) => { (globalThis as {window?: unknown}).window = { localStorage, sessionStorage, dispatchEvent: () => { notices++; return true; } }; };
  try {
    seedOwnedCart("owner-a");
    tab(a); observeGeneration("owner-a",IDS.cart);
    const put = localStorage.setItem;
    localStorage.setItem = () => { throw new Error("storage full"); };
    expect(() => beginGeneration("owner-a", IDS.cart)).toThrow();
    expect(heldGeneration("owner-a")).toBeNull();
    // Interleave at the first write, after both tabs can pass the empty check.
    let competing = "";
    localStorage.setItem = (name, value) => {
      localStorage.setItem = put;
      tab(b); competing = beginGeneration("owner-a", IDS.cart);
      tab(a); return put(name, value);
    };
    const pending = beginGeneration("owner-a", IDS.cart);
    expect(competing).not.toBe(pending);
    expect(heldGeneration("owner-a")).toBe(IDS.cart);
    tab(b); expect(checkoutMode("owner-a")).toBe("required");
    expect(() => observeGeneration("owner-a")).toThrow();
    expect(() => beginGeneration("owner-a",IDS.cart)).toThrow();
    rejectGenerationAttempt("owner-a", IDS.cart, competing);
    tab(storage()); // neither sending tab's session is needed
    expect(heldGeneration("owner-a")).toBe(IDS.cart);
    expect(heldGeneration("owner-b")).toBeNull();
    expect(reviewChangedGeneration("owner-a", IDS.cart, IDS.cart)).toBe(false);
    expect([...localStorage.map.values()].every(v => v === IDS.cart)).toBe(true);
    let active: string = IDS.cart;
    const reads: string[] = [];
    globalThis.fetch = async (url, init) => {
      expect(init?.method).toBe("GET");
      const name = String(url).split("/").pop()!;
      reads.push(name);
      return name === "cart" ? response(cartPayload({ generation: active })) : response({},404);
    };
    const inspect = () => inspectCheckoutOutcome("owner-a", IDS.cart, () => heldGeneration("owner-a") === IDS.cart);
    const same = await inspect();
    expect(reviewChangedGeneration("owner-a", IDS.cart, same!.snapshot!.generation!)).toBe(false);
    expect(heldGeneration("owner-a")).toBe(IDS.cart);
    active = IDS.secondProduct;
    await inspect(); // checking is not consent to resume
    expect(heldGeneration("owner-a")).toBe(IDS.cart);
    const review = await inspect();
    expect(review?.receipt).toBeNull();
    expect(reads.slice(-3)).toEqual([IDS.cart,"cart",IDS.cart]);
    const adopt = useCart.getState().prepareCartAdoption("owner-a", IDS.cart);
    expect(adopt).not.toBeNull();
    localStorage.setItem = () => { throw new Error("Cannot publish fence"); };
    expect(reviewChangedGeneration("owner-a", IDS.cart, review!.snapshot!.generation!)).toBe(false);
    expect(heldGeneration("owner-a")).toBe(IDS.cart);
    localStorage.setItem = put;
    localStorage.setItem("zg-checkout:owner-a:hold:" + IDS.order, IDS.order);
    localStorage.setItem("zg-checkout:owner-b:hold:" + IDS.cart, IDS.cart);
    const remove = localStorage.removeItem, beforeSettlement = notices;
    localStorage.removeItem = () => { throw new Error("Cannot clean up old records"); };
    expect(reviewChangedGeneration("owner-a", IDS.cart, review!.snapshot!.generation!)).toBe(true);
    localStorage.removeItem = remove;
    expect(notices).toBe(beforeSettlement + 1);
    expect(localStorage.map.has("zg-checkout:owner-a:attempt:" + IDS.cart + ":" + pending)).toBe(true);
    expect(localStorage.map.has("zg-checkout:owner-a:hold:" + IDS.cart)).toBe(false);
    expect(localStorage.getItem("zg-checkout:owner-a:fenced:" + IDS.cart)).toBe(IDS.cart);
    expect(adopt?.([])).toBe(false);
    expect(useCart.getState().items).toEqual([cartItem]);
    late.setItem("zg-checkout:owner-a:sending", IDS.cart);
    tab(late); // an older client still has a tab-private sending marker
    expect(heldGeneration("owner-a")).toBe(IDS.order);
    rejectGenerationAttempt("owner-a", IDS.cart, pending);
    expect(localStorage.map.has("zg-checkout:owner-a:hold:" + IDS.cart)).toBe(false);
    // Simulate an old writer that checked the fence just before it was published.
    localStorage.setItem("zg-checkout:owner-a:hold:" + IDS.cart, IDS.cart);
    tab(storage());
    expect(heldGeneration("owner-b")).toBe(IDS.cart);
    expect(heldGeneration("owner-a")).toBe(IDS.order);
    settleGeneration("owner-a", IDS.order);
    expect(heldGeneration("owner-a")).toBeNull();
    expect(() => beginGeneration("owner-a", IDS.cart)).toThrow();
    a.setItem("zg-checkout:legacy-owner:sending", IDS.order);
    tab(a);
    expect(heldGeneration("legacy-owner")).toBe(IDS.order);
    preserveLegacySending("legacy-owner", IDS.order);
    expect(a.getItem("zg-checkout:legacy-owner:sending")).toBeNull();
    tab(storage());
    expect(heldGeneration("legacy-owner")).toBe(IDS.order);
  } finally {
    globalThis.fetch = previousFetch;
    if (previous === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as {window?: unknown}).window = previous;
  }
});

test("generation: unchanged cart and 404 are inconclusive, malformed cart or wrong receipt fails closed", async () => {
  const previous = globalThis.fetch;
  let key: unknown = IDS.cart;
  const reads: string[] = [];
  globalThis.fetch = async (url, init) => {
    expect(init?.method).toBe("GET");
    const name = String(url).split("/").pop()!;
    reads.push(name);
    return name === "cart" ? response(cartPayload({ generation: key })) : response({},404);
  };
  try {
    const result = await inspectCheckoutOutcome("owner-a", IDS.cart, () => true);
    expect(result?.receipt).toBeNull();
    expect(result?.snapshot?.generation).toBe(IDS.cart);
    expect(reads).toEqual([IDS.cart,"cart"]);
    key = null;
    await expect(inspectCheckoutOutcome("owner-a",IDS.cart,() => true)).rejects.toBeInstanceOf(CheckoutContractError);
    globalThis.fetch = async () => response(receiptFor(IDS.order));
    await expect(inspectCheckoutOutcome("owner-a",IDS.cart,() => true)).rejects.toBeInstanceOf(CheckoutContractError);
  } finally { globalThis.fetch = previous; }
});

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
  expect(parseCheckoutQuoteResponse(quotePayload(), "frontend-first")).toEqual({
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
    expect(() => parseCheckoutQuoteResponse(fixture.value, "frontend-first")).toThrow(CheckoutContractError);
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
    await expect(createCheckoutOrder(checkoutInput, acceptedQuote)).rejects.toBeInstanceOf(CheckoutOrderOutcomeUnknownError);
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
    await expect(createCheckoutOrder(checkoutInput, acceptedQuote)).rejects.toBeInstanceOf(CheckoutOrderOutcomeUnknownError);
    expect(orderPosts).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout error presenter distinguishes CSRF verification expiry from session expiry without leaking CSRF", () => {
  const csrfMessage = getCheckoutErrorMessage(new ApiError("Invalid CSRF token", 403), "create");
  expect(csrfMessage).toBe(
    "Your order was not placed because your checkout verification expired. Select Place Order Now to try again.",
  );
  expect(csrfMessage).not.toMatch(/csrf/i);
  expect(getCheckoutErrorMessage(new ApiError("Session expired", 401), "create")).toBe(
    "Please sign in again to continue.",
  );
});

test("createCheckoutOrder aborts with 0 POSTs if browser auth snapshot changes during CSRF bootstrap", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;
  const store = new Map<string, string>([
    ["zogular_auth_user", JSON.stringify({ id: "owner-a", email: "owner-a@example.test" })],
  ]);
  const storageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  };
  const sessionStorageMock = {
    getItem: () => "1",
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  (globalThis as { window?: unknown }).window = {
    localStorage: storageMock,
    sessionStorage: sessionStorageMock,
    location: { origin: "http://127.0.0.1:3398" },
    dispatchEvent: () => true,
  };
  resetApiClientSecurityStateForTests();

  let orderPosts = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/csrf-token")) {
      store.set("zogular_auth_user", JSON.stringify({ id: "owner-b", email: "owner-b@example.test" }));
      return response({ data: { csrfToken: "fixture-csrf" } });
    }
    if (url.endsWith("/orders") && init?.method === "POST") {
      orderPosts += 1;
      return response(createdOrderPayload());
    }
    throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${url}`);
  }) as typeof fetch;
  try {
    await expect(createCheckoutOrder(checkoutInput, acceptedQuote)).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
    });
    expect(orderPosts).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
    resetApiClientSecurityStateForTests();
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
});

function seedOwnedCart(ownerId: string, item: CartItem = cartItem) {
  useCart.getState().reconcileIdentity(null);
  useCart.setState({
    items: [],
    itemCount: 0,
    totalAmount: 0,
    ownerId: null,
    hasHydrated: true,
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

test("generation: adoption requires the same idle owner and preserves unsyncable local lines", () => {
  seedOwnedCart("owner-a");
  const local = { ...cartItem, id: "local-line", variant: "local" };
  useCart.setState({items: [cartItem, local]});
  const stable = useCart.getState().prepareCartAdoption("owner-a");
  expect(stable?.([])).toBe(true);
  expect(useCart.getState().items).toEqual([local]);
  expect(stable?.([])).toBe(false);
  const beforeEdit = useCart.getState().prepareCartAdoption("owner-a");
  useCart.setState({items: [cartItem]});
  expect(beforeEdit?.([])).toBe(false);
  const beforeSwitch = useCart.getState().prepareCartAdoption("owner-a");
  seedOwnedCart("owner-b");
  expect(beforeSwitch?.([])).toBe(false);
  expect(useCart.getState().items).toEqual([cartItem]);
});

test("generation: pending clear, removal and merge are never consumed by receipt refresh", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("unexpected fetch"); };
  try {
    for (const pending of [{pendingClear:true}, {pendingDeletions:[IDS.product]},
      {pendingAnonymousMerge:[{item:cartItem,targetQuantity:3}]}]) {
      seedOwnedCart("owner-a");
      const before = useCart.getState().prepareCartAdoption("owner-a");
      useCart.setState(pending);
      expect(before?.([])).toBe(false);
      expect(useCart.getState().prepareCartAdoption("owner-a")).toBeNull();
      await useCart.getState().refreshCartAfterReceipt("owner-a");
      expect(useCart.getState()).toMatchObject({...pending, items:[cartItem], syncError:expect.stringContaining("kept")});
    }
    expect(calls).toBe(0);
  } finally { globalThis.fetch = original; }
});

test("generation: a receipt read cannot overwrite changes made during its GET", async () => {
  seedOwnedCart("owner-a");
  const original = globalThis.fetch, started = deferred<void>(), reply = deferred<Response>();
  globalThis.fetch = async (_, init) => { expect(init?.method).toBe("GET"); started.resolve(); return reply.promise; };
  try {
    const refresh = useCart.getState().refreshCartAfterReceipt("owner-a");
    await started.promise;
    useCart.setState({ items:[{...cartItem,quantity:3}], pendingDeletions:[IDS.secondProduct] });
    reply.resolve(response(cartPayload({generation:IDS.cart})));
    await refresh;
    expect(useCart.getState()).toMatchObject({ items:[{quantity:3}], pendingDeletions:[IDS.secondProduct] });
  } finally { globalThis.fetch = original; }
});

test("generation: receipt refresh does not invalidate or supersede queued synchronization", async () => {
  seedOwnedCart("owner-a");
  const original = globalThis.fetch, started = deferred<void>(), reply = deferred<Response>();
  let reads = 0;
  globalThis.fetch = async () => { reads++; started.resolve(); return reply.promise; };
  try {
    const sync = useCart.getState().syncWithBackend();
    await started.promise;
    expect(useCart.getState().prepareCartAdoption("owner-a")).toBeNull();
    await useCart.getState().refreshCartAfterReceipt("owner-a");
    expect(useCart.getState().syncStatus).toBe("syncing");
    reply.resolve(response(cartPayload({items:[],summary:{subtotal:0,totalItems:0,uniqueItems:0}})));
    await sync;
    expect(reads).toBe(1);
    expect(useCart.getState()).toMatchObject({items:[],syncStatus:"idle"});
  } finally { globalThis.fetch = original; }
});

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

test("guest stock caps apply atomically across variants and preserve prior cart quantities", () => {
  const previous = useCart.getState();
  const { addItem, increaseQuantity, decreaseQuantity } = previous;
  const line = { ...cartItem, quantity: 1, variant: "red" };
  try {
    useCart.setState({ items: [line], itemCount: 1, totalAmount: line.price, ownerId: null, identityResolved: true, hasHydrated: true });
    for (const knownStock of [undefined, -1, 0.5, NaN, Infinity]) {
      expect(addItem({ ...line, knownStock })).toBe("Check stock on product page");
      increaseQuantity(line);
      expect(useCart.getState().itemCount).toBe(1);
    }
    for (const quantity of [0, -1, 1.5, NaN, 100]) {
      expect(addItem({ ...line, knownStock: 100, quantity })).toBeTruthy();
    }
    expect(addItem({ ...line, variant: "blue", knownStock: 3, quantity: 2 })).toBeUndefined();
    expect(useCart.getState().items.map((row) => row.knownStock)).toEqual([3, 3]);
    increaseQuantity(line);
    expect(useCart.getState().totalAmount).toBe(3 * line.price);
    expect(addItem({ ...line, knownStock: 0 })).toBe("Out of stock");
    expect(useCart.getState().items.map((row) => row.knownStock)).toEqual([0, 0]);
    decreaseQuantity({ ...line, variant: "blue" });
    increaseQuantity(line);
    expect(useCart.getState().itemCount).toBe(2);
    for (const flags of [{ hasHydrated: false, identityResolved: true }, { hasHydrated: true, identityResolved: false }]) {
      useCart.setState(flags);
      expect(addItem({ ...line, knownStock: 10 })).toBe("Loading your cart");
      expect(useCart.getState().items[0].knownStock).toBe(0);
      expect(useCart.getState().itemCount).toBe(2);
    }
  } finally {
    useCart.setState(previous, true);
  }
});

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

async function failCheckoutStorage(page: Page, failure: "fence" | "cleanup") {
  await page.evaluate(mode => {
    const put = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (name, value) {
      if (mode === "fence" && this === localStorage && name.startsWith("zg-checkout:owner-a:fenced:")) {
        throw new DOMException("Synthetic fence failure", "QuotaExceededError");
      }
      return put.call(this, name, value);
    };
    Storage.prototype.removeItem = function (name) {
      if (mode === "cleanup" && this === localStorage && name.startsWith("zg-checkout:owner-a:attempt:")) {
        throw new DOMException("Synthetic cleanup failure", "SecurityError");
      }
      return remove.call(this, name);
    };
  }, failure);
}

async function fulfillStaticDependencies(page: Page) {
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/_vercel/insights/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("**/_vercel/speed-insights/script.js", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.route("https://images.example.test/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: pixel }));
  await page.route("https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?*", (route) => route.fulfill({ status: 200, contentType: "image/png", body: pixel }));
  await page.route(/\/_next\/image\?.*/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: pixel }));
}

async function advanceMobileCheckoutToReview(page: Page) {
  const continueToReview = page.getByRole("button", { name: "Continue to order review" });
  if (await continueToReview.isVisible()) await continueToReview.click();
  const reviewOrder = page.getByRole("button", { name: "Review Order" });
  if (await reviewOrder.isVisible()) await reviewOrder.click();
}

async function expectTextContrast(text: Locator) {
  await expect(text).toBeVisible();
  await expect.poll(() => text.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const pixel = canvas.getContext("2d", { willReadFrequently: true });
    if (!pixel) throw new Error("A browser color sample is required.");
    const solidLayers: string[] = [];
    const foreground = getComputedStyle(element).color;
    let opacity = 1;
    const paint = (color: string) => {
      pixel.fillStyle = color;
      pixel.fillRect(0, 0, 1, 1);
    };
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== "none") throw new Error("Contrast fixture expects solid CSS background layers.");
      opacity *= Number(style.opacity);
      solidLayers.push(style.backgroundColor);
      pixel.clearRect(0, 0, 1, 1);
      paint(style.backgroundColor);
      if (pixel.getImageData(0, 0, 1, 1).data[3] === 255 || style.backdropFilter !== "none") break;
    }
    const luminance = () => {
      const [red, green, blue] = pixel.getImageData(0, 0, 1, 1).data;
      const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
    };
    // A translucent drawer can sit over arbitrary content: bound its surface with both backdrop extremes.
    const samples = ["#000", "#fff"].map((backdrop) => {
      paint(backdrop);
      for (const color of [...solidLayers].reverse()) paint(color);
      const background = luminance();
      pixel.globalAlpha = opacity;
      paint(foreground);
      pixel.globalAlpha = 1;
      return { background, text: luminance() };
    });
    if ((samples[0].text - samples[0].background) * (samples[1].text - samples[1].background) <= 0) return 1;
    return Math.min(...samples.map(({ background, text: foreground }) =>
      (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05),
    ));
  }), { message: "Visible text must contrast at least 4.5:1 against its rendered surface." }).toBeGreaterThanOrEqual(4.5);
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

test.describe("guest stock route", () => {
  const web = process.env.GUEST_STOCK_WEB_ORIGIN;
  const api = process.env.GUEST_STOCK_API_ORIGIN;
  test.skip(!web || !api, "Requires an isolated frontend built against the synthetic loopback API.");
  test.use({ serviceWorkers: "block" });
  test.describe.configure({ mode: "serial" });
  const products = [
    { id: "legacy", title: "Single listing", stock: null },
    { id: "counted", title: "Counted listing", stock: 3 },
  ].map((item) => ({ ...item, slug: item.id, isSold: false, price: 250, category: "HOME", images: ["/file.svg"] }));
  const writes: string[] = [];
  const fixture = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const route = url.pathname.replace(/^\/api\/v1/, "");
    const product = products.find((item) => route === `/products/${item.slug}`);
    const related = products.find((item) => route === `/products/${item.id}/related`);
    if (req.method !== "GET") writes.push(req.method ?? "unknown");
    const body = route === "/products" ? { results: products.length, data: { products }, pagination: { page: 1, pages: 1, total: products.length, limit: Number(url.searchParams.get("limit")) } }
      : product ? { data: { product } } : related ? { results: 1, data: { products: products.filter((item) => item !== related) } }
      : route === "/categories" ? { data: { categories: [] } } : null;
    res.writeHead(req.method !== "GET" ? 405 : body ? 200 : 404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "success", ...body }));
  });
  test.beforeAll(async () => {
    for (const origin of [web!, api!]) {
      if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || Number(new URL(origin).port) < 1024 || new URL(origin).port === "3000") throw new Error("Private loopback origins required");
    }
    if (api === web) throw new Error("Distinct fixture ports required");
    await new Promise<void>((resolve, reject) => fixture.once("error", reject).listen(Number(new URL(api!).port), "127.0.0.1", resolve));
  });
  test.afterAll(async () => {
    if (fixture.listening) await new Promise<void>((resolve, reject) => fixture.close((err) => err ? reject(err) : resolve()));
  });
  for (const width of [320, 390, 1440]) {
    test(`guest stock route at ${width}px`, async ({ page, context }, info) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : width === 390 ? 844 : 900 });
      await context.routeWebSocket("**/*", (ws) => ws.close());
      await context.route("**/*", (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() !== "GET" && request.method() !== "HEAD") writes.push(request.method());
        if (url.origin !== web) return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        return route.fulfill(url.pathname.endsWith("/categories") ? { json: { data: { categories: [] } } }
          : { status: url.pathname.endsWith("/user/me") ? 401 : 404, json: {} });
      });
      const photo = async (name: string) => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`${width}-${name}.png`), animations: "disabled" });
      };
      await page.goto(`${web}/products`);
      const cardAdd = page.getByRole("button", { name: "Add Single listing to cart" });
      await expect(cardAdd).not.toHaveAttribute("title", "Loading your cart");
      await cardAdd.click();
      await cardAdd.click();
      await expect(page.getByText("Not enough stock to add more", { exact: true })).toBeVisible();
      await photo("card-rejected");
      await page.goto(`${web}/product/counted`);
      const add = page.getByRole("button", { name: "Add", exact: true }).filter({ visible: true });
      await expect(add).not.toHaveAttribute("title", "Loading your cart");
      await add.click();
      await page.getByRole("button", { name: "Increase quantity", exact: true }).filter({ visible: true }).click();
      await page.getByRole("button", { name: "Increase quantity", exact: true }).filter({ visible: true }).click();
      await add.click();
      await expect(page.getByText("Not enough stock to add more", { exact: true })).toBeVisible();
      await photo("detail");
      await page.goto(`${web}/cart`);
      const plus = page.getByRole("button", { name: "Increase quantity" });
      const subtotal = page.getByTestId("cart-items-subtotal");
      // Read Chrome's AX tree as well as checking that the actual text fits its clipping ancestors.
      const verifyNote = async (button: typeof plus, label: string, artifact: string) => {
        await expect(button).toHaveAccessibleDescription(label);
        const noteId = await button.getAttribute("aria-describedby");
        const note = page.locator(`[id="${noteId}"]`);
        await expect(note).toHaveText(label);
        await note.scrollIntoViewIfNeeded();
        expect(await note.evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = Array.from(range.getClientRects());
          return rects.length > 0 && rects.every((r) => {
            if (r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return false;
            for (let p = el.parentElement; p; p = p.parentElement) {
              const box = p.getBoundingClientRect();
              const css = getComputedStyle(p);
              if (css.overflowX !== "visible" && (r.left < box.left - 1 || r.right > box.right + 1)) return false;
              if (css.overflowY !== "visible" && (r.top < box.top - 1 || r.bottom > box.bottom + 1)) return false;
            }
            return true;
          });
        })).toBe(true);
        const cdp = await context.newCDPSession(page);
        try {
          const { nodes } = await cdp.send("Accessibility.getFullAXTree");
          const evidence = nodes.filter((node) => !node.ignored && node.role?.value === "button"
            && node.description?.value === label && node.properties?.some((p) => p.name === "disabled" && p.value.value === true));
          expect(evidence.length).toBeGreaterThan(0);
          fs.writeFileSync(info.outputPath(`${width}-${artifact}-ax.json`), JSON.stringify(evidence, null, 2));
        } finally {
          await cdp.detach();
        }
      };
      await expect(subtotal).toHaveText("K500");
      await expectTextContrast(subtotal);
      await expectTextContrast(page.getByRole("link", { name: "Proceed to checkout", exact: true }));
      await expect(plus.first()).toBeDisabled();
      await verifyNote(plus.first(), "Only 1 available", "cart-single");
      await expect(plus.last()).not.toHaveAttribute("aria-describedby", /.+/);
      await plus.last().click();
      await expect(subtotal).toHaveText("K750");
      {
        const openCart = page.getByRole("button", { name: "Open cart", exact: true });
        await openCart.press("Enter");
        const drawer = page.getByRole("dialog", { name: /^Your Cart/ });
        const closeCart = drawer.getByRole("button", { name: "Close cart", exact: true });
        const checkout = drawer.getByRole("link", { name: "Proceed to checkout", exact: true });
        const drawerSubtotal = drawer.getByTestId("cart-drawer-items-subtotal");
        await expect(closeCart).toBeFocused();
        await expect(drawer.getByText("Items subtotal", { exact: true })).toHaveCount(1);
        await expect(drawer.getByText("Delivery is calculated at checkout, where you’ll see your final total.", { exact: true })).toBeVisible();
        await expect(drawer.getByText("Total", { exact: true })).toHaveCount(0);
        await expect(drawer.getByText(/Lusaka Area/)).toHaveCount(0);
        await expect(drawerSubtotal).toHaveText("K750");
        await expect(drawer.getByText("K750", { exact: true })).toHaveCount(1);
        await expect(drawer.getByRole("button", { name: "Increase Single listing quantity" })).toBeDisabled();
        const more = drawer.getByRole("button", { name: "Increase Counted listing quantity" });
        await more.press("Enter");
        await expect(more).toBeDisabled();
        await expect(drawerSubtotal).toHaveText("K1,000");
        await expect(drawer.getByText("K1,000", { exact: true })).toHaveCount(1);
        await expect(checkout).toHaveAttribute("href", "/checkout");
        await page.mouse.move(0, 0);
        await expectTextContrast(drawerSubtotal);
        await expectTextContrast(checkout);
        await checkout.focus();
        await expect(checkout).toBeFocused();
        const bounds = await drawer.boundingBox();
        const viewport = page.viewportSize();
        expect(bounds).not.toBeNull();
        expect(viewport).not.toBeNull();
        for (const control of [drawerSubtotal, checkout]) {
          await expect(control).toBeInViewport({ ratio: 1 });
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(Math.max(0, bounds!.x) - 1);
          expect(box!.y).toBeGreaterThanOrEqual(Math.max(0, bounds!.y) - 1);
          expect(box!.x + box!.width).toBeLessThanOrEqual(Math.min(viewport!.width, bounds!.x + bounds!.width) + 1);
          expect(box!.y + box!.height).toBeLessThanOrEqual(Math.min(viewport!.height, bounds!.y + bounds!.height) + 1);
        }
        await page.keyboard.press("Tab");
        await expect(closeCart).toBeFocused();
        await verifyNote(drawer.getByRole("button", { name: "Increase Single listing quantity" }), "Only 1 available", "drawer-single");
        await photo("drawer");
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
        await expect(openCart).toBeFocused();
      }
      await page.reload();
      await expect(subtotal).toHaveText("K1,000");
      await expect(plus.last()).toBeDisabled();
      await photo("cart-reload");
      // Pre-snapshot cart rows survive hydration without acquiring invented stock.
      await page.evaluate(() => {
        const key = "zogular-cart-storage";
        const persisted = JSON.parse(localStorage.getItem(key)!);
        for (const row of persisted.state.items) delete row.knownStock;
        localStorage.setItem(key, JSON.stringify(persisted));
      });
      await page.reload();
      await expect(subtotal).toHaveText("K1,000");
      await expect(plus.last()).toBeDisabled();
      const action = "Check stock on product page";
      await verifyNote(plus.last(), action, "cart-restored");
      await photo("cart-restored");
      await page.getByRole("button", { name: "Decrease quantity" }).click();
      await expect(subtotal).toHaveText("K750");
      await page.getByRole("button", { name: "Open cart" }).click();
      const drawer = page.getByRole("dialog");
      await verifyNote(drawer.getByRole("button", { name: "Increase Counted listing quantity" }), action, "drawer-restored");
      await photo("drawer-restored");
      await drawer.getByRole("link", { name: action }).and(drawer.locator('[href="/product/counted"]')).click();
      await expect(page).toHaveURL(`${web}/product/counted`);
      await expect(add).toHaveAttribute("title", "Add Counted listing to cart");
      await add.click();
      await page.goto(`${web}/cart`);
      const recoveryLinks = page.getByRole("link", { name: action });
      const savedLines = () => page.evaluate(() => {
        const { state } = JSON.parse(localStorage.getItem("zogular-cart-storage")!);
        return state.items.map(({ slug, quantity, knownStock }: CartItem) => [slug, quantity, knownStock ?? null]);
      });
      await expect(subtotal).toHaveText("K1,000");
      await expect.poll(savedLines).toEqual([["legacy", 1, null], ["counted", 3, 3]]);
      await expect(plus.last()).toBeDisabled();
      await expect(plus.last()).toHaveAccessibleDescription("Only 3 available");
      await expect(recoveryLinks).toHaveCount(1);
      await expect(recoveryLinks).toHaveAttribute("href", "/product/legacy");
      await photo("counted-recovered");

      await recoveryLinks.click();
      await expect(page).toHaveURL(`${web}/product/legacy`);
      await expect(add).toHaveAttribute("title", "Not enough stock to add more");
      await add.click();
      await expect(page.getByText("Not enough stock to add more", { exact: true })).toBeVisible();
      await page.goto(`${web}/cart`);
      await expect(subtotal).toHaveText("K1,000");
      await expect.poll(savedLines).toEqual([["legacy", 1, 1], ["counted", 3, 3]]);
      await expect(plus.first()).toBeDisabled();
      await expect(plus.first()).toHaveAccessibleDescription("Only 1 available");
      await expect(plus.last()).toHaveAccessibleDescription("Only 3 available");
      await expect(recoveryLinks).toHaveCount(0);
      await photo("single-recovered");
      expect(writes).toEqual([]);
    });
  }
});
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
  test.use({ serviceWorkers: "block" });

    test.beforeEach(async ({ page }) => {
    // Test pages must never register a worker that could intercept checkout fixtures.
    await page.addInitScript(() => Reflect.deleteProperty(Navigator.prototype, "serviceWorker"));
    await fulfillStaticDependencies(page);
  });

  for (const width of [320, 639, 640, 1440]) {
    test(`confirmation actions stay inside the card at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route("**/api/backend/**", (route) => {
        const { pathname } = new URL(route.request().url());
        const payload = pathname.endsWith("/user/me") ? userPayload()
          : pathname.endsWith(`/orders/${IDS.order}`)
            ? { status: "success", data: { order: detailOrderPayload("owner-a", "ZG-2026-0001") } }
            : pathname.endsWith("/cart") ? cartPayload()
              : { status: "success", data: { categories: [] } };
        return route.fulfill({ json: payload });
      });

      await page.goto(`${baseUrl}/success?orderId=${IDS.order}`, { waitUntil: "domcontentloaded" });
      const heading = page.getByRole("heading", { name: "Order confirmed by Zogular" });
      await expect(heading).toBeVisible();
      const card = page.locator("main section").filter({ has: heading });
      const view = card.getByRole("link", { name: "View order" });
      const shop = card.getByRole("link", { name: "Continue shopping" });
      await expect(view).toHaveAttribute("href", `/account/orders/${IDS.order}`);
      await expect(shop).toHaveAttribute("href", "/categories");
      const [bounds, first, second] = await Promise.all([card.boundingBox(), view.boundingBox(), shop.boundingBox()]);
      if (!bounds || !first || !second) throw new Error("Missing confirmation card or action bounds");

      for (const action of [first, second]) {
        expect(action.x).toBeGreaterThan(bounds.x);
        expect(action.x + action.width).toBeLessThan(bounds.x + bounds.width);
        expect(action.height).toBeGreaterThanOrEqual(44);
      }
      if (width < 640) {
        expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
      } else {
        expect(second.y).toBeCloseTo(first.y, 0);
        expect(second.x).toBeGreaterThanOrEqual(first.x + first.width);
      }
      await page.screenshot({ path: path.resolve(`output/playwright/consumer-cart-checkout-integrity/confirmation-${width}.png`), fullPage: true });
    });
  }

  for (const { width, closedStatus } of [
    { width: 320, closedStatus: "CANCELLED" },
    { width: 1440, closedStatus: "REFUNDED" },
  ]) {
    test(`success readback replaces processing with neutral ${closedStatus} at ${width}px`, async ({ page }) => {
      if (!baseUrl || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Private loopback fixture required.");
      await page.setViewportSize({ width, height: 900 });
      const closedId = "00000000-0000-4000-8000-000000000009";
      const mismatchId = "00000000-0000-4000-8000-000000000010";
      const closedRead = deferred<void>();
      const releaseClosed = deferred<void>();
      const orderReads: string[] = [];
      const mutations: string[] = [];
      await page.route("**/api/backend/**", async (route) => {
        const request = route.request();
        const { pathname } = new URL(request.url());
        if (request.method() !== "GET" && request.method() !== "HEAD") {
          mutations.push(`${request.method()} ${pathname}`);
          return route.fulfill({ status: 405 });
        }
        if (pathname.endsWith("/user/me")) return route.fulfill({ json: userPayload() });
        if (pathname.endsWith("/cart")) return route.fulfill({ json: cartPayload() });
        if (pathname.endsWith(`/orders/${IDS.order}`)) {
          orderReads.push(IDS.order);
          const order = { ...detailOrderPayload("owner-a", "ZG-PROCESSING"), status: "PROCESSING" };
          return route.fulfill({ json: { status: "success", data: { order } } });
        }
        if (pathname.endsWith(`/orders/${closedId}`)) {
          orderReads.push(closedId);
          closedRead.resolve();
          await releaseClosed.promise;
          const order = { ...detailOrderPayload("owner-a", "ZG-CLOSED"), id: closedId, status: closedStatus };
          return route.fulfill({ json: { status: "success", data: { order } } });
        }
        if (pathname.endsWith(`/orders/${mismatchId}`)) {
          orderReads.push(mismatchId);
          const order = { ...detailOrderPayload("owner-a", "ZG-WRONG-ID"), status: "PROCESSING" };
          return route.fulfill({ json: { status: "success", data: { order } } });
        }
        return route.fulfill({ json: { status: "success", data: { categories: [] } } });
      });

      await page.goto(`${baseUrl}/success?orderId=${IDS.order}`);
      const main = page.locator("main:not(:has(main))");
      const confirmed = main.getByRole("heading", { name: "Order confirmed by Zogular" });
      const cashDue = main.getByText("Cash due on delivery", { exact: true });
      const screenshotDir = "output/playwright/consumer-cart-checkout-integrity";
      await expect(confirmed).toBeVisible();
      await expect(cashDue).toBeVisible();
      await expect(main.getByRole("link", { name: "View order" })).toHaveAttribute("href", `/account/orders/${IDS.order}`);
      await main.screenshot({ path: path.resolve(screenshotDir, `success-processing-${width}.png`) });

      try {
        await page.evaluate((id) => window.history.pushState(null, "", `/success?orderId=${id}`), closedId);
        await closedRead.promise;
        await expect(main.getByRole("heading", { name: "Confirming your order" })).toBeVisible();
        await expect(confirmed).toHaveCount(0);
        await expect(main.getByText("Order ZG-PROCESSING", { exact: true })).toHaveCount(0);
        await expect(main.getByRole("link", { name: "View order" })).toHaveCount(0);
      } finally {
        releaseClosed.resolve();
      }

      const closed = main.getByRole("heading", { name: "Order closed" });
      const viewOrder = main.getByRole("link", { name: "View order" });
      await expect(closed).toBeVisible();
      await expect(closed).toBeFocused();
      await expect(viewOrder).toHaveAttribute("href", `/account/orders/${closedId}`);
      await page.keyboard.press("Tab");
      await expect(viewOrder).toBeFocused();
      const bounds = await viewOrder.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await main.evaluate((el) => el.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(main).not.toContainText(/confirmed|cash due|delivery updates|refund|K500/i);
      await main.screenshot({ path: path.resolve(screenshotDir, `success-closed-${width}.png`) });

      await page.evaluate((id) => window.history.pushState(null, "", `/success?orderId=${id}`), mismatchId);
      await expect(main.getByRole("heading", { name: "Order confirmation could not be verified" })).toBeVisible();
      await expect(viewOrder).toHaveCount(0);
      await expect(main).not.toContainText("ZG-WRONG-ID");
      expect(orderReads).toEqual([IDS.order, closedId, mismatchId]);
      expect(mutations).toEqual([]);
    });
  }

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
      const inspectQuoteStates = viewport.width === 1440;
      const releaseAddresses = deferred<void>();
      const releaseQuote = deferred<void>();
      await page.route("**/api/backend/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload()) });
        if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
        if (url.pathname.endsWith("/user/addresses")) {
          if (inspectQuoteStates) await releaseAddresses.promise;
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(addressPayload()) });
        }
        if (url.pathname.endsWith("/orders/quote")) {
          if (inspectQuoteStates) await releaseQuote.promise;
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quotePayload()) });
        }
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
      const dueNow = page.getByTestId("checkout-delivery-due-now");
      try {
        await page.goto(`${baseUrl}/checkout`, { waitUntil: inspectQuoteStates ? "domcontentloaded" : "networkidle" });
        await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
        if (inspectQuoteStates) {
          await expect(dueNow).toHaveText("Pending");
          await expectTextContrast(dueNow);
          releaseAddresses.resolve();
          await expect(dueNow).toHaveText("...");
          await expectTextContrast(dueNow);
        }
      } finally {
        releaseAddresses.resolve();
        releaseQuote.resolve();
      }
      await advanceMobileCheckoutToReview(page);
      await expect.poll(async () => page.getByText("K550", { exact: true }).evaluateAll((elements) => (
        elements.filter((element) => {
          const rectangle = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rectangle.width > 0 && rectangle.height > 0 && style.visibility !== "hidden";
        }).length
      ))).toBeGreaterThan(0);
      await expect(dueNow).toHaveText("K50");
      await expectTextContrast(dueNow);
      const placeOrder = page.getByRole("button", { name: "Place Order Now", exact: true });
      await expect(placeOrder).toBeEnabled();
      await page.mouse.move(0, 0);
      await expectTextContrast(placeOrder);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
      await page.screenshot({ path: path.resolve(`output/playwright/consumer-cart-checkout-integrity/checkout-${viewport.name}.png`), fullPage: true });
    });
  }

  for (const scenario of ["review", "concurrent edit", "buyer switch", "late hold", "create conflict"] as const) {
    test(`quote recovery boundary: ${scenario}`, async ({ page }, info) => {
      const mobile = scenario === "review";
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
      await page.addInitScript(() => localStorage.setItem("zogular_auth_user", JSON.stringify({
        id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test",
      })));
      const line = cartPayload().data.cart.items[0];
      const latest = cartPayload({ generation: IDS.secondProduct, items: [{
        ...line, id: IDS.secondCartItem, productId: IDS.secondProduct,
        product: { ...line.product, id: IDS.secondProduct, title: "Updated cart item", slug: "updated-cart-item" },
      }] });
      const started = deferred<void>(), release = deferred<void>();
      let review = false, reads = 0, quotes = 0, receipts = 0, creates = 0;
      let buyer = "owner-a";
      const unexpected: string[] = [];
      const conflict = { status: "fail", code: "CHECKOUT_CART_CHANGED", message: "private fixture detail" };
      await page.route("**/api/backend/**", async route => {
        const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
        const method = route.request().method();
        if (path === "/user/me") return route.fulfill({ json: userPayload(buyer) });
        if (path === "/user/addresses") return route.fulfill({ json: addressPayload(buyer) });
        if (path === "/auth/csrf-token") return route.fulfill({ json: { data: { csrfToken: "fixture" } } });
        if (path === "/cart" && method === "GET") {
          if (buyer === "owner-b") return route.fulfill({ json: cartPayload({ generation: IDS.secondProduct,
            items: [], summary: { subtotal: 0, totalItems: 0, uniqueItems: 0 } }) });
          if (!review) return route.fulfill({ json: cartPayload(mobile ? {} : { generation: IDS.cart }) });
          reads++;
          if ((mobile && reads === 1) || (!mobile && reads > 1)) return route.fulfill({ status: 503, json: {} });
          started.resolve();
          await release.promise;
          return route.fulfill({ json: latest });
        }
        if (path === "/orders/quote" && method === "POST") {
          quotes++;
          if (mobile && quotes === 1) return route.fulfill({ status: 503, json: {} });
          if (scenario === "create conflict") return route.fulfill({ json: quotePayload({ cartGeneration: IDS.cart }) });
          return route.fulfill({ status: 409, json: conflict });
        }
        if (path === "/orders" && method === "POST") {
          creates++;
          return route.fulfill({ status: 409, json: conflict });
        }
        if (path === "/orders/checkout-receipt/" + IDS.cart && method === "GET") {
          receipts++;
          return route.fulfill({ status: 404, json: {} });
        }
        if (method !== "GET" || path.startsWith("/orders")) unexpected.push(method + " " + path);
        return route.fulfill({ json: { status: "success", data: { categories: [] } } });
      });
      try {
        await page.goto(baseUrl + "/checkout", { waitUntil: "networkidle" });
        await advanceMobileCheckoutToReview(page);
        const action = page.getByRole("button", { name: "Review cart", exact: true });
        const alert = page.locator("form").getByRole("alert");
        if (scenario === "create conflict") {
          await page.getByRole("button", { name: "Place Order Now" }).click();
          await expect(page.getByRole("heading", { name: "Order outcome not confirmed" })).toBeVisible();
          await expect(action).toHaveCount(0);
          await page.getByRole("button", { name: "Check order status" }).click();
          await expect(page.getByText("No receipt is available yet.", { exact: false })).toBeVisible();
          expect([creates, receipts]).toEqual([1, 1]);
          expect(unexpected).toEqual([]);
          return;
        }
        if (mobile) {
          const retry = page.getByRole("button", { name: "Refresh order total" });
          await expect(retry).toBeVisible();
          await expect(action).toHaveCount(0);
          await retry.click();
        }
        await expect(alert).toHaveText("Your cart changed. Review your updated cart before checking out.");
        await expect(page.getByRole("button", { name: "Place Order Now" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Refresh order total" })).toHaveCount(0);
        await expect(page.getByText(/private fixture detail|CHECKOUT_CART_CHANGED|check its order status/i)).toHaveCount(0);
        await action.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("quote-conflict.png") });
        const issued = () => page.evaluate(() => localStorage.getItem("zg-checkout:owner-a:issued"));
        expect(await issued()).toBe(mobile ? null : IDS.cart);
        review = true;
        if (mobile) {
          await action.click();
          await expect(alert).toHaveText("Your cart could not be refreshed. Try reviewing it again.");
          await expect(action).toBeEnabled();
          expect(await issued()).toBeNull();
          expect(new URL(page.url()).pathname).toBe("/checkout");
        }
        await action.click();
        await started.promise;
        await expect(action).toBeDisabled();
        if (scenario === "late hold") {
          // Publish the existing owner-scoped unknown marker from a second tab
          // while the first tab's deliberate cart read is still outstanding.
          const other = await page.context().newPage();
          try {
            await other.goto(baseUrl + "/icon.png");
            await other.evaluate(key => localStorage.setItem("zg-checkout:owner-a:hold:" + key, key), IDS.cart);
          } finally { await other.close(); }
          const check = page.getByRole("button", { name: "Check order status" });
          await expect(check).toBeVisible();
          const stale = page.waitForResponse(r => r.url().endsWith("/api/backend/cart") && r.status() === 200);
          release.resolve();
          await (await stale).finished();
          await expect(check).toBeVisible();
          expect(await issued()).toBe(IDS.cart);
          expect(new URL(page.url()).pathname).toBe("/checkout");
        } else if (scenario === "buyer switch") {
          buyer = "owner-b";
          await setBrowserIdentity(page, buyer);
          const empty = page.getByRole("heading", { name: "Your cart is empty" });
          await expect(empty).toBeVisible();
          const stale = page.waitForResponse(r => r.url().endsWith("/api/backend/cart") && r.status() === 200);
          release.resolve();
          await (await stale).finished();
          await expect(empty).toBeVisible();
          await expect(page.getByText("Updated cart item", { exact: true })).toHaveCount(0);
          expect(await issued()).toBe(IDS.cart);
          expect(new URL(page.url()).pathname).toBe("/checkout");
        } else if (scenario === "concurrent edit") {
          await page.getByRole("button", { name: "Open cart" }).click();
          await page.getByRole("button", { name: /Decrease Samsung Galaxy A55 5G quantity/ }).click();
          const kept = page.getByRole("button", { name: "Remove Samsung Galaxy A55 5G", exact: true });
          await expect(kept).toBeVisible();
          const stale = page.waitForResponse(r => r.url().endsWith("/api/backend/cart") && r.status() === 200);
          release.resolve();
          await (await stale).finished();
          await expect(kept).toBeVisible();
          await page.keyboard.press("Escape");
          const previousReads = reads;
          await action.click();
          await expect(alert).toHaveText("Your cart changes were kept. Open your cart and review them before checking out.");
          expect(reads).toBe(previousReads);
          expect(await issued()).toBe(IDS.cart);
          expect(new URL(page.url()).pathname).toBe("/checkout");
        } else {
          release.resolve();
          await expect(page).toHaveURL(baseUrl + "/cart");
          await expect(page.getByText("Updated cart item", { exact: true })).toBeVisible();
          await expect(page.getByText("Samsung Galaxy A55 5G", { exact: true })).toHaveCount(0);
          expect(reads).toBe(2);
          expect(await issued()).toBe(IDS.secondProduct);
        }
        expect([creates, receipts]).toEqual([0, 0]);
      } finally { release.resolve(); }
      expect(unexpected).toEqual([]);
    });
  }

  test("closing the submitting tab before its response preserves owner receipt recovery", async ({ page, context }, info) => {
    const dispatched = deferred<void>();
    let posts = 0, receipts = 0, committed = false;
    await context.addInitScript(() => localStorage.setItem("zogular_auth_user", JSON.stringify({
      id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test",
    })));
    await context.route("**/api/backend/**", async route => {
      const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
      if (path === "/user/me") return route.fulfill({ json: userPayload() });
      if (path === "/user/addresses") return route.fulfill({ json: addressPayload() });
      if (path === "/cart") return route.fulfill({ json: cartPayload({ generation: IDS.cart }) });
      if (path === "/orders/quote") return route.fulfill({ json: quotePayload({ cartGeneration: IDS.cart }) });
      if (path === "/auth/csrf-token") return route.fulfill({ json: { data: { csrfToken: "fixture" } } });
      if (path === "/orders" && route.request().method() === "POST") {
        expect(route.request().postDataJSON().cartGeneration).toBe(IDS.cart);
        posts++;
        dispatched.resolve();
        return; // Leave the request paused until Chrome closes the originating tab.
      }
      if (path === "/orders/checkout-receipt/" + IDS.cart && route.request().method() === "GET") {
        receipts++;
        return route.fulfill(committed ? { json: receiptFor(IDS.cart) } : { status: 404, json: {} });
      }
      if (path === "/orders/" + IDS.order) return route.fulfill({ json: {
        status: "success", data: { order: detailOrderPayload("owner-a", "ZG-2026-0001") },
      } });
      return route.fulfill({ json: { status: "success", data: { categories: [] } } });
    });
    await page.goto(baseUrl + "/checkout", { waitUntil: "networkidle" });
    await advanceMobileCheckoutToReview(page);
    const place = page.getByRole("button", { name: "Place Order Now" });
    await page.evaluate(() => {
      const put = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (this === localStorage && name.startsWith("zg-checkout:owner-a:attempt:")) {
          Storage.prototype.setItem = put;
          throw new DOMException("Synthetic storage failure", "QuotaExceededError");
        }
        return put.call(this, name, value);
      };
    });
    await place.click();
    await expect(page.getByText("This tab did not send an order.", { exact: false })).toBeVisible();
    expect(posts).toBe(0);
    await place.click();
    await dispatched.promise;
    await page.close();
    const reopened = await context.newPage();
    await fulfillStaticDependencies(reopened);
    await reopened.goto(baseUrl + "/checkout", { waitUntil: "networkidle" });
    const check = reopened.getByRole("button", { name: "Check order status" });
    await expect(check).toBeVisible();
    await expect(reopened.getByRole("button", { name: "Retry this exact order" })).toHaveCount(0);
    expect([posts, receipts]).toEqual([1, 0]);
    await check.click();
    await expect(reopened.getByText("No receipt is available yet.", { exact: false })).toBeVisible();
    await reopened.screenshot({ path: info.outputPath("reopened-receipt-pending.png") });
    await failCheckoutStorage(reopened, "fence");
    committed = true;
    await check.click();
    await expect(reopened.getByRole("heading", { name: "Existing order found" })).toBeVisible();
    await expect(reopened.getByText(/latest checkout changes were not placed/i)).toHaveCount(0);
    await expect(reopened).toHaveURL(baseUrl + "/checkout");
    await reopened.screenshot({ path: info.outputPath("reopened-order-found.png") });
    await reopened.getByRole("button", { name: "View existing order" }).click();
    await expect(reopened).toHaveURL(baseUrl + "/account/orders/" + IDS.order);
    await expect(reopened.getByRole("heading", { name: "RECEIPT", exact: true })).toBeVisible();
    expect(await reopened.evaluate(() => Object.keys(localStorage).some(k => k.startsWith("zg-checkout:owner-a:attempt:")))).toBe(true);
    expect([posts, receipts]).toEqual([1, 2]);
  });

  for (const width of [320, 1440]) {
    test(`receipt intent conflict: deliberate existing-order read at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
      await page.addInitScript(() => localStorage.setItem("zogular_auth_user", JSON.stringify({
        id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test",
      })));
      const order = detailOrderPayload("owner-a", "ZG-2026-0001");
      const addresses = addressPayload();
      addresses.data.addresses[0].addressLine = "24 Cairo Road";
      const writes: string[] = [];
      let receipts = 0, details = 0;
      await page.route("**/api/backend/**", async route => {
        const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
        const method = route.request().method();
        if (method !== "GET") writes.push(method + " " + path);
        if (path === "/user/me") return route.fulfill({ json: userPayload() });
        if (path === "/user/addresses") return route.fulfill({ json: addresses });
        if (path === "/cart" && method === "GET") return route.fulfill({ json: cartPayload({ generation: IDS.cart }) });
        if (path === "/orders/quote") return route.fulfill({ json: quotePayload({ cartGeneration: IDS.cart }) });
        if (path === "/auth/csrf-token") return route.fulfill({ json: { data: { csrfToken: "fixture" } } });
        if (path === "/orders" && method === "POST") {
          const body = route.request().postDataJSON();
          expect(body.shippingAddress.addressLine).toBe("24 Cairo Road");
          expect(body.cartGeneration).toBe(IDS.cart);
          if (width === 1440) {
            // Another tab received its matched POST success before this 409 arrived.
            await page.evaluate(generation => {
              const key = "zg-checkout:owner-a:fenced:" + generation;
              localStorage.setItem(key, generation);
              window.dispatchEvent(new StorageEvent("storage", { key, newValue: generation }));
            }, IDS.cart);
          }
          return route.fulfill({ status: 409, json: { status: "fail", code: "CHECKOUT_INTENT_CONFLICT", message: "fixture diagnostic" } });
        }
        if (path === "/orders/checkout-receipt/" + IDS.cart) { receipts++; return route.fulfill({ json: receiptFor(IDS.cart) }); }
        if (path === "/orders/" + IDS.order) { details++; return route.fulfill({ json: { status: "success", data: { order } } }); }
        return route.fulfill({ json: { status: "success", data: { categories: [] } } });
      });
      await page.goto(baseUrl + "/checkout", { waitUntil: "networkidle" });
      await advanceMobileCheckoutToReview(page);
      const lines = () => page.evaluate(() => JSON.parse(localStorage.getItem("zogular-cart-storage")!).state.items);
      const before = await lines();
      expect(before).toHaveLength(1);
      await page.getByRole("button", { name: "Place Order Now" }).click();
      const notPlaced = page.getByText(/Your latest checkout changes were not placed/);
      await expect(notPlaced).toBeVisible();
      await page.getByRole("button", { name: "Check order status" }).click();
      const view = page.getByRole("button", { name: "View existing order" });
      await expect(view).toBeVisible();
      await expect(notPlaced).toBeVisible();
      await expect(page.getByRole("button", {name:"Retry this exact order"})).toHaveCount(0);
      await expect(page).toHaveURL(baseUrl + "/checkout");
      expect([receipts, details]).toEqual([1, 0]);
      expect(await lines()).toEqual(before);
      await page.screenshot({path:info.outputPath("existing-order.png"), animations:"disabled"});
      await view.click();
      await expect(page).toHaveURL(baseUrl + "/account/orders/" + IDS.order);
      await expect(page.getByRole("heading", { name: "RECEIPT", exact: true })).toBeVisible();
      await expect(page.getByText(/15 Great East Road/).first()).toBeVisible();
      await expect(page.getByRole("region", { name:"Order totals" })).toContainText("K550");
      await expect(page.getByText(/24 Cairo Road|fixture diagnostic/)).toHaveCount(0);
      expect(writes.filter(write => write !== "POST /orders/quote")).toEqual(["POST /orders"]);
      expect(await lines()).toEqual(before);
    });
  }

  for (const scenario of ["create cleanup", "create fence", "exact retry", "changed cart"] as const) {
    test(`checkout settlement storage failure: ${scenario}`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("zogular_auth_user", JSON.stringify({
        id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test",
      })));
      let posts = 0, receipts = 0;
      await page.route("**/api/backend/**", async route => {
        const path = new URL(route.request().url()).pathname.replace("/api/backend", "");
        if (path === "/user/me") return route.fulfill({ json: userPayload() });
        if (path === "/user/addresses") return route.fulfill({ json: addressPayload() });
        if (path === "/cart") return route.fulfill({ json: cartPayload({
          generation: posts && scenario === "changed cart" ? IDS.secondProduct : IDS.cart,
        }) });
        if (path === "/orders/quote") return route.fulfill({ json: quotePayload({ cartGeneration: IDS.cart }) });
        if (path === "/auth/csrf-token") return route.fulfill({ json: { data: { csrfToken: "fixture" } } });
        if (path === "/orders" && route.request().method() === "POST") {
          posts++;
          if ((scenario === "exact retry" || scenario === "changed cart") && posts === 1) return route.abort("failed");
          return route.fulfill({ json: { status: "success", data: {
            ...createdOrderPayload({ userId: "owner-a", status: "CONFIRMED" }).data, cartGeneration: IDS.cart,
          } } });
        }
        if (path === "/orders/checkout-receipt/" + IDS.cart) { receipts++; return route.fulfill({ status: 404, json: {} }); }
        if (path === "/orders/" + IDS.order) return route.fulfill({ json: {
          status: "success", data: { order: detailOrderPayload("owner-a", "ZG-2026-0001") },
        } });
        return route.fulfill({ json: { status: "success", data: { categories: [] } } });
      });
      await page.goto(baseUrl + "/checkout", { waitUntil: "networkidle" });
      await advanceMobileCheckoutToReview(page);
      await failCheckoutStorage(page, scenario === "create cleanup" ? "cleanup" : "fence");
      await page.getByRole("button", { name: "Place Order Now" }).click();
      if (scenario === "exact retry") {
        await page.getByRole("button", { name: "Retry this exact order" }).click();
      } else if (scenario === "changed cart") {
        await page.getByRole("button", { name: "Check order status" }).click();
        await page.getByRole("button", { name: "Review my updated cart" }).click();
        await expect(page.getByText("Your updated cart could not be opened.", { exact: false })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Order outcome not confirmed" })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe("/checkout");
        expect([posts, receipts]).toEqual([1, 4]);
        return;
      }
      await expect(page).toHaveURL(new RegExp("/success\\?orderId=" + IDS.order + "$"));
      await expect(page.getByRole("heading", { name: "Order confirmed by Zogular" })).toBeVisible();
      expect([posts, receipts]).toEqual(scenario === "exact retry" ? [2, 1] : [1, 0]);
      const records = await page.evaluate(key => ({
        fence: localStorage.getItem("zg-checkout:owner-a:fenced:" + key),
        attempts: Object.keys(localStorage).filter(k => k.startsWith("zg-checkout:owner-a:attempt:" + key + ":")).length,
      }), IDS.cart);
      expect(records).toEqual({ fence: scenario === "create cleanup" ? IDS.cart : null, attempts: 1 });
    });
  }

  for (const [width, height] of [[320, 568], [390, 844], [1440, 900]]) {
    test(`held checkout restores visible recovery on reload at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript(() => localStorage.setItem("zogular_auth_user", JSON.stringify({
        id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test",
      })));
      let posts = 0;
      const checking = deferred<void>(), release = deferred<void>();
      await page.route("**/api/backend/**", async route => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.endsWith("/user/me")) return route.fulfill({ json: userPayload() });
        if (pathname.endsWith("/user/addresses")) return route.fulfill({ json: addressPayload() });
        if (pathname.endsWith("/cart")) return route.fulfill({ json: cartPayload({ generation: IDS.cart }) });
        if (pathname.endsWith("/orders/quote")) return route.fulfill({ json: quotePayload({ cartGeneration: IDS.cart }) });
        if (pathname.endsWith("/auth/csrf-token")) return route.fulfill({ json: { data: { csrfToken: "fixture" } } });
        if (pathname.endsWith("/orders") && route.request().method() === "POST") {
          expect(route.request().postDataJSON().cartGeneration).toBe(IDS.cart);
          posts++;
          return route.abort("failed");
        }
        if (pathname.endsWith("/checkout-receipt/" + IDS.cart)) {
          checking.resolve();
          await release.promise;
          return route.fulfill({ status: 404, json: {} });
        }
        return route.fulfill({ json: { status: "success", data: { categories: [] } } });
      });

      const heading = page.getByRole("heading", { name: "Order outcome not confirmed" });
      const check = page.getByRole("button", { name: "Check order status" });
      await page.goto(baseUrl + "/checkout", { waitUntil: "networkidle" });
      await advanceMobileCheckoutToReview(page);
      const submit = page.getByRole("button", { name: "Place Order Now" });
      const reviewOffset = await page.evaluate(() => {
        window.scrollTo({ top: 120, behavior: "instant" });
        return window.scrollY;
      });
      if (width < 768) expect(reviewOffset).toBeGreaterThan(0);
      await submit.scrollIntoViewIfNeeded();
      await submit.click();
      await expect(heading).toBeVisible();
      // Model a retained Review offset explicitly; neither measurement may auto-scroll a locator.
      const offset = await page.evaluate(top => {
        window.scrollTo({ top, behavior: "instant" });
        return window.scrollY;
      }, reviewOffset);
      if (width < 768) expect(offset).toBeGreaterThan(0);
      await page.reload({ waitUntil: "networkidle" });
      await expect(check).toBeVisible();
      const measure = async (target: typeof heading) => target.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const headerBottom = document.querySelector("header")!.getBoundingClientRect().bottom;
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { top: rect.top, bottom: rect.bottom, headerBottom, hit: el.contains(hit),
          overflow: document.documentElement.scrollWidth - innerWidth, viewport: innerHeight, scroll: scrollY };
      });
      const geometry = { heading: await measure(heading), status: await measure(check) };
      const evidence = info.outputPath("viewport.json");
      await page.screenshot({ path: info.outputPath("held-viewport.png") });
      await fs.promises.writeFile(evidence, JSON.stringify(geometry));
      await info.attach("viewport", { path: evidence, contentType: "application/json" });
      for (const box of Object.values(geometry)) {
        expect(box.top).toBeGreaterThanOrEqual(box.headerBottom);
        expect(box.bottom).toBeLessThanOrEqual(box.viewport);
        expect(box.hit).toBe(true);
        expect(box.overflow).toBeLessThanOrEqual(0);
      }
      try {
        await check.click();
        await checking.promise;
        const support = page.getByRole("link", { name: "Contact support" });
        await support.focus();
        const before = await page.evaluate(() => {
          window.scrollTo({ top: 35, behavior: "instant" });
          return scrollY;
        });
        release.resolve();
        await expect(page.getByText("No receipt is available yet.", { exact: false })).toBeVisible();
        await expect(support).toBeFocused();
        expect(await page.evaluate(() => scrollY)).toBe(before);
        expect(posts).toBe(1);
      } finally { release.resolve(); }
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

  test("changed quote refreshes checkout and waits for a second deliberate submission", async ({ page, context }) => {
    if (!baseUrl || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) {
      throw new Error("Checkout fixture requires an IPv4 loopback origin.");
    }
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === baseUrl ? route.continue() : route.abort(),
    );
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({
        id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test",
      }));
    });
    const requests: unknown[] = [];
    let refreshedQuoteAttempts = 0;
    const latestQuote = { ...acceptedQuote, itemSubtotal: 600, grandTotalAmount: 650 };
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
      if (url.pathname.endsWith("/user/me")) return reply(userPayload());
      if (url.pathname.endsWith("/cart") && request.method() === "GET") return reply(cartPayload());
      if (url.pathname.endsWith("/user/addresses")) return reply(addressPayload());
      if (url.pathname.endsWith("/orders/quote")) {
        if (requests.length && ++refreshedQuoteAttempts === 1) {
          return reply({ status: "error", message: "Service temporarily unavailable" }, 503);
        }
        return reply(quotePayload(requests.length ? { ...latestQuote, cashDueOnDelivery: 600 } : {}));
      }
      if (url.pathname.endsWith("/auth/csrf-token")) return reply({ data: { csrfToken: "fixture-csrf" } });
      if (url.pathname.endsWith("/orders") && request.method() === "POST") {
        requests.push(request.postDataJSON().expectedQuote);
        if (requests.length === 1) return reply({ status: "fail", code: "CHECKOUT_QUOTE_CHANGED" }, 409);
        return reply(createdOrderPayload({
          totalAmount: 600,
          cashDueOnDelivery: 600,
          grandTotalAmount: 650,
          items: [{ productId: IDS.product, quantity: 2, price: 300 }],
        }));
      }
      if (url.pathname.endsWith(`/orders/${IDS.order}`)) {
        return reply({ status: "success", data: { order: detailOrderPayload("owner-a", "ZG-2026-0001") } });
      }
      return reply({ status: "success", data: { categories: [] } });
    });

    await page.goto(`${baseUrl}/checkout`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Continue to order review" }).click();
    await page.getByRole("button", { name: "Review Order" }).click();
    const placeOrder = page.getByRole("button", { name: "Place Order Now" });
    await placeOrder.click();
    await expect(page.getByText("Your order total changed. Review the updated amounts before placing your order.")).toBeVisible();
    await expect(placeOrder).toBeDisabled();
    await page.getByRole("button", { name: "Refresh order total" }).click();
    await expect(page.getByText("K650", { exact: true })).toBeVisible();
    await expect(page.getByText("K250", { exact: true })).toHaveCount(0);
    await expect(placeOrder).toBeEnabled();
    await expect(page).toHaveURL(/\/checkout$/);
    expect(requests).toEqual([acceptedQuote]);
    await page.screenshot({
      path: path.resolve("output/playwright/consumer-cart-checkout-integrity/reconfirm-390x844.png"),
      fullPage: true,
    });

    await placeOrder.click();
    await expect(page).toHaveURL(new RegExp(`/success\\?orderId=${IDS.order}$`));
    expect(requests).toEqual([acceptedQuote, latestQuote]);
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

  test("mounted mobile Review returns to focused address recovery after a same-owner refresh fails", async ({ page }) => {
    test.skip(process.env.CHECKOUT_MOUNTED_ADDRESS_FIXTURE !== "1", "Requires the scratch-only mounted checkout fixture.");
    if (!baseUrl || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) throw new Error("Private loopback fixture required.");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
    });
    const refreshStarted = Promise.withResolvers<void>();
    const releaseFailure = Promise.withResolvers<void>();
    let failRefresh = false;
    let orderPosts = 0;
    const diagnostics = collectDiagnostics(page, {
      badResponses: [{ method: "GET", path: "/api/backend/user/addresses", status: 503 }],
    });
    await page.route("**/api/backend/**", async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (pathname.endsWith("/user/me")) return route.fulfill({ json: userPayload() });
      if (pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ json: cartPayload() });
      if (pathname.endsWith("/user/addresses")) {
        if (!failRefresh) return route.fulfill({ json: addressPayload() });
        refreshStarted.resolve();
        await releaseFailure.promise;
        return route.fulfill({ status: 503, json: { status: "fail", message: "fixture internal address failure" } });
      }
      if (pathname.endsWith("/orders/quote")) return route.fulfill({ json: quotePayload() });
      if (pathname.endsWith("/auth/csrf-token")) return route.fulfill({ json: { data: { csrfToken: "fixture-review-recovery" } } });
      if (pathname.endsWith("/orders") && request.method() === "POST") {
        orderPosts++;
        return route.fulfill({ status: 500, json: { status: "fail" } });
      }
      return route.fulfill({ json: { status: "success", data: { categories: [] } } });
    });

    try {
      await page.goto(`${baseUrl}/checkout-address-revalidation-fixture`);
      await expect(page.getByRole("radio")).toBeChecked();
      await advanceMobileCheckoutToReview(page);
      const placeOrder = page.getByRole("button", { name: "Place Order Now" });
      const checkoutProgress = page.getByRole("progressbar", { name: "Checkout Progress" });
      await expect(placeOrder).toBeEnabled();
      await expect(checkoutProgress).toHaveAttribute("aria-valuenow", "80");

      failRefresh = true;
      await page.getByRole("button", { name: "Simulate same-owner address refresh" }).click();
      await refreshStarted.promise;
      await expect(checkoutProgress).toHaveAttribute("aria-valuenow", "80");
      await expect(placeOrder).toBeDisabled();
      releaseFailure.resolve();

      const heading = page.getByRole("heading", { name: /Delivery Address/ });
      const section = page.locator("section").filter({ has: heading });
      await expect(checkoutProgress).toHaveAttribute("aria-valuenow", "40");
      await expect(section.getByRole("alert")).toHaveText("This service is temporarily unavailable. Please try again in a moment.");
      await expect(heading).toBeFocused();
      await expect(heading).toBeInViewport();
      await expect(placeOrder).toBeHidden();
      await page.screenshot({ path: path.resolve("output/playwright/consumer-cart-checkout-integrity/address-refresh-from-review-390x844.png") });

      failRefresh = false;
      await section.getByRole("button", { name: "Try again" }).press("Enter");
      await expect(section.getByRole("radio")).toBeChecked();
      await expect(section.getByRole("alert")).toHaveCount(0);
      await advanceMobileCheckoutToReview(page);
      await expect(placeOrder).toBeEnabled();
      await expect(checkoutProgress).toHaveAttribute("aria-valuenow", "80");
      expect(orderPosts).toBe(0);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    } finally {
      releaseFailure.resolve();
    }
  });

  for (const vp of [{ name: "390x844", width: 390, height: 844 }, { name: "1440x900", width: 1440, height: 900 }] as const) {
    test(`address loading failure recovers without a stale submit alert or order write at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
      });
      const releaseRetry = Promise.withResolvers<void>();
      const retryStarted = Promise.withResolvers<void>();
      const addressFailure = "This service is temporarily unavailable. Please try again in a moment.";
      const privateDiagnostic = "fixture internal address failure";
      let retryRequested = false;
      let orderPosts = 0;
      const diagnostics = collectDiagnostics(page, {
        badResponses: [
          { method: "GET", path: "/api/backend/user/addresses", status: 503 },
          { method: "POST", path: "/api/backend/orders", status: 422 },
        ],
      });
      await page.route("**/api/backend/**", async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        if (pathname.endsWith("/user/me")) return route.fulfill({ json: userPayload() });
        if (pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ json: cartPayload() });
        if (pathname.endsWith("/user/addresses")) {
          if (!retryRequested) return route.fulfill({ status: 503, json: { status: "fail", message: privateDiagnostic } });
          retryStarted.resolve();
          await releaseRetry.promise;
          return route.fulfill({ json: addressPayload() });
        }
        if (pathname.endsWith("/orders/quote")) return route.fulfill({ json: quotePayload() });
        if (pathname.endsWith("/auth/csrf-token")) return route.fulfill({ json: { data: { csrfToken: "fixture-address-retry" } } });
        if (pathname.endsWith("/orders") && request.method() === "POST") {
          orderPosts++;
          return route.fulfill({ status: 422, json: { status: "fail", message: "fixture internal order rejection" } });
        }
        return route.fulfill({ json: { status: "success", data: { categories: [] } } });
      });

      try {
        await page.goto(`${baseUrl}/checkout`, { waitUntil: "networkidle" });
        const heading = page.getByRole("heading", { name: /Delivery Address/ });
        const section = page.locator("section").filter({ has: heading });
        const placeOrder = page.getByRole("button", { name: "Place Order Now" });
        await expect(section.getByRole("alert")).toHaveText(addressFailure);
        await expect(page.getByText(addressFailure, { exact: true })).toHaveCount(1);
        await expect(page.getByText(privateDiagnostic)).toHaveCount(0);
        if (vp.width >= 768) await expect(placeOrder).toBeDisabled();
        await page.screenshot({ path: path.resolve(`output/playwright/consumer-cart-checkout-integrity/address-failed-${vp.name}.png`) });

        retryRequested = true;
        await section.getByRole("button", { name: "Try again" }).press("Enter");
        await retryStarted.promise;
        await expect(heading).toBeFocused();
        await expect(section.getByRole("status")).toHaveText("Loading delivery addresses...");
        await expect(section.getByRole("button", { name: "Try again" })).toHaveCount(0);
        if (vp.width >= 768) await expect(placeOrder).toBeDisabled();

        releaseRetry.resolve();
        await expect(section.getByRole("radio")).toBeChecked();
        await expect(page.getByText(addressFailure, { exact: true })).toHaveCount(0);
        await advanceMobileCheckoutToReview(page);
        await expect(placeOrder).toBeEnabled();
        await placeOrder.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.resolve(`output/playwright/consumer-cart-checkout-integrity/address-recovered-${vp.name}.png`) });
        expect(orderPosts).toBe(0);

        // Only the deliberate submit reaches the synthetic order endpoint, which never creates an order.
        await placeOrder.click();
        await expect(page.getByText("Some cart details changed. Review your cart and try again.", { exact: true })).toBeVisible();
        await expect(page.getByText("fixture internal order rejection")).toHaveCount(0);
        await expect(page.getByText(addressFailure, { exact: true })).toHaveCount(0);
        expect(orderPosts).toBe(1);
        expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
      } finally {
        releaseRetry.resolve();
      }
    });

    test(`CSRF 403 on order creation performs 1 POST, shows safe retry copy, and succeeds on second deliberate click at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript(() => {
        localStorage.clear();
        localStorage.setItem("zogular_auth_user", JSON.stringify({ id: "owner-a", firstName: "Ada", lastName: "Buyer", email: "owner-a@example.test" }));
      });
      let csrfIssued = 0;
      const orderPosts: Array<string | undefined> = [];
      const diagnostics = collectDiagnostics(page, {
        badResponses: [{ method: "POST", path: "/api/backend/orders", status: 403 }],
      });
      await page.route("**/api/backend/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith("/user/me")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(userPayload()) });
        if (url.pathname.endsWith("/cart") && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(cartPayload()) });
        if (url.pathname.endsWith("/user/addresses")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(addressPayload()) });
        if (url.pathname.endsWith("/orders/quote")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quotePayload()) });
        if (url.pathname.endsWith("/auth/csrf-token")) {
          csrfIssued += 1;
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: `fixture-csrf-${csrfIssued}` } }) });
        }
        if (url.pathname.endsWith("/orders") && request.method() === "POST") {
          const token = request.headers()["x-csrf-token"];
          orderPosts.push(token);
          if (orderPosts.length === 1) {
            return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ status: "fail", message: "Invalid CSRF token" }) });
          }
          if (token === "fixture-csrf-2") {
            return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(createdOrderPayload()) });
          }
          return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ status: "fail", message: "Unexpected CSRF token" }) });
        }
        if (url.pathname.endsWith(`/orders/${IDS.order}`)) {
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { order: detailOrderPayload("owner-a", "ZG-2026-0001") } }) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "success", data: { categories: [] } }) });
      });

      await page.goto(`${baseUrl}/checkout`, { waitUntil: "networkidle" });
      await advanceMobileCheckoutToReview(page);
      const placeOrder = page.getByRole("button", { name: "Place Order Now" });
      await placeOrder.click();

      const retryCopy = page.getByText("Your order was not placed because your checkout verification expired. Select Place Order Now to try again.");
      await expect(retryCopy).toBeVisible();
      await expect(page.getByText("Please sign in again to continue.")).toHaveCount(0);
      await expect(page.getByText(/csrf/i)).toHaveCount(0);
      await page.waitForTimeout(250);
      expect(orderPosts).toEqual(["fixture-csrf-1"]);
      expect(await page.evaluate(() => {
        const stored = localStorage.getItem("zogular-cart-storage");
        return stored ? JSON.parse(stored).state.items : null;
      })).toEqual(expect.arrayContaining([expect.objectContaining({ id: IDS.product })]));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await placeOrder.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: path.resolve(`output/playwright/consumer-cart-checkout-integrity/csrf-403-no-resend-viewport-${vp.name}.png`),
        fullPage: false,
      });

      await placeOrder.click();
      await expect(page).toHaveURL(new RegExp(`/success\\?orderId=${IDS.order}$`));
      await expect(page.getByRole("heading", { name: "Order confirmed by Zogular" })).toBeVisible();
      expect(orderPosts).toEqual(["fixture-csrf-1", "fixture-csrf-2"]);
      expect(csrfIssued).toBeGreaterThanOrEqual(2);
      expect(await page.evaluate(() => {
        const stored = localStorage.getItem("zogular-cart-storage");
        return stored ? JSON.parse(stored).state.items : null;
      })).toEqual([]);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], unexpectedFailedRequests: [], unexpectedBadResponses: [] });
    });
  }
});
