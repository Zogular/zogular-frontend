import { expect, test as base, type Locator, type Page, type TestInfo } from "@playwright/test";
import type { BackendOrder } from "../src/types/backend-order";
import {
  auditAction,
  auditKeyboardFocus,
  auditPageLayout,
  containAuditNetwork,
  loopbackAuditOrigin,
} from "./helpers/ui-audit-checks";

const configuredOrigin = process.env.TEST_BASE_URL;
const origin = configuredOrigin ? loopbackAuditOrigin(configuredOrigin) : undefined;
const channel = process.env.PLAYWRIGHT_CHANNEL?.trim() || (process.platform === "win32" ? "msedge" : undefined);
const mobile = { width: 320, height: 568 };
const viewports = [
  mobile,
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];
const fullListCount = 12;
const ordersPath = "/account/orders";
const proxyPrefix = "/api/backend";
const internalError = "FIXTURE_INTERNAL_ORDER_DIAGNOSTIC: SyntheticOrderError at fixture/orders.ts:42";
const parserError = "Order list response is missing pagination.";

const buyer = {
  id: "buyer-1", firstName: "Buyer", lastName: "One", email: "buyer@example.test", role: "buyer",
};
const order: BackendOrder = {
  id: "00000000-0000-4000-8000-000000000042",
  orderNumber: "ZMO-AUDIT-0042",
  userId: buyer.id,
  status: "PROCESSING",
  totalAmount: 180,
  paymentMethod: "CASH_ON_DELIVERY",
  paymentCollectionMode: "DELIVERY_FEE_THEN_CASH",
  deliveryFeeAmount: 35,
  cashDueOnDelivery: 180,
  grandTotalAmount: 215,
  commitmentFeeStatus: "PENDING",
  shippingAddress: { addressLine: "Fixture delivery address", district: "Kabulonga", city: "Lusaka" },
  deliveryMethod: "standard",
  createdAt: "2026-11-21T10:00:00Z",
  updatedAt: "2026-11-21T10:00:00Z",
  items: [{
    id: "order-item-1", productId: "product-1", quantity: 2, price: 90, lineTotal: 180,
    vendorId: "seller-1", vendorStatus: "PENDING",
    product: { id: "product-1", title: "Fixture Desk Lamp", images: ["/brand/zogular-icon-192.png"] },
  }],
};
// Place the target below the fold at every viewport without adding artificial page height.
const earlierOrders = Array.from({ length: fullListCount - 1 }, (_, index) => ({
  ...order,
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  orderNumber: `ZMO-AUDIT-PRIOR-${index + 1}`,
}));
const detailPath = `${ordersPath}/${order.id}`;

type OrderFixture = { listStatus: 200 | 503 | "malformed"; detailStatus: 200 | 403 | 404 | 503; listCount: 0 | 1 | typeof fullListCount; listReads: number; detailReads: number };

// Only the named browser API reads below are allowed; unknown API routes and writes never reach Next's proxy.
const test = base.extend<{ orderFixture: OrderFixture }>({
  orderFixture: async ({ context, page }, runWithFixture) => {
    if (!origin) throw new Error("TEST_BASE_URL must point to the isolated loopback frontend.");
    const fixture: OrderFixture = { listStatus: 200, detailStatus: 200, listCount: 1, listReads: 0, detailReads: 0 };
    const unexpectedRequests: string[] = [];
    const pageErrors: string[] = [];
    await containAuditNetwork(context, [origin]);
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await context.route("**/*", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const local = url.origin === origin;
      const method = request.method();
      const ok = (json: object) => route.fulfill({ status: 200, json });
      const fail = (status: number) => route.fulfill({ status, json: { status: "fail", message: internalError } });

      if (local && method === "GET") {
        switch (url.pathname) {
          case `${proxyPrefix}/user/me`:
            return ok({ status: "success", data: { user: buyer } });
          case `${proxyPrefix}/orders`:
            if (url.searchParams.get("page") !== "1" || url.searchParams.get("limit") !== "20") break;
            fixture.listReads += 1;
            if (fixture.listStatus === 503) return fail(503);
            if (fixture.listStatus === "malformed") return ok({ status: "success", data: { orders: [] } });
            return ok({
              status: "success", results: fixture.listCount, data: {
                orders: fixture.listCount === 0 ? [] : fixture.listCount === 1 ? [order] : [...earlierOrders, order],
              },
              pagination: { total: fixture.listCount, page: 1, limit: 20, pages: Number(fixture.listCount > 0) },
            });
          case `${proxyPrefix}/orders/${order.id}`:
            fixture.detailReads += 1;
            return fixture.detailStatus === 200
              ? ok({ status: "success", data: { order } })
              : fail(fixture.detailStatus);
          case `${proxyPrefix}/user/addresses`:
            return ok({ status: "success", data: { addresses: [] } });
          case `${proxyPrefix}/wishlist`:
            return ok({ status: "success", results: 0, data: { items: [] }, pagination: { total: 0, page: 1, limit: 100, pages: 0 } });
          case `${proxyPrefix}/cart`:
            return ok({ status: "success", data: { cart: {
              id: "00000000-0000-4000-8000-000000000001", items: [],
              summary: { totalItems: 0, uniqueItems: 0, subtotal: 0 },
            } } });
          case `${proxyPrefix}/categories`:
            return ok({ status: "success", results: 0, data: { categories: [] } });
          case `${proxyPrefix}/auth/csrf-token`:
            return ok({ data: { csrfToken: "fixture-csrf" } });
        }
      }

      if ((local && (method === "GET" || method === "HEAD") && !/^\/api(?:\/|$)/.test(url.pathname)) ||
          url.origin === "https://va.vercel-scripts.com" || url.protocol === "data:" || url.protocol === "blob:") {
        return route.fallback();
      }
      unexpectedRequests.push(`${method} ${url.origin}${url.pathname}`);
      return route.abort("blockedbyclient");
    });

    await runWithFixture(fixture);
    expect.soft(unexpectedRequests, "Only fixture API reads and local frontend resources are allowed").toEqual([]);
    expect.soft(pageErrors, "The account routes must not throw browser errors").toEqual([]);
  },
});

