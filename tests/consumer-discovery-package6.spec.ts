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
const correctionEvidenceDirectory = path.resolve("output/playwright/consumer-discovery-correction-package4");
const package6EvidenceDirectory = path.resolve("output/playwright/consumer-discovery-correction-package6");
const package6bEvidenceDirectory = path.resolve("output/playwright/consumer-discovery-correction-package6b");

type FixtureMode = "success" | "delayed-success" | "true-empty" | "filtered-zero" | "product-failure" | "delayed-product-failure" | "category-filter-failure" | "malformed";
let fixtureMode: FixtureMode = "success";
let backendServer: Server;
let frontendProcess: ChildProcess;
const package4Timings: Array<{ action: string; milliseconds: number }> = [];

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
  fs.mkdirSync(correctionEvidenceDirectory, { recursive: true });
  fs.mkdirSync(package6EvidenceDirectory, { recursive: true });
  fs.mkdirSync(package6bEvidenceDirectory, { recursive: true });
  backendServer = await startFixtureBackend();
  frontendProcess = spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(frontendPort)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      INTERNAL_BACKEND_URL: `http://127.0.0.1:${backendPort}/api/v1`,
      ADMIN_API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
    },
    stdio: "ignore",
    windowsHide: true,
  });
  await waitForFrontend();
});

