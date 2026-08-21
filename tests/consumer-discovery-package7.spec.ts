import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const frontendPort = 3522;
const backendPort = 5522;
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
const evidenceDirectory = path.resolve("output/playwright/consumer-discovery-package7");
const legacyRoutes = ["/deals", "/trending", "/best-sellers", "/flash-sales"] as const;
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

let backendServer: Server;
let frontendProcess: ChildProcess;
const backendErrors: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  await assertPortAvailable(frontendPort);
  await assertPortAvailable(backendPort);
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  backendServer = await startFixtureBackend();
  frontendProcess = spawn(
    process.execPath,
    [path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(frontendPort)],
    {
      cwd: process.cwd(),
      env: { ...process.env, INTERNAL_BACKEND_URL: `http://127.0.0.1:${backendPort}/api/v1`, NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backendPort}/api/v1`, ADMIN_API_URL: `http://127.0.0.1:${backendPort}/api/v1` },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  await waitForFrontend();
});

test.afterAll(async () => {
  await stopFrontendProcess();
  await new Promise<void>((resolve) => backendServer?.close(() => resolve()));
  expect(backendErrors).toEqual([]);
});

test("unsupported discovery promotions are absent from source navigation data", async () => {
  const navbar = fs.readFileSync(path.resolve("src/components/layout/Navbar.tsx"), "utf8");
  expect(navbar).not.toMatch(/label:\s*["']Hot Deals["']/);
  expect(navbar).not.toMatch(/label:\s*["']Best Sellers["']/);
  expect(navbar).not.toMatch(/href:\s*["']\/(?:deals|best-sellers)["']/);
  expect(navbar).toContain('{ label: "All Products", href: "/products" }');
  expect(navbar).toContain('{ label: "New Arrivals", href: "/new-arrivals" }');
  expect(navbar).not.toContain('{ label: "Electronics", href: "/category/electronics" }');
  expect(navbar).toContain("...categoryLinks.slice(0, 4)");
  expect(navbar).toContain("...categoryLinks.slice(0, 3)");
});

for (const legacyRoute of legacyRoutes) {
  test(`${legacyRoute} performs exactly one bounded internal redirect to /products`, async ({ page, request }) => {
    const response = await request.get(`${frontendBaseUrl}${legacyRoute}`, { maxRedirects: 0 });
    if (response.status() === 307) {
      expect(new URL(response.headers().location, frontendBaseUrl).pathname).toBe("/products");
    } else {
      expect(response.status()).toBe(200);
      const body = await response.text();
      expect(body).toContain('http-equiv="refresh" content="1;url=/products"');
      expect(body).toContain("NEXT_REDIRECT;replace;/products;307;");
    }

    const documents: string[] = [];
    page.on("request", (incoming) => {
      if (incoming.isNavigationRequest() && incoming.frame() === page.mainFrame()) documents.push(incoming.url());
    });
    await page.goto(`${frontendBaseUrl}${legacyRoute}`, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(`${frontendBaseUrl}/products`);
    await expect(page.getByRole("heading", { name: "All Products" })).toBeVisible();
    expect(documents.map((url) => new URL(url).pathname)).toEqual([legacyRoute, "/products"]);
  });
}

for (const viewport of viewports) {
  test(`Fixture-based visual QA, not production-runtime proof: navigation compatibility at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await ignoreLocalTelemetry(page);
    const diagnostics = collectDiagnostics(page);
    await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });

    if (viewport.width < 768) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const drawer = page.getByRole("dialog", { name: "Shop menu" });
      await expect(drawer).toHaveAttribute("data-state", "open");
      await waitForStableRect(drawer);
    }

    await expect(page.getByText("Hot Deals", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Best Sellers", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "New Arrivals", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "All Products", exact: true }).first()).toBeVisible();

    const geometry = await page.evaluate(() => {
      const visibleControls = Array.from(document.querySelectorAll<HTMLElement>("header a, header button, header input"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return { label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        })
        .filter((rect) => rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight);
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        viewportWidth: innerWidth,
        visibleControls,
        drawer: (() => {
          const rect = document.querySelector<HTMLElement>("[role='dialog']")?.getBoundingClientRect();
          return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null;
        })(),
      };
    });
    expect(geometry.overflow).toBe(0);
    for (const control of geometry.visibleControls) {
      expect.soft(control.left, control.label).toBeGreaterThanOrEqual(-0.5);
      expect.soft(control.right, control.label).toBeLessThanOrEqual(geometry.viewportWidth + 0.5);
    }
    if (geometry.drawer) {
      expect(geometry.drawer.left).toBeGreaterThanOrEqual(-0.5);
      expect(geometry.drawer.right).toBeLessThanOrEqual(geometry.viewportWidth + 0.5);
      expect(geometry.drawer.top).toBeGreaterThanOrEqual(-0.5);
      expect(geometry.drawer.bottom).toBeLessThanOrEqual(viewport.height + 0.5);
    }
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });

    if (["320x568", "390x844", "1440x900"].includes(viewport.name)) {
      await page.screenshot({ path: path.join(evidenceDirectory, `navigation-${viewport.name}.png`), fullPage: false });
    }
  });
}

test("mobile drawer and category drilldown contain focus and restore it exactly", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.route("**/api/backend/categories", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "success",
      results: 2,
      data: { categories: [category("electronics", "Electronics", ["Phones", "Computers"]), category("fashion", "Fashion", ["Clothing"])] },
    }),
  }));
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "Open menu" });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Shop menu" });
  await expect(drawer).toHaveAttribute("data-state", "open");
  await waitForStableRect(drawer);
  await expect(drawer.getByText("Shop by department", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Hot Deals", { exact: true })).toHaveCount(0);
  await expect(drawer.getByText("Best Sellers", { exact: true })).toHaveCount(0);
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: path.join(evidenceDirectory, "mobile-category-root-320x568.png"), fullPage: false });

  const focusables = drawer.locator('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])');
  await focusables.last().focus();
  await page.keyboard.press("Tab");
  await expect(focusables.first()).toBeFocused();

  await drawer.getByRole("button", { name: /Electronics/ }).click();
  const detailPanel = drawer.getByText("Browse Electronics", { exact: true }).locator("..");
  const shopAll = drawer.getByRole("link", { name: "Shop all Electronics" });
  const detailSamples = await waitForStableRect(detailPanel);
  expect(await visiblyIntersects(detailPanel, drawer)).toBe(true);
  await expect(shopAll).toBeVisible();
  await page.screenshot({ path: path.join(evidenceDirectory, "mobile-category-drilldown-320x568.png"), fullPage: false });
  await drawer.getByRole("button", { name: "Back to categories" }).click();
  const rootCategory = drawer.getByRole("button", { name: /Electronics/ });
  const reverseSamples = await waitForStableRect(detailPanel);
  expect(await visiblyIntersects(detailPanel, drawer)).toBe(false);
  expect(await visiblyIntersects(rootCategory, drawer)).toBe(true);
  expect(detailSamples.length).toBeGreaterThanOrEqual(3);
  expect(reverseSamples.length).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: path.join(evidenceDirectory, "mobile-category-returned-root-320x568.png"), fullPage: false });
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const viewport of viewports.slice(0, 3)) {
  test(`slow-scroll navbar records one hide and one reveal at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
    const mobileSearch = page.getByTestId("mobile-navbar-search");
    const transitions: Array<{ y: number; hidden: string | null }> = [];
    let previous = await mobileSearch.getAttribute("aria-hidden");

    for (let y = 0; y <= 220; y += 4) {
      await setScrollAndPause(page, y, y === 140 || y === 144 || y === 148 ? 140 : 16);
      const current = await mobileSearch.getAttribute("aria-hidden");
      if (current !== previous) {
        transitions.push({ y, hidden: current });
        previous = current;
      }
    }
    for (let y = 220; y >= 0; y -= 4) {
      await setScrollAndPause(page, y, y === 36 || y === 32 || y === 28 ? 140 : 16);
      const current = await mobileSearch.getAttribute("aria-hidden");
      if (current !== previous) {
        transitions.push({ y, hidden: current });
        previous = current;
      }
    }

    expect(transitions.filter((entry) => entry.hidden === "true")).toHaveLength(1);
    expect(transitions.filter((entry) => entry.hidden === "false")).toHaveLength(1);
    expect(transitions).toHaveLength(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}

test("search, account, cart, and supported navigation controls remain operable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Open menu" })).toBeEnabled();
  await expect(page.locator("header button").filter({ has: page.locator("svg.lucide-shopping-cart") }).first()).toBeEnabled();
  await expect(page.locator("header button").filter({ has: page.locator("svg.lucide-user") }).first()).toBeEnabled();
  const search = page.getByPlaceholder("Search products...");
  await search.fill("phone cases");
  await search.press("Enter");
  await expect(page).toHaveURL(`${frontendBaseUrl}/search?q=phone%20cases`);
});

async function setScrollAndPause(page: Page, y: number, pause: number) {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await page.waitForTimeout(pause);
}

async function waitForStableRect(locator: ReturnType<Page["locator"]>) {
  const samples: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let index = 0; index < 12; index += 1) {
    await locator.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const rect = await locator.boundingBox();
    if (!rect) throw new Error("Navigation surface rectangle is unavailable.");
    samples.push(rect);
    if (samples.length >= 3) {
      const a = samples.at(-1)!;
      const b = samples.at(-2)!;
      if (["x", "y", "width", "height"].every((key) => Math.abs(a[key as keyof typeof a] - b[key as keyof typeof b]) <= 0.5)) return samples;
    }
  }
  throw new Error(`Navigation surface did not settle: ${JSON.stringify(samples)}`);
}

async function visiblyIntersects(locator: ReturnType<Page["locator"]>, container: ReturnType<Page["locator"]>) {
  const [rect, containerRect] = await Promise.all([locator.boundingBox(), container.boundingBox()]);
  if (!rect || !containerRect) return false;
  const left = Math.max(rect.x, containerRect.x);
  const right = Math.min(rect.x + rect.width, containerRect.x + containerRect.width);
  const top = Math.max(rect.y, containerRect.y);
  const bottom = Math.min(rect.y + rect.height, containerRect.y + containerRect.height);
  return right - left > 0.5 && bottom - top > 0.5;
}

async function ignoreLocalTelemetry(page: Page) {
  await page.route("**/_vercel/insights/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/_vercel/speed-insights/**", (route) => route.fulfill({ status: 200, body: "" }));
}

function collectDiagnostics(page: Page) {
  const result = { consoleErrors: [] as string[], pageErrors: [] as string[], failedRequests: [] as string[], badResponses: [] as string[] };
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("requestfailed", (request) => result.failedRequests.push(JSON.stringify({
    errorText: request.failure()?.errorText ?? "Unknown request failure",
    method: request.method(),
    resourceType: request.resourceType(),
    url: request.url(),
  })));
  page.on("response", (response) => { if (response.status() >= 400 && !response.url().includes("/_vercel/")) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
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
    try {
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${backendPort}`);
      response.setHeader("content-type", "application/json");
    if (url.pathname === "/api/v1/categories") {
      return send(response, 200, {
        status: "success",
        results: 2,
        data: { categories: [category("electronics", "Electronics", ["Phones", "Computers"]), category("fashion", "Fashion", ["Clothing"])] },
      });
    }
    if (url.pathname === "/api/v1/products") {
      const products = Array.from({ length: 40 }, (_, index) => product(index + 1));
      return send(response, 200, { status: "success", results: 20, pagination: { page: 1, limit: 20, total: 40, pages: 2 }, data: { products: products.slice(0, 20) } });
    }
    if (url.pathname === "/api/v1/user/me") {
      if (request.headers.cookie?.includes("session") || request.headers.cookie?.includes("token")) {
        return send(response, 200, { status: "success", data: { id: "user-1", email: "user@example.com", name: "Test User", role: "BUYER" } });
      }
      return send(response, 200, { status: "success", data: null });
    }
    if (url.pathname === "/api/v1/auth/csrf-token") {
      return send(response, 200, { status: "success", data: { csrfToken: "mock-csrf-token" } });
    }
    if (url.pathname === "/api/v1/cart") {
      return send(response, 200, {
        status: "success",
        data: {
          cart: {
            id: "11111111-1111-4111-a111-111111111111",
            items: [],
            summary: { totalItems: 0, uniqueItems: 0, subtotal: 0 },
          },
        },
      });
    }
    if (url.pathname === "/api/v1/wishlist") {
      return send(response, 200, { status: "success", data: { items: [] } });
    }
    } catch (error) {
      backendErrors.push(error instanceof Error ? error.stack ?? error.message : String(error));
      return send(response, 500, { status: "fail", message: "backend error" });
    }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(backendPort, "127.0.0.1", () => resolve()); });
  return server;
}

async function stopFrontendProcess() {
  if (!frontendProcess || frontendProcess.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => frontendProcess.once("exit", () => resolve()));
  frontendProcess.kill();
  await Promise.race([
    exited,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Package 7 frontend process did not stop.")), 10_000)),
  ]);
}

function category(slug: string, name: string, children: string[]) {
  return {
    id: slug, name, slug, description: `${name} products`, icon: null, parentId: null, isActive: true, sortOrder: 1,
    _count: { products: 40 },
    children: children.map((child, index) => ({ id: `${slug}-${index}`, name: child, slug: child.toLowerCase(), description: null, icon: null, parentId: slug, isActive: true, sortOrder: index, _count: { products: 20 }, children: [] })),
  };
}

function product(index: number) {
  return {
    id: `product-${index}`, slug: `product-${index}`, title: `Fixture product ${index}`, description: "Fixture product", price: 100 + index,
    salePrice: null, stock: 4, categoryRef: { id: "electronics", name: "Electronics", slug: "electronics", parentId: null },
    categorySlug: "electronics", subcategorySlug: "phones", images: [], reviews: [], user: { id: "owner-1" }, createdAt: "2026-08-01T00:00:00.000Z",
  };
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
  throw new Error("Timed out waiting for the Package 7 fixture frontend.");
}
