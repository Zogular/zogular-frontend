import { expect, test as base, type Page, type TestInfo } from "@playwright/test";
import {
  auditAction,
  auditHorizontalScroller,
  auditKeyboardFocus,
  auditPageLayout,
  auditReducedMotionStatus,
  containAuditNetwork,
  loopbackAuditOrigin,
} from "./helpers/ui-audit-checks";

const LIST = "/seller/orders";
const API_ROOT = "/api/backend";
const SESSION = `${API_ROOT}/user/me`;
const APPLICATION = `${API_ROOT}/vendor/applications/me`;
const COLLECTION = `${API_ROOT}/vendor/orders`;
const OUTAGE = "Seller orders are temporarily unavailable.";
const STAMP = "2026-08-20T12:00:00.000Z";
const seller = {
  id: "seller-fixture-user",
  firstName: "Fixture",
  lastName: "Seller",
  email: "seller@fixture.invalid",
  role: "VENDOR",
  emailVerified: true,
  isActive: true,
};
const application = {
  id: "fixture-application",
  userId: seller.id,
  sellerType: "INDIVIDUAL",
  // The seller layout derives canReceiveOrders from APPROVED, not a DTO flag.
  status: "APPROVED",
  ownerFullName: "Fixture Seller",
  storeName: "Fixture Store",
  legalBusinessName: "Fixture Store",
  productCategories: ["Electronics"],
  createdAt: STAMP,
  updatedAt: STAMP,
};
const buyer = {
  id: "buyer-fixture-user",
  firstName: "Fixture",
  lastName: "Buyer",
  email: "buyer@fixture.invalid",
  telephone: null,
};
const product = { id: "fixture-product", title: "Fixture Desk Lamp", images: [], category: "electronics", brand: null };
const order = {
  id: "0d9229f7-429d-4195-bdcc-a2207d8ed664",
  orderNumber: "ZG-FIXTURE-001",
  userId: buyer.id,
  status: "DELIVERED",
  sellerStatus: "DELIVERED",
  allowedSellerTransitions: [],
  totalAmount: 120,
  paymentMethod: null,
  paymentStatus: null,
  sellerCommissionAmount: null,
  sellerNetAmount: null,
  sellerVisibleTotals: { subtotal: 120, shipping: null, discount: null, total: 120 },
  createdAt: STAMP,
  updatedAt: STAMP,
  deliveryMethod: "standard",
  shippingAddress: null,
  shipping: { method: "standard", fee: null, instructions: null },
  user: buyer,
  customer: { name: "Fixture Buyer", email: buyer.email, phone: null },
  items: [{
    id: "fixture-order-item", productId: product.id, quantity: 1,
    price: 120, vendorStatus: "DELIVERED", product,
  }],
};
// A full page makes the target reachable only after scrolling, even at desktop height.
const populatedOrders = [
  ...Array.from({ length: 19 }, (_, index) => ({
    ...order,
    id: `0d9229f7-429d-4195-bdcc-${String(index + 1).padStart(12, "0")}`,
    orderNumber: `ZG-FIXTURE-PRIOR-${index + 1}`,
  })),
  order,
];
const DETAIL = `${LIST}/${order.id}`;
const DETAIL_API = `${COLLECTION}/${order.id}`;
const DETAIL_LINK = `${DETAIL}?returnTo=${encodeURIComponent(LIST)}`;
const COLLECTION_QUERY = new URLSearchParams({ page: "1", limit: "20", sortBy: "createdAt", sortOrder: "desc" });
const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"];
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

type Scenario = "populated" | "empty" | "outage";
type Read = { path: string; status: number };
const instructions = "Use the side gate for collection.";
const street = "Unit 4, 28 Longacres Commercial Access Road";
const deliveryFixtures = {
  missing: { shipping: { ...order.shipping, instructions }, lines: ["No delivery address provided."] },
  partial: { shipping: { ...order.shipping, addressLine: " ", city: " Lusaka ", instructions }, lines: ["Lusaka"] },
  full: { shipping: { ...order.shipping, addressLine: street, district: "Longacres", city: "Lusaka", instructions },
    lines: [street, "Longacres, Lusaka"] },
};
type DeliveryCase = keyof typeof deliveryFixtures;

