import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { existsSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const host = "127.0.0.1";
const appPort = 3408;
const origin = `http://${host}:${appPort}`;
const storeSlug = "e7234ec8-b4b6-46fa-9d61-7f5199f564a1";
const otherSlug = "c08820fd-86fd-45fd-942a-afd07abdfa6a";
const storeName = "Woodlands Home Goods";
const path = `/store/${storeSlug}`;
const backendPath = `/api/v1/products/by-store/${storeSlug}`;
const rawDiagnostic = "Fixture internal directory diagnostic";
const ownerId = "opaque-public-owner-fixture";
const reviewerName = "FixtureReviewer";
const unapprovedHost = "unapproved-media.example.test";
const limit = 20;
const loopbackOnly = `import { Socket } from "node:net";
const connect = Socket.prototype.connect;
Socket.prototype.connect = function (...args) {
  const [options, host] = Array.isArray(args[0]) ? args[0] : args;
  if ((typeof options === "number" ? host : options?.host) !== "127.0.0.1") {
    throw new Error("Outbound fixture connection blocked.");
  }
  return connect.apply(this, args);
};`;

type Scenario = "catalog" | "empty" | "missing" | "unavailable" | "wrong-store" | "wrong-page" | "private-field" | "inconsistent-count";
let scenario: Scenario;
let fixture: Server | undefined;
let next: ChildProcess | undefined;
let fixturePort: number | undefined;
const storeReads: Array<{ page: string | null; limit: string | null; auth: boolean }> = [];

function product(n: number) {
  const image = {
    url: "/images/discovery/category-artwork.webp", alt: null, isPrimary: true, sortOrder: 0,
    linkedVariantValue: null, width: null, height: null,
  };
  const external = { ...image, url: `https://${unapprovedHost}/lamp.webp` };
  const insecure = { ...image, url: "http://res.cloudinary.com/fixture/lamp.webp" };
  return {
    id: `product-${n}`, slug: `desk-lamp-${n}`, title: `Desk lamp ${n}`, description: "Fixture lamp",
    price: 149, salePrice: null, images: n === 1
      ? [external, { ...image, isPrimary: false, sortOrder: 1 }]
      : n === 2 ? [insecure, external] : [image],
    condition: "NEW", category: "ELECTRONICS", categoryRef: null, categorySlug: null, subcategorySlug: null,
    location: null, sku: null, stock: 4, brand: null, model: null, ram: null, storage: null, size: null, color: null,
    isSold: false, user: { id: ownerId }, reviews: [{
      rating: 4, comment: null, createdAt: "2026-11-27T12:00:00.000Z",
      user: { firstName: reviewerName, lastName: null },
    }], attributeValues: [],
  };
}

async function assertVacant(port: number) {
  const probe = createServer();
  probe.listen({ host, port, exclusive: true });
  await once(probe, "listening");
  const closed = once(probe, "close");
  probe.close();
  await closed;
}

test.use({
  channel: "chrome", serviceWorkers: "block",
  launchOptions: { args: [
    "--disable-background-networking", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
  ] },
});

test.describe.configure({ timeout: 45_000 });

test.beforeAll(async () => {
  const cwd = process.cwd();
  if (!existsSync(".next/BUILD_ID") || readdirSync(cwd).some((entry) => /^(?:\.git$|\.env(?:\.|$))/i.test(entry))) {
    throw new Error("Storefront browser tests require an isolated production build without dotenv files.");
  }
  await assertVacant(appPort);
  fixture = createServer((request, response) => {
    const url = new URL(request.url ?? "/", origin);
    const respond = (status: number, body: object) =>
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }).end(JSON.stringify(body));
    if (request.method !== "GET" || !url.pathname.startsWith("/api/v1/products/by-store/")) {
      respond(404, { status: "fail" });
      return;
    }
    storeReads.push({
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
      auth: Boolean(request.headers.authorization || request.headers.cookie),
    });
    if (url.pathname !== backendPath || scenario === "missing") {
      respond(404, { status: "fail" });
      return;
    }
    if (scenario === "unavailable") {
      respond(503, { status: "fail", message: rawDiagnostic });
      return;
    }
    const page = Number(url.searchParams.get("page"));
    const offset = (page - 1) * limit;
    const total = scenario === "empty" ? 0 : 21;
    const products = Array.from({ length: Math.min(limit, Math.max(0, total - offset)) }, (_, index) => product(offset + index + 1));
    respond(200, {
      status: "success",
      store: { slug: scenario === "wrong-store" ? otherSlug : storeSlug, name: storeName,
        ...(scenario === "private-field" ? { email: "private-fixture@example.test" } : {}) },
      results: products.length + (scenario === "inconsistent-count" ? 1 : 0),
      pagination: { page: scenario === "wrong-page" ? page + 1 : page, limit, total, pages: Math.ceil(total / limit) },
      data: { products },
    });
  }).listen({ host, port: 0, exclusive: true });
  await once(fixture, "listening");
  const binding = fixture.address();
  if (!binding || typeof binding === "string") throw new Error("Store fixture did not bind loopback.");
  fixturePort = binding.port;
  const backendUrl = `http://${host}:${fixturePort}/api/v1`;
  const child = spawn(process.execPath, [
    "--import", `data:text/javascript,${encodeURIComponent(loopbackOnly)}`,
    require.resolve("next/dist/bin/next"), "start", "-H", host, "-p", String(appPort),
  ], {
    cwd, windowsHide: true,
    env: {
      ...(process.platform === "win32" ? { SystemRoot: process.env.SystemRoot } : {}),
      NODE_ENV: "production", NO_COLOR: "1", NEXT_TELEMETRY_DISABLED: "1",
      INTERNAL_BACKEND_URL: backendUrl, NEXT_PUBLIC_API_URL: backendUrl, NEXT_PUBLIC_API_PROXY_URL: "/api/backend",
    },
    stdio: ["ignore", "pipe", "ignore"],
  });
  next = child;
  let ready = false;
  let failed = false;
  let tail = "";
  child.on("error", () => { failed = true; });
  child.once("exit", () => { failed = true; });
  // Next production emits Ready only after its own listener starts; don't probe an unowned port.
  child.stdout!.setEncoding("utf8").on("data", (chunk: string) => {
    if (!ready) {
      tail = (tail + chunk).slice(-256);
      ready = /Ready in \d/.test(tail);
    }
  });
  await expect.poll(() => {
    if (failed || child.exitCode !== null || child.signalCode !== null) throw new Error("Storefront fixture exited during startup.");
    return ready;
  }, { timeout: 20_000 }).toBe(true);
});

