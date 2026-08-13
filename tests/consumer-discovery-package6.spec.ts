import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const frontendPort = 3521;
const backendPort = 5521;
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
const evidenceDirectory = path.resolve("test-results/consumer-discovery-package6");

type FixtureMode = "success" | "true-empty" | "filtered-zero" | "product-failure" | "category-filter-failure" | "malformed";
let fixtureMode: FixtureMode = "success";
let backendServer: Server;
let frontendProcess: ChildProcess;

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
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  backendServer = await startFixtureBackend();
  frontendProcess = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(frontendPort)], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backendPort}/api/v1` },
    stdio: "pipe",
    windowsHide: true,
  });
  await waitForFrontend();
});

test.afterAll(async () => {
  frontendProcess?.kill();
  await new Promise<void>((resolve) => backendServer?.close(() => resolve()));
});

test.afterEach(() => { fixtureMode = "success"; });

for (const viewport of viewports) {
  test(`Fixture-based visual QA, not production-runtime proof: responsive filters at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await ignoreLocalTelemetry(page);
    const diagnostics = collectDiagnostics(page);
    await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("discovery-listing-controls")).toBeVisible();

    const geometry = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>("[data-testid='discovery-product-grid']");
      const rail = document.querySelector<HTMLElement>("[data-testid='desktop-filter-rail']");
      const cards = grid ? Array.from(grid.children).map((child) => child.getBoundingClientRect()) : [];
      const firstTop = cards[0]?.top;
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        columns: cards.filter((card) => Math.abs(card.top - firstTop) < 0.5).length,
        railVisible: Boolean(rail?.offsetParent),
        railRight: rail?.getBoundingClientRect().right ?? 0,
        gridLeft: grid?.getBoundingClientRect().left ?? 0,
        cardWidths: cards.filter((card) => Math.abs(card.top - firstTop) < 0.5).map((card) => card.width),
      };
    });

    expect(geometry.overflow).toBe(0);
    if (viewport.width < 1024) {
      await expect(page.getByRole("button", { name: /^Filter/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Sort/ })).toBeVisible();
      expect(geometry.railVisible).toBe(false);
      expect(geometry.columns).toBe(viewport.width < 768 ? 2 : 3);
    } else {
      await expect(page.getByTestId("desktop-filter-rail")).toBeVisible();
      expect(geometry.railRight).toBeLessThanOrEqual(geometry.gridLeft);
      expect(geometry.columns).toBe(viewport.width === 1024 ? 4 : 5);
      if (viewport.width >= 1280) {
        for (const width of geometry.cardWidths) {
          expect(width).toBeGreaterThanOrEqual(211);
          expect(width).toBeLessThanOrEqual(221);
        }
      }
    }
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });
    await page.screenshot({ path: path.join(evidenceDirectory, `products-${viewport.name}.png`), fullPage: false });
  });
}

test("mobile sheet traps focus, discards drafts, applies once, clears, and restores focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontendBaseUrl}/products?page=3`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: /^Filter/ });
  await trigger.click();
  const sheet = page.getByTestId("mobile-filter-sheet");
  await expect(sheet).toHaveAttribute("data-state", "open");
  await waitForStableRect(sheet);
  await page.screenshot({ path: path.join(evidenceDirectory, "filter-sheet-open-390x844.png"), fullPage: false });
  await page.getByRole("button", { name: "Electronics" }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?page=3`);

  await trigger.click();
  await page.getByRole("button", { name: "Electronics" }).click();
  await page.getByRole("button", { name: "Price: low to high" }).click();
  let mainFrameNavigations = 0;
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) mainFrameNavigations += 1; });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?categorySlug=electronics&sort=price_asc`);
  await expect(page.getByTestId("active-filter-chips")).toContainText("Electronics");
  await expect(page.getByTestId("active-filter-chips")).toContainText("Price: low to high");
  expect(mainFrameNavigations).toBe(1);

  await trigger.click();
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?sort=price_asc`);
  await expect(sheet).toBeHidden();
  await page.screenshot({ path: path.join(evidenceDirectory, "mobile-applied-filters-390x844.png"), fullPage: false });
});

test("backdrop dismissal discards draft and sheet blocks background interaction", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Filter/ }).click();
  await waitForStableRect(page.getByTestId("mobile-filter-sheet"));
  await page.screenshot({ path: path.join(evidenceDirectory, "filter-sheet-open-320x568.png"), fullPage: false });
  await page.getByRole("button", { name: "Phones" }).click();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.getByTestId("mobile-filter-dialog").click({ position: { x: 5, y: 5 } });
  await expect(page.getByTestId("mobile-filter-sheet")).toBeHidden();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page).toHaveURL(`${frontendBaseUrl}/category/electronics`);
});

test("keyboard activation, duplicate sort selection, reduced motion, and safe-area actions remain correct", async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: /^Sort/ });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByTestId("mobile-filter-sheet");
  await expect(sheet).toBeVisible();
  await waitForStableRect(sheet);
  const actionGeometry = await page.getByTestId("mobile-filter-footer").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const controls = Array.from(element.querySelectorAll("button")).map((button) => button.getBoundingClientRect());
    return { bottom: rect.bottom, viewport: innerHeight, controls: controls.map((control) => ({ width: control.width, height: control.height })) };
  });
  expect(actionGeometry.bottom).toBeLessThanOrEqual(actionGeometry.viewport + 0.5);
  for (const control of actionGeometry.controls) {
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
  await sheet.getByRole("button", { name: "Newest" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products`);
});