function collectionPayload(populated: boolean) {
  const total = populated ? populatedOrders.length : 0;
  return {
    status: "success",
    results: total,
    pagination: { total, page: 1, limit: 20, pages: Number(populated) },
    data: {
      orders: populated ? populatedOrders : [],
      summary: { totalOrders: total, activeOrders: 0, completedOrders: total, cancelledOrders: 0, refundedOrders: 0 },
      facets: { statuses: STATUSES.map((status) => ({ status, count: status === "DELIVERED" ? total : 0 })) },
    },
  };
}

const test = base.extend<{ scenario: Scenario; deliveryCase: DeliveryCase | null; sellerReads: { origin: string; reads: Read[] } }>({
  scenario: ["populated", { option: true }],
  deliveryCase: [null, { option: true }],
  sellerReads: async ({ context, scenario, deliveryCase }, provide, testInfo) => {
    const baseUrl = new URL(process.env.TEST_BASE_URL ?? "");
    const origin = loopbackAuditOrigin(baseUrl.href);
    if (baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) {
      throw new Error("TEST_BASE_URL must name only the approved loopback origin.");
    }
    const reads: Read[] = [];
    const denied: string[] = [];
    await containAuditNetwork(context, [origin]);
    // The browser must fulfill every API read here; no application proxy is contacted.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const isApi = url.pathname === "/api" || url.pathname.startsWith("/api/");
      const isOffOriginData = url.origin !== origin && ["fetch", "xhr"].includes(request.resourceType());
      if (!isApi && !isOffOriginData && (url.origin !== origin || method === "GET")) {
        return route.fallback();
      }

      const fulfill = (json: unknown, status = 200) => {
        reads.push({ path: url.pathname, status });
        return route.fulfill({ status, json });
      };
      if (url.origin === origin && method === "GET") {
        if (url.pathname === SESSION && !url.search) {
          return fulfill({ status: "success", data: { user: seller } });
        }
        if (url.pathname === APPLICATION && !url.search) {
          return fulfill({ status: "success", data: { application } });
        }
        if (url.pathname === COLLECTION && url.searchParams.size === COLLECTION_QUERY.size &&
          [...COLLECTION_QUERY].every(([key, value]) => url.searchParams.get(key) === value)) {
          return scenario === "outage"
            ? fulfill({ status: "fail", message: OUTAGE }, 503)
            : fulfill(collectionPayload(scenario === "populated"));
        }
        if (url.pathname === DETAIL_API && !url.search && scenario === "populated") {
          const detail = deliveryCase ? { ...order, shipping: deliveryFixtures[deliveryCase].shipping } : order;
          return fulfill({ status: "success", data: { order: detail } });
        }
      }
      denied.push(`${method} ${url.origin}${url.pathname}${url.search}`);
      return route.abort("blockedbyclient");
    });

    await provide({ origin, reads });
    await testInfo.attach("seller-order-api-reads", {
      body: JSON.stringify({ reads, denied }, null, 2),
      contentType: "application/json",
    });
    expect(denied, "Only allowlisted synthetic reads may reach the seller fixture").toEqual([]);
  },
});

test.skip(!process.env.TEST_BASE_URL, "Set TEST_BASE_URL to the approved loopback frontend origin.");
test.use({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined),
  launchOptions: { args: [
    "--disable-background-networking", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
  ] },
  serviceWorkers: "block",
  contextOptions: { reducedMotion: "reduce" },
  storageState: { cookies: [], origins: [] },
});

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

async function expectApprovedSeller(page: Page, width: number) {
  const ordersNav = page.getByRole("link", { name: "Orders", exact: true });
  await expect(ordersNav).toBeVisible();
  await expect(ordersNav).toBeEnabled();
  await expect(ordersNav).toHaveAttribute("href", LIST);
  if (width < 768) {
    await expect(page.getByRole("heading", { name: application.storeName, exact: true })).toBeVisible();
  } else {
    const settings = page.getByRole("link", { name: "Open seller settings" });
    await expect(settings.getByText("FS", { exact: true })).toBeVisible();
    if (width >= 1024) await expect(settings.getByText("Approved seller", { exact: true })).toBeVisible();
  }
}

