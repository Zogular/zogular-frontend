import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import type { AdminOrderRecord } from "../src/services/admin/orders";

const origin = "http://127.0.0.1:3238";
const orderNumber = "ZG-FIXTURE-001";
const timestamp = "2026-11-24T10:00:00.000Z";
const seller = { userId: "seller-fixture", storeName: null, applicationStatus: "APPROVED" };
const maskedOrder = {
  id: "order-fixture", orderNumber, status: "CONFIRMED",
  createdAt: timestamp, updatedAt: timestamp, deliveredAt: null,
  estimatedDelivery: null, trackingNumber: null,
  customer: { id: "buyer-fixture" },
  payment: { method: "CASH_ON_DELIVERY", collectionMode: "COD", commitmentFeeStatus: "PENDING" },
  totals: { itemSubtotal: 150, deliveryFeeAmount: 40, cashDueOnDelivery: 190, grandTotalAmount: 190 },
  delivery: { method: "delivery", trackingMode: "MANUAL_ONLY" },
  items: [{
    id: "item-fixture", productId: "product-fixture", title: "Fixture desk lamp",
    slug: "fixture-desk-lamp", quantity: 1, price: 150, lineTotal: 150,
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

test.use({ channel: "chrome", serviceWorkers: "block" });
test.describe.configure({ mode: "default", timeout: 120_000 });

let backend: Server;
let next: ChildProcess | undefined;

test.beforeAll(async () => {
  // The server validates the synthetic admin token and returns the corresponding DTO shape.
  backend = createServer((request, response) => {
    const url = new URL(request.url ?? "/", origin);
    const privileged = request.headers.authorization === "Bearer orders-operations";
    const masked = request.headers.authorization === "Bearer orders-tech";
    response.setHeader("Content-Type", "application/json");
    if (!privileged && !masked) {
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
      if (search === "fixture-forbidden") {
        response.writeHead(403).end(JSON.stringify({ status: "fail", message: "Fixture access denied" }));
        return;
      }
      const order = privileged
        ? search === "fixture-empty-note" ? { ...privilegedOrder, notes: null } : privilegedOrder
        : maskedOrder;
      response.end(JSON.stringify({ status: "success", data: { orders: [order] },
        pagination: { total: 1, page: 1, limit: 12, pages: 1 } }));
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

for (const width of [1440, 390]) {
  for (const privileged of [false, true]) {
    test(`${privileged ? "privileged" : "masked"} Order Queue and drawer at ${width}px`, async ({ page, context }, testInfo) => {
      const pageErrors: Error[] = [];
      page.on("pageerror", (error) => pageErrors.push(error));
      await context.route("**/*", (route) => new URL(route.request().url()).origin === origin
        ? route.continue() : route.abort());
      await context.addCookies([{ name: "zogular_admin_session",
        value: privileged ? "orders-operations" : "orders-tech", url: origin }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/admin/orders`);

      const queue = width === 1440 ? page.getByRole("table") : page;
      await expect(queue.getByText(orderNumber, { exact: true }).filter({ visible: true })).toBeVisible();
      await expect(queue.getByText(privileged ? "Fixture Buyer" : "Restricted", { exact: true })
        .filter({ visible: true }).first()).toBeVisible();
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
        const search = page.getByPlaceholder(/Search order ID/);
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