if (channel) test.use({ channel });
test.skip(!origin, "Provide an isolated loopback TEST_BASE_URL using the default /api/backend proxy.");
test.use({ baseURL: origin, serviceWorkers: "block", contextOptions: { reducedMotion: "reduce" }, viewport: mobile });

function orderDetailsLink(page: Page) {
  return page.getByRole("link", { name: "View Order Details", exact: true })
    .and(page.locator(`a[href="${detailPath}"]`));
}

async function followLinkWithKeyboard(page: Page, link: Locator, href: string, beforeEnter?: () => Promise<void>) {
  await expect(link).toHaveJSProperty("tagName", "A");
  await expect(link).toHaveAttribute("href", href);
  await expect(link.getByRole("button")).toHaveCount(0);
  await auditAction(link);

  // Traverse the actual tab order without sending focus directly to the link.
  for (let step = 0; step < 100; step += 1) {
    await page.keyboard.press("Tab");
    if (await link.evaluate((element) => document.activeElement === element)) break;
  }
  await auditKeyboardFocus(link);
  await expect.poll(() => link.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const top = document.elementFromPoint(x, rect.top + 1);
    const bottom = document.elementFromPoint(x, rect.bottom - 1);
    return top !== null && bottom !== null && element.contains(top) && element.contains(bottom);
  }), { message: "The focused link must clear the fixed navigation" }).toBe(true);
  await beforeEnter?.();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(href);
}

async function expectOrderList(page: Page, count = 1) {
  await expect(page).toHaveURL(ordersPath);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "My Orders", exact: true })).toBeVisible();
  await expect(page.getByText(`Showing ${count} of ${count} orders`, { exact: true })).toBeVisible();
  await expect(page.getByText(order.orderNumber, { exact: true })).toBeVisible();
  await expect(orderDetailsLink(page)).toHaveAttribute("href", detailPath);
}

async function expectReceipt(page: Page) {
  await expect(page).toHaveURL(detailPath);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "RECEIPT", exact: true })).toBeVisible();
  await expect(page.getByText(`#${order.orderNumber}`, { exact: true })).toBeVisible();
  await expect(page.getByText("Fixture Desk Lamp", { exact: true })).toBeVisible();
  await expect(page.getByText("Fixture delivery address", { exact: false })).toBeVisible();
  await expect(page.getByText("Delivery Fee (Due Now)", { exact: true })).toBeVisible();
  await expect(page.getByText("Cash Due on Delivery", { exact: true })).toBeVisible();
  await expect(page.getByText("Official payment status is pending.")).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
}

