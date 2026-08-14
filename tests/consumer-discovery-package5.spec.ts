import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { parseDiscoveryQuery } from "../src/features/consumer-discovery/lib/discovery-query";

const frontendPort = 3519;
const backendPort = 5519;
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
const screenshotDirectory = path.resolve("test-results/consumer-discovery-package5");

type FixtureMode =
  | "success"
  | "true-empty"
  | "filtered-zero"
  | "search-zero"
  | "product-failure"
  | "metadata-failure"
  | "malformed"
  | "out-of-range";

let fixtureMode: FixtureMode = "success";
let backendServer: Server;
let frontendProcess: ChildProcess;
type BackendRequestTraceEntry = {
  url: string;
  pathname: string;
  query: Record<string, string>;
  phase: "category-metadata" | "requested-page" | "resolved-last-page" | "other-product-page";
};
let backendRequestTrace: BackendRequestTraceEntry[] = [];

const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1280x900", width: 1280, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await assertPortAvailable(frontendPort);
  await assertPortAvailable(backendPort);
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  backendServer = await startFixtureBackend();
  frontendProcess = spawn(
    process.execPath,
    [path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(frontendPort)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
      },
      stdio: "pipe",
      windowsHide: true,
    },
  );
  await waitForFrontend();
});

test.afterAll(async () => {
  frontendProcess?.kill();
  await new Promise<void>((resolve) => backendServer?.close(() => resolve()));
});

test.afterEach(() => {
  fixtureMode = "success";
});

test("query parser canonicalizes the preserved navbar q alias", () => {
  expect(parseDiscoveryQuery({ q: "  Galaxy   A55 " })).toEqual({
    page: 1,
    sort: "newest",
    search: "Galaxy A55",
  });
  expect(parseDiscoveryQuery({ q: "phone", search: "tablet" }).search).toBeUndefined();
  expect(parseDiscoveryQuery({ subcategory: "Mobile-Phones" }).subcategorySlug).toBe("mobile-phones");
  expect(parseDiscoveryQuery({ subcategory: "phones", subcategorySlug: "tablets" }).subcategorySlug).toBeUndefined();
});

