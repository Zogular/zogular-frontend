import { expect, test as base } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { ApiError, apiClient, resetApiClientSecurityStateForTests } from "../src/services/api";
import { CheckoutOrderOutcomeUnknownError, createCheckoutOrder } from "../src/services/checkout";

interface Loopback {
  calls: string[];
  headersReceived: string[];
  caller: AbortController;
  refresh: "slow" | "fast" | "rejected";
  refreshClosedEarly: boolean;
}

const test = base.extend<{ loopback: Loopback }>({
  loopback: async ({}, runTest) => {
    const fixture: Loopback = {
      calls: [], headersReceived: [], caller: new AbortController(), refresh: "slow", refreshClosedEarly: false,
    };
    let sessionConfirmed = false;
    const nativeFetch = globalThis.fetch;
    const server = createServer((req, res) => {
      fixture.calls.push(`${req.method} ${req.url}`);
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/auth/csrf-token") return void res.end('{"csrfToken":"fixture"}');
      if (req.url === "/fast") return void res.end('{"ok":true}');
      if (req.url === "/protected") {
        res.statusCode = sessionConfirmed ? 200 : 401;
        return void res.end(sessionConfirmed ? '{"ok":true}' : '{"message":"Original protected rejection"}');
      }
      res.statusCode = req.url === "/denied" ? 403 : 200;
      if (req.url === "/auth/refresh-token") {
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

test("checkout preserves uncertainty after one order submission", async ({ loopback }) => {
  await assert.rejects(createCheckoutOrder({
    items: [{ id: "11111111-1111-4111-8111-111111111111", name: "Fixture", slug: "fixture",
      price: 20, image: "", quantity: 1 }],
    contact: { firstName: "Test", lastName: "Buyer", phone: "0000000000", email: "test@example.invalid" },
    delivery: { street: "Fixture Street", area: "Fixture" },
    paymentMethod: "cash_on_delivery",
  }, { itemSubtotal: 20, deliveryFeeAmount: 5, grandTotalAmount: 25 }),
  error => error instanceof CheckoutOrderOutcomeUnknownError && isTimeout(error.cause));
  expect(loopback.headersReceived).toEqual(["/auth/csrf-token", "/orders"]);
  expect(loopback.calls).toEqual(["GET /auth/csrf-token", "POST /orders"]);
});
