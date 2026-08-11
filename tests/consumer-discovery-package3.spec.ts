import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { buildHomeCategoryDirectoryFromTree } from "../src/features/categories/category-directory";
import {
  loadHomeDiscoveryData,
  type HomeDiscoveryDependencies,
} from "../src/features/consumer-discovery/home/home-discovery-data";
import type { CategoryNode } from "../src/services/categories-api";
import type { Product } from "../src/types/product";

function makeProduct(id: number): Product {
  return {
    id: `product-${id}`,
    slug: `product-${id}`,
    title: `Fixture product ${id}`,
    price: 100 + id,
    rating: 0,
    reviews: 0,
    image: "",
  };
}

const categoryNode: CategoryNode = {
  id: "category-1",
  name: "Electronics",
  slug: "electronics",
  description: "Current electronics listings.",
  icon: null,
  parentId: null,
  isActive: true,
  sortOrder: 1,
  _count: { products: 7 },
  children: [],
};

function dependencies(overrides: Partial<HomeDiscoveryDependencies> = {}): HomeDiscoveryDependencies {
  return {
    categories: async () => buildHomeCategoryDirectoryFromTree([categoryNode]),
    newArrivals: async () => [1, 2, 3, 4, 5].map(makeProduct),
    mostViewed: async () => [4, 5, 6, 7, 8, 9].map(makeProduct),
    exploreMore: async () => [7, 8, 9, 10, 11, 12].map(makeProduct),
    ...overrides,
  };
}

test("category normalization preserves backend description and count without fabricated copy", () => {
  const [category] = buildHomeCategoryDirectoryFromTree([categoryNode]);
  expect(category).toMatchObject({
    id: "category-1",
    name: "Electronics",
    slug: "electronics",
    description: "Current electronics listings.",
    productCount: 7,
  });
  expect(category).not.toHaveProperty("icon");

  const [withoutOptionalFields] = buildHomeCategoryDirectoryFromTree([
    { ...categoryNode, description: null, _count: undefined },
  ]);
  expect(withoutOptionalFields.description).toBeUndefined();
  expect(withoutOptionalFields.productCount).toBeUndefined();
  expect(JSON.stringify(withoutOptionalFields)).not.toContain("trusted sellers across Lusaka");
});

test("optional homepage collections settle independently and required data remains available", async () => {
  const newArrivalsFailure = await loadHomeDiscoveryData(
    dependencies({ newArrivals: async () => Promise.reject(new Error("new arrivals unavailable")) }),
  );
  expect(newArrivalsFailure.newArrivals).toEqual([]);
  expect(newArrivalsFailure.mostViewed).toHaveLength(6);
  expect(newArrivalsFailure.exploreMore).toHaveLength(6);

  const mostViewedFailure = await loadHomeDiscoveryData(
    dependencies({ mostViewed: async () => Promise.reject(new Error("views unavailable")) }),
  );
  expect(mostViewedFailure.newArrivals).toHaveLength(5);
  expect(mostViewedFailure.mostViewed).toEqual([]);
  expect(mostViewedFailure.exploreMore).toHaveLength(6);
});

test("required category and Explore More failures remain typed failures", async () => {
  await expect(
    loadHomeDiscoveryData(
      dependencies({ categories: async () => Promise.reject(new Error("categories unavailable")) }),
    ),
  ).rejects.toMatchObject({
    name: "RequiredHomeDiscoveryError",
    source: "categories",
  });
  await expect(
    loadHomeDiscoveryData(
      dependencies({ exploreMore: async () => Promise.reject(new Error("catalog unavailable")) }),
    ),
  ).rejects.toMatchObject({
    name: "RequiredHomeDiscoveryError",
    source: "explore-more",
  });
});

test("cross-section reuse is minimized without changing source order or fabricating products", async () => {
  const data = await loadHomeDiscoveryData(dependencies());
  expect(data.newArrivals.map((item) => item.id)).toEqual([
    "product-1",
    "product-2",
    "product-3",
    "product-4",
    "product-5",
  ]);
  expect(data.mostViewed.map((item) => item.id)).toEqual([
    "product-6",
    "product-7",
    "product-8",
    "product-9",
  ]);
  expect(data.exploreMore.map((item) => item.id)).toEqual([
    "product-7",
    "product-8",
    "product-9",
    "product-10",
    "product-11",
    "product-12",
  ]);

  const enoughUnseen = await loadHomeDiscoveryData(
    dependencies({ mostViewed: async () => [4, 5, 6, 7, 8, 9, 10].map(makeProduct) }),
  );
  expect(enoughUnseen.mostViewed.map((item) => item.id)).toEqual([
    "product-6",
    "product-7",
    "product-8",
    "product-9",
    "product-10",
  ]);
});

