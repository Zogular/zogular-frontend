import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { ApiError, resetApiClientSecurityStateForTests } from "@/services/api";
import { storeAuthSession, clearStoredAuthSession } from "@/services/auth-session";
import { cancelBuyerOrder, getInvoiceById, OrderContractError, parseBuyerCanCancel } from "@/services/orders";
import type { BackendOrder, BackendOrderStatus } from "@/types/backend-order";

const FRONTEND_PORT = 3324;
const BACKEND_PORT = 3325;
const FRONTEND_ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;
const runBrowserSuite = Boolean(process.env.BUYER_CANCEL_BASE_URL);

function makeBackendOrder(overrides: Omit<Partial<BackendOrder>, "buyerActions"> & { buyerActions?: unknown } = {}): Record<string, unknown> {
  return {
    id: "ord-1",
    orderNumber: "ZG-1001",
    userId: "buyer-1",
    status: "PENDING",
    totalAmount: 250,
    paymentMethod: "CASH_ON_DELIVERY",
    paymentCollectionMode: "UPFRONT_COMMITMENT_FEE",
    deliveryFeeAmount: 35,
    cashDueOnDelivery: 250,
    grandTotalAmount: 285,
    commitmentFeeStatus: "PENDING",
    shippingAddress: {
      fullName: "Chanda Mwamba",
      phone: "+260971000111",
      address: "Plot 12, Kabulonga",
      area: "Kabulonga",
      city: "Lusaka",
    },
    deliveryMethod: "STANDARD",
    createdAt: "2026-11-27T10:00:00.000Z",
    updatedAt: "2026-11-27T10:00:00.000Z",
    items: [
      {
        id: "item-1",
        productId: "prod-1",
        quantity: 1,
        price: 250,
        lineTotal: 250,
        vendorId: "vendor-1",
        vendorStatus: "PENDING",
        product: { id: "prod-1", title: "Maize Meal 25kg", slug: "maize-meal-25kg" },
      },
    ],
    buyerActions: { canCancel: true },
    ...overrides,
  };
}

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function installBrowserGlobals(userId = "buyer-1") {
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  const events: string[] = [];
  const win = {
    location: { origin: "http://127.0.0.1:3000" },
    localStorage,
    sessionStorage,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent(event: Event) {
      events.push(event.type);
      return true;
    },
  };
  Object.defineProperty(globalThis, "window", { value: win, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: localStorage, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: sessionStorage, configurable: true });
  storeAuthSession({
    user: {
      id: userId,
      email: "buyer@example.test",
      firstName: "Chanda",
      lastName: "Mwamba",
    },
  });
  return {
    clearAuth: () => clearStoredAuthSession(),
    switchUser: (nextId: string) =>
      storeAuthSession({
        user: {
          id: nextId,
          email: `${nextId}@example.test`,
          firstName: "Other",
          lastName: "Buyer",
        },
      }),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test.describe("buyer order cancellation contract & transport", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = (globalThis as { window?: unknown }).window;

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    resetApiClientSecurityStateForTests();
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, "window", { value: originalWindow, configurable: true });
    }
  });

  test("parseBuyerCanCancel fails closed for missing or non-boolean true values", () => {
    expect(parseBuyerCanCancel(null)).toBe(false);
    expect(parseBuyerCanCancel({})).toBe(false);
    expect(parseBuyerCanCancel({ buyerActions: null })).toBe(false);
    expect(parseBuyerCanCancel({ buyerActions: [] })).toBe(false);
    expect(parseBuyerCanCancel({ buyerActions: {} })).toBe(false);
    expect(parseBuyerCanCancel({ buyerActions: { canCancel: false } })).toBe(false);
    expect(parseBuyerCanCancel({ buyerActions: { canCancel: "true" } })).toBe(false);
    expect(parseBuyerCanCancel({ buyerActions: { canCancel: 1 } })).toBe(false);
    expect(parseBuyerCanCancel({ buyerActions: { canCancel: true } })).toBe(true);
  });

  test("identical processing status can carry opposite server-issued canCancel flags", async () => {
    installBrowserGlobals();
    resetApiClientSecurityStateForTests();

    let call = 0;
    globalThis.fetch = (async () => {
      call += 1;
      return jsonResponse({
        status: "success",
        data: {
          order: makeBackendOrder({
            id: call === 1 ? "ord-a" : "ord-b",
            status: "PROCESSING",
            buyerActions: { canCancel: call === 1 },
          }),
        },
      });
    }) as typeof fetch;

    const first = await getInvoiceById("ord-a");
    const second = await getInvoiceById("ord-b");
    expect(first.status).toBe("processing");
    expect(second.status).toBe("processing");
    expect(first.canCancel).toBe(true);
    expect(second.canCancel).toBe(false);
  });

  test("cancelBuyerOrder sends one CSRF-protected POST and rejects mismatched ID, active status, or canCancel=true", async () => {
    installBrowserGlobals();
    resetApiClientSecurityStateForTests();

    const calls: Array<{ url: string; method: string; csrf: string | null; body: unknown }> = [];
    let scenario:
      | "ok"
      | "wrong-id"
      | "not-cancelled"
      | "still-cancellable"
      | "missing-actions"
      | "null-can-cancel"
      | "string-false-can-cancel" = "ok";

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/auth/csrf-token")) {
        return jsonResponse({ csrfToken: "csrf-1" });
      }
      const headers = new Headers(init?.headers);
      calls.push({ url, method, csrf: headers.get("x-csrf-token"), body: init?.body });

      if (scenario === "wrong-id") {
        return jsonResponse({
          status: "success",
          message: "Order cancelled",
          data: { order: makeBackendOrder({ id: "ord-other", status: "CANCELLED", buyerActions: { canCancel: false } }) },
        });
      }
      if (scenario === "not-cancelled") {
        return jsonResponse({
          status: "success",
          message: "Order cancelled",
          data: { order: makeBackendOrder({ id: "ord-1", status: "PENDING", buyerActions: { canCancel: false } }) },
        });
      }
      if (scenario === "still-cancellable") {
        return jsonResponse({
          status: "success",
          message: "Order cancelled",
          data: { order: makeBackendOrder({ id: "ord-1", status: "CANCELLED", buyerActions: { canCancel: true } }) },
        });
      }
      if (scenario === "missing-actions") {
        return jsonResponse({
          status: "success",
          message: "Order cancelled",
          data: { order: makeBackendOrder({ id: "ord-1", status: "CANCELLED", buyerActions: undefined }) },
        });
      }
      if (scenario === "null-can-cancel") {
        return jsonResponse({
          status: "success",
          message: "Order cancelled",
          data: { order: makeBackendOrder({ id: "ord-1", status: "CANCELLED", buyerActions: { canCancel: null } }) },
        });
      }
      if (scenario === "string-false-can-cancel") {
        return jsonResponse({
          status: "success",
          message: "Order cancelled",
          data: { order: makeBackendOrder({ id: "ord-1", status: "CANCELLED", buyerActions: { canCancel: "false" } }) },
        });
      }

      return jsonResponse({
        status: "success",
        message: "Order cancelled",
        data: { order: makeBackendOrder({ id: "ord-1", status: "CANCELLED", buyerActions: { canCancel: false } }) },
      });
    }) as typeof fetch;

    const ok = await cancelBuyerOrder("ord-1");
    expect(ok.rawStatus).toBe("CANCELLED");
    expect(ok.status).toBe("cancelled");
    expect(ok.canCancel).toBe(false);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: "POST",
      csrf: "csrf-1",
      body: undefined,
    });
    expect(calls[0]?.url).toContain("/orders/ord-1/cancel");

    for (const bad of [
      "wrong-id",
      "not-cancelled",
      "still-cancellable",
      "missing-actions",
      "null-can-cancel",
      "string-false-can-cancel",
    ] as const) {
      scenario = bad;
      await expect(cancelBuyerOrder("ord-1")).rejects.toBeInstanceOf(OrderContractError);
    }
  });

  test("cancelBuyerOrder never auto-replays on 401, CSRF 403, or mid-CSRF session change", async () => {
    const authControl = installBrowserGlobals();
    resetApiClientSecurityStateForTests();

    let postCount = 0;
    let mode: "401" | "csrf403" | "session-change" = "401";

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/auth/csrf-token")) {
        if (mode === "session-change") {
          authControl.switchUser("buyer-2");
        }
        return jsonResponse({ csrfToken: "csrf-token-val" });
      }
      if (url.endsWith("/auth/refresh-token")) {
        return jsonResponse({ status: "success" });
      }
      if (url.includes("/orders/ord-1/cancel") && method === "POST") {
        postCount += 1;
        if (mode === "401") return jsonResponse({ status: "fail", message: "Unauthorized" }, 401);
        return jsonResponse({ status: "fail", message: "Invalid CSRF token" }, 403);
      }
      return jsonResponse({}, 404);
    }) as typeof fetch;

    await expect(cancelBuyerOrder("ord-1")).rejects.toMatchObject({ status: 401 });
    expect(postCount).toBe(1);

    postCount = 0;
    mode = "csrf403";
    await expect(cancelBuyerOrder("ord-1")).rejects.toMatchObject({ status: 403 });
    expect(postCount).toBe(1);

    postCount = 0;
    mode = "session-change";
    resetApiClientSecurityStateForTests();
    await expect(cancelBuyerOrder("ord-1")).rejects.toBeInstanceOf(ApiError);
    expect(postCount).toBe(0);
  });
});