for (const viewport of viewports.filter(({ width }) => width === 320 || width === 1440)) {
  for (const deliveryCase of ["missing", "partial", "full"] as const) {
    test.describe(`${deliveryCase} delivery address at ${viewport.width}px`, () => {
      test.use({ viewport, deliveryCase });

      test("shows only available address lines and keeps instructions", async ({ page, sellerReads }, testInfo) => {
        await page.goto(`${sellerReads.origin}${DETAIL}`);
        await expect(page.getByRole("heading", { name: order.orderNumber, exact: true })).toBeVisible();
        const delivery = page.getByRole("region", { name: "Delivery", exact: true });
        await expect(delivery.locator("p")).toHaveText([...deliveryFixtures[deliveryCase].lines, instructions]);
        await expect(delivery.getByText(/^Not provided$/i)).toHaveCount(0);
        await auditPageLayout(page);
        expect(await delivery.evaluate((section) => section.scrollWidth - section.clientWidth)).toBe(0);
        await delivery.scrollIntoViewIfNeeded();
        await screenshot(page, testInfo, `seller-delivery-${deliveryCase}`);
        await delivery.screenshot({ path: testInfo.outputPath(`seller-delivery-${deliveryCase}-panel.png`) });
        expect(sellerReads.reads).toContainEqual({ path: DETAIL_API, status: 200 });
      });
    });
  }
}