test("homepage services use the verified public collection endpoints and retire unsupported composition", () => {
  const productsSource = fs.readFileSync(path.resolve("src/services/products.ts"), "utf8");
  const homeSource = fs.readFileSync(
    path.resolve("src/features/consumer-discovery/home/HomeDiscovery.tsx"),
    "utf8",
  );
  const pageSource = fs.readFileSync(path.resolve("src/app/(consumer)/page.tsx"), "utf8");
  const introSource = fs.readFileSync(
    path.resolve("src/features/consumer-discovery/home/EditorialDiscoveryIntro.tsx"),
    "utf8",
  );

  expect(productsSource).toContain('fetchBackendProductCollection("/products/new-arrivals"');
  expect(productsSource).toContain('fetchBackendProductCollection("/products/featured"');
  expect(productsSource).toContain('sort: "newest"');
  expect(pageSource).toContain("<HomeDiscovery {...discovery} />");
  expect(pageSource).not.toContain("HomePageClient");
  expect(fs.existsSync(path.resolve("src/components/home/HomePageClient.tsx"))).toBe(false);
  expect(`${homeSource}\n${pageSource}`).not.toMatch(
    /FlashSales|TrendingProducts|TrustBanner|Autoplay|Recently Viewed|Current Deals/,
  );
  expect(introSource).not.toMatch(/rounded-full border-\[32px\]|home-editorial-orb|home-editorial-ring/);
});

test("homepage loading reserves introduction, category, and canonical 3:4 product geometry", () => {
  const loadingSource = fs.readFileSync(path.resolve("src/app/(consumer)/loading.tsx"), "utf8");
  const skeletonSource = fs.readFileSync(
    path.resolve("src/features/consumer-discovery/components/DiscoveryProductSkeleton.tsx"),
    "utf8",
  );

  expect(loadingSource).toContain('data-testid="home-intro-skeleton"');
  expect(loadingSource).toContain("h-[76px] min-w-[132px]");
  expect(loadingSource).toContain('<DiscoveryProductSkeleton layout="rail"');
  expect(loadingSource).toContain('<DiscoveryProductSkeleton layout="grid"');
  expect(skeletonSource).toContain("aspect-[3/4]");
});

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

function collectDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
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

const browserBaseUrl = process.env.PACKAGE3_BASE_URL;
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1280x900", width: 1280, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

const unsupportedClaims = [
  "Flash Sales",
  "Trending Near You",
  "Recently Viewed",
  "Current Deals",
  "Best Sellers",
  "Buyer Protection",
  "Free delivery",
  "Trusted Stores",
  "Trust",
];

async function resetScrollAndWaitForNavbar(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const navbar = page.locator("header.sticky").first();
  await expect(navbar).toBeVisible();
  await navbar.evaluate(async (element) => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    let previous = element.getBoundingClientRect();
    for (let index = 0; index < 12; index += 1) {
      await nextFrame();
      const current = element.getBoundingClientRect();
      if (
        current.x === previous.x
        && current.y === previous.y
        && current.width === previous.width
        && current.height === previous.height
      ) return;
      previous = current;
    }
  });
}

