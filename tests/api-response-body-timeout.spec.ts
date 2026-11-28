import { expect, test as base } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ApiError, apiClient, resetApiClientSecurityStateForTests } from "../src/services/api";
import { CheckoutOrderOutcomeUnknownError, createCheckoutOrder, quoteCheckoutOrder } from "../src/services/checkout";

interface Loopback {
  calls: string[];
  headersReceived: string[];
  caller: AbortController;
  refresh: "slow" | "fast" | "rejected";
  refreshClosedEarly: boolean;
  protectedMode?: "malformed-before-refresh" | "malformed-through-replay";
  ordersMode: "slow" | "csrf403" | "401" | "503" | "ok";
  quoteMode: "ok" | "csrf403-once";
  csrfTokenVersion: number;
  onCsrfRequest?: (version: number) => Promise<void> | void;
  onRefreshRequest?: () => Promise<void> | void;
  onOrdersRequest?: () => Promise<void> | void;
}

const test = base.extend<{ loopback: Loopback }>({
  loopback: async ({}, runTest) => {
    const fixture: Loopback = {
      calls: [], headersReceived: [], caller: new AbortController(), refresh: "slow", refreshClosedEarly: false,
      ordersMode: "slow", quoteMode: "ok", csrfTokenVersion: 0,
    };
    let sessionConfirmed = false;
    let quoteCsrfRejected = false;
    const nativeFetch = globalThis.fetch;
    const server = createServer(async (req, res) => {
      fixture.calls.push(`${req.method} ${req.url}`);
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/auth/csrf-token") {
        fixture.csrfTokenVersion += 1;
        await fixture.onCsrfRequest?.(fixture.csrfTokenVersion);
        return void res.end(JSON.stringify({ csrfToken: `fixture-${fixture.csrfTokenVersion}` }));
      }
      if (req.url === "/fast") return void res.end('{"ok":true}');
      if (req.url === "/malformed-success") return void res.end('{"ok":');
      if (req.url === "/malformed-forbidden") {
        res.statusCode = 403;
        return void res.end('{"message":"Synthetic invalid CSRF diagnostic');
      }
      if (req.url === "/protected") {
        if (fixture.protectedMode && !sessionConfirmed) {
          res.statusCode = 401;
          return void res.end('{"message":"Synthetic restricted session diagnostic');
        }
        if (fixture.protectedMode === "malformed-through-replay") {
          res.statusCode = 401;
          return void res.end();
        }
        res.statusCode = sessionConfirmed ? 200 : 401;
        return void res.end(sessionConfirmed ? '{"ok":true}' : '{"message":"Original protected rejection"}');
      }
      if (req.url === "/orders/quote") {
        if (fixture.quoteMode === "csrf403-once" && !quoteCsrfRejected) {
          quoteCsrfRejected = true;
          res.statusCode = 403;
          return void res.end('{"status":"fail","message":"Invalid CSRF token"}');
        }
        return void res.end(JSON.stringify({
          status: "success",
          data: {
            quote: {
              itemSubtotal: 20,
              deliveryFeeAmount: 5,
              cashDueOnDelivery: 20,
              grandTotalAmount: 25,
              paymentMethod: "CASH_ON_DELIVERY",
              paymentCollectionMode: "DELIVERY_FEE_THEN_CASH",
              commitmentFeeStatus: "PENDING",
            },
          },
        }));
      }
      if (req.url === "/orders" && fixture.ordersMode !== "slow") {
        await fixture.onOrdersRequest?.();
        if (fixture.ordersMode === "csrf403") {
          res.statusCode = 403;
          return void res.end('{"status":"fail","message":"Invalid CSRF token"}');
        }
        if (fixture.ordersMode === "401") {
          res.statusCode = 401;
          return void res.end('{"status":"fail","message":"Session expired"}');
        }
        if (fixture.ordersMode === "503") {
          res.statusCode = 503;
          return void res.end('{"status":"error","message":"Service unavailable"}');
        }
        return void res.end(JSON.stringify({
          status: "success",
          data: {
            order: {
              id: "22222222-2222-4222-8222-222222222222",
              orderNumber: "ZG-2026-0099",
              createdAt: "2026-08-16T10:00:00.000Z",
              totalAmount: 20,
              deliveryFeeAmount: 5,
              cashDueOnDelivery: 20,
              grandTotalAmount: 25,
              paymentMethod: "CASH_ON_DELIVERY",
              paymentCollectionMode: "DELIVERY_FEE_THEN_CASH",
              commitmentFeeStatus: "PENDING",
              items: [{ productId: "11111111-1111-4111-8111-111111111111", quantity: 1, price: 20 }],
            },
          },
        }));
      }
      res.statusCode = req.url === "/denied" ? 403 : 200;
      if (req.url === "/auth/refresh-token") {
        await fixture.onRefreshRequest?.();
        if (fixture.refresh === "fast") {
          sessionConfirmed = true;
          return void res.end('{"ok":true}');
        }
        res.statusCode = fixture.refresh === "rejected" ? 401 : 200;
        res.once("close", () => { fixture.refreshClosedEarly = !res.writableEnded; });
      }
      res.flushHeaders();
      res.write('{"ok":');
      // A client that ignores cancellation must still settle and fail the assertion.
      const timer = setTimeout(() => res.end("true}"), req.url === "/orders" ? 14_000 : 2_500);
      res.once("close", () => clearTimeout(timer));
    });
    await new Promise<void>((ready, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", ready);
    });
    try {
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const origin = `http://127.0.0.1:${address.port}`;
      resetApiClientSecurityStateForTests();
      globalThis.fetch = async (input, init) => {
        assert.equal(typeof input, "string", "apiClient must supply its resolved URL");
        const source = new URL(String(input));
        const target = new URL(origin);
        target.pathname = source.pathname.replace(/^\/api\/v1(?=\/)/, "");
        target.search = source.search;
        const response = await nativeFetch(target, { ...init, redirect: "error" });
        fixture.headersReceived.push(target.pathname);
        if (target.pathname === "/cancel") setImmediate(() => fixture.caller.abort());
        return response;
      };
      await runTest(fixture);
    } finally {
      globalThis.fetch = nativeFetch;
      resetApiClientSecurityStateForTests();
      const closed = new Promise<void>((done, reject) =>
        server.close(error => error ? reject(error) : done()));
      server.closeAllConnections();
      await closed;
    }
  },
});