for (const viewport of viewports) {
  test.describe(`seller order navigation at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("opens the assigned order with the keyboard and returns to the same collection", async ({ page, sellerReads }, testInfo) => {
      const { origin, reads } = sellerReads;
      const main = page.getByRole("main");
      await page.goto(`${origin}${LIST}`);
      await expectApprovedSeller(page, viewport.width);
      const statusTotals = main.getByLabel("Order status totals");
      const allOrders = statusTotals.getByRole("button", { name: `All ${populatedOrders.length}`, exact: true });
      const row = main.getByRole("row").filter({ hasText: order.orderNumber });
      const orderLink = row.getByRole("cell").getByRole("link");
      await expect(orderLink).toHaveAttribute("href", DETAIL_LINK);
      await expect(orderLink).toContainText("Fixture Buyer");
      await expect(row.getByText("Delivered", { exact: true })).toBeVisible();
      await screenshot(page, testInfo, "seller-orders-list");
      await auditPageLayout(page);
      await auditHorizontalScroller(statusTotals);
      await auditAction(allOrders, { contrast: "text" });

      await row.getByRole("button").focus();
      await page.keyboard.press("Shift+Tab");
      await auditKeyboardFocus(orderLink);
      await auditReducedMotionStatus(orderLink);
      const startScrollY = await page.evaluate(() => Math.round(window.scrollY));
      expect(startScrollY, "The fixture must exercise a nonzero return position").toBeGreaterThan(0);
      await screenshot(page, testInfo, "seller-orders-list-keyboard");
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(`${origin}${DETAIL_LINK}`);
      const orderHeading = main.getByRole("heading", { name: order.orderNumber, exact: true });
      await expect(orderHeading).toBeVisible();
      await expectApprovedSeller(page, viewport.width);
      await expect(main.getByRole("heading", { name: product.title, exact: true })).toBeVisible();
      await expect(main.getByText("Fixture Buyer", { exact: true })).toBeVisible();
      await expect(main.getByText("Qty 1", { exact: true })).toBeVisible();
      await expect(main.getByRole("button", { name: /^(Accept order|Start preparing|Cancel)$/ })).toHaveCount(0);
      await screenshot(page, testInfo, "seller-order-detail");
      await auditReducedMotionStatus(orderHeading);
      await auditPageLayout(page);
      const back = main.getByRole("button", { name: "Back to seller orders", exact: true });
      await auditAction(back);
      const toolbar = main.locator("header").filter({
        has: page.getByRole("heading", { name: order.orderNumber, exact: true }),
      });
      if (viewport.width < 768) {
        await test.step("VIS-08 joins the sticky seller header and order toolbar while scrolling", async () => {
          const storeHeading = page.getByRole("heading", { name: application.storeName, exact: true });
          const shellHeader = page.locator("header").filter({ has: storeHeading });
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
          await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
          const start = await toolbar.boundingBox();
          if (!start) throw new Error("Seller order toolbar is not visible.");
          await page.evaluate(() => window.scrollTo({ top: 160, behavior: "instant" }));
          await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(64);
          const shell = await shellHeader.boundingBox();
          const detail = await toolbar.boundingBox();
          if (!shell || !detail) throw new Error("Sticky seller headers are not visible.");
          await screenshot(page, testInfo, "seller-order-sticky-headers");
          await testInfo.attach("seller-order-sticky-bounds", {
            body: JSON.stringify({ shell, detail, gap: detail.y - (shell.y + shell.height) }),
            contentType: "application/json",
          });
          expect(detail.y, "The toolbar must move into its sticky position").toBeLessThan(start.y);
          expect(Math.abs(shell.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(detail.y - (shell.y + shell.height))).toBeLessThanOrEqual(1);
          for (const header of [shellHeader, toolbar]) {
            expect(await header.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
          }
          await expect(shellHeader.getByRole("link", { name: "Open notifications" })).toBeInViewport({ ratio: 1 });
          await expect(back).toBeInViewport({ ratio: 1 });
          await auditPageLayout(page);
        });
      } else {
        await expect(toolbar).toHaveCSS("position", "sticky");
        await expect(toolbar).toHaveCSS("top", "0px");
      }
      await back.click();

      await expect(page).toHaveURL(`${origin}${LIST}`);
      await expect(orderLink).toBeVisible();
      await expectApprovedSeller(page, viewport.width);
      await expect.poll(() => page.evaluate(() => Math.round(window.scrollY)), {
        message: "Returning from detail must restore the list position",
      }).toBe(startScrollY);
      await screenshot(page, testInfo, "seller-orders-list-return");
      await auditReducedMotionStatus(orderLink);
      await auditAction(orderLink);
      expect(reads).toEqual(expect.arrayContaining(
        [SESSION, APPLICATION, COLLECTION, DETAIL_API].map((path) => ({ path, status: 200 })),
      ));
    });

    test.describe("with no assigned orders", () => {
      test.use({ scenario: "empty" });

      test("reports an empty collection without an enabled export", async ({ page, sellerReads }, testInfo) => {
        await page.goto(`${sellerReads.origin}${LIST}`);
        await expectApprovedSeller(page, viewport.width);
        const main = page.getByRole("main");
        const empty = main.getByRole("heading", { name: "No orders yet", exact: true });
        await expect(empty).toBeVisible();
        await expect(main.getByRole("alert")).toHaveCount(0);
        await expect(main.getByRole("table", { name: "Seller orders" })).toHaveCount(0);
        await expect(main.getByRole("button", { name: "Export current page" })).toBeDisabled();
        await screenshot(page, testInfo, "seller-orders-empty");
        await auditReducedMotionStatus(empty);
        await auditPageLayout(page);
        await auditHorizontalScroller(main.getByLabel("Order status totals"));
        expect(sellerReads.reads).toContainEqual({ path: COLLECTION, status: 200 });
      });
    });

    test.describe("during a collection outage", () => {
      test.use({ scenario: "outage" });

      test("shows a retryable 503 error instead of an empty collection", async ({ page, sellerReads }, testInfo) => {
        await page.goto(`${sellerReads.origin}${LIST}`);
        await expectApprovedSeller(page, viewport.width);
        const main = page.getByRole("main");
        const error = main.getByRole("alert").filter({ hasText: "Orders could not be loaded" });
        // The default query retry delays total seven seconds before rendering the error.
        await expect(error).toBeVisible({ timeout: 15_000 });
        await expect(error.getByText(OUTAGE, { exact: true })).toBeVisible();
        await expect(main.getByRole("heading", { name: "No orders yet" })).toHaveCount(0);
        await expect(main.getByRole("table", { name: "Seller orders" })).toHaveCount(0);
        await expect(main.getByRole("button", { name: "Export current page" })).toBeDisabled();
        await screenshot(page, testInfo, "seller-orders-503");
        await auditReducedMotionStatus(error);
        await auditPageLayout(page);
        const retry = error.getByRole("button", { name: "Try again", exact: true });
        await auditAction(retry);
        const countCollectionReads = () => sellerReads.reads.filter(({ path }) => path === COLLECTION).length;
        const beforeRetry = countCollectionReads();
        expect(beforeRetry).toBeGreaterThan(0);
        await Promise.all([
          page.waitForResponse((response) => {
            const url = new URL(response.url());
            return url.origin === sellerReads.origin && url.pathname === COLLECTION &&
              response.request().method() === "GET" && response.status() === 503;
          }),
          retry.click(),
        ]);
        expect(countCollectionReads()).toBeGreaterThan(beforeRetry);
      });
    });
  });
}
