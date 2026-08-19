import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { ProductContractError, normalizeProduct } from "../src/lib/normalizers/product";
import {
  normalizeBackendProduct,
  normalizeBackendProductDetail,
  type BackendProduct,
} from "../src/services/products";

const structuredProduct: BackendProduct = {
  id: "product-1",
  slug: "samsung-galaxy-a55-5g",
  title: "Samsung Galaxy A55 5G",
  price: 2499,
  salePrice: 2199,
  stock: 5,
  categoryRef: { name: "Electronics", slug: "electronics" },
  images: [
    {
      url: "/secondary.png",
      alt: "Samsung Galaxy A55 side view",
      isPrimary: false,
      sortOrder: 1,
      width: 800,
      height: 800,
    },
    {
      url: "/primary.png",
      alt: "Samsung Galaxy A55 front view",
      isPrimary: true,
      sortOrder: 9,
      width: 1200,
      height: 1600,
    },
    {
      url: "/later.png",
      alt: "Samsung Galaxy A55 rear view",
      isPrimary: false,
      sortOrder: 3,
    },
  ],
  user: { id: "opaque-owner-1" },
  reviews: [
    {
      rating: 5,
      user: { firstName: "Review", lastName: "Author" },
    },
  ],
};

test("structured public images select the primary image before sort order", () => {
  const product = normalizeBackendProduct(structuredProduct);

  expect(product.image).toBe("/primary.png");
  expect(product.images?.map((image) => image.url)).toEqual([
    "/primary.png",
    "/secondary.png",
    "/later.png",
  ]);
  expect(product.images?.[0]).toMatchObject({
    alt: "Samsung Galaxy A55 front view",
    isPrimary: true,
    sortOrder: 9,
    width: 1200,
    height: 1600,
  });
});

test("public image alt text is preserved and falls back only to the truthful title", () => {
  expect(normalizeBackendProduct(structuredProduct).imageAlt).toBe(
    "Samsung Galaxy A55 front view",
  );

  const withoutAlt = normalizeBackendProduct({
    ...structuredProduct,
    images: [{ url: "/primary.png", alt: "   ", isPrimary: true, sortOrder: 0 }],
  });
  expect(withoutAlt.imageAlt).toBe("Samsung Galaxy A55 5G");
});

test("missing public media remains an honest unavailable state", () => {
  const product = normalizeBackendProduct({ ...structuredProduct, images: [] });

  expect(product.image).toBe("");
  expect(product.images).toEqual([]);
  expect(product.imageAlt).toBe("Samsung Galaxy A55 5G");
});

test("malformed required fields fail the product contract without fabricated values", () => {
  const invalidProducts: Array<[ProductContractError["field"], BackendProduct]> = [
    ["id", { ...structuredProduct, id: undefined }],
    ["slug", { ...structuredProduct, slug: "   " }],
    ["title", { ...structuredProduct, title: null }],
    ["price", { ...structuredProduct, price: 0 }],
  ];

  for (const [field, product] of invalidProducts) {
    expect(() => normalizeBackendProduct(product)).toThrow(ProductContractError);
    try {
      normalizeBackendProduct(product);
      throw new Error("Expected product normalization to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(ProductContractError);
      expect((error as ProductContractError).field).toBe(field);
    }
  }

  expect(() =>
    normalizeProduct({
      id: "product-2",
      slug: "missing-title",
      title: "",
      price: 100,
    }),
  ).toThrow(/valid title/i);
});

test("public owner mapping retains only the opaque ID", () => {
  const product = normalizeBackendProduct({
    ...structuredProduct,
    user: {
      id: "opaque-owner-1",
      firstName: "Private",
      lastName: "Seller",
      email: "private@example.com",
      telephone: "+260955000000",
    } as unknown as { id: string },
  });

  expect(product.ownerId).toBe("opaque-owner-1");
  expect(product.storeName).toBeUndefined();
  expect(JSON.stringify(product)).not.toContain("Private");
  expect(JSON.stringify(product)).not.toContain("private@example.com");
  expect(JSON.stringify(product)).not.toContain("+260955000000");
});

test("review-author names remain review data and are not mapped as seller identity", () => {
  const detail = normalizeBackendProductDetail(structuredProduct);

  expect(detail.ownerId).toBe("opaque-owner-1");
  expect(detail.seller).toBeUndefined();
  expect(detail.rating).toBe(5);
  expect(detail.reviewCount).toBe(1);
  expect(JSON.stringify(detail)).not.toContain("Review Author");
});

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
  badResponses: string[];
};