const isTimeout = (error: unknown) => error instanceof ApiError && error.status === 408;

const refreshAttempt = ["GET /protected", "GET /auth/csrf-token", "POST /auth/refresh-token"];

test("incomplete successful refresh times out without replay and a later refresh recovers", async ({ loopback }) => {
  await assert.rejects(apiClient("/protected", { timeout: 750 }), isTimeout);
  expect(loopback.headersReceived).toEqual(["/protected", "/auth/csrf-token", "/auth/refresh-token"]);
  expect(loopback.calls).toEqual(refreshAttempt);
  await expect.poll(() => loopback.refreshClosedEarly).toBe(true);

  loopback.refresh = "fast";
  expect(await apiClient("/protected", { timeout: 2_000 })).toEqual({ ok: true });
  expect(loopback.calls.slice(refreshAttempt.length).filter(call => call !== "GET /auth/csrf-token"))
    .toEqual(["GET /protected", "POST /auth/refresh-token", "GET /protected"]);
});

test("a stalled refresh denial is bounded by the request deadline and preserves the original 401 without replay", async ({ loopback }) => {
  loopback.refresh = "rejected";
  // The refresh body outlasts this deadline; its timeout must not replace the explicit denial.
  await assert.rejects(apiClient("/protected", { timeout: 750 }), error =>
    error instanceof ApiError && error.status === 401 && error.message === "Original protected rejection");
  expect(loopback.headersReceived).toEqual(["/protected", "/auth/csrf-token", "/auth/refresh-token"]);
  expect(loopback.calls).toEqual(refreshAttempt);
  await expect.poll(() => loopback.refreshClosedEarly).toBe(true);
});

test("fast complete JSON succeeds", async ({ loopback }) => {
  expect(await apiClient("/fast")).toEqual({ ok: true });
  expect(loopback.calls).toEqual(["GET /fast"]);
});

