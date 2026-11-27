import { expect, test, type BrowserContext, type Response } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AdminOrderRecord } from "../src/services/admin/orders";

const origin = "http://127.0.0.1:3238";
const orderNumber = "ZG-FIXTURE-001";
const rejectedNote = "Synthetic permission rejection";
const unconfirmedNote = "Synthetic service interruption";
const validationNote = "Synthetic validation rejection";
const conflictNote = "Synthetic stale fulfillment attempt";
const concurrentReference = "FIXTURE-CONCURRENT-HANDOFF";
const internalDiagnostic = "Fixture internal fulfillment diagnostic";
const timestamp = "2026-11-24T10:00:00.000Z";
const concurrentTimestamp = "2026-11-24T10:05:00.000Z";
const seller = { userId: "seller-fixture", storeName: null, applicationStatus: "APPROVED" };
const totals = { itemSubtotal: 123_456_789.99, deliveryFeeAmount: 12_345_678.9,
  cashDueOnDelivery: 123_456_789.99, grandTotalAmount: 135_802_468.89 };
const metrics = [
  { title: "Grand Total", amount: "K135,802,468.89", note: "Total recorded for this order" },
  { title: "Delivery Fee", amount: "K12,345,678.9", note: "Collected before dispatch where required" },
  { title: "Cash on Delivery", amount: "K123,456,789.99", note: "Collected at handoff" },
];
const maskedOrder = {
  id: "order-fixture", orderNumber, status: "CONFIRMED",
  createdAt: timestamp, updatedAt: timestamp, deliveredAt: null,
  estimatedDelivery: null, trackingNumber: null,
  customer: { id: "buyer-fixture" },
  payment: { method: "CASH_ON_DELIVERY", collectionMode: "COD", commitmentFeeStatus: "PENDING" },
  totals,
  delivery: { method: "delivery", trackingMode: "MANUAL_ONLY" },
  items: [{
    id: "item-fixture", productId: "product-fixture", title: "Fixture desk lamp",
    slug: "fixture-desk-lamp", quantity: 1, price: totals.itemSubtotal, lineTotal: totals.itemSubtotal,
    vendorId: seller.userId, vendorStatus: "PENDING", seller,
  }],
  sellerSummaries: [{ ...seller, itemCount: 1 }],
} satisfies AdminOrderRecord;

const privilegedOrder = {
  ...maskedOrder,
  notes: "Fixture dispatch note",
  customer: { ...maskedOrder.customer, name: "Fixture Buyer", email: "buyer@example.test", phone: null },
  delivery: {
    ...maskedOrder.delivery,
    shippingAddress: {
      fullName: "Fixture Recipient", phone: null, addressLine: "20 Fixture Road",
      district: "Woodlands", city: "Lusaka", postalCode: null, country: "ZM",
    },
  },
  items: maskedOrder.items.map((item) => ({ ...item, seller: { ...seller, name: "Fixture Seller" } })),
} satisfies AdminOrderRecord;

test.use({ channel: "chrome", serviceWorkers: "block", launchOptions: { args: [
  "--disable-background-networking", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
] } });
test.describe.configure({ mode: "default", timeout: 120_000 });

let backend: Server;
let next: ChildProcess | undefined;
let conflictPatchCount = 0;
let conflictReloadCount = 0;

async function restrictToFixture(context: BrowserContext) {
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  // The installed Next dev runtime needs its local HMR socket during hydration.
  const hmrUrl = `ws://${new URL(origin).host}/_next/hmr`;
  await context.routeWebSocket("**/*", (socket) =>
    socket.url().split("?")[0] === hmrUrl ? void socket.connectToServer() : socket.close());
}