test("native dialog preserves modal focus, exact restoration, rapid activation, and cleanup", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  const filterTrigger = page.getByRole("button", { name: /^Filter/ });
  const sortTrigger = page.getByRole("button", { name: /^Sort/ });
  const initialAriaHiddenNodes = await page.locator("[aria-hidden='true']").count();

  await sortTrigger.click();
  const dialog = page.getByTestId("mobile-filter-dialog");
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(page.getByRole("heading", { name: "Filter and sort" })).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-describedby", /.+/);
  await expect(page.getByRole("button", { name: "Close filter and sort" })).toBeFocused();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

  const focusables = dialog.locator("button:not([disabled])");
  await focusables.last().focus();
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toHaveJSProperty("open", true);
  await expect(sortTrigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

  await filterTrigger.click();
  await expect(dialog).toHaveJSProperty("open", true);
  await page.getByRole("button", { name: "Close filter and sort" }).click();
  await expect(dialog).not.toHaveJSProperty("open", true);
  await filterTrigger.click();
  await expect(dialog).toHaveJSProperty("open", true);
  await page.getByRole("button", { name: "Close filter and sort" }).click();
  await expect(dialog).not.toHaveJSProperty("open", true);
  await expect(filterTrigger).toBeFocused();

  const residue = await page.evaluate(() => ({
    openDialogs: document.querySelectorAll("dialog[open]").length,
    ariaHiddenNodes: document.querySelectorAll("[aria-hidden='true']").length,
    bodyOverflow: document.body.style.overflow,
  }));
  expect(residue).toEqual({ openDialogs: 0, ariaHiddenNodes: initialAriaHiddenNodes, bodyOverflow: "" });
});

