import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const baseUrl = process.env.TEST_BASE_URL;
const productId = "fixture-product";
const productTitle = "Fixture stock item";
const orderId = "fixture-order";
const orderNumber = "ZG-FIXTURE";
const timestamp = "2026-08-21T12:00:00.000Z";
type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

test.use({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
test.skip(!baseUrl, "Set TEST_BASE_URL to an isolated loopback Next.js server.");

async function installFixtures(context: BrowserContext) {
  const origin = new URL(baseUrl!).origin;
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw new Error("Only an explicit IPv4 loopback test origin is allowed.");

  const state = {
    stock: 4,
    orderStatus: "PENDING" as OrderStatus,
    failCancellation: false,
    failStock: false,
    productReads: 0,
    attemptedStock: [] as number[],
  };
  const order = () => ({
    id: orderId,
    orderNumber,
    status: state.orderStatus,
    sellerStatus: state.orderStatus,
    allowedSellerTransitions: state.orderStatus === "PENDING" ? ["CONFIRMED", "CANCELLED"]
      : state.orderStatus === "CONFIRMED" ? ["CANCELLED"] : [],
    totalAmount: 10,
    createdAt: timestamp,
    updatedAt: timestamp,
    user: { firstName: "Fixture", lastName: "Buyer" },
    sellerVisibleTotals: { subtotal: 10, shipping: null, discount: null, total: 10 },
    items: [{
      id: "fixture-item", productId, quantity: 1, price: 10, vendorStatus: state.orderStatus,
      product: { id: productId, title: productTitle, images: [], category: "ELECTRONICS" },
    }],
  });
  const product = () => ({
    id: productId, title: productTitle, slug: productId, description: "Synthetic fixture",
    price: 10, category: "ELECTRONICS", categorySlug: "electronics", condition: "NEW",
    images: [], status: "PUBLISHED", stock: state.stock, isSold: false, lowStockThreshold: 2,
    createdAt: timestamp, updatedAt: timestamp,
  });

  // Abort external traffic and fulfill every backend path here; no API write reaches the server.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/backend/")) {
      return url.pathname.startsWith("/api/") ? route.abort() : route.continue();
    }

    const path = url.pathname.slice("/api/backend".length);
    const pagination = { total: 1, page: 1, limit: Number(url.searchParams.get("limit") ?? 20), pages: 1 };
    const success = (data: unknown) => route.fulfill({ json: { status: "success", data } });
    if (path === "/user/me") {
      return success({ user: { id: "fixture-seller", firstName: "Fixture", email: "seller@example.test", role: "vendor" } });
    }
    if (path === "/vendor/applications/me") {
      return success({ application: { id: "fixture-application", status: "APPROVED", storeName: "Fixture shop" } });
    }
    if (path === "/auth/csrf-token") return success({ csrfToken: "synthetic-csrf" });
    if (path === "/vendor/products" && request.method() === "GET") {
      state.productReads += 1;
      const stock = { inStock: Number(state.stock > 2), lowStock: Number(state.stock > 0 && state.stock <= 2), outOfStock: Number(state.stock === 0) };
      return route.fulfill({ json: { status: "success", pagination, data: {
        products: [product()],
        summary: { total: 1, buyerVisible: 1, pendingReview: 0, lowStock: stock.lowStock, outOfStock: stock.outOfStock },
        facets: { categories: [], statuses: { PUBLISHED: 1 }, stock },
      } } });
    }
    if (path === "/vendor/orders" && request.method() === "GET") {
      const cancelled = Number(state.orderStatus === "CANCELLED");
      return route.fulfill({ json: { status: "success", pagination, data: {
        orders: [order()],
        summary: { totalOrders: 1, activeOrders: 1 - cancelled, completedOrders: 0, cancelledOrders: cancelled, refundedOrders: 0 },
        facets: { statuses: [{ status: state.orderStatus, count: 1 }] },
      } } });
    }
    if (path === `/vendor/orders/${orderId}` && request.method() === "GET") return success({ order: order() });
    if (path === `/vendor/orders/${orderId}/status` && request.method() === "PATCH") {
      const { status } = request.postDataJSON() as { status: OrderStatus };
      if (status === "CANCELLED" && state.failCancellation) {
        return route.fulfill({ status: 409, json: { status: "fail", message: "Fixture cancellation failed." } });
      }
      if (status === "CANCELLED") state.stock += 1;
      state.orderStatus = status;
      return success({ order: order() });
    }
    if (path === `/vendor/products/${productId}/stock` && request.method() === "PATCH") {
      const { stock } = request.postDataJSON() as { stock: number };
      state.attemptedStock.push(stock);
      if (state.failStock) return route.fulfill({ status: 409, json: { status: "fail", message: "Fixture stock update failed." } });
      state.stock = stock;
      return success({ inventory: { id: productId, stock } });
    }
    return route.fulfill({ status: 404, json: { status: "fail", message: "Unmatched fixture request." } });
  });
  return state;
}