test.afterAll(async () => {
  fs.writeFileSync(
    path.join(correctionEvidenceDirectory, "timings.json"),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), measurements: package4Timings }, null, 2)}\n`,
  );
  await stopFrontendProcess();
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
    await expect(page.getByText("Browse products available on Zogular.")).toBeVisible();
    await expect(page.getByText(/approved products|approved public|buyer-visible/i)).toHaveCount(0);

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
      expect(geometry.columns).toBe(4);
      if (viewport.width >= 1280) {
        for (const width of geometry.cardWidths) {
          expect(width).toBeGreaterThanOrEqual(211);
          expect(width).toBeLessThanOrEqual(221);
        }
      }
    }
    if (viewport.width < 768) {
      await assertMobileBottomNavigation(page, viewport.height);
      await page.screenshot({ path: path.join(package6bEvidenceDirectory, `successful-listing-${viewport.name}.png`), fullPage: false });
    } else {
      await expect(page.getByTestId("mobile-bottom-navigation")).toBeHidden();
    }
    expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });
    await page.screenshot({ path: path.join(evidenceDirectory, `products-${viewport.name}.png`), fullPage: false });
    await page.screenshot({ path: path.join(correctionEvidenceDirectory, `products-${viewport.name}.png`), fullPage: false });
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
  let mainFrameNavigations = 0;
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) mainFrameNavigations += 1; });
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?categorySlug=electronics`);
  await page.getByRole("button", { name: /^Sort/ }).click();
  await page.getByRole("button", { name: "Price: low to high" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?categorySlug=electronics&sort=price_asc`);
  await expect(page.getByTestId("active-filter-chips")).toContainText("Electronics");
  await expect(page.getByTestId("active-filter-chips")).toContainText("Price: low to high");
  expect(mainFrameNavigations).toBe(2);

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
  const sheet = page.getByTestId("mobile-sort-sheet");
  await expect(sheet).toBeVisible();
  await waitForStableRect(sheet);
  await page.screenshot({ path: path.join(evidenceDirectory, "sort-sheet-open-414x896.png"), fullPage: false });
  const actionGeometry = await page.getByTestId("mobile-sort-footer").evaluate((element) => {
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
  const dialog = page.getByTestId("mobile-sort-dialog");
  await expect(dialog).toHaveJSProperty("open", true);
  await expect(page.getByRole("heading", { name: "Sort products" })).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-describedby", /.+/);
  await expect(page.getByRole("button", { name: "Close sort options" })).toBeFocused();
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
  const filterDialog = page.getByTestId("mobile-filter-dialog");
  await expect(filterDialog).toHaveJSProperty("open", true);
  await page.getByRole("button", { name: "Close filters" }).click();
  await expect(filterDialog).not.toHaveJSProperty("open", true);
  await filterTrigger.click();
  await expect(filterDialog).toHaveJSProperty("open", true);
  await page.getByRole("button", { name: "Close filters" }).click();
  await expect(filterDialog).not.toHaveJSProperty("open", true);
  await expect(filterTrigger).toBeFocused();

  const residue = await page.evaluate(() => ({
    openDialogs: document.querySelectorAll("dialog[open]").length,
    ariaHiddenNodes: document.querySelectorAll("[aria-hidden='true']").length,
    bodyOverflow: document.body.style.overflow,
  }));
  expect(residue).toEqual({ openDialogs: 0, ariaHiddenNodes: initialAriaHiddenNodes, bodyOverflow: "" });
});

test("desktop draft filters, chips, sort, and browser Back/Forward stay canonical", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${frontendBaseUrl}/products?page=2`, { waitUntil: "networkidle" });
  const rail = page.getByTestId("desktop-filter-rail");
  await rail.getByRole("button", { name: "Electronics" }).click();
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?page=2`);
  await rail.getByRole("button", { name: "Apply" }).click();
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
  await page.setViewportSize({ width: 390, height: 844 });
  fixtureMode = "true-empty";
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-true-empty")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No products in this category yet" })).toBeVisible();
  await expect(page.getByText("Try another category or search all products.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse all products" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
  fixtureMode = "filtered-zero";
  await page.goto(`${frontendBaseUrl}/category/electronics?subcategorySlug=phones`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-filtered-zero")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No matches for these filters" })).toBeVisible();
  await expect(page.getByText("Change a filter to see more products.")).toBeVisible();
  await page.getByRole("button", { name: "Edit filters" }).click();
  await expect(page.getByTestId("mobile-filter-dialog")).toHaveJSProperty("open", true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Edit filters" })).toBeFocused();
  fixtureMode = "product-failure";
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-product-failure")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Products could not load" })).toBeVisible();
  await expect(page.getByText("Check your connection and try again.")).toBeVisible();
  await expect(page.getByText(/\b\d[\d,]*\s+approved products\b|showing\s+\d|\b0\s+products\b/i)).toHaveCount(0);
  fixtureMode = "malformed";
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("listing-product-failure")).toBeVisible();
  await expect(page.getByText(/\b\d[\d,]*\s+approved products\b|showing\s+\d|\b0\s+products\b/i)).toHaveCount(0);
});

test("optional category-filter failure does not hide successful products", async ({ page }) => {
  fixtureMode = "category-filter-failure";
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await expect(page.locator("[data-testid='product-card']")).toHaveCount(20);
  await expect(page.getByTestId("desktop-filter-rail")).toContainText("Category filters are unavailable right now.");
  await expect(page.getByTestId("listing-product-failure")).toHaveCount(0);
});

for (const viewport of viewports.filter(({ width }) => width !== 1280)) {
  test(`fixture-based visual QA, not production-runtime proof: truthful states at ${viewport.name}`, async ({ browser }) => {
    const aggregateDiagnostics = { consoleErrors: [] as string[], pageErrors: [] as string[], failedRequests: [] as string[], badResponses: [] as string[] };

    async function runScenario(
      mode: FixtureMode,
      route: string,
      assertions: (scenarioPage: Page) => Promise<void>,
    ) {
      fixtureMode = mode;
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const scenarioPage = await context.newPage();
      await ignoreLocalTelemetry(scenarioPage);
      const diagnostics = collectDiagnostics(scenarioPage, [503]);
      try {
        await scenarioPage.goto(`${frontendBaseUrl}${route}`, { waitUntil: "networkidle" });
        await assertions(scenarioPage);
        await settleScenarioPage(scenarioPage);
      } finally {
        await context.close();
        aggregateDiagnostics.consoleErrors.push(...diagnostics.consoleErrors);
        aggregateDiagnostics.pageErrors.push(...diagnostics.pageErrors);
        aggregateDiagnostics.failedRequests.push(...diagnostics.failedRequests);
        aggregateDiagnostics.badResponses.push(...diagnostics.badResponses);
      }
    }

    await runScenario("true-empty", "/", async (scenarioPage) => {
      await expect(scenarioPage.getByRole("heading", { name: "Explore Zogular." })).toBeVisible();
      const browseProducts = scenarioPage.getByRole("link", { name: "Browse products" });
      const searchProducts = scenarioPage.getByRole("link", { name: "Search" });
      await expect(browseProducts).toBeVisible();
      await expect(searchProducts).toBeVisible();
      if (viewport.width < 768) {
        const [browseBox, searchBox] = await Promise.all([browseProducts.boundingBox(), searchProducts.boundingBox()]);
        expect(browseBox).not.toBeNull();
        expect(searchBox).not.toBeNull();
        expect(Math.abs(browseBox!.y - searchBox!.y)).toBeLessThanOrEqual(1);
        await assertMobileBottomNavigation(scenarioPage, viewport.height);
      }
      await assertContained(scenarioPage);
      await scenarioPage.screenshot({ path: path.join(package6EvidenceDirectory, `homepage-no-products-${viewport.name}.png`), fullPage: false });
      if (viewport.width < 768) await scenarioPage.screenshot({ path: path.join(package6bEvidenceDirectory, `homepage-no-products-${viewport.name}.png`), fullPage: false });
    });

    await runScenario("true-empty", "/category/electronics", async (scenarioPage) => {
      await expect(scenarioPage.getByTestId("listing-true-empty")).toBeVisible();
      await expect(scenarioPage.getByText(/approved products?/i)).toHaveCount(0);
      if (viewport.width >= 1024) await expect(scenarioPage.getByTestId("desktop-filter-rail")).toBeVisible();
      await assertContained(scenarioPage);
      if (viewport.width < 768) await assertMobileBottomNavigation(scenarioPage, viewport.height);
      await scenarioPage.screenshot({ path: path.join(package6EvidenceDirectory, `true-empty-${viewport.name}.png`), fullPage: false });
      if (viewport.width < 768) await scenarioPage.screenshot({ path: path.join(package6bEvidenceDirectory, `true-empty-${viewport.name}.png`), fullPage: false });
      if (viewport.width < 768) await assertStateActionsClearNavigation(scenarioPage, "listing-true-empty");
    });

    await runScenario("filtered-zero", "/category/electronics?subcategorySlug=phones", async (scenarioPage) => {
      await expect(scenarioPage.getByTestId("listing-filtered-zero")).toBeVisible();
      await expect(scenarioPage.getByText(/approved products?/i)).toHaveCount(0);
      if (viewport.width >= 1024) await expect(scenarioPage.getByTestId("desktop-filter-rail")).toBeVisible();
      await assertContained(scenarioPage);
      if (viewport.width < 768) await assertMobileBottomNavigation(scenarioPage, viewport.height);
      await scenarioPage.screenshot({ path: path.join(package6EvidenceDirectory, `filtered-zero-${viewport.name}.png`), fullPage: false });
      if (viewport.width < 768) await scenarioPage.screenshot({ path: path.join(package6bEvidenceDirectory, `filtered-zero-${viewport.name}.png`), fullPage: false });
      if (viewport.width < 768) await assertStateActionsClearNavigation(scenarioPage, "listing-filtered-zero");
    });

    await runScenario("product-failure", "/category/electronics", async (scenarioPage) => {
      await expect(scenarioPage.getByTestId("listing-product-failure")).toBeVisible();
      if (viewport.width >= 1024) await expect(scenarioPage.getByTestId("desktop-filter-rail")).toBeVisible();
      await expect(scenarioPage.getByText(/\b\d[\d,]*\s+approved products\b|showing\s+\d|\b0\s+products\b/i)).toHaveCount(0);
      await assertContained(scenarioPage);
      if (viewport.width < 768) await assertMobileBottomNavigation(scenarioPage, viewport.height);
      await scenarioPage.screenshot({ path: path.join(package6EvidenceDirectory, `request-failure-${viewport.name}.png`), fullPage: false });
      if (viewport.width < 768) await scenarioPage.screenshot({ path: path.join(package6bEvidenceDirectory, `request-failure-${viewport.name}.png`), fullPage: false });
      if (viewport.width < 768) await assertStateActionsClearNavigation(scenarioPage, "listing-product-failure");
    });

    expect(aggregateDiagnostics).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });
  });
}

test("mobile bottom navigation fails closed while authentication is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  const nav = page.getByTestId("mobile-bottom-navigation");
  await expect(nav.getByRole("link")).toHaveCount(3);
  await expect(nav.getByRole("link")).toHaveText(["Home", "Categories", "Cart"]);
  await expect(nav.getByRole("link", { name: "Cart" })).toHaveAttribute("href", "/cart");
  await expect(nav.getByRole("link", { name: /Saved|Wishlist|Orders|Account/ })).toHaveCount(0);
  const categoriesLink = page.getByTestId("mobile-bottom-navigation").getByRole("link", { name: "Categories" });
  await categoriesLink.focus();
  await expect(categoriesLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${frontendBaseUrl}/categories`);
});