test.afterAll(async () => {
  try {
    if (next?.pid && next.exitCode === null && next.signalCode === null) {
      const exited = once(next, "exit");
      next.kill("SIGKILL");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([exited, new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Storefront application shutdown could not be verified.")), 5000);
        })]);
      } finally {
        clearTimeout(timer);
      }
    }
  } finally {
    if (fixture?.listening) {
      const closed = once(fixture, "close");
      fixture.close();
      fixture.closeAllConnections();
      await closed;
    }
  }
  if (next) await assertVacant(appPort);
  if (fixturePort !== undefined) await assertVacant(fixturePort);
});

test.beforeEach(async ({ context }) => {
  scenario = "catalog";
  storeReads.length = 0;
  await context.route("**/*", (route) => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  await context.routeWebSocket("**/*", (socket) => socket.close());
});

for (const width of [320, 1440]) {
  test(`renders and paginates the public store with mixed media at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 900 });
    const unsupportedRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      const source = url.pathname === "/_next/image" ? url.searchParams.get("url") : url.href;
      if (source?.includes(unapprovedHost) || source?.startsWith("http://res.cloudinary.com/")) {
        unsupportedRequests.push(source);
      }
    });
    await page.goto(`${origin}${path}`);
    await expect(page.getByRole("heading", { name: storeName, exact: true })).toBeInViewport();
    const grid = page.getByRole("list", { name: "Store products" });
    await expect(grid.getByTestId("product-card")).toHaveCount(limit);
    await expect(page.getByText("21 products", { exact: true })).toBeVisible();
    const mixedMedia = grid.getByRole("link", { name: "View Desk lamp 1", exact: true });
    await expect(mixedMedia).toHaveAttribute("href", "/product/desk-lamp-1");
    await expect.poll(() => mixedMedia.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const noMedia = grid.getByRole("link", { name: "View Desk lamp 2", exact: true });
    await expect(noMedia).toBeVisible();
    await expect(noMedia.locator("img")).toHaveCount(0);
    expect(await page.content()).not.toContain(unapprovedHost);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("store-products.png"), animations: "disabled" });
    const nextPage = page.getByRole("link", { name: "Next", exact: true });
    await nextPage.focus();
    await nextPage.press("Enter");
    await expect(page).toHaveURL(`${origin}${path}?page=2`);
    await expect(grid.getByTestId("product-card")).toHaveCount(1);
    await expect(grid.getByRole("link", { name: "View Desk lamp 21", exact: true })).toBeVisible();
    await expect(page.getByText("Showing 21-21 of 21")).toBeVisible();
    await page.goto(`${origin}${path}?page=1000`);
    await expect(page).toHaveURL(`${origin}${path}?page=2`);
    await expect(grid.getByRole("link", { name: "View Desk lamp 21", exact: true })).toBeVisible();
    expect(storeReads).toEqual(expect.arrayContaining([1, 2, 1000].map((number) => ({
      page: String(number), limit: "20", auth: false,
    }))));
    const html = await page.content();
    expect(html).not.toContain(ownerId);
    expect(html).not.toContain(reviewerName);
    expect(unsupportedRequests).toEqual([]);
  });
}

test("distinguishes public not-found from an approved empty store", async ({ page, context }) => {
  scenario = "empty";
  const empty = await page.goto(`${origin}${path}`);
  expect(empty?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: storeName })).toBeVisible();
  await expect(page.getByText("No products available yet")).toBeVisible();
  await expect(page.getByTestId("product-card")).toHaveCount(0);
  await context.addCookies([{ name: "zogular_admin_session", value: "synthetic-session", url: origin }]);
  const missing = await page.goto(`${origin}/store/${otherSlug}`);
  expect([200, 404]).toContain(missing?.status());
  await expect(page.getByRole("heading", { name: "Store unavailable" })).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByRole("heading", { name: storeName })).toHaveCount(0);
  expect(storeReads.every(({ auth }) => !auth)).toBe(true);
  const before = storeReads.length;
  for (const invalid of ["/store/display-name", `${path}?page=1001`, `${path}?page=1&page=2`]) {
    await page.goto(origin + invalid);
    await expect(page.getByRole("heading", { name: "Store unavailable" })).toBeVisible();
  }
  expect(storeReads).toHaveLength(before);
});

test("retries an outage at the requested page without disclosing backend errors", async ({ page }, testInfo) => {
  scenario = "unavailable";
  await page.goto(`${origin}${path}?page=2`);
  await expect(page.getByRole("heading", { name: "Store products could not load" })).toBeVisible();
  await expect(page.getByText(rawDiagnostic)).toHaveCount(0);
  await expect(page.getByText("No products available yet")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("store-retry.png"), animations: "disabled" });
  scenario = "catalog";
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(`${origin}${path}?page=2`);
  await expect(page.getByRole("heading", { name: storeName })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Desk lamp 21" })).toBeVisible();
});

test("fails closed on a mismatched identity, page, private field, or count", async ({ page }) => {
  for (const invalid of ["wrong-store", "wrong-page", "private-field", "inconsistent-count"] as const) {
    scenario = invalid;
    await page.goto(`${origin}${path}`);
    await expect(page.getByRole("heading", { name: "Store products could not load" })).toBeVisible();
    await expect(page.getByRole("heading", { name: storeName })).toHaveCount(0);
    await expect(page.getByTestId("product-card")).toHaveCount(0);
    expect(await page.content()).not.toContain("private-fixture@example.test");
  }
});