test.beforeAll(async () => {
  // The server validates the synthetic admin token and returns the corresponding DTO shape.
  backend = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", origin);
    const privileged = request.headers.authorization === "Bearer orders-operations";
    const masked = request.headers.authorization === "Bearer orders-tech";
    response.setHeader("Content-Type", "application/json");
    if (request.method === "GET" && url.pathname === "/api/v1/auth/csrf-token") {
      response.setHeader("Set-Cookie", "_csrf=fixture-order-csrf; Path=/; HttpOnly; SameSite=Lax");
      response.end(JSON.stringify({ status: "success", data: { csrfToken: "fixture-order-csrf" } }));
    } else if (!privileged && !masked) {
      response.writeHead(401).end(JSON.stringify({ status: "fail" }));
    } else if (request.method === "GET" && url.pathname === "/api/v1/user/me") {
      response.end(JSON.stringify({ status: "success", data: { user: {
        id: "admin-fixture", name: "Fixture Admin", email: "admin@example.test",
        role: privileged ? "OPERATIONS" : "TECH_ADMIN",
        permissions: ["access_admin_panel", "view_all_orders", ...(privileged
          ? ["view_order_sensitive_fields", "manage_order_fulfillment"] : [])],
      } } }));
    } else if (request.method === "GET" && url.pathname === "/api/v1/admin/orders") {
      const search = url.searchParams.get("search");
      if (privileged && conflictPatchCount > 0 && search === orderNumber && ++conflictReloadCount === 1) {
        response.writeHead(503).end(JSON.stringify({ status: "fail", message: internalDiagnostic }));
        return;
      }
      if (search === "fixture-forbidden") {
        response.writeHead(403).end(JSON.stringify({ status: "fail", message: "Fixture access denied" }));
        return;
      }
      const order = privileged
        ? conflictPatchCount > 0 && search !== "ZG-FIXTURE"
          ? { ...privilegedOrder, status: "SHIPPED", updatedAt: concurrentTimestamp, trackingNumber: concurrentReference }
          : search === "fixture-empty-note" ? { ...privilegedOrder, notes: null } : privilegedOrder
        : maskedOrder;
      const status = url.searchParams.get("status");
      const orders = search === "fixture-missing" || (status && status !== order.status) ? [] : [order];
      if (privileged && conflictPatchCount > 0 && search === orderNumber) {
        orders.unshift({ ...order, id: "unrelated-order", orderNumber: "ZG-FIXTURE-001-OTHER" });
      }
      response.end(JSON.stringify({ status: "success", data: { orders },
        pagination: { total: orders.length, page: 1, limit: 12, pages: 1 } }));
    } else if (privileged && request.method === "PATCH" && url.pathname === "/api/v1/admin/orders/order-fixture/status") {
      let body = "";
      for await (const chunk of request) body += String(chunk);
      const input = JSON.parse(body) as { notes?: string };
      if (input.notes === conflictNote) {
        conflictPatchCount += 1;
        response.writeHead(409).end(JSON.stringify({ status: "fail", message: internalDiagnostic }));
        return;
      }
      if (input.notes === validationNote) {
        response.writeHead(422).end(JSON.stringify({ status: "fail", message: internalDiagnostic }));
        return;
      }
      if (input.notes !== rejectedNote && input.notes !== unconfirmedNote) {
        response.writeHead(400).end(JSON.stringify({ status: "fail", message: "Unexpected fixture update" }));
        return;
      }
      const status = input.notes === rejectedNote ? 403 : 503;
      response.writeHead(status).end(JSON.stringify({ status: "fail", message: internalDiagnostic }));
    } else {
      response.writeHead(404).end(JSON.stringify({ status: "fail" }));
    }
  }).listen(0, "127.0.0.1");
  await once(backend, "listening");
  const binding = backend.address();
  if (!binding || typeof binding === "string") throw new Error("Orders fixture did not bind TCP.");
  const backendUrl = `http://127.0.0.1:${binding.port}/api/v1`;

  next = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--webpack", "-H", "127.0.0.1", "-p", "3238"], {
    cwd: process.cwd(),
    env: { ...process.env, ADMIN_API_URL: backendUrl, INTERNAL_BACKEND_URL: backendUrl,
      NEXT_PUBLIC_API_URL: backendUrl, NEXT_PUBLIC_API_PROXY_URL: "/api/backend", NEXT_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
  });
  await expect.poll(async () => {
    if (next?.exitCode != null) throw new Error(`Next exited with code ${next.exitCode}.`);
    try {
      return (await fetch(`${origin}/admin/login`)).ok;
    } catch {
      return false;
    }
  }, { timeout: 60_000 }).toBe(true);
});