test("malformed initial 401 keeps the existing refresh and single successful replay", async ({ loopback }) => {
  loopback.protectedMode = "malformed-before-refresh";
  loopback.refresh = "fast";

  expect(await apiClient("/protected")).toEqual({ ok: true });
  expect(loopback.calls).toEqual([...refreshAttempt, "GET /protected"]);
});

test("an empty JSON 401 after replay stays terminal and exposes no diagnostics", async ({ loopback }) => {
  loopback.protectedMode = "malformed-through-replay";
  loopback.refresh = "fast";

  await assert.rejects(apiClient("/protected"), error =>
    error instanceof ApiError && error.status === 401 &&
    error.message === "Please sign in again." && error.details === undefined);
  expect(loopback.calls).toEqual([...refreshAttempt, "GET /protected"]);
});

for (const noAutoReplay of [false, true]) {
  test(`malformed 401 on a mutation sends only one POST (noAutoReplay=${noAutoReplay})`, async ({ loopback }) => {
    loopback.protectedMode = "malformed-before-refresh";
    loopback.refresh = "fast";

    await assert.rejects(apiClient("/protected", { method: "POST", csrf: true, noAutoReplay }), error =>
      error instanceof ApiError && error.status === 401 &&
      error.message === "Please sign in again." && error.details === undefined);
    expect(loopback.calls).toEqual(["GET /auth/csrf-token", "POST /protected"]);
  });
}

test("malformed 403 does not infer a CSRF failure or replay the mutation", async ({ loopback }) => {
  await assert.rejects(apiClient("/malformed-forbidden", { method: "POST", csrf: true }), error =>
    error instanceof ApiError && error.status === 403 &&
    error.message === "You don't have access to this request." && error.details === undefined);
  expect(loopback.calls).toEqual(["GET /auth/csrf-token", "POST /malformed-forbidden"]);
});

test("malformed successful JSON still fails instead of returning empty data", async ({ loopback }) => {
  await assert.rejects(apiClient("/malformed-success"), error =>
    error instanceof ApiError && error.status === 503);
  expect(loopback.calls).toEqual(["GET /malformed-success"]);
});

for (const path of ["/slow", "/denied"]) {
  test(`timeout while reading ${path} after headers does not replay the request`, async ({ loopback }) => {
    await assert.rejects(apiClient(path, { timeout: 750 }), isTimeout);
    expect(loopback.headersReceived).toEqual([path]);
    expect(loopback.calls).toEqual([`GET ${path}`]);
  });
}

test("caller abort interrupts the incomplete body before the independent deadline", async ({ loopback }) => {
  await assert.rejects(apiClient("/cancel", { signal: loopback.caller.signal, timeout: 10_000 }), isTimeout);
  expect(loopback.caller.signal.aborted).toBe(true);
  expect(loopback.headersReceived).toEqual(["/cancel"]);
  expect(loopback.calls).toEqual(["GET /cancel"]);
});

const checkoutInput = {
  items: [{ id: "11111111-1111-4111-8111-111111111111", name: "Fixture", slug: "fixture",
    price: 20, image: "", quantity: 1 }],
  contact: { firstName: "Test", lastName: "Buyer", phone: "0000000000", email: "test@example.invalid" },
  delivery: { street: "Fixture Street", area: "Fixture" },
  paymentMethod: "cash_on_delivery" as const,
};

const acceptedQuote = { itemSubtotal: 20, deliveryFeeAmount: 5, grandTotalAmount: 25 };

test("checkout preserves uncertainty after one order submission", async ({ loopback }) => {
  await assert.rejects(createCheckoutOrder(checkoutInput, acceptedQuote),
  error => error instanceof CheckoutOrderOutcomeUnknownError && isTimeout(error.cause));
  expect(loopback.headersReceived).toEqual(["/auth/csrf-token", "/orders"]);
  expect(loopback.calls).toEqual(["GET /auth/csrf-token", "POST /orders"]);
});