test("authenticated mobile navigation hydrates with stable account destinations", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ignoreLocalTelemetry(page);
  await page.route("**/api/backend/cart", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: {
          cart: {
            id: "11111111-1111-4111-a111-111111111111",
            items: [],
            summary: { totalItems: 0, uniqueItems: 0, subtotal: 0 },
          },
        },
      }),
    });
  });
  await page.route("**/api/backend/user/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "success",
        data: {
          user: {
            id: "package-6-buyer",
            firstName: "QA",
            lastName: "Buyer",
            email: "qa-buyer@example.test",
            role: "USER",
            telephone: "0970000000",
            emailVerified: true,
          },
        },
      }),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("zogular_auth_user", JSON.stringify({
      id: "package-6-buyer",
      firstName: "QA",
      lastName: "Buyer",
      email: "qa-buyer@example.test",
      role: "buyer",
    }));
  });
  const diagnostics = collectDiagnostics(page);

  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });

  const nav = page.getByTestId("mobile-bottom-navigation");
  await expect(nav.getByRole("link", { name: "Orders" })).toHaveAttribute("href", "/account/orders");
  await expect(nav.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
  expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });
});

test("PDP and operational routes do not render the discovery bottom navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/product/fixture-product", "/cart", "/checkout", "/auth/login"]) {
    await page.goto(`${frontendBaseUrl}${route}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mobile-bottom-navigation")).toHaveCount(0);
  }
});

test("mobile and desktop navigation acknowledge Apply immediately without stale results", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^Filter/ }).click();
  await page.getByRole("button", { name: "Electronics" }).click();
  fixtureMode = "delayed-success";
  await installPendingMeasurement(page, "mobile-filter-footer");
  await page.getByTestId("mobile-filter-footer").getByRole("button", { name: "Apply" }).click();
  const mobileTiming = await readPendingMeasurement(page);
  package4Timings.push({ action: "mobile-filter-apply", milliseconds: mobileTiming });
  expect(mobileTiming).toBeLessThanOrEqual(100);
  await expect(page.getByTestId("mobile-filter-dialog")).not.toHaveJSProperty("open", true);
  await expect(page.getByTestId("listing-pending-state")).toBeVisible();
  await expect(page.getByTestId("listing-toolbar")).toContainText("Updating products…");
  await expect(page.locator("[data-testid='product-card']")).toHaveCount(0);
  await expect(page.getByTestId("active-filter-chips")).toHaveCount(0);
  await page.screenshot({ path: path.join(correctionEvidenceDirectory, "mobile-filter-pending-390x844.png"), fullPage: false });
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?categorySlug=electronics`);
  await expect(page.locator("[data-testid='product-card']")).toHaveCount(20);

  fixtureMode = "delayed-product-failure";
  await page.getByRole("button", { name: /^Sort/ }).click();
  await page.getByRole("button", { name: "Price: low to high" }).click();
  await installPendingMeasurement(page, "mobile-sort-footer");
  await page.getByTestId("mobile-sort-footer").getByRole("button", { name: "Apply" }).click();
  const mobileSortTiming = await readPendingMeasurement(page);
  package4Timings.push({ action: "mobile-sort-apply", milliseconds: mobileSortTiming });
  expect(mobileSortTiming).toBeLessThanOrEqual(100);
  await page.screenshot({ path: path.join(correctionEvidenceDirectory, "mobile-sort-pending-390x844.png"), fullPage: false });
  await expect(page.getByTestId("listing-product-failure")).toBeVisible();
  await expect(page.getByText(/Showing\s+\d|\b\d[\d,]*\s+approved products\b/i)).toHaveCount(0);
  await page.screenshot({ path: path.join(correctionEvidenceDirectory, "failure-after-pending-390x844.png"), fullPage: false });

  fixtureMode = "success";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  const rail = page.getByTestId("desktop-filter-rail");
  await rail.getByRole("button", { name: "Electronics" }).click();
  fixtureMode = "delayed-success";
  await installPendingMeasurement(page, "desktop-filter-rail");
  await rail.getByRole("button", { name: "Apply" }).click();
  const desktopTiming = await readPendingMeasurement(page);
  package4Timings.push({ action: "desktop-filter-apply", milliseconds: desktopTiming });
  expect(desktopTiming).toBeLessThanOrEqual(100);
  await expect(page.getByTestId("listing-pending-state")).toBeVisible();
  await expect(page.locator("[data-testid='product-card']")).toHaveCount(0);
  await page.screenshot({ path: path.join(correctionEvidenceDirectory, "desktop-filter-pending-1440x900.png"), fullPage: false });
  await expect(page).toHaveURL(`${frontendBaseUrl}/products?categorySlug=electronics`);
});