for (const width of [320, 1440]) {
  test(`reloads server fulfillment state after one conflict at ${width}px`, async ({ page, context }, testInfo) => {
    await restrictToFixture(context);
    await context.addCookies([{ name: "zogular_admin_session", value: "orders-operations", url: origin }]);
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    const queue = width === 1440 ? page.getByRole("table").filter({ visible: true }) : page;
    const openOrder = queue.getByRole("button", { name: "Open order" });
    const drawer = page.getByRole("dialog", { name: orderNumber });
    const reference = drawer.getByLabel("External courier reference");
    const apply = drawer.getByRole("button", { name: "Apply fulfillment update" });
    const patchResponses: number[] = [];
    const isStatusPatch = (result: Response) =>
      result.request().method() === "PATCH" && new URL(result.url()).pathname.endsWith("/admin/orders/order-fixture/status");
    page.on("response", (result) => {
      if (isStatusPatch(result)) patchResponses.push(result.status());
    });

    try {
      await page.goto(`${origin}/admin/orders`);
      await expect(openOrder).toBeVisible({ timeout: 30_000 });
      const statusFilter = page.getByRole("combobox", { name: "Filter by order status" });
      if (width === 1440) {
        const filtered = page.waitForResponse((result) => new URL(result.url()).searchParams.get("status") === "CONFIRMED");
        await statusFilter.selectOption("CONFIRMED");
        expect((await filtered).status()).toBe(200);
      }
      await openOrder.click();
      await drawer.getByLabel("Next status").selectOption("PROCESSING");
      await reference.fill("FIXTURE-STALE-DISPATCH");
      await drawer.getByLabel("Operations notes").fill(conflictNote);
      const rejection = page.waitForResponse(isStatusPatch);
      await apply.click();
      const response = await rejection;
      expect(response.status()).toBe(409);
      expect(await response.json()).toMatchObject({ message: internalDiagnostic });
      const feedback = drawer.getByRole("status");
      const reload = drawer.getByRole("button", { name: "Reload order" });
      await expect(feedback).toHaveText("The order may have changed. Reload the order and check its status before trying again.");
      await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
      await expect(page.getByText(internalDiagnostic)).toHaveCount(0);
      await expect(page.getByText(/^Order moved to /)).toHaveCount(0);
      await expect(drawer).toHaveAccessibleDescription("Fixture Buyer · Confirmed");
      await expect(apply).toBeDisabled();
      await expect(drawer.getByLabel("Next status")).toBeDisabled();
      await expect(reference).toBeDisabled();
      await expect(drawer.getByLabel("Operations notes")).toBeDisabled();
      await reload.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("fulfillment-conflict.png"), animations: "disabled" });

      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await openOrder.click();
      await expect(apply).toBeDisabled();
      await expect(reference).toHaveValue("FIXTURE-STALE-DISPATCH");
      await reload.click();
      await expect(feedback).toHaveText("We couldn't reload this order. Your draft is still locked. Try reloading again.");
      await expect(page.getByText(internalDiagnostic)).toHaveCount(0);
      await expect(apply).toBeDisabled();
      await expect(reference).toHaveValue("FIXTURE-STALE-DISPATCH");
      await expect(drawer.getByLabel("Operations notes")).toHaveValue(conflictNote);
      await reload.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("fulfillment-reload-failed.png"), animations: "disabled" });

      await reload.click();
      await expect(drawer).toHaveAccessibleDescription("Fixture Buyer · Shipped");
      await expect(reference).toHaveValue(concurrentReference);
      await expect(drawer.getByLabel("Next status")).toHaveValue("");
      await expect(reference).toBeEnabled();
      await expect(apply).toBeDisabled();
      await expect(reload).toHaveCount(0);
      await reference.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("fulfillment-reloaded.png"), animations: "disabled" });
      await drawer.getByLabel("Next status").selectOption("DELIVERED");
      await expect(apply).toBeEnabled();
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      if (width === 1440) {
        await expect(statusFilter).toHaveValue("CONFIRMED");
        await expect(queue.getByRole("button", { name: "Open order" })).toHaveCount(0);
        await expect(page.getByText("ZG-FIXTURE-001-OTHER", { exact: true })).toHaveCount(0);
      } else {
        // A later queue request can still return a snapshot older than the explicit reload.
        const stale = page.waitForResponse((result) => new URL(result.url()).searchParams.get("search") === "ZG-FIXTURE");
        await page.getByPlaceholder("Search orders").fill("ZG-FIXTURE");
        expect(await (await stale).json()).toMatchObject({ data: { orders: [{ status: "CONFIRMED" }] } });
        await openOrder.click();
        await expect(drawer).toHaveAccessibleDescription("Fixture Buyer · Shipped");
        await expect(reference).toHaveValue(concurrentReference);
      }
      expect(patchResponses).toEqual([409]);
      expect(conflictPatchCount).toBe(1);
      expect(conflictReloadCount).toBe(2);
    } finally {
      conflictPatchCount = 0;
      conflictReloadCount = 0;
    }
  });
}

