import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import {
  normalizeBackendProduct,
  normalizeBackendProductDetail,
  type BackendProduct,
  type BackendProductUser,
} from "../src/services/products";

const baseProduct: BackendProduct = {
  id: "product-1",
  slug: "fixture-product",
  title: "Fixture Product",
  price: 250,
  stock: 4,
  images: ["/file.svg"],
  reviews: [{ rating: 4 }],
};

test("preserves an opaque owner ID without fabricating a public seller identity", () => {
  const detail = normalizeBackendProductDetail({
    ...baseProduct,
    user: { id: "seller-1" },
  });

  expect(detail.ownerId).toBe("seller-1");
  expect(detail.seller).toBeUndefined();
});

test("does not fabricate seller information without a valid owner ID", () => {
  expect(normalizeBackendProductDetail(baseProduct).ownerId).toBeUndefined();
  expect(normalizeBackendProductDetail(baseProduct).seller).toBeUndefined();
  expect(normalizeBackendProductDetail({ ...baseProduct, user: { id: "   " } }).ownerId).toBeUndefined();
  expect(normalizeBackendProductDetail({ ...baseProduct, user: { id: "   " } }).seller).toBeUndefined();
});

test("public owner expectations exclude personal and contact fields", () => {
  const owner = { id: "seller-1" } satisfies BackendProductUser;

  expect(owner).toEqual({ id: "seller-1" });

  // @ts-expect-error Public product owners do not expose first names.
  const firstNameOwner: BackendProductUser = { firstName: "Former" };
  // @ts-expect-error Public product owners do not expose last names.
  const lastNameOwner: BackendProductUser = { lastName: "Seller" };
  // @ts-expect-error Public product owners do not expose email addresses.
  const emailOwner: BackendProductUser = { email: "seller@example.com" };
  // @ts-expect-error Public product owners do not expose telephone numbers.
  const telephoneOwner: BackendProductUser = { telephone: "+260000000000" };

  expect([firstNameOwner, lastNameOwner, emailOwner, telephoneOwner]).toHaveLength(4);
});

test("product cards do not derive a store name from the owner ID", () => {
  const summary = normalizeBackendProduct({
    ...baseProduct,
    user: { id: "seller-1" },
  });

  expect(summary.ownerId).toBe("seller-1");
  expect(summary.storeName).toBeUndefined();
});

test("seller normalization leaves review rating and count unchanged", () => {
  const detail = normalizeBackendProductDetail({
    ...baseProduct,
    user: { id: "seller-1" },
    reviews: [{ rating: 5 }, { rating: 3 }],
  });

  expect(detail.rating).toBe(4);
  expect(detail.reviewCount).toBe(2);
});

const browserBaseUrl = process.env.PRODUCT_CONTRACT_BASE_URL;
const browserViewports = [
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
] as const;

type BrowserDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  badResponses: string[];
  failedRequests: string[];
};

function collectBrowserDiagnostics(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    badResponses: [],
    failedRequests: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!failure.includes("ERR_ABORTED")) diagnostics.failedRequests.push(`${failure} ${request.url()}`);
  });

  return diagnostics;
}

test.describe("public owner identity browser contract", () => {
  test.skip(!browserBaseUrl, "PRODUCT_CONTRACT_BASE_URL is required for fixture browser verification.");

  for (const viewport of browserViewports) {
    test(`${viewport.name} does not render the opaque owner ID as seller identity`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const diagnostics = collectBrowserDiagnostics(page);

      await page.goto(`${browserBaseUrl}/product/fixture-product`, { waitUntil: "networkidle" });

      await expect(page.getByTestId("product-seller-identity").filter({ visible: true })).toHaveCount(0);
      await expect(page.getByText("Zogular Seller", { exact: true }).filter({ visible: true })).toHaveCount(0);

      const body = page.locator("body");
      await expect(body).not.toContainText("Legacy Personal");
      await expect(body).not.toContainText("Seller Name");
      await expect(body).not.toContainText("legacy-seller@example.com");
      await expect(body).not.toContainText("+260 955 000 000");
      await expect(body).not.toContainText("seller-1");
      await expect(page.getByRole("link", { name: /view store/i })).toHaveCount(0);

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasOverflow).toBe(false);
      expect(diagnostics).toEqual({
        consoleErrors: [],
        pageErrors: [],
        badResponses: [],
        failedRequests: [],
      });

      await page.screenshot({
        path: path.resolve(`output/playwright/pdp-seller-contract-${viewport.name}.png`),
      });
    });

    test(`${viewport.name} does not render a seller identity without an owner`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const diagnostics = collectBrowserDiagnostics(page);

      await page.goto(`${browserBaseUrl}/product/fixture-product-without-owner`, { waitUntil: "networkidle" });

      await expect(page.getByTestId("product-seller-identity").filter({ visible: true })).toHaveCount(0);
      await expect(page.getByText("Zogular Seller", { exact: true }).filter({ visible: true })).toHaveCount(0);
      expect(diagnostics).toEqual({
        consoleErrors: [],
        pageErrors: [],
        badResponses: [],
        failedRequests: [],
      });
    });
  }
});