function stockInput(page: Page) {
  return page.getByRole("spinbutton").filter({ visible: true });
}

async function navigate(page: Page, label: "Inventory" | "Orders" | "Products") {
  await page.getByRole("link", { name: label, exact: true }).filter({ visible: true }).first().click();
}

async function expectCatalogStock(page: Page, stock: number) {
  await navigate(page, "Products");
  await expect(page.getByText(`${stock} in stock`, { exact: true }).filter({ visible: true })).toBeVisible();
  await navigate(page, "Inventory");
  await expect(stockInput(page)).toHaveValue(String(stock));
}

async function openStockWorkspace(page: Page, context: BrowserContext) {
  const state = await installFixtures(context);
  // Freeze Date.now so a warm query cannot pass the test by naturally expiring.
  await page.clock.setFixedTime(new Date(timestamp));
  await page.goto(new URL("/seller/inventory", baseUrl!).href);
  await expect(stockInput(page)).toHaveValue("4");
  return state;
}

test("detail acceptance does not refetch stock, but confirmed cancellation refreshes both cached views", async ({ page, context }) => {
  const state = await openStockWorkspace(page, context);
  await expectCatalogStock(page, 4);
  const warmReads = state.productReads;
  await navigate(page, "Orders");
  await page.locator(`a[href^="/seller/orders/${orderId}?"]`).filter({ visible: true }).first().click();
  const detailUrl = page.url();
  await page.getByRole("button", { name: "Accept order", exact: true }).click();
  await expect(page.getByText("Order updated to Confirmed.")).toBeVisible();

  await expectCatalogStock(page, 4);
  expect(state.productReads).toBe(warmReads);

  await navigate(page, "Orders");
  await page.locator(`a[href^="/seller/orders/${orderId}?"]`).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(detailUrl);
  await page.getByRole("button", { name: "Cancel", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(page.getByText("Order updated to Cancelled.")).toBeVisible();
  await expectCatalogStock(page, 5);
});

test("collection cancellation updates stock only after success", async ({ page, context }) => {
  const state = await openStockWorkspace(page, context);
  await expectCatalogStock(page, 4);
  const warmReads = state.productReads;
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Cancel order", exact: true });
  const openCancellation = async () => {
    await navigate(page, "Orders");
    await page.getByRole("button", { name: `Actions for order ${orderNumber}` }).filter({ visible: true }).first().click();
    await page.getByText("Cancel order", { exact: true }).click();
  };

  await openCancellation();
  state.failCancellation = true;
  await confirm.click();
  await expect(page.getByText("Fixture cancellation failed.")).toBeVisible();
  await dialog.getByRole("button", { name: "Keep order" }).click();
  await expectCatalogStock(page, 4);
  expect(state.productReads).toBe(warmReads);

  state.failCancellation = false;
  await openCancellation();
  await confirm.click();
  await expect(page.getByText(`Order ${orderNumber} cancelled.`)).toBeVisible();
  await expectCatalogStock(page, 5);
});

for (const entry of ["inline", "menu"] as const) {
  test(`failed ${entry} stock save keeps the draft and retries the same value`, async ({ page, context }) => {
    if (entry === "inline") await page.setViewportSize({ width: 390, height: 844 });
    const state = await openStockWorkspace(page, context);
    const stock = stockInput(page);
    const save = page.getByRole("button", { name: `Save stock for ${productTitle}` }).filter({ visible: true });
    state.failStock = true;
    const draft = entry === "inline" ? 7 : 2;
    if (entry === "inline") {
      await stock.fill(String(draft));
      await save.click();
    } else {
      await page.getByRole("button", { name: "Open inventory actions" }).filter({ visible: true }).click();
      await page.getByText("Restock to Threshold", { exact: true }).click();
    }
    await expect(page.getByText("Fixture stock update failed.")).toBeVisible();
    await expect(stock).toHaveValue(String(draft));
    await expect(save).toBeEnabled();
    expect(state.stock).toBe(4);
    state.failStock = false;
    await save.click();
    await expect(page.getByText("Stock updated successfully.")).toBeVisible();
    await expect(save).toHaveCount(0);
    await expect(stock).toHaveValue(String(draft));
    expect(state.attemptedStock).toEqual([draft, draft]);
  });
}