test("desktop links, chips, sort, and browser Back/Forward stay canonical", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${frontendBaseUrl}/products?page=2`, { waitUntil: "networkidle" });
  await page.getByTestId("desktop-filter-rail").getByRole("link", { name: "Electronics" }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?categorySlug=electronics`);
  await page.getByRole("combobox", { name: "Sort products" }).selectOption("price_desc");
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?categorySlug=electronics&sort=price_desc`);
  await page.goBack({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?categorySlug=electronics`);
  await page.goForward({ waitUntil: "networkidle" });
  await expect(page.getByRole("combobox", { name: "Sort products" })).toHaveValue("price_desc");
  await page.getByTestId("active-filter-chips").getByRole("link", { name: /Remove Electronics/ }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?sort=price_desc`);
});

test("unsupported controls and Most Viewed remain absent from ordinary listings", async ({ page }) => {
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  const controls = page.getByTestId("discovery-listing-controls");
  for (const unsupported of ["Price range", "Condition", "Availability", "Rating", "Seller", "Delivery", "Recommended", "Top Rated", "Most Viewed"]) {
    await expect(controls.getByText(unsupported, { exact: true })).toHaveCount(0);
  }
});

test("true-empty, filtered-zero, request-failure, and malformed-response outcomes remain distinct", async ({ page }) => {
  fixtureMode = "true-empty";
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-true-empty")).toBeVisible();
  fixtureMode = "filtered-zero";
  await page.goto(`${frontendBaseUrl}/category/electronics?subcategorySlug=phones`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-filtered-zero")).toBeVisible();
  fixtureMode = "product-failure";
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-product-failure")).toBeVisible();
  fixtureMode = "malformed";
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-product-failure")).toBeVisible();
});

test("optional category-filter failure does not hide successful products", async ({ page }) => {
  fixtureMode = "category-filter-failure";
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-testid='product-card']")).toHaveCount(20);
  await expect(page.getByTestId("desktop-filter-rail")).toContainText("Category filters are unavailable right now.");
  await expect(page.getByTestId("listing-product-failure")).toHaveCount(0);
});

async function waitForStableRect(locator: ReturnType<Page["locator"]>) {
  const samples: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let index = 0; index < 8; index += 1) {
    await locator.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const rect = await locator.boundingBox();
    if (!rect) throw new Error("Sheet rectangle is unavailable.");
    samples.push(rect);
    if (samples.length >= 3) {
      const a = samples.at(-1)!;
      const b = samples.at(-2)!;
      if (["x", "y", "width", "height"].every((key) => Math.abs(a[key as keyof typeof a] - b[key as keyof typeof b]) <= 0.5)) return samples;
    }
  }
  throw new Error(`Sheet did not settle: ${JSON.stringify(samples)}`);
}

async function ignoreLocalTelemetry(page: Page) {
  await page.route("**/_vercel/insights/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/_vercel/speed-insights/**", (route) => route.fulfill({ status: 200, body: "" }));
}

function collectDiagnostics(page: Page) {
  const result = { consoleErrors: [] as string[], pageErrors: [] as string[], failedRequests: [] as string[], badResponses: [] as string[] };
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("requestfailed", (request) => { if (!request.failure()?.errorText.includes("ERR_ABORTED")) result.failedRequests.push(request.url()); });
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
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${backendPort}`);
    response.setHeader("content-type", "application/json");
    if (url.pathname === "/api/v1/categories") {
      if (fixtureMode === "category-filter-failure") return send(response, 503, { status: "fail", message: "Fixture category failure" });
      const count = fixtureMode === "true-empty" ? 0 : 30;
      return send(response, 200, { status: "success", results: 2, data: { categories: [category("electronics", "Electronics", count, [{ id: "phones", name: "Phones", slug: "phones" }]), category("fashion", "Fashion", 12, [])] } });
    }
    if (url.pathname === "/api/v1/products") {
      if (fixtureMode === "product-failure") return send(response, 503, { status: "fail", message: "Fixture failure" });
      if (fixtureMode === "malformed") return send(response, 200, { status: "success", data: { products: [] } });
      const page = Number(url.searchParams.get("page") ?? "1");
      const empty = fixtureMode === "true-empty" || fixtureMode === "filtered-zero";
      const products = empty ? [] : Array.from({ length: 20 }, (_, index) => product((page - 1) * 20 + index + 1));
      return send(response, 200, { status: "success", results: products.length, pagination: { page, limit: 20, total: empty ? 0 : 40, pages: empty ? 0 : 2 }, data: { products } });
    }
    return send(response, 404, { status: "fail", message: "Not found" });
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(backendPort, "127.0.0.1", () => resolve()); });
  return server;
}

function category(id: string, name: string, count: number, children: Array<{ id: string; name: string; slug: string }>) {
  return { id, name, slug: id, description: `${name} products`, icon: null, parentId: null, isActive: true, sortOrder: 1, _count: { products: count }, children: children.map((child) => ({ ...child, description: null, icon: null, parentId: id, isActive: true, sortOrder: 1, _count: { products: count }, children: [] })) };
}

function product(index: number) {
  return { id: `product-${index}`, slug: `product-${index}`, title: `Fixture product ${index}`, description: "Fixture product", price: 100 + index, salePrice: null, stock: 4, categoryRef: { id: "electronics", name: "Electronics", slug: "electronics", parentId: null }, categorySlug: "electronics", subcategorySlug: "phones", images: [], reviews: [], user: { id: "owner-1" }, createdAt: "2026-08-01T00:00:00.000Z" };
}

function send(response: http.ServerResponse, status: number, payload: unknown) { response.statusCode = status; response.end(JSON.stringify(payload)); }

async function waitForFrontend() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${frontendBaseUrl}/products`)).ok) return; } catch { /* Isolated server is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the Package 6 fixture frontend.");
}