async function expectConfiguredReceiptSupport(page: Page, testInfo: TestInfo) {
  const main = page.getByRole("main");
  const whatsapp = main.getByRole("link", { name: "WhatsApp Support", exact: true });
  const call = main.getByRole("link", { name: "Call Support", exact: true });
  const whatsappNumber = process.env.TEST_RECEIPT_SUPPORT_WHATSAPP_NUMBER;
  const callNumber = process.env.TEST_RECEIPT_SUPPORT_CALL_NUMBER;
  if (!whatsappNumber && !callNumber) {
    await expect(whatsapp).toHaveCount(0);
    await expect(call).toHaveCount(0);
    return;
  }
  if (!whatsappNumber || !callNumber) throw new Error("Set both synthetic receipt support numbers for this check.");
  const message = encodeURIComponent(`Hi Zogular, I need help with Order #${order.orderNumber}`);
  await expect(whatsapp).toHaveAttribute("href", `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${message}`);
  await expect(whatsapp).toHaveAttribute("target", "_blank");
  await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
  await expect(call).toHaveAttribute("href", `tel:${callNumber}`);
  for (const link of [whatsapp, call]) {
    await expect(link).toHaveJSProperty("tagName", "A");
    await expect(link.locator("button, [role=button]")).toHaveCount(0);
    await expect(link).toBeVisible();
  }

  const actions = whatsapp.locator("..");
  await actions.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  const [group, first, second] = await Promise.all([actions.boundingBox(), whatsapp.boundingBox(), call.boundingBox()]);
  if (!group || !first || !second) throw new Error("Expected both support links and their container to be rendered.");
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Expected a fixed viewport for receipt support checks.");
  for (const link of [first, second]) {
    expect(link.x).toBeGreaterThanOrEqual(Math.max(0, group.x - 1));
    expect(link.x + link.width).toBeLessThanOrEqual(Math.min(viewport.width, group.x + group.width + 1));
  }
  if (viewport.width < 640) {
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
  }
  const totals = main.getByRole("region", { name: "Order totals" });
  await expect(totals).toBeVisible();
  const totalsFit = await totals.evaluate((element) => {
    const panel = element.getBoundingClientRect();
    const amounts = Array.from(element.querySelectorAll("span")).filter((span) => span.textContent?.trim().startsWith("K"));
    return amounts.length >= 4 && panel.left >= 0 && panel.right <= document.documentElement.clientWidth + 1 &&
      amounts.every((span) => {
        const amount = span.getBoundingClientRect();
        return amount.left >= panel.left - 1 && amount.right <= panel.right + 1;
      });
  });
  expect(totalsFit, "Receipt totals and amount labels must fit inside the viewport").toBe(true);
  await capture(page, testInfo, "receipt-support");
  // Inspect links only; never navigate to a support channel.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
}

async function expectSafeOrderError(page: Page, description: string) {
  await expect(page.getByRole("main").getByText(description, { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/FIXTURE_INTERNAL_ORDER_DIAGNOSTIC|SyntheticOrderError|fixture\/orders\.ts|OrderListContractError/);
  await expect(page.locator("body")).not.toContainText(parserError);
}

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("verified buyer can open an order receipt and return to the list", async ({ page, orderFixture }, testInfo) => {
      orderFixture.listCount = fullListCount;
      await page.goto(ordersPath);
      await expectOrderList(page, fullListCount);
      expect(orderFixture.listReads).toBeGreaterThan(0);
      await capture(page, testInfo, "orders");
      await auditPageLayout(page);

      const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
      for (const returnVia of ["receipt link", "browser Back"] as const) {
        let fromY = 0;
        await followLinkWithKeyboard(page, orderDetailsLink(page), detailPath, async () => {
          fromY = await scrollY();
          expect(fromY, "Order navigation must start from nonzero scroll").toBeGreaterThan(0);
          if (returnVia === "receipt link") await capture(page, testInfo, "orders-keyboard");
        });

        await expectReceipt(page);
        if (returnVia === "receipt link") {
          await capture(page, testInfo, "receipt");
          await expectConfiguredReceiptSupport(page, testInfo);
          await auditPageLayout(page);
          const back = page.getByRole("link", { name: "Back to Orders", exact: true });
          const print = page.getByRole("button", { name: "View / Print Receipt", exact: true });
          await auditAction(back);
          await auditAction(print);
          await followLinkWithKeyboard(page, back, ordersPath);
        } else {
          await page.goBack();
        }
        await expectOrderList(page, fullListCount);
        await expect.poll(scrollY, { message: `${returnVia} must restore the exact list position` }).toBe(fromY);
        if (returnVia === "receipt link") await capture(page, testInfo, "orders-return");
      }
      expect(orderFixture.detailReads).toBeGreaterThan(0);
    });
  });
}