function isKnownLocalTelemetry(url: string): boolean {
  const pathname = new URL(url).pathname;
  return (
    pathname.startsWith("/_vercel/insights/") ||
    pathname.startsWith("/_vercel/speed-insights/")
  );
}

function isExpectedGuestVerificationResponse(method: string, url: string, status: number): boolean {
  if (!browserBaseUrl || method !== "GET" || status !== 401) return false;
  const requestUrl = new URL(url);
  const fixtureUrl = new URL(browserBaseUrl);
  return requestUrl.origin === fixtureUrl.origin
    && requestUrl.pathname === "/api/backend/user/me"
    && requestUrl.search === "";
}

function isExpectedGuestRefreshResponse(method: string, url: string, status: number): boolean {
  if (!browserBaseUrl || method !== "POST" || status !== 401) return false;
  const requestUrl = new URL(url);
  const fixtureUrl = new URL(browserBaseUrl);
  return requestUrl.origin === fixtureUrl.origin
    && requestUrl.pathname === "/api/backend/auth/refresh-token"
    && requestUrl.search === "";
}

function isExpectedGuestVerificationConsole(message: string, location: string): boolean {
  return message === "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
    && (
      isExpectedGuestVerificationResponse("GET", location, 401)
      || isExpectedGuestRefreshResponse("POST", location, 401)
    );
}

function collectDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location().url;
      if (!location || (!isKnownLocalTelemetry(location) && !isExpectedGuestVerificationConsole(message.text(), location))) {
        diagnostics.consoleErrors.push(location ? `${message.text()} ${location}` : message.text());
      }
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!failure.includes("ERR_ABORTED")) {
      diagnostics.failedRequests.push(`${failure} ${request.url()}`);
    }
  });
  page.on("response", (response) => {
    if (
      response.status() >= 400
      && !isKnownLocalTelemetry(response.url())
      && !isExpectedGuestVerificationResponse(response.request().method(), response.url(), response.status())
      && !isExpectedGuestRefreshResponse(response.request().method(), response.url(), response.status())
    ) {
      diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  return diagnostics;
}

const browserBaseUrl = process.env.PACKAGE1_BASE_URL;
const viewports = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

test.describe("canonical ProductCard fixture-based browser contract", () => {
  test.skip(!browserBaseUrl, "PACKAGE1_BASE_URL is required for fixture-based visual QA.");

  test.beforeEach(async ({ page }) => {
    await page.route(`${browserBaseUrl}/api/backend/user/me`, async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Sign in required" }) });
    });
    await page.route(`${browserBaseUrl}/api/backend/auth/csrf-token`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { csrfToken: "package-1-csrf" } }) });
    });
    await page.route(`${browserBaseUrl}/api/backend/auth/refresh-token`, async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "No refresh cookie" }) });
    });
  });

  for (const viewport of viewports) {
    test(`${viewport.name} preserves geometry, accessibility, and shared actions`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(() => localStorage.clear());
      const diagnostics = collectDiagnostics(page);

      await page.goto(browserBaseUrl!, { waitUntil: "networkidle" });
      const card = page.getByTestId("product-card").filter({ hasText: "Samsung Galaxy A55 5G" }).first();
      await card.scrollIntoViewIfNeeded();
      await expect(card).toBeVisible();

      const media = card.getByTestId("product-card-media");
      const image = media.locator("img");
      const title = card.getByRole("link", { name: "Samsung Galaxy A55 5G", exact: true });
      const wishlist = card.getByRole("button", { name: "Add to wishlist" });
      const add = card.getByRole("button", { name: "Add Samsung Galaxy A55 5G to cart" });

      await expect(image).toHaveAttribute("alt", "Samsung Galaxy A55 5G front view");
      const geometry = await media.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          width: rect.width,
          height: rect.height,
          ratio: rect.width / rect.height,
          backgroundColor: style.backgroundColor,
        };
      });
      expect(geometry.ratio).toBeCloseTo(0.75, 2);
      expect(geometry.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
      const cardHeight = await card.evaluate((element) => element.getBoundingClientRect().height);
      expect(cardHeight).toBeGreaterThan(geometry.height);
      expect(cardHeight).toBeLessThan(geometry.height + 220);
      const sectionCards = page.getByTestId("product-card").filter({ visible: true });
      const sectionCardWidths = await sectionCards.evaluateAll((elements) =>
        elements.slice(0, 4).map((element) => element.getBoundingClientRect().width),
      );
      expect(sectionCardWidths).toHaveLength(4);
      expect(Math.max(...sectionCardWidths) - Math.min(...sectionCardWidths)).toBeLessThanOrEqual(0.5);

      const beforeHover = await image.evaluate((element) => ({
        objectFit: window.getComputedStyle(element).objectFit,
        transform: window.getComputedStyle(element).transform,
      }));
      await image.hover();
      const afterHover = await image.evaluate((element) => ({
        objectFit: window.getComputedStyle(element).objectFit,
        transform: window.getComputedStyle(element).transform,
      }));
      expect(beforeHover.objectFit).toBe("contain");
      expect(afterHover.objectFit).toBe("contain");
      expect(afterHover.transform).toBe(beforeHover.transform);

      const titleGeometry = await title.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          lineClamp: style.getPropertyValue("-webkit-line-clamp"),
          height: element.getBoundingClientRect().height,
          lineHeight: Number.parseFloat(style.lineHeight),
        };
      });
      expect(titleGeometry.lineClamp).toBe("2");
      expect(titleGeometry.height).toBeLessThanOrEqual(titleGeometry.lineHeight * 2 + 0.5);

      for (const control of [wishlist, add]) {
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      await wishlist.focus();
      await expect(wishlist).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/auth\/login\?next=/);
      expect(new URL(page.url()).searchParams.get("next")).toBe("/");
      expect(await page.evaluate(() => localStorage.getItem("zogular-wishlist-storage"))).toBeNull();

      await page.goBack();
      await expect(card).toBeVisible();

      await add.focus();
      await expect(add).toBeFocused();
      await page.keyboard.press("Enter");
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("zogular-cart-storage")))
        .toContain("product-1");

      const missingCard = page
        .getByTestId("product-card")
        .filter({ hasText: "Media Missing Test Product" })
        .first();
      await expect(missingCard.getByText("Image unavailable")).toBeVisible();
      const disabledAdd = missingCard.getByRole("button", {
        name: /Out of stock: Media Missing Test Product/,
      });
      await expect(disabledAdd).toBeDisabled();

      await expect(page.locator("body")).not.toContainText("Review Author");
      await expect(page.locator("body")).not.toContainText("opaque-owner-1");
      await expect(card.getByText("5", { exact: true })).toBeVisible();
      await expect(card.getByText("(1)", { exact: true })).toBeVisible();
      const unratedCard = page.getByTestId("product-card").filter({ hasText: "Product Without Reviews" }).first();
      await expect(unratedCard.getByText(/^\([0-9]+\)$/)).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      expect(diagnostics).toEqual({
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
        badResponses: [],
      });

      console.log(`${viewport.name} ProductCard geometry: ${JSON.stringify(geometry)}`);
      await card.evaluate((element) => {
        const documentTop = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: Math.max(0, documentTop - 160), behavior: "auto" });
      });
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
      );
      await page.screenshot({
        path: path.resolve(
          `output/playwright/consumer-discovery-package1/product-card-${viewport.name}.png`,
        ),
      });
    });
  }

  test("PDP renders genuine rating evidence and suppresses malformed review evidence", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${browserBaseUrl}/product/samsung-galaxy-a55-5g`, { waitUntil: "networkidle" });
    const ratings = page.locator("#product-reviews");
    await expect(ratings.getByText("5", { exact: true })).toBeVisible();
    await expect(ratings.getByText("1 customer reviews", { exact: true })).toBeVisible();

    await page.goto(`${browserBaseUrl}/product/product-without-reviews`, { waitUntil: "networkidle" });
    await expect(page.locator("#product-reviews").getByText("No verified reviews yet", { exact: true })).toBeVisible();
    await expect(page.locator("#product-reviews").getByText(/customer reviews$/)).toHaveCount(0);
  });
});