test("createCheckoutOrder on CSRF 403 performs 1 POST, clears cached CSRF, and waits for next deliberate action", async ({ loopback }) => {
  loopback.ordersMode = "csrf403";
  await assert.rejects(createCheckoutOrder(checkoutInput, acceptedQuote),
    error => error instanceof ApiError && error.status === 403);
  expect(loopback.calls).toEqual(["GET /auth/csrf-token", "POST /orders"]);

  loopback.ordersMode = "ok";
  const created = await createCheckoutOrder(checkoutInput, acceptedQuote);
  expect(created.orderNumber).toBe("ZG-2026-0099");
  expect(loopback.calls).toEqual([
    "GET /auth/csrf-token",
    "POST /orders",
    "GET /auth/csrf-token",
    "POST /orders",
  ]);
});

test("createCheckoutOrder on 401 does not auto-refresh or replay POST", async ({ loopback }) => {
  loopback.refresh = "fast";
  loopback.ordersMode = "401";
  await assert.rejects(createCheckoutOrder(checkoutInput, acceptedQuote),
    error => error instanceof ApiError && error.status === 401);
  expect(loopback.calls).toEqual(["GET /auth/csrf-token", "POST /orders"]);
});

test("createCheckoutOrder on 401 after concurrent session revision bump does not replay POST", async ({ loopback }) => {
  loopback.refresh = "fast";
  loopback.ordersMode = "401";
  let bumped = false;
  loopback.onOrdersRequest = async () => {
    if (!bumped) {
      bumped = true;
      await apiClient("/protected", { timeout: 2_000 });
    }
  };
  await assert.rejects(createCheckoutOrder(checkoutInput, acceptedQuote),
    error => error instanceof ApiError && error.status === 401);
  expect(loopback.calls.filter(call => call === "POST /orders")).toHaveLength(1);
});

test("createCheckoutOrder aborts with 0 POSTs if session revision changes during CSRF bootstrap", async ({ loopback }) => {
  loopback.refresh = "fast";
  loopback.ordersMode = "ok";
  loopback.quoteMode = "csrf403-once";

  let releaseRefresh!: () => void;
  const refreshInFlight = new Promise<void>(resolve => {
    loopback.onRefreshRequest = () => {
      resolve();
      return new Promise<void>(done => { releaseRefresh = done; });
    };
  });

  let releaseSecondCsrf!: () => void;
  const secondCsrfInFlight = new Promise<void>(resolve => {
    loopback.onCsrfRequest = (version) => {
      if (version === 2) {
        resolve();
        return new Promise<void>(done => { releaseSecondCsrf = done; });
      }
    };
  });

  const protectedPromise = apiClient("/protected", { timeout: 5_000 });
  await refreshInFlight;

  const quotePromise = quoteCheckoutOrder(checkoutInput);
  await secondCsrfInFlight;

  const orderPromise = createCheckoutOrder(checkoutInput, acceptedQuote);
  const orderAssertion = assert.rejects(orderPromise,
    error => error instanceof ApiError && error.status === 401);
  releaseRefresh();
  await protectedPromise;
  releaseSecondCsrf();

  await Promise.all([orderAssertion, quotePromise]);
  expect(loopback.calls.filter(call => call === "POST /orders")).toHaveLength(0);
});

test("createCheckoutOrder on 503 preserves uncertainty with 1 POST", async ({ loopback }) => {
  loopback.ordersMode = "503";
  await assert.rejects(createCheckoutOrder(checkoutInput, acceptedQuote),
    error => error instanceof CheckoutOrderOutcomeUnknownError
      && error.cause instanceof ApiError
      && error.cause.status === 503);
  expect(loopback.calls).toEqual(["GET /auth/csrf-token", "POST /orders"]);
});

test("quoteCheckoutOrder on CSRF 403 still refreshes CSRF and recovers", async ({ loopback }) => {
  loopback.quoteMode = "csrf403-once";
  const quote = await quoteCheckoutOrder(checkoutInput);
  expect(quote.grandTotalAmount).toBe(25);
  expect(loopback.calls).toEqual([
    "GET /auth/csrf-token",
    "POST /orders/quote",
    "GET /auth/csrf-token",
    "POST /orders/quote",
  ]);
});