for (const viewport of viewports) {
  test(`Fixture-based visual QA, not production-runtime proof: category workspace at ${viewport.name}`, async ({ page }) => {
    fixtureMode = "success";
    await page.setViewportSize(viewport);
    await page.route("**/_vercel/insights/**", (route) => route.fulfill({ status: 200, body: "" }));
    await page.route("**/_vercel/speed-insights/**", (route) => route.fulfill({ status: 200, body: "" }));
    const diagnostics = collectDiagnostics(page);
    await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Electronics", level: 1 })).toBeVisible();
    await expect(page.getByTestId("approved-public-count")).toHaveText("30 products");
    await expect(page.getByTestId("discovery-product-grid")).toBeVisible();
    await expect(page.locator("[data-testid='product-card']")).toHaveCount(20);
    if (viewport.width < 1024) {
      await expect(page.getByRole("navigation", { name: "Subcategories" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Subcategories" })).toBeHidden();
      await expect(page.getByTestId("desktop-filter-rail")).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Product results pages" })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const heading = document.querySelector("h1") as HTMLElement;
      const grid = document.querySelector("[data-testid='discovery-product-grid']") as HTMLElement;
      const cards = Array.from(grid.children).map((item) => item.getBoundingClientRect());
      const style = getComputedStyle(heading);
      return {
        titleSize: Number.parseFloat(style.fontSize),
        letterSpacing: style.letterSpacing,
        gridTop: grid.getBoundingClientRect().top,
        columnCount: new Set(cards.map((card) => Math.round(card.top))).size > 0
          ? cards.filter((card) => Math.abs(card.top - cards[0].top) < 1).length
          : 0,
        firstRowWidths: cards.filter((card) => Math.abs(card.top - cards[0].top) < 1).map((card) => card.width),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(geometry.letterSpacing === "normal" || Number.parseFloat(geometry.letterSpacing) === 0).toBe(true);
    expect(geometry.overflow).toBe(0);
    expect(geometry.gridTop).toBeLessThan(viewport.height);
    if (viewport.width < 768) expect(geometry.titleSize).toBeGreaterThanOrEqual(24);
    if (viewport.width < 768) expect(geometry.titleSize).toBeLessThanOrEqual(28);
    if (viewport.width === 768) expect(geometry.columnCount).toBe(3);
    if (viewport.width === 1024) expect(geometry.columnCount).toBe(4);
    if (viewport.width >= 1280) {
      expect(geometry.columnCount).toBe(4);
      for (const width of geometry.firstRowWidths) {
        expect(width).toBeGreaterThanOrEqual(211);
        expect(width).toBeLessThanOrEqual(221);
      }
    }

    const next = page.getByRole("link", { name: "Next", exact: true });
    await next.focus();
    await expect(next).toBeFocused();
    const nextBox = await next.boundingBox();
    expect(nextBox?.height).toBeGreaterThanOrEqual(44);
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.screenshot({ path: path.join(screenshotDirectory, `category-${viewport.name}-viewport.png`), fullPage: false });
    await page.screenshot({ path: path.join(screenshotDirectory, `category-${viewport.name}-full.png`), fullPage: true });
  });
}

test("all-products and search use the shared listing workspace", async ({ page }) => {
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "All products" })).toBeVisible();
  await expect(page.locator("[data-testid='product-card']")).toHaveCount(20);

  await page.goto(`${frontendBaseUrl}/search?q=Product`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Search results for “Product”" })).toBeVisible();
  await expect(page.locator("[data-testid='product-card']")).toHaveCount(20);
});

test("true empty and filtered zero remain distinct", async ({ page }) => {
  fixtureMode = "true-empty";
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-true-empty")).toBeVisible();
  await expect(page.getByTestId("approved-public-count")).toHaveText("0 products");

  fixtureMode = "filtered-zero";
  await page.goto(`${frontendBaseUrl}/category/electronics?subcategorySlug=phones`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-filtered-zero")).toBeVisible();
  await expect(page.getByTestId("approved-public-count")).toHaveText("30 products");
});

test("search zero and empty search use explicit search states", async ({ page }) => {
  fixtureMode = "search-zero";
  await page.goto(`${frontendBaseUrl}/search?search=missing`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-search-zero")).toContainText("No products found for “missing”");

  await page.goto(`${frontendBaseUrl}/search`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-search-idle")).toContainText("Search Zogular products");
});

test("unknown category uses not-found without fabricated category copy", async ({ page }) => {
  await page.goto(`${frontendBaseUrl}/category/invented-category`, { waitUntil: "networkidle" });
  await expect(page.getByText("404 - Lost in Transit")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invented Category" })).toHaveCount(0);
});

test("metadata failure and malformed product responses remain failure states", async ({ page }) => {
  fixtureMode = "metadata-failure";
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-metadata-failure")).toBeVisible();
  await expect(page.getByText("30 products")).toHaveCount(0);

  fixtureMode = "malformed";
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-product-failure")).toBeVisible();
  await expect(page.getByText("No products to display")).toHaveCount(0);
});

test("known category metadata survives product failure and Retry is real", async ({ page }) => {
  fixtureMode = "product-failure";
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Electronics" })).toBeVisible();
  await expect(page.getByText(/\b\d[\d,]*\s+approved products\b|showing\s+\d|\b0\s+products\b/i)).toHaveCount(0);
  await expect(page.getByTestId("listing-product-failure")).toBeVisible();
  await expect(page.getByText("No products to display")).toHaveCount(0);

  fixtureMode = "success";
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("[data-testid='product-card']")).toHaveCount(20);
});

test("out-of-range pages resolve once without redirect loops", async ({ page }) => {
  fixtureMode = "out-of-range";
  backendRequestTrace = [];
  const listingRequests: Array<{ url: string; pathname: string; query: Record<string, string>; resourceType: string; navigation: boolean; phase: string }> = [];
  const mainFrameNavigations: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/products")) {
      const url = new URL(request.url());
      listingRequests.push({
        url: url.toString(),
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams),
        resourceType: request.resourceType(),
        navigation: request.isNavigationRequest(),
        phase: request.isNavigationRequest()
          ? "document-navigation"
          : url.pathname === "/products" && url.searchParams.size === 1 && url.searchParams.has("_rsc")
            ? "shell-link-prefetch"
            : url.searchParams.has("_rsc")
              ? "listing-rsc-request"
              : "other",
      });
    }
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations.push(frame.url());
  });
  await page.goto(`${frontendBaseUrl}/products?page=9`, { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?page=9`);
  const settledBackendRequestCount = backendRequestTrace.length;
  const settledListingRequestCount = listingRequests.length;
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

  console.log(`PACKAGE5_OUT_OF_RANGE_TRACE=${JSON.stringify(listingRequests)}`);
  console.log(`PACKAGE5_BACKEND_TRACE=${JSON.stringify(backendRequestTrace)}`);
  expect(mainFrameNavigations).toHaveLength(2);
  expect(new Set(mainFrameNavigations)).toEqual(new Set([`${frontendBaseUrl}/products?page=9`]));
  expect(listingRequests.filter((request) => request.phase === "document-navigation")).toHaveLength(1);
  expect(listingRequests.filter((request) => request.phase === "shell-link-prefetch")).toHaveLength(2);
  expect(listingRequests.filter((request) => request.phase === "listing-rsc-request")).toEqual([]);
  expect(listingRequests).toHaveLength(3);
  expect(listingRequests.length).toBe(settledListingRequestCount);
  const categoryMetadataRequests = backendRequestTrace.filter((request) => request.phase === "category-metadata");
  const productBackendRequests = backendRequestTrace.filter((request) => request.pathname === "/api/v1/products");
  expect(productBackendRequests).toEqual([
    { url: "/api/v1/products?page=9&limit=20&sort=newest", pathname: "/api/v1/products", query: { page: "9", limit: "20", sort: "newest" }, phase: "requested-page" },
    { url: "/api/v1/products?page=2&limit=20&sort=newest", pathname: "/api/v1/products", query: { page: "2", limit: "20", sort: "newest" }, phase: "resolved-last-page" },
  ]);
  expect(categoryMetadataRequests).toHaveLength(
    1 + listingRequests.filter((request) => request.phase === "shell-link-prefetch").length + (mainFrameNavigations.length - 1),
  );
  expect(backendRequestTrace).toHaveLength(categoryMetadataRequests.length + productBackendRequests.length);
  expect(new Set(productBackendRequests.map((request) => request.url)).size).toBe(productBackendRequests.length);
  expect(backendRequestTrace.length).toBe(settledBackendRequestCount);
});

test("pagination and browser Back/Forward restore rendered query state", async ({ page }) => {
  await page.goto(`${frontendBaseUrl}/products?search=Product`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?search=Product&page=2`);
  await expect(page.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  await page.goBack({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?search=Product`);
  await expect(page.getByRole("link", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
  await page.goForward({ waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
});

function collectDiagnostics(page: Page) {
  const diagnostics = { consoleErrors: [] as string[], pageErrors: [] as string[], failedRequests: [] as string[], badResponses: [] as string[] };
  page.on("console", (message) => { if (message.type() === "error") diagnostics.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "failed";
    if (!failure.includes("ERR_ABORTED")) diagnostics.failedRequests.push(`${failure} ${request.url()}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    const isLocalTelemetry = url.includes("/_vercel/insights/") || url.includes("/_vercel/speed-insights/");
    if (response.status() >= 400 && !isLocalTelemetry) diagnostics.badResponses.push(`${response.status()} ${url}`);
  });
  return diagnostics;
}

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
  });
}

async function startFixtureBackend(): Promise<Server> {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${backendPort}`);
    response.setHeader("content-type", "application/json");

    if (url.pathname === "/api/v1/categories") {
      backendRequestTrace.push({ url: `${url.pathname}${url.search}`, pathname: url.pathname, query: Object.fromEntries(url.searchParams), phase: "category-metadata" });
      if (fixtureMode === "metadata-failure") return send(response, 503, { status: "fail", message: "Fixture category failure" });
      const count = fixtureMode === "true-empty" ? 0 : 30;
      return send(response, 200, { status: "success", results: 1, data: { categories: [categoryFixture(count)] } });
    }

    if (url.pathname === "/api/v1/products") {
      const page = Number(url.searchParams.get("page") ?? "1");
      backendRequestTrace.push({
        url: `${url.pathname}${url.search}`,
        pathname: url.pathname,
        query: Object.fromEntries(url.searchParams),
        phase: page === 9 ? "requested-page" : page === 2 ? "resolved-last-page" : "other-product-page",
      });
      if (fixtureMode === "product-failure") return send(response, 503, { status: "fail", message: "Fixture product failure" });
      if (fixtureMode === "malformed") return send(response, 200, { status: "success", data: { products: [] } });
      if (fixtureMode === "out-of-range" && page === 9) {
        return send(response, 200, productPayload([], 9, 20, 30, 2));
      }
      const empty = fixtureMode === "true-empty" || fixtureMode === "filtered-zero" || fixtureMode === "search-zero";
      const total = empty ? 0 : 30;
      const products = empty ? [] : Array.from({ length: page === 2 ? 10 : 20 }, (_, index) => productFixture((page - 1) * 20 + index + 1));
      return send(response, 200, productPayload(products, page, 20, total, Math.ceil(total / 20)));
    }

    return send(response, 404, { status: "fail", message: "Fixture endpoint not found" });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(backendPort, "127.0.0.1", () => resolve());
  });
  return server;
}

function categoryFixture(productCount: number) {
  return {
    id: "category-1", name: "Electronics", slug: "electronics", description: "Phones, computers, and approved electronics.", icon: null,
    parentId: null, isActive: true, sortOrder: 1, _count: { products: productCount },
    children: [{ id: "subcategory-1", name: "Phones", slug: "phones", description: null, icon: null, parentId: "category-1", isActive: true, sortOrder: 1, _count: { products: productCount }, children: [] }],
  };
}

function productFixture(index: number) {
  return {
    id: `product-${index}`, slug: `product-${index}`, title: `Product ${index}`, description: "Fixture product", price: 100 + index,
    salePrice: null, stock: 4, categoryRef: { id: "category-1", name: "Electronics", slug: "electronics", parentId: null },
    categorySlug: "electronics", subcategorySlug: "phones", images: [], reviews: [], user: { id: "owner-1" }, createdAt: "2026-08-01T00:00:00.000Z",
  };
}

function productPayload(products: unknown[], page: number, limit: number, total: number, pages: number) {
  return { status: "success", results: products.length, pagination: { page, limit, total, pages }, data: { products } };
}

function send(response: http.ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.end(JSON.stringify(payload));
}

async function waitForFrontend() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${frontendBaseUrl}/products`);
      if (response.ok) return;
    } catch {
      // The isolated production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the isolated Package 5 frontend fixture.");
}