test.describe("Package 3 fixture-based Hybrid C homepage", () => {
  test.skip(!browserBaseUrl, "PACKAGE3_BASE_URL is required for fixture-based visual QA.");

  for (const viewport of viewports) {
    test(`${viewport.name} preserves truthful compact discovery and clean diagnostics`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/_vercel/**", (route) => route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "",
      }));
      await page.route("**/api/backend/categories", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "success", results: 0, data: { categories: [] } }),
      }));
      const diagnostics = collectDiagnostics(page);
      await page.goto(browserBaseUrl!, { waitUntil: "networkidle" });
      await resetScrollAndWaitForNavbar(page);

      await expect(page.getByTestId("home-editorial-intro")).toBeVisible();
      await expect(page.getByTestId("home-editorial-intro").locator(":scope > [aria-hidden='true']")).toHaveCount(0);
      await expect(page.getByTestId("home-categories")).toBeVisible();
      await expect(page.getByTestId("home-new-arrivals")).toBeVisible();
      await expect(page.getByTestId("home-most-viewed")).toBeVisible();
      await expect(page.getByTestId("home-explore-more")).toBeVisible();
      await expect(page.locator("[data-testid='home-new-arrivals'] [data-testid='product-card']")).toHaveCount(5);
      await expect(page.locator("[data-testid='home-most-viewed'] [data-testid='product-card']")).toHaveCount(4);
      await expect(page.locator("[data-testid='home-explore-more'] [data-testid='product-card']")).toHaveCount(6);

      const firstProduct = page.locator("[data-testid='home-new-arrivals'] [data-testid='product-card']").first();
      const firstProductBox = await firstProduct.boundingBox();
      expect(firstProductBox).not.toBeNull();
      const newArrivalsHeading = page.getByRole("heading", { name: "New Arrivals", exact: true });
      const headingBox = await newArrivalsHeading.boundingBox();
      expect(headingBox).not.toBeNull();
      const chromeGeometry = await page.evaluate(() => {
        const navbar = document.querySelector("header.sticky")?.getBoundingClientRect();
        const intro = document.querySelector("[data-testid='home-editorial-intro']")?.getBoundingClientRect();
        return {
          navbarBottom: navbar?.bottom ?? null,
          introTop: intro?.top ?? null,
        };
      });
      expect(chromeGeometry.navbarBottom).not.toBeNull();
      expect(chromeGeometry.introTop).not.toBeNull();
      expect(chromeGeometry.navbarBottom!).toBeLessThanOrEqual(chromeGeometry.introTop!);
      if (viewport.width === 320) {
        expect(headingBox!.y).toBeLessThan(viewport.height);
        expect(firstProductBox!.y).toBeLessThan(viewport.height);
      } else if (viewport.width === 390 || viewport.width === 414 || viewport.width >= 1024) {
        expect(firstProductBox!.y).toBeLessThan(viewport.height);
        expect(firstProductBox!.y + firstProductBox!.height).toBeGreaterThan(0);
      }
      console.log(`${viewport.name} initial geometry: ${JSON.stringify({
        ...chromeGeometry,
        newArrivalsHeadingTop: headingBox!.y,
        firstNewArrivalTop: firstProductBox!.y,
        firstNewArrivalBottom: firstProductBox!.y + firstProductBox!.height,
        viewportHeight: viewport.height,
      })}`);

      await expect(
        page.locator("[data-testid='home-most-viewed'] > header > a"),
      ).toHaveCount(0);

      const categoryLinks = page.getByTestId("home-category-link");
      await expect(categoryLinks).toHaveCount(3);
      await expect(categoryLinks.nth(0)).toHaveAttribute("href", "/category/electronics");
      await expect(categoryLinks.nth(0)).toContainText("7 products");
      await expect(categoryLinks.nth(1)).not.toContainText(/product/);
      await categoryLinks.nth(0).focus();
      await expect(categoryLinks.nth(0)).toBeFocused();

      const rail = page.locator("[data-testid='home-new-arrivals'] [data-testid='discovery-product-rail']");
      await rail.focus();
      await expect(rail).toBeFocused();
      const scrollBehavior = await rail.evaluate((element) => {
        let behavior: ScrollBehavior | undefined;
        const original = element.scrollBy.bind(element);
        element.scrollBy = ((options: ScrollToOptions) => {
          behavior = options.behavior;
          original(options);
        }) as typeof element.scrollBy;
        element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        return behavior;
      });
      expect(scrollBehavior).toBe("auto");

      const homeText = await page.getByTestId("home-discovery").innerText();
      for (const claim of unsupportedClaims) expect(homeText).not.toContain(claim);
      await expect(page.getByTestId("home-discovery").locator("[aria-roledescription='carousel']")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      expect(diagnostics).toEqual({ consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] });

      const screenshotDirectory = path.resolve("output/playwright/consumer-discovery-package3");
      fs.mkdirSync(screenshotDirectory, { recursive: true });
      await resetScrollAndWaitForNavbar(page);
      await page.screenshot({
        path: path.join(screenshotDirectory, `hybrid-home-viewport-${viewport.name}.png`),
        fullPage: false,
      });
      await resetScrollAndWaitForNavbar(page);
      await page.screenshot({
        path: path.join(screenshotDirectory, `hybrid-home-full-${viewport.name}.png`),
        fullPage: true,
      });
    });
  }

  test("optional section failures do not erase required or successful sections", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${browserBaseUrl!}?omit=new-arrivals`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("home-new-arrivals")).toHaveCount(0);
    await expect(page.getByTestId("home-most-viewed")).toBeVisible();
    await expect(page.getByTestId("home-explore-more")).toBeVisible();

    await page.goto(`${browserBaseUrl!}?omit=most-viewed`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("home-new-arrivals")).toBeVisible();
    await expect(page.getByTestId("home-most-viewed")).toHaveCount(0);
    await expect(page.getByTestId("home-explore-more")).toBeVisible();
  });
});