test("ignores a delayed queue response after a newer search", async ({ page, context }) => {
  await restrictToFixture(context);
  await context.addCookies([{ name: "zogular_admin_session", value: "orders-operations", url: origin }]);
  const oldSearchUrl = (url: URL) => url.origin === origin && url.pathname === "/api/backend/admin/orders"
    && url.searchParams.get("search") === "ZG-FIXTURE";
  const release = Promise.withResolvers<void>();
  const captured = Promise.withResolvers<void>();
  await page.route(oldSearchUrl, async (route) => {
    const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 });
    captured.resolve();
    await release.promise;
    await route.fulfill({ response });
  });

  try {
    await page.goto(`${origin}/admin/orders`);
    await expect(page.getByRole("button", { name: "Open order" }).filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    const search = page.getByPlaceholder("Search orders");
    await search.fill("ZG-FIXTURE");
    await captured.promise;
    await search.fill("fixture-missing");
    const emptyQueue = page.getByText("No orders match this control-room view", { exact: true }).filter({ visible: true });
    await expect(emptyQueue).toBeVisible();
    const delayed = page.waitForResponse((response) => oldSearchUrl(new URL(response.url())));
    release.resolve();
    expect(await (await delayed).json()).toMatchObject({ data: { orders: [{ orderNumber }] } });
    await page.evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(emptyQueue).toBeVisible();
    await expect(page.getByText(orderNumber, { exact: true })).toHaveCount(0);
  } finally {
    release.resolve();
  }
});

test.afterAll(async () => {
  if (next?.exitCode === null && next.signalCode === null) {
    const exited = once(next, "exit");
    next.kill();
    await exited;
  }
  if (backend?.listening) {
    await new Promise<void>((resolve, reject) => backend.close((error) => error ? reject(error) : resolve()));
  }
});

for (const [width, note, status, message] of [
  [320, rejectedNote, 403, "You don't have permission to update this order."],
  [1440, unconfirmedNote, 503, "We couldn't confirm the update. Reload the order and check its status before trying again."],
  [1440, validationNote, 422, "Check the status, courier reference and notes, then try again."],
] as const) {
  test(`shows safe fulfillment feedback after ${status} at ${width}px`, async ({ page, context }, testInfo) => {
    await restrictToFixture(context);
    await context.addCookies([{ name: "zogular_admin_session", value: "orders-operations", url: origin }]);
    await page.setViewportSize({ width, height: width === 320 ? 568 : 900 });
    await page.goto(`${origin}/admin/orders`);
    const queue = width === 1440 ? page.getByRole("table").filter({ visible: true }) : page;
    await queue.getByRole("button", { name: "Open order" }).click();
    const drawer = page.getByRole("dialog", { name: orderNumber });
    const nextStatus = drawer.getByLabel("Next status");
    const reference = drawer.getByLabel("External courier reference");
    const notes = drawer.getByLabel("Operations notes");
    await nextStatus.selectOption("PROCESSING");
    await reference.fill("DISPATCH-42");
    await notes.fill(note);
    const rejection = page.waitForResponse((result) =>
      result.request().method() === "PATCH" && result.url().endsWith("/admin/orders/order-fixture/status"));
    await drawer.getByRole("button", { name: "Apply fulfillment update" }).click();
    const response = await rejection;
    expect(response.status()).toBe(status);
    expect(await response.json()).toMatchObject({ message: internalDiagnostic });
    await expect(drawer.getByRole("status")).toHaveText(message);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    const apply = drawer.getByRole("button", { name: "Apply fulfillment update" });
    if (status === 503) {
      await expect(apply).toBeDisabled();
      await expect(drawer.getByRole("button", { name: "Reload order" })).toBeVisible();
    } else {
      await expect(apply).toBeEnabled();
      await expect(drawer.getByRole("button", { name: "Reload order" })).toHaveCount(0);
    }
    await expect(page.getByText(internalDiagnostic)).toHaveCount(0);
    await expect(nextStatus).toHaveValue("PROCESSING");
    await expect(reference).toHaveValue("DISPATCH-42");
    await expect(notes).toHaveValue(note);
    await page.screenshot({ path: testInfo.outputPath(`fulfillment-feedback-${width}.png`), animations: "disabled" });
  });
}