test("an empty order history offers a native category link", async ({ page, orderFixture }, testInfo) => {
  orderFixture.listCount = 0;
  await page.goto(ordersPath);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "No orders found", exact: true })).toBeVisible();
  await expect(page.getByText("Showing 0 of 0 orders", { exact: true })).toBeVisible();
  await expect(orderDetailsLink(page)).toHaveCount(0);
  const browse = page.getByRole("main").getByRole("link", { name: "Browse Categories", exact: true });
  await expect(browse).toHaveAttribute("href", "/categories");
  await expect(browse.getByRole("button")).toHaveCount(0);
  await capture(page, testInfo, "orders-empty");
  await auditAction(browse);
});

test("temporary list and receipt failures can be retried without signing in again", async ({ page, orderFixture }, testInfo) => {
  orderFixture.listStatus = 503;
  orderFixture.detailStatus = 503;
  await page.goto(ordersPath);
  await expect(page.getByRole("heading", { name: "Orders could not load", exact: true })).toBeVisible();
  await expectSafeOrderError(page, "Please try again in a moment.");
  await expect(page.getByRole("heading", { name: "No orders found", exact: true })).toHaveCount(0);
  const retry = page.getByRole("button", { name: "Try Again", exact: true });
  await capture(page, testInfo, "orders-503");
  const listReads = orderFixture.listReads;
  await auditPageLayout(page);
  await auditAction(retry);
  orderFixture.listStatus = 200;
  await retry.click();
  await expectOrderList(page);
  expect(orderFixture.listReads).toBeGreaterThan(listReads);

  await orderDetailsLink(page).click();
  await expect(page).toHaveURL(detailPath);
  await expect(page.getByRole("heading", { name: "Order could not load", exact: true })).toBeVisible();
  await expectSafeOrderError(page, "Please try again in a moment.");
  const back = page.getByRole("link", { name: "Back to Orders", exact: true });
  await expect(back).toHaveAttribute("href", ordersPath);
  await auditAction(back);
  await capture(page, testInfo, "receipt-503");
  await auditPageLayout(page);
  await auditAction(retry);
  const detailReads = orderFixture.detailReads;
  orderFixture.detailStatus = 200;
  await retry.click();
  await expectReceipt(page);
  expect(orderFixture.detailReads).toBeGreaterThan(detailReads);
});

test("temporary list failure from malformed data hides parser diagnostics and offers Retry", async ({ page, orderFixture }) => {
  orderFixture.listStatus = "malformed";
  await page.goto(ordersPath);
  await expect(page.getByRole("heading", { name: "Orders could not load", exact: true })).toBeVisible();
  await expectSafeOrderError(page, "Please try again in a moment.");
  orderFixture.listStatus = 200;
  await page.getByRole("button", { name: "Try Again", exact: true }).click();
  await expectOrderList(page);
});

for (const { status, heading } of [
  { status: 403, heading: "Order unavailable" },
  { status: 404, heading: "Order not found" },
] as const) {
  test(`receipt ${status} has distinct safe copy and returns to order history`, async ({ page, orderFixture }, testInfo) => {
    orderFixture.detailStatus = status;
    await page.goto(detailPath);
    await expect(page).toHaveURL(detailPath);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "RECEIPT", exact: true })).toHaveCount(0);
    await expectSafeOrderError(page, "This order is not available.");
    expect(orderFixture.detailReads).toBeGreaterThan(0);
    await capture(page, testInfo, `receipt-${status}`);
    await auditPageLayout(page);
    const back = page.getByRole("link", { name: "Back to Orders", exact: true });
    await expect(back).toHaveAttribute("href", ordersPath);
    await auditAction(page.getByRole("button", { name: "Try Again", exact: true }));
    await auditAction(back);
    await back.click();
    await expectOrderList(page);
  });
}

test("narrow account navigation reaches saved items, addresses and settings without writes", async ({ page, orderFixture }) => {
  await page.goto(ordersPath);
  await expectOrderList(page);
  expect(orderFixture.listReads).toBeGreaterThan(0);

  for (const { link, path, ready } of [
    { link: "Saved Items", path: "/account/saved", ready: "Your wishlist is empty" },
    { link: "Addresses", path: "/account/addresses", ready: "No saved addresses" },
    { link: "Settings", path: "/account/settings", ready: "Account Settings" },
  ]) {
    const navigation = page.getByRole("link", { name: link, exact: true });
    await expect(navigation).toHaveAttribute("href", path);
    await auditAction(navigation);
    await navigation.click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: ready, exact: true })).toBeVisible();
    await auditPageLayout(page);
  }

  await expect(page.getByRole("textbox", { name: "First Name", exact: true })).toHaveValue(buyer.firstName);
  await auditAction(page.getByRole("button", { name: "Save Changes", exact: true }));
});
