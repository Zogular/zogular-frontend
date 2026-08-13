import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ApiError } from "../src/services/api";
import {
  classifyDiscoveryCollection,
  createDiscoveryFailure,
} from "../src/features/consumer-discovery/lib/discovery-outcomes";
import type { Product } from "../src/types/product";

const product: Product = {
  id: "product-1",
  slug: "product-1",
  title: "Product one",
  price: 100,
  rating: 0,
  reviews: 0,
  image: "",
};

test("models success, true empty, filtered zero, and typed failure distinctly", () => {
  expect(classifyDiscoveryCollection({ products: [product] })).toEqual({
    status: "success",
    products: [product],
  });
  expect(classifyDiscoveryCollection({ products: [] })).toEqual({
    status: "true-empty",
    products: [],
  });
  expect(classifyDiscoveryCollection({ products: [], hasActiveQuery: true })).toEqual({
    status: "filtered-zero",
    products: [],
  });

  const error = new ApiError("Timed out", 408);
  const retry = () => undefined;
  const failure = classifyDiscoveryCollection({ products: [], error, retry });

  expect(failure.status).toBe("failure");
  if (failure.status === "failure") {
    expect(failure.error).toBe(error);
    expect(failure.error).toBeInstanceOf(ApiError);
    expect(failure.error.status).toBe(408);
    expect(failure.retry).toBe(retry);
  }
});

test("failure cannot be normalized without an explicit retry boundary", () => {
  const error = new ApiError("Network connection failed.", 503);
  expect(() => classifyDiscoveryCollection({ products: [], error })).toThrow(
    /requires a retry boundary/i,
  );
  expect(createDiscoveryFailure(error, () => undefined).products).toEqual([]);
});

test("rail, grid, and skeleton source reuse canonical card geometry", () => {
  const rail = fs.readFileSync(
    path.resolve("src/features/consumer-discovery/components/ProductRail.tsx"),
    "utf8",
  );
  const grid = fs.readFileSync(
    path.resolve("src/features/consumer-discovery/components/ProductGrid.tsx"),
    "utf8",
  );
  const skeleton = fs.readFileSync(
    path.resolve("src/features/consumer-discovery/components/DiscoveryProductSkeleton.tsx"),
    "utf8",
  );

  for (const source of [rail, grid]) {
    expect(source).toContain('from "@/components/productCard"');
    expect(source).toContain("<ProductCard");
    expect(source).toContain("product={product}");
    expect(source).not.toMatch(/interface\s+(Discovery)?Product\b/);
  }
  expect(rail).toContain("snap-mandatory");
  expect(rail).toContain("overflow-x-auto");
  expect(rail).toContain("w-[148px]");
  expect(rail).toContain("[justify-content:safe_center]");
  expect(rail).toContain('event.key === "Home"');
  expect(rail).toContain('event.key === "End"');
  expect(skeleton).toContain("aspect-[3/4]");
  expect(skeleton).toContain('layout?: "rail" | "grid"');
});

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

function collectDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!failure.includes("ERR_ABORTED")) diagnostics.failedRequests.push(`${failure} ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
  });
  return diagnostics;
}

const browserBaseUrl = process.env.PACKAGE2_BASE_URL;
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

test.describe("Package 2 fixture-based browser contract", () => {
  test.skip(!browserBaseUrl, "PACKAGE2_BASE_URL is required for fixture-based visual QA.");

  for (const viewport of viewports) {
    test(`${viewport.name} keeps rail, grid, loading, states, and overflow truthful`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const diagnostics = collectDiagnostics(page);
      await page.goto(browserBaseUrl!, { waitUntil: "networkidle" });

      const rail = page.getByTestId("discovery-product-rail").first();
      const railCards = rail.getByTestId("product-card");
      await expect(railCards).toHaveCount(5);
      const railGeometry = await rail.evaluate((element) => {
        const cards = [...element.querySelectorAll<HTMLElement>("[data-testid='product-card']")];
        const railRect = element.getBoundingClientRect();
        const cardRects = cards.map((card) => card.getBoundingClientRect());
        return {
          cardWidths: cardRects.map((rect) => rect.width),
          firstOffset: cardRects[0].left - railRect.left,
          lastOffset: railRect.right - cardRects.at(-1)!.right,
          visibleCards: cardRects.reduce((total, rect) => {
            const visible = Math.max(0, Math.min(rect.right, railRect.right) - Math.max(rect.left, railRect.left));
            return total + visible / rect.width;
          }, 0),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        };
      });

      if (viewport.width === 320) {
        expect(railGeometry.visibleCards).toBeGreaterThan(1.25);
        expect(railGeometry.visibleCards).toBeLessThan(2.1);
      }
      if (viewport.width === 390) {
        expect(railGeometry.visibleCards).toBeGreaterThanOrEqual(2.25);
        expect(railGeometry.visibleCards).toBeLessThanOrEqual(2.5);
      }
      if (viewport.width === 1024) {
        expect(railGeometry.visibleCards).toBeGreaterThanOrEqual(4);
        expect(railGeometry.firstOffset).toBeGreaterThanOrEqual(0);
        expect(railGeometry.firstOffset).toBeLessThanOrEqual(5);
      }
      if (viewport.width === 1440) {
        expect(railGeometry.cardWidths).toEqual([216, 216, 216, 216, 216]);
        expect(railGeometry.visibleCards).toBe(5);
      }
      expect(railGeometry.scrollWidth).toBeGreaterThanOrEqual(railGeometry.clientWidth);

      await rail.focus();
      await expect(rail).toBeFocused();
      if (railGeometry.scrollWidth - railGeometry.clientWidth > 16) {
        await page.keyboard.press("End");
        await expect
          .poll(() => rail.evaluate((element) => element.scrollLeft))
          .toBeCloseTo(railGeometry.scrollWidth - railGeometry.clientWidth, 0);
        const lastReachability = await rail.evaluate((element) => {
          const railRect = element.getBoundingClientRect();
          const lastCard = element.querySelector<HTMLElement>("li:last-child [data-testid='product-card']")!;
          const cardRect = lastCard.getBoundingClientRect();
          return { left: cardRect.left, right: cardRect.right, railLeft: railRect.left, railRight: railRect.right };
        });
        expect(lastReachability.left).toBeGreaterThanOrEqual(lastReachability.railLeft - 1);
        expect(lastReachability.right).toBeLessThanOrEqual(lastReachability.railRight + 1);

        await page.keyboard.press("Home");
        await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(4);
        const firstReachability = await rail.evaluate((element) => {
          const railRect = element.getBoundingClientRect();
          const firstCard = element.querySelector<HTMLElement>("li:first-child [data-testid='product-card']")!;
          const cardRect = firstCard.getBoundingClientRect();
          return { left: cardRect.left, right: cardRect.right, railLeft: railRect.left, railRight: railRect.right };
        });
        expect(firstReachability.left).toBeGreaterThanOrEqual(firstReachability.railLeft - 1);
        expect(firstReachability.right).toBeLessThanOrEqual(firstReachability.railRight + 1);
      }

      const fourCardRail = page.getByTestId("four-product-rail").getByTestId("discovery-product-rail");
      await expect(fourCardRail.getByTestId("product-card")).toHaveCount(4);
      await expect(fourCardRail).toHaveAttribute("data-product-count", "4");
      if (viewport.width >= 1024) {
        const fourCardBalance = await fourCardRail.evaluate((element) => {
          const railRect = element.getBoundingClientRect();
          const cards = [...element.querySelectorAll<HTMLElement>("[data-testid='product-card']")];
          return {
            leading: cards[0].getBoundingClientRect().left - railRect.left,
            trailing: railRect.right - cards.at(-1)!.getBoundingClientRect().right,
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        });
        expect(Math.abs(fourCardBalance.leading - fourCardBalance.trailing)).toBeLessThanOrEqual(1);
        expect(fourCardBalance.scrollWidth).toBe(fourCardBalance.clientWidth);
      }

      const grid = page.getByTestId("discovery-product-grid");
      await expect(grid.getByTestId("product-card")).toHaveCount(5);
      const gridColumns = await grid.evaluate((element) =>
        window.getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
      expect(gridColumns).toBe(viewport.width < 768 ? 2 : viewport.width < 1024 ? 3 : viewport.width < 1280 ? 4 : 5);

      const skeletonMedia = page.getByTestId("discovery-product-skeleton-media").first();
      const skeletonRatio = await skeletonMedia.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width / rect.height;
      });
      expect(skeletonRatio).toBeCloseTo(0.75, 2);

      for (const status of ["true-empty", "filtered-zero", "failure"] as const) {
        await expect(page.getByTestId(`discovery-${status}`)).toBeVisible();
      }
      await expect(page.getByTestId("discovery-true-empty")).toContainText("Browse all products");
      await expect(page.getByTestId("discovery-filtered-zero")).toContainText("Clear filters");
      await expect(page.getByTestId("discovery-failure")).toContainText("Retry");
      const retryButton = page.getByTestId("discovery-failure").getByRole("button", { name: "Retry", exact: true });
      await retryButton.evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      });
      await expect(page.getByTestId("retry-count")).toHaveText("1");
      await expect(page.getByRole("button", { name: "Retrying…" })).toBeDisabled();
      await page.getByTestId("reject-retry").click();
      await expect(page.getByTestId("discovery-retry-failure")).toHaveText(
        "We still could not retrieve products. Please try again.",
      );
      const retryAgain = page.getByRole("button", { name: "Retry again" });
      await expect(retryAgain).toBeEnabled();
      await retryAgain.click();
      await expect(page.getByTestId("retry-count")).toHaveText("2");
      await page.getByTestId("reject-retry").click();
      await expect(page.getByTestId("discovery-retry-failure")).toBeVisible();

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });

      const screenshotDirectory = path.resolve("output/playwright/consumer-discovery-package2");
      fs.mkdirSync(screenshotDirectory, { recursive: true });
      await page.screenshot({
        path: path.join(screenshotDirectory, `discovery-primitives-${viewport.name}.png`),
        fullPage: true,
      });
    });
  }
});