test("cancel closes without navigation, request, or pending feedback", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const listingRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "fetch" && new URL(request.url()).pathname === "/products") listingRequests.push(request.url());
  });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  const before = listingRequests.length;
  await page.getByRole("button", { name: /^Filter/ }).click();
  await page.getByRole("button", { name: "Electronics" }).click();
  await page.getByTestId("mobile-filter-footer").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("mobile-filter-dialog")).not.toHaveJSProperty("open", true);
  await expect(page.getByTestId("listing-pending-state")).toHaveCount(0);
  expect(listingRequests).toHaveLength(before);
  await expect(page).toHaveURL(`${frontendBaseUrl}/products`);
  await page.screenshot({ path: path.join(correctionEvidenceDirectory, "mobile-filter-cancelled-390x844.png"), fullPage: false });
});

test("category, all-products, and search routes expose the appropriate responsive filter surface", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontendBaseUrl}/search?search=Fixture`, { waitUntil: "networkidle" });
  await expect(page.getByText("Products matching your search.")).toBeVisible();
  await expect(page.getByText(/approved products|approved public|buyer-visible/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Filter/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sort/ })).toBeVisible();
  await expect(page.getByTestId("desktop-filter-rail")).toBeHidden();

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`${frontendBaseUrl}/products`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("desktop-filter-rail")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Sort products" })).toBeVisible();
  await page.goto(`${frontendBaseUrl}/category/electronics`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("desktop-filter-rail")).toContainText("Phones");
  await page.goto(`${frontendBaseUrl}/search?search=Fixture`, { waitUntil: "networkidle" });
  await expect(page.getByTestId("desktop-filter-rail")).toBeVisible();
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

async function assertContained(page: Page) {
  const geometry = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    viewportWidth: document.documentElement.clientWidth,
    controls: Array.from(document.querySelectorAll<HTMLElement>("a, button"))
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "" };
      }),
  }));
  expect(geometry.overflow).toBe(0);
  for (const control of geometry.controls) {
    expect(control.left, control.label).toBeGreaterThanOrEqual(-0.5);
    expect(control.right, control.label).toBeLessThanOrEqual(geometry.viewportWidth + 0.5);
  }
}

async function assertMobileBottomNavigation(page: Page, viewportHeight: number) {
  const nav = page.getByTestId("mobile-bottom-navigation");
  await expect(nav).toBeVisible();
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(3);
  await expect(links).toHaveText(["Home", "Categories", "Cart"]);
  const geometry = await nav.evaluate((element) => ({
    nav: element.getBoundingClientRect().toJSON(),
    links: Array.from(element.querySelectorAll("a")).map((link) => link.getBoundingClientRect().toJSON()),
  }));
  expect(geometry.nav.bottom).toBeLessThanOrEqual(viewportHeight + 0.5);
  expect(geometry.nav.top).toBeGreaterThanOrEqual(0);
  for (const link of geometry.links) {
    expect(link.height).toBeGreaterThanOrEqual(44);
    expect(link.left).toBeGreaterThanOrEqual(-0.5);
    expect(link.right).toBeLessThanOrEqual(geometry.nav.right + 0.5);
  }
}

async function assertStateActionsClearNavigation(page: Page, stateTestId: string) {
  const state = page.getByTestId(stateTestId);
  const finalAction = state.locator("a, button").last();
  await finalAction.scrollIntoViewIfNeeded();
  const geometry = await page.evaluate(({ stateId }) => {
    const navigation = document.querySelector<HTMLElement>("[data-testid='mobile-bottom-navigation']")!;
    const stateElement = document.querySelector<HTMLElement>(`[data-testid='${stateId}']`)!;
    const actions = Array.from(stateElement.querySelectorAll<HTMLElement>("a, button"));
    return {
      navTop: navigation.getBoundingClientRect().top,
      actionBottoms: actions.map((action) => action.getBoundingClientRect().bottom),
    };
  }, { stateId: stateTestId });
  for (const bottom of geometry.actionBottoms) expect(bottom).toBeLessThanOrEqual(geometry.navTop + 0.5);
}

async function installPendingMeasurement(page: Page, footerTestId: string) {
  await page.evaluate((testId) => {
    const footer = document.querySelector(`[data-testid='${testId}']`);
    const apply = Array.from(footer?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "Apply");
    if (!apply) throw new Error(`Apply control not found in ${testId}.`);
    (window as Window & { __listingPendingMs?: number }).__listingPendingMs = undefined;
    apply.addEventListener("pointerdown", () => {
      const startedAt = performance.now();
      const observer = new MutationObserver(() => {
        const pending = document.querySelector<HTMLElement>("[data-testid='listing-pending-state']");
        if (pending && pending.getClientRects().length > 0) {
          (window as Window & { __listingPendingMs?: number }).__listingPendingMs = performance.now() - startedAt;
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  }, footerTestId);
}

async function readPendingMeasurement(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as Window & { __listingPendingMs?: number }).__listingPendingMs)).toBeGreaterThanOrEqual(0);
  return page.evaluate(() => (window as Window & { __listingPendingMs?: number }).__listingPendingMs!);
}

async function ignoreLocalTelemetry(page: Page) {
  await page.route("**/_vercel/insights/**", (route) => route.fulfill({ status: 200, body: "" }));
  await page.route("**/_vercel/speed-insights/**", (route) => route.fulfill({ status: 200, body: "" }));
}

function collectDiagnostics(page: Page, expectedStatuses: number[] = []) {
  const result = { consoleErrors: [] as string[], pageErrors: [] as string[], failedRequests: [] as string[], badResponses: [] as string[] };
  page.on("console", (message) => { if (message.type() === "error") result.consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    result.failedRequests.push(JSON.stringify({
      errorText: request.failure()?.errorText ?? "Unknown request failure",
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url(),
    }));
  });
  page.on("response", (response) => { if (response.status() >= 400 && !expectedStatuses.includes(response.status()) && !response.url().includes("/_vercel/")) result.badResponses.push(`${response.status()} ${response.url()}`); });
  return result;
}

async function settleScenarioPage(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.waitForLoadState("networkidle");
}

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
  });
}

async function stopFrontendProcess() {
  if (!frontendProcess || frontendProcess.exitCode !== null) return;
  const exited = new Promise<void>((resolve) => frontendProcess.once("exit", () => resolve()));
  frontendProcess.kill();
  await Promise.race([
    exited,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Package 6 frontend process did not stop.")), 10_000)),
  ]);
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
      if (fixtureMode === "delayed-success" || fixtureMode === "delayed-product-failure") {
        return setTimeout(() => {
          if (fixtureMode === "delayed-product-failure") send(response, 503, { status: "fail", message: "Fixture failure" });
          else sendProducts(response, url);
        }, 500);
      }
      if (fixtureMode === "product-failure") return send(response, 503, { status: "fail", message: "Fixture failure" });
      if (fixtureMode === "malformed") return send(response, 200, { status: "success", data: { products: [] } });
      return sendProducts(response, url);
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

function sendProducts(response: http.ServerResponse, url: URL) {
  const page = Number(url.searchParams.get("page") ?? "1");
  const empty = fixtureMode === "true-empty" || fixtureMode === "filtered-zero";
  const products = empty ? [] : Array.from({ length: 20 }, (_, index) => product((page - 1) * 20 + index + 1));
  return send(response, 200, { status: "success", results: products.length, pagination: { page, limit: 20, total: empty ? 0 : 40, pages: empty ? 0 : 2 }, data: { products } });
}

async function waitForFrontend() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${frontendBaseUrl}/products`)).ok) return; } catch { /* Isolated server is starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the Package 6 fixture frontend.");
}
