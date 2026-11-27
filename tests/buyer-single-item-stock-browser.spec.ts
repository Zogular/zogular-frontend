import { createServer } from "node:http";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const web = process.env.BUYER_STOCK_WEB_ORIGIN;
const api = process.env.BUYER_STOCK_API_ORIGIN;
const items = [
  { id: "single", slug: "single-item", title: "Single listing", stock: null, isSold: false },
  { id: "sold", slug: "sold-item", title: "Sold listing", stock: null, isSold: true },
  { id: "invalid", slug: "invalid-item", title: "Unconfirmed listing", stock: "invalid", isSold: false },
].map((item) => ({ ...item, price: 250, category: "HOME", images: ["/file.svg"] }));
const [single, sold, invalid] = items;
const reads = new Set<string>();

// Only Next's server-side catalog requests reach this fixture. Browser API calls are intercepted below.
const fixture = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const path = url.pathname;
  const reply = (status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method !== "GET") return reply(405, {});
  reads.add(path);
  if (path === "/api/v1/categories") return reply(200, { data: { categories: [] } });
  if (path === "/api/v1/products") return reply(200, {
    status: "success", results: items.length, data: { products: items },
    pagination: { page: 1, limit: Number(url.searchParams.get("limit")), total: items.length, pages: 1 },
  });
  for (const item of items) {
    if (path === `/api/v1/products/${item.slug}`) return reply(200, { status: "success", data: { product: item } });
    if (path === `/api/v1/products/${item.id}/related`) {
      const products = items.filter((peer) => peer.id !== item.id);
      return reply(200, { status: "success", results: products.length, data: { products } });
    }
  }
  return reply(404, {});
});

test.describe.configure({ mode: "serial" });
test.use({ serviceWorkers: "block" });
test.skip(!web || !api, "Requires an isolated Next build configured to use the loopback stock fixture.");
test.beforeAll(async () => {
  for (const origin of [web!, api!]) {
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) || Number(new URL(origin).port) < 1024 || new URL(origin).port === "3000") {
      throw new Error("Refusing a non-fixture origin.");
    }
  }
  if (web === api) throw new Error("Fixture and frontend require separate ports.");
  await new Promise<void>((resolve, reject) => fixture.once("error", reject).listen(Number(new URL(api!).port), "127.0.0.1", resolve));
});
test.afterAll(async () => {
  if (fixture.listening) await new Promise<void>((resolve, reject) => fixture.close((error) => error ? reject(error) : resolve()));
});

async function expectSingleCartLine(page: Page) {
  await page.goto(`${web}/cart`);
  await expect(page.getByRole("link", { name: single.title, exact: true }).filter({ hasText: single.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove item from cart" })).toBeVisible();
  await expect(page.getByTestId("cart-items-subtotal")).toHaveText("K250");
}

for (const width of [390, 1440]) {
  test(`public single-item purchase controls at ${width}px`, async ({ page, context }, testInfo) => {
    reads.clear();
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== web) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      if (url.pathname === "/api/backend/categories") return route.fulfill({ json: { data: { categories: [] } } });
      return route.fulfill({ status: url.pathname.endsWith("/user/me") ? 401 : 404, json: {} });
    });
    const photo = async (name: string) => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const file = `${width}-${name}.png`;
      await page.screenshot({ path: process.env.BUYER_STOCK_EVIDENCE_DIR ? join(process.env.BUYER_STOCK_EVIDENCE_DIR, file) : testInfo.outputPath(file), animations: "disabled" });
    };
    const card = (title: string) => page.getByTestId("product-card").filter({ has: page.getByRole("link", { name: title, exact: true }) });
    const addSingle = () => card(single.title).getByRole("button", { name: `Add ${single.title} to cart` });
    const pdpAdd = page.getByRole("button", { name: "Add", exact: true }).filter({ visible: true });
    const increase = page.getByRole("button", { name: "Increase quantity" }).filter({ visible: true });
    const remove = page.getByRole("button", { name: "Remove item from cart" });
    const clearLine = async () => {
      await remove.click();
      await expect(remove).toHaveCount(0);
    };

    await page.goto(`${web}/products`);
    await expect(addSingle()).toBeEnabled();
    for (const item of [sold, invalid]) {
      await expect(card(item.title).getByRole("button", { name: `Out of stock: ${item.title}` })).toBeDisabled();
    }
    await addSingle().scrollIntoViewIfNeeded();
    await photo("list");
    await addSingle().click();
    await expectSingleCartLine(page);
    await clearLine();

    for (const item of [invalid, sold]) {
      await page.goto(`${web}/product/${item.slug}`);
      await expect(page.getByRole("heading", { name: item.title, exact: true })).toBeVisible();
      await expect(pdpAdd).toBeDisabled();
      await expect(increase).toBeDisabled();
    }
    await expect(page.getByRole("heading", { name: "You might also like" })).toBeVisible();
    await expect(addSingle()).toBeEnabled();
    await expect(card(invalid.title).getByRole("button", { name: `Out of stock: ${invalid.title}` })).toBeDisabled();
    await addSingle().scrollIntoViewIfNeeded();
    await photo("related");
    await addSingle().click();
    await expectSingleCartLine(page);
    await clearLine();

    await page.goto(`${web}/product/${single.slug}`);
    await expect(page.getByText("Only 1 left", { exact: true })).toBeVisible();
    await expect(pdpAdd).toBeEnabled();
    await expect(increase).toBeDisabled();
    await expect(card(sold.title).getByRole("button", { name: `Out of stock: ${sold.title}` })).toBeDisabled();
    await pdpAdd.scrollIntoViewIfNeeded();
    await photo("pdp");
    await pdpAdd.click();
    await expectSingleCartLine(page);
    await photo("cart");
    for (const path of ["/products", ...items.map(({ slug }) => `/products/${slug}`), "/products/sold/related", "/products/single/related"]) {
      expect(reads.has(`/api/v1${path}`), path).toBe(true);
    }
  });
}