async function checkPort(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", reject);
    tester.once("listening", () => tester.close(() => resolve()));
    tester.listen(port, "127.0.0.1");
  });
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Wait for Next server startup
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

test.describe("buyer order cancellation browser acceptance", () => {
  test.skip(!runBrowserSuite, "BUYER_CANCEL_BASE_URL is required for installed-Chrome acceptance.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ serviceWorkers: "block" });

  let backendServer: http.Server | null = null;
  let frontendProcess: ChildProcess | null = null;

  let ordersById: Record<string, Record<string, unknown>> = {};
  let cancelOutcome:
    | "success"
    | "csrf-then-success"
    | "forbidden403"
    | "unauthorized401"
    | "reconcile-401"
    | "ambiguous-string-false"
    | "conflict409"
    | "conflict409-still-eligible"
    | "ambiguous500-cancelled"
    | "ambiguous500-refunded"
    | "ambiguous500-pending"
    | "delayed-success" = "success";
  let forceGetUnauthorized = false;
  let cancelPostCount = 0;
  let getOrderCount = 0;
  let csrfAttempts = 0;
  let releaseDelayedCancel: (() => void) | null = null;

  function resetFixtureState() {
    ordersById = {
      "ord-1": makeBackendOrder({ id: "ord-1", orderNumber: "ZG-1001", status: "PENDING", buyerActions: { canCancel: true } }),
      "ord-2": makeBackendOrder({ id: "ord-2", orderNumber: "ZG-1002", status: "CONFIRMED", buyerActions: { canCancel: true } }),
      "ord-blocked": makeBackendOrder({ id: "ord-blocked", orderNumber: "ZG-1003", status: "PROCESSING", buyerActions: { canCancel: false } }),
      "ord-malformed": makeBackendOrder({ id: "ord-malformed", orderNumber: "ZG-1004", status: "PENDING", buyerActions: "true" }),
    };
    cancelOutcome = "success";
    forceGetUnauthorized = false;
    cancelPostCount = 0;
    getOrderCount = 0;
    csrfAttempts = 0;
    releaseDelayedCancel = null;
  }

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(120_000);
    resetFixtureState();
    await checkPort(FRONTEND_PORT);
    await checkPort(BACKEND_PORT);

    backendServer = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", BACKEND_ORIGIN);
      res.setHeader("content-type", "application/json");
      const cookieHeader = req.headers.cookie ?? "";
      const hasSessionCookie = cookieHeader.includes("accessToken=fixture-buyer-token");

      if (url.pathname === "/api/v1/auth/csrf-token") {
        csrfAttempts += 1;
        res.setHeader("set-cookie", `_csrf=csrf-cookie-${csrfAttempts}; Path=/; HttpOnly; SameSite=Lax`);
        res.end(JSON.stringify({ csrfToken: `fixture-csrf-${csrfAttempts}` }));
        return;
      }
      if (url.pathname === "/api/v1/auth/login" && req.method === "POST") {
        res.setHeader("set-cookie", "accessToken=fixture-buyer-token; Path=/; HttpOnly; SameSite=Lax");
        res.end(
          JSON.stringify({
            status: "success",
            data: {
              user: {
                id: "buyer-1",
                email: "buyer@example.test",
                firstName: "Chanda",
                lastName: "Mwamba",
                role: "CUSTOMER",
              },
            },
          }),
        );
        return;
      }
      if (url.pathname === "/api/v1/auth/logout" && req.method === "POST") {
        res.setHeader("set-cookie", "accessToken=; Path=/; Max-Age=0");
        res.end(JSON.stringify({ status: "success" }));
        return;
      }
      if (url.pathname === "/api/v1/user/me" || url.pathname === "/api/v1/auth/me") {
        if (!hasSessionCookie) {
          res.writeHead(401).end(JSON.stringify({ status: "fail", message: "Not authenticated" }));
          return;
        }
        res.end(
          JSON.stringify({
            status: "success",
            data: {
              user: {
                id: "buyer-1",
                email: "buyer@example.test",
                firstName: "Chanda",
                lastName: "Mwamba",
                role: "CUSTOMER",
              },
            },
          }),
        );
        return;
      }
      if (url.pathname === "/api/v1/orders" && req.method === "GET") {
        if (!hasSessionCookie) {
          res.writeHead(401).end(JSON.stringify({ status: "fail" }));
          return;
        }
        const orders = Object.values(ordersById);
        res.end(
          JSON.stringify({
            status: "success",
            results: orders.length,
            data: { orders },
            pagination: { total: orders.length, page: 1, limit: 20, pages: 1 },
          }),
        );
        return;
      }
      const orderGetMatch = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)$/);
      if (orderGetMatch && req.method === "GET") {
        getOrderCount += 1;
        if (!hasSessionCookie || forceGetUnauthorized) {
          res.writeHead(401).end(JSON.stringify({ status: "fail", message: "Session expired" }));
          return;
        }
        const order = ordersById[orderGetMatch[1]];
        if (!order) {
          res.writeHead(404).end(JSON.stringify({ status: "fail", message: "Order not found" }));
          return;
        }
        res.end(JSON.stringify({ status: "success", data: { order } }));
        return;
      }
      const orderCancelMatch = url.pathname.match(/^\/api\/v1\/orders\/([^/]+)\/cancel$/);
      if (orderCancelMatch && req.method === "POST") {
        cancelPostCount += 1;
        if (!hasSessionCookie) {
          res.writeHead(401).end(JSON.stringify({ status: "fail", message: "Session expired" }));
          return;
        }
        const orderId = orderCancelMatch[1];
        const current = ordersById[orderId];
        if (!current) {
          res.writeHead(404).end(JSON.stringify({ status: "fail", message: "Order not found" }));
          return;
        }

        const completeSuccess = () => {
          const updated = {
            ...current,
            status: "CANCELLED" as BackendOrderStatus,
            buyerActions: { canCancel: false },
          };
          ordersById[orderId] = updated;
          res.end(JSON.stringify({ status: "success", message: "Order cancelled", data: { order: updated } }));
        };

        if (cancelOutcome === "delayed-success") {
          releaseDelayedCancel = completeSuccess;
          return;
        }
        if (cancelOutcome === "csrf-then-success" && cancelPostCount === 1) {
          res.writeHead(403).end(JSON.stringify({ status: "fail", message: "Invalid CSRF token" }));
          return;
        }
        if (cancelOutcome === "forbidden403") {
          res.writeHead(403).end(JSON.stringify({ status: "fail", message: "Forbidden" }));
          return;
        }
        if (cancelOutcome === "unauthorized401") {
          res.writeHead(401).end(JSON.stringify({ status: "fail", message: "Unauthorized" }));
          return;
        }
        if (cancelOutcome === "reconcile-401") {
          forceGetUnauthorized = true;
          res.writeHead(500).end(JSON.stringify({ status: "error", message: "Temporary gateway error" }));
          return;
        }
        if (cancelOutcome === "ambiguous-string-false") {
          ordersById[orderId] = {
            ...current,
            status: "CANCELLED",
            buyerActions: { canCancel: false },
          };
          res.end(
            JSON.stringify({
              status: "success",
              message: "Order cancelled",
              data: {
                order: {
                  ...current,
                  status: "CANCELLED",
                  buyerActions: { canCancel: "false" },
                },
              },
            }),
          );
          return;
        }
        if (cancelOutcome === "conflict409-still-eligible" && cancelPostCount === 1) {
          res.writeHead(409).end(JSON.stringify({ status: "fail", message: "Please retry." }));
          return;
        }
        if (cancelOutcome === "conflict409") {
          ordersById[orderId] = {
            ...current,
            status: "PROCESSING",
            buyerActions: { canCancel: false },
          };
          res.writeHead(409).end(JSON.stringify({ status: "fail", message: "Order is already being prepared." }));
          return;
        }
        if (cancelOutcome === "ambiguous500-cancelled") {
          ordersById[orderId] = {
            ...current,
            status: "CANCELLED",
            buyerActions: { canCancel: false },
          };
          res.writeHead(500).end(JSON.stringify({ status: "error", message: "Temporary gateway error" }));
          return;
        }
        if (cancelOutcome === "ambiguous500-refunded") {
          ordersById[orderId] = {
            ...current,
            status: "REFUNDED",
            buyerActions: { canCancel: false },
          };
          res.writeHead(500).end(JSON.stringify({ status: "error", message: "Temporary gateway error" }));
          return;
        }
        if (cancelOutcome === "ambiguous500-pending") {
          res.writeHead(500).end(JSON.stringify({ status: "error", message: "Temporary gateway error" }));
          return;
        }

        completeSuccess();
        return;
      }

      res.writeHead(404).end(JSON.stringify({ status: "fail", message: `Unhandled fixture route: ${url.pathname}` }));
    });

    await new Promise<void>((resolve) => backendServer!.listen(BACKEND_PORT, "127.0.0.1", () => resolve()));

    const nextBin = path.resolve("node_modules/next/dist/bin/next");
    frontendProcess = spawn(
      process.execPath,
      [nextBin, "start", "-H", "127.0.0.1", "-p", String(FRONTEND_PORT)],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          INTERNAL_BACKEND_URL: `${BACKEND_ORIGIN}/api/v1`,
          NEXT_PUBLIC_API_URL: `${BACKEND_ORIGIN}/api/v1`,
        },
        stdio: "ignore",
      },
    );

    await waitForServer(`${FRONTEND_ORIGIN}/auth/login`);
  });

  test.afterAll(async () => {
    if (frontendProcess && !frontendProcess.killed) {
      frontendProcess.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
      if (!frontendProcess.killed) frontendProcess.kill("SIGKILL");
    }
    if (backendServer) {
      await new Promise<void>((resolve) => backendServer!.close(() => resolve()));
    }
  });

  async function signInAsBuyer(page: Page, nextPath = "/account/orders/ord-1") {
    await page.context().clearCookies();
    await page.goto(`${FRONTEND_ORIGIN}/auth/login?next=${encodeURIComponent(nextPath)}`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("textbox", { name: /email/i }).fill("buyer@example.test");
    await page.getByRole("textbox", { name: "Password" }).fill("BuyerPass123!");
    await page.getByRole("button", { name: /continue to your account/i }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/account"), { timeout: 15_000 });
  }

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`keep, confirm, duplicate-click guard, and return-to-orders at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      resetFixtureState();
      await page.setViewportSize(viewport);
      await signInAsBuyer(page, "/account/orders");
      await page.waitForSelector(`text=ZG-1001`);

      await page.locator("#buyer-order-link-ord-1").click();
      await expect(page).toHaveURL(/\/account\/orders\/ord-1/);

      const cancelTrigger = page.getByRole("button", { name: "Cancel order" });
      await expect(cancelTrigger).toBeVisible();
      await cancelTrigger.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Cancel order #ZG-1001?");
      await expect(dialog).toContainText("whole order");
      const keepButton = dialog.getByRole("button", { name: "Keep order" });
      await expect(keepButton).toBeFocused();

      await page.screenshot({
        path: path.resolve(`output/playwright/buyer-order-cancel/dialog-${viewport.width}x${viewport.height}.png`),
        fullPage: false,
      });

      // Keep order sends 0 POSTs and restores focus to trigger
      await keepButton.click();
      await expect(dialog).toHaveCount(0);
      expect(cancelPostCount).toBe(0);
      await expect(cancelTrigger).toBeFocused();

      // Escape sends 0 POSTs and restores focus to trigger
      await cancelTrigger.click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(cancelPostCount).toBe(0);
      await expect(cancelTrigger).toBeFocused();

      // Confirm cancellation with duplicate-click guard
      cancelOutcome = "delayed-success";
      await cancelTrigger.click();
      const confirmButton = page.getByRole("dialog").getByRole("button", { name: /Confirm cancellation|Cancelling/i });
      await confirmButton.click();
      await expect(confirmButton).toBeDisabled();
      await confirmButton.click({ force: true });
      await expect.poll(() => cancelPostCount).toBe(1);

      releaseDelayedCancel?.();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
      await expect(page.getByText("Your order has been cancelled.")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Order Cancelled" })).toBeVisible();

      await page.screenshot({
        path: path.resolve(`output/playwright/buyer-order-cancel/cancelled-${viewport.width}x${viewport.height}.png`),
        fullPage: false,
      });

      await page.getByRole("link", { name: "Back to Orders" }).click();
      await expect(page).toHaveURL(/\/account\/orders/);
      const orderCard = page.locator("[data-order-history-list] > *").filter({ hasText: "ZG-1001" }).first();
      await expect(orderCard).toContainText(/cancelled/i);
    });
  }

  test("denied/malformed capabilities, 403 hide, 401 sign-in, 409 refresh, and ambiguous reconciliation", async ({ page }) => {
    resetFixtureState();
    await page.setViewportSize({ width: 390, height: 844 });

    // Ineligible & malformed buyerActions -> no Cancel button
    await signInAsBuyer(page, "/account/orders/ord-blocked");
    await expect(page.getByText("#ZG-1003")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-malformed`, { waitUntil: "networkidle" });
    await expect(page.getByText("#ZG-1004")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    // 409 conflict refreshes order and removes Cancel button when no longer eligible
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-1`, { waitUntil: "networkidle" });
    cancelOutcome = "conflict409";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/This order changed and can no longer be cancelled online/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    // 409 serialization conflict where GET returns still eligible: reconciles copy, 1 POST until deliberate reconfirmation
    resetFixtureState();
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-1`, { waitUntil: "networkidle" });
    cancelOutcome = "conflict409-still-eligible";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/Your cancellation could not be completed because the order was updated at the same time\. Select Cancel order to try again\./i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();
    expect(cancelPostCount).toBe(1);
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByText("Your order has been cancelled.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
    expect(cancelPostCount).toBe(2);

    // Ambiguous 500 -> reconciled CANCELLED
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-2`, { waitUntil: "networkidle" });
    cancelOutcome = "ambiguous500-cancelled";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByText("Order cancellation was confirmed.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order Cancelled" })).toBeVisible();

    // Ambiguous 500 -> reconciled REFUNDED
    resetFixtureState();
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-2`, { waitUntil: "networkidle" });
    cancelOutcome = "ambiguous500-refunded";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByText("This order is marked as refunded.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order Refunded" })).toBeVisible();

    // Ambiguous 500 -> still PENDING -> locks retransmission + Check order status GET-only
    resetFixtureState();
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-2`, { waitUntil: "networkidle" });
    cancelOutcome = "ambiguous500-pending";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
    const checkStatusButton = page.getByRole("button", { name: "Check order status" });
    await expect(checkStatusButton).toBeVisible();

    const postsBeforeCheck = cancelPostCount;
    const getsBeforeCheck = getOrderCount;
    ordersById["ord-2"] = { ...ordersById["ord-2"], status: "CANCELLED", buyerActions: { canCancel: false } };
    await checkStatusButton.click();
    await expect(page.getByText("Order cancellation was confirmed.")).toBeVisible();
    expect(cancelPostCount).toBe(postsBeforeCheck);
    expect(getOrderCount).toBe(getsBeforeCheck + 1);

    // Ambiguous POST with string "false" canCancel -> rejects POST envelope (1 POST) and reconciles via GET
    resetFixtureState();
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-1`, { waitUntil: "networkidle" });
    cancelOutcome = "ambiguous-string-false";
    const getsBeforeAmbiguous = getOrderCount;
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByText("Order cancellation was confirmed.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Order Cancelled" })).toBeVisible();
    expect(cancelPostCount).toBe(1);
    expect(getOrderCount).toBeGreaterThanOrEqual(getsBeforeAmbiguous + 1);

    // CSRF 403 keeps invoice visible and allows deliberate second click
    resetFixtureState();
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-1`, { waitUntil: "networkidle" });
    cancelOutcome = "csrf-then-success";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByText(/verification expired/i)).toBeVisible();
    expect(cancelPostCount).toBe(1);
    await expect(page.getByText("+260971000111")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByText("Your order has been cancelled.")).toBeVisible();
    expect(cancelPostCount).toBe(2);

    // 401 on cancel -> 1 POST, clears PII & Cancel button, renders usable Sign in recovery
    resetFixtureState();
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-1`, { waitUntil: "networkidle" });
    cancelOutcome = "unauthorized401";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByText(/Your session expired/i)).toBeVisible();
    expect(cancelPostCount).toBe(1);
    await expect(page.getByText("+260971000111")).toHaveCount(0);
    await expect(page.getByText(/Plot 12, Kabulonga/)).toHaveCount(0);
    await expect(page.getByText("#ZG-1001")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?reason=signin-again/);

    // 401 on reconciliation GET (after POST 500) -> 1 POST, clears PII & Cancel button, navigates to Sign in
    resetFixtureState();
    await signInAsBuyer(page, "/account/orders/ord-1");
    cancelOutcome = "reconcile-401";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
    expect(cancelPostCount).toBe(1);
    await expect(page.getByText("+260971000111")).toHaveCount(0);
    await expect(page.getByText(/Plot 12, Kabulonga/)).toHaveCount(0);
    await expect(page.getByText("#ZG-1001")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);

    // 403 non-CSRF -> hides private order detail & Cancel button
    resetFixtureState();
    await signInAsBuyer(page, "/account/orders/ord-1");
    cancelOutcome = "forbidden403";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
    await expect(page.getByText("#ZG-1001")).toHaveCount(0);
  });

  test("switch-away from Order A to Order B while cancel is pending discards late result", async ({ page }) => {
    resetFixtureState();
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsBuyer(page, "/account/orders/ord-1");
    await expect(page.getByText("#ZG-1001")).toBeVisible();

    cancelOutcome = "delayed-success";
    await page.getByRole("button", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm cancellation" }).click();
    await expect.poll(() => cancelPostCount).toBe(1);

    // Navigate away to Order B while Order A cancel is still in flight
    await page.goto(`${FRONTEND_ORIGIN}/account/orders/ord-2`, { waitUntil: "networkidle" });
    await expect(page.getByText("#ZG-1002")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();

    // Now resolve the stale Order A response; Order B must remain unaffected
    releaseDelayedCancel?.();
    await page.waitForTimeout(200);
    await expect(page.getByText("#ZG-1002")).toBeVisible();
    await expect(page.getByText("Your order has been cancelled.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cancel order" })).toBeVisible();
  });
});