for (const [width, columns] of [[320, 1], [390, 1], [768, 2], [1024, 2], [1440, 2]]) {
  for (const privileged of [false, true]) {
    test(`${privileged ? "privileged" : "masked"} Order Queue and drawer at ${width}px`, async ({ page, context }, testInfo) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));
      await restrictToFixture(context);
      await context.addCookies([{ name: "zogular_admin_session",
        value: privileged ? "orders-operations" : "orders-tech", url: origin }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/admin/orders`);

      const queue = width >= 1024 ? page.getByRole("table").filter({ visible: true }) : page;
      await expect(queue.getByText(orderNumber, { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(queue.getByText(privileged ? "Fixture Buyer" : "Restricted", { exact: true })
        .filter({ visible: true }).first()).toBeVisible();
      const search = page.getByPlaceholder("Search orders", { exact: true });
      if (width === 320) {
        const header = page.locator("header").filter({ has: page.getByTestId("admin-command-trigger") });
        const title = header.getByText("Orders and Fulfillment", { exact: true });
        await expect(title).toBeInViewport({ ratio: 1 });
        await expect.poll(() => title.evaluate((element) => {
          const available = element.getBoundingClientRect();
          const text = document.createRange();
          text.selectNodeContents(element);
          const fragments = Array.from(text.getClientRects());
          return fragments.length > 0 && fragments.every((fragment) =>
            fragment.left >= available.left - 1 && fragment.right <= available.right + 1);
        })).toBe(true);
        for (const control of ["admin-menu-button", "admin-command-trigger", "admin-notification-trigger"]) {
          await expect(header.getByTestId(control)).toBeInViewport({ ratio: 1 });
        }
        await expect(header.getByRole("button", { name: /open admin profile/i })).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: testInfo.outputPath("orders-header-320.png"), animations: "disabled" });
        await search.scrollIntoViewIfNeeded();
        await expect(search).toBeInViewport({ ratio: 1 });
        await expect(search).toHaveValue("");
        const { textWidth, availableWidth } = await search.evaluate((input: HTMLInputElement) => {
          const style = getComputedStyle(input);
          const placeholder = getComputedStyle(input, "::placeholder");
          const canvas = document.createElement("canvas").getContext("2d")!;
          canvas.font = `${placeholder.fontWeight} ${placeholder.fontSize} ${placeholder.fontFamily}`;
          return {
            textWidth: canvas.measureText(input.placeholder).width,
            availableWidth: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          };
        });
        expect(textWidth).toBeGreaterThan(0);
        expect(textWidth).toBeLessThanOrEqual(availableWidth);
        await page.screenshot({ path: testInfo.outputPath("orders-search-320.png"), animations: "disabled" });
      }
      if (width === 1440) {
        await expect(queue.getByText(privileged ? "Woodlands, Lusaka" : "Restricted", { exact: true }))
          .toHaveCount(privileged ? 1 : 4);
        await expect(queue.getByText("Phone not recorded")).toHaveCount(privileged ? 1 : 0);
      }
      const openOrder = queue.getByRole("button", { name: "Open order" });
      await openOrder.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("queue.png"), animations: "disabled" });

      await openOrder.click();
      const drawer = page.getByRole("dialog", { name: orderNumber });
      await expect(drawer.getByText("Fixture desk lamp")).toBeVisible();
      const summary = drawer.getByRole("group", { name: "Order totals" });
      const cards = summary.locator(":scope > div");
      await expect(cards).toHaveCount(metrics.length);
      for (const [index, { title, amount, note }] of metrics.entries()) {
        const card = cards.nth(index);
        await expect(card.getByText(title, { exact: true })).toBeVisible();
        await expect(card.getByRole("heading", { name: amount, exact: true })).toBeVisible();
        await expect(card.getByText(note, { exact: true })).toBeVisible();
        await expect(card.locator("svg")).toBeVisible();
      }
      // Check rendered text fragments too: a block can fit while its unbroken text spills.
      await expect.poll(() => summary.evaluate((grid) => {
        const sheet = grid.closest('[role="dialog"]')!;
        const bounds = grid.getBoundingClientRect();
        const inside = (outer: DOMRect, inner: DOMRect) => inner.left >= outer.left - 0.5
          && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;
        const cards = Array.from(grid.children);
        const positions = cards.map((card) => Math.round(card.getBoundingClientRect().left - bounds.left));
        let drawerOverflow = 0;
        for (let parent: Element | null = grid; parent; parent = parent.parentElement) {
          drawerOverflow = Math.max(drawerOverflow, parent.scrollWidth - parent.clientWidth);
          if (parent === sheet) break;
        }
        return {
          columns: new Set(positions).size,
          drawerOverflow,
          drawerOnScreen: sheet.getBoundingClientRect().left >= -0.5
            && sheet.getBoundingClientRect().right <= window.innerWidth + 0.5,
          fit: cards.map((card) => {
            const frame = card.getBoundingClientRect();
            const icon = card.querySelector("svg")!;
            const label = card.querySelector("p")!;
            return inside(bounds, frame) && card.scrollWidth === card.clientWidth
              && inside(frame, icon.parentElement!.getBoundingClientRect())
              && inside(icon.parentElement!.getBoundingClientRect(), icon.getBoundingClientRect())
              && label.getBoundingClientRect().right <= icon.parentElement!.getBoundingClientRect().left
              && Array.from(card.querySelectorAll("p, h3")).every((text) => {
                const range = document.createRange();
                range.selectNodeContents(text);
                const fragments = Array.from(range.getClientRects());
                return fragments.length > 0 && fragments.every((fragment) => inside(frame, fragment));
              });
          }),
        };
      })).toEqual({ columns, drawerOverflow: 0, drawerOnScreen: true, fit: [true, true, true] });
      if (privileged) {
        for (const text of ["Name: Fixture Buyer", "Email: buyer@example.test", "Address: 20 Fixture Road",
          "Area: Woodlands, Lusaka", "Order note: Fixture dispatch note", "Fixture Seller · Vendor item status Pending"]) {
          await expect(drawer.getByText(text, { exact: true })).toBeVisible();
        }
        await expect(drawer.getByText("Phone: Not recorded", { exact: true })).toHaveCount(2);
        await expect(drawer.getByLabel("Operations notes")).toHaveValue("Fixture dispatch note");
      } else {
        for (const text of ["Name: Restricted", "Email: Restricted", "Phone: Restricted", "Shipping address: Restricted",
          "Order note: Restricted", "Restricted · Vendor item status Pending"]) {
          await expect(drawer.getByText(text, { exact: true })).toBeVisible();
        }
        await expect(drawer.getByText(/Fixture Buyer|buyer@example\.test|20 Fixture Road|Fixture Seller|Fixture dispatch note/)).toHaveCount(0);
        await expect(drawer.getByText(/read-only order access/)).toBeVisible();
        await expect(drawer.getByLabel("Operations notes")).toHaveCount(0);
      }
      await page.screenshot({ path: testInfo.outputPath("drawer.png"), animations: "disabled" });
      await drawer.getByText(/^Order note:/).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("drawer-details.png"), animations: "disabled" });
      expect(pageErrors).toEqual([]);

      if (width === 1440) {
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
        if (privileged) {
          const response = page.waitForResponse((result) => result.url().includes("search=fixture-empty-note"));
          await search.fill("fixture-empty-note");
          await response;
          await queue.getByRole("button", { name: "Open order" }).click();
          await expect(drawer.getByText("Order note: Not recorded", { exact: true })).toBeVisible();
        } else {
          await search.fill("fixture-forbidden");
          await expect(queue.getByRole("button", { name: "Retry queue load" })).toBeVisible();
          await expect(queue.getByText(orderNumber, { exact: true })).toHaveCount(0);
        }
      }
    });
  }
}
