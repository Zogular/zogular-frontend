import { expect, test, type Page } from "@playwright/test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { ApiError } from "../src/services/api";
import {
  CategoryContractError,
  parseCategoryAttributesResponse,
  parseCategoryTreeResponse,
  type CategoryAttributeOption,
} from "../src/services/categories-api";
import { buildSellerProductRequest, type CreateSellerProductInput } from "../src/services/seller-catalog";
import { parseAdminCategoriesResponse } from "../src/features/admin-categories/api/admin-categories";
import {
  reconcileCategoryFieldValues,
  validateCategoryIntegrity,
} from "../src/app/seller/products/new/_lib/category-form-integrity";
import { parseProductCategoryServerErrors } from "../src/app/seller/products/new/_lib/product-category-errors";
import type { CategorySelection } from "../src/app/seller/products/new/_lib/category-selection";

const ROOT_ID = "11111111-1111-4111-8111-111111111111";
const LEAF_ID = "22222222-2222-4222-8222-222222222222";
const ATTRIBUTE_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_LEAF_ID = "44444444-4444-4444-8444-444444444444";
const APP_BASE_URL = process.env.STEP4A_BASE_URL;
const FIXTURE_API_URL = process.env.STEP4A_FIXTURE_API_URL ?? "http://127.0.0.1:47823/api/v1";
const FIXTURE_PORT = Number(new URL(FIXTURE_API_URL).port);
const SCREENSHOT_DIR = path.resolve("output/playwright/admin-recovery-step4a");
let categoryMode: "success" | "tree-error" = "success";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  if (!APP_BASE_URL) return;
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    fixtureServer.once("error", reject);
    fixtureServer.listen(FIXTURE_PORT, "127.0.0.1", () => resolve());
  });
});

test.afterAll(async () => {
  if (!APP_BASE_URL || !fixtureServer.listening) return;
  await new Promise<void>((resolve, reject) => fixtureServer.close((error) => error ? reject(error) : resolve()));
});

const leafSelection: CategorySelection = {
  path: ["Electronics", "Mobile Phones"],
  categoryId: ROOT_ID,
  categoryName: "Electronics",
  categorySlug: "electronics",
  subcategoryId: LEAF_ID,
  subcategoryName: "Mobile Phones",
  subcategorySlug: "mobile-phones",
  leafId: LEAF_ID,
  leafName: "Mobile Phones",
  leafSlug: "mobile-phones",
  isOther: false,
  isBackendCategory: true,
};

test("runtime parses a valid category tree and rejects malformed and cyclic payloads", () => {
  const valid = makeCategoryTreeResponse();
  expect(parseCategoryTreeResponse(valid)[0]?.children?.[0]?.id).toBe(LEAF_ID);

  expect(() => parseCategoryTreeResponse({ ...valid, results: "2" })).toThrow(CategoryContractError);

  const cyclicNode: Record<string, unknown> = makeNode(ROOT_ID, null, "Electronics", "electronics");
  cyclicNode.children = [cyclicNode];
  expect(() => parseCategoryTreeResponse({ status: "success", results: 1, data: { categories: [cyclicNode] } })).toThrow(/cycle/i);
});

test("runtime validates category attributes against the selected leaf", () => {
  const response = makeAttributesResponse();
  expect(parseCategoryAttributesResponse(response, { categoryId: LEAF_ID, categorySlug: "mobile-phones" })).toHaveLength(1);
  expect(() => parseCategoryAttributesResponse(response, { categoryId: ROOT_ID })).toThrow(/did not match/i);
  expect(() => parseCategoryAttributesResponse({ ...response, data: { ...response.data, attributes: [{ broken: true }] } })).toThrow(CategoryContractError);
});

test("runtime parses relevant admin category responses before recursive workspace state", () => {
  const record = {
    ...makeNode(ROOT_ID, null, "Electronics", "electronics"),
    createdAt: "2026-08-30T10:00:00.000Z",
    updatedAt: "2026-08-30T10:00:00.000Z",
    _count: { children: 0, products: 0, attributes: 0 },
  };
  const parsed = parseAdminCategoriesResponse({
    status: "success",
    results: 1,
    data: { categories: [record], tree: [{ ...record, children: [] }] },
  });
  expect(parsed.categories[0]?.id).toBe(ROOT_ID);
  expect(() => parseAdminCategoriesResponse({ status: "success", results: 1, data: { categories: [record], tree: [{ ...record, children: "invalid" }] } })).toThrow(CategoryContractError);
});

test("product request sends the authoritative leaf ID with compatibility slugs", () => {
  const request = buildSellerProductRequest({
    categoryId: LEAF_ID,
    categoryLeafSlug: "mobile-phones",
    categorySelectionKind: "backend",
    categoryName: "Electronics",
    categorySlug: "electronics",
    subcategoryName: "Mobile Phones",
    subcategorySlug: "mobile-phones",
  } as CreateSellerProductInput, "create");

  expect(request).toMatchObject({
    categoryId: LEAF_ID,
    categorySlug: "mobile-phones",
    subcategorySlug: "mobile-phones",
  });
  expect(request.categoryId).not.toBe(ROOT_ID);
});

test("incomplete and manual-category drafts omit category authority while review remains gated", () => {
  const incompleteDraft = buildSellerProductRequest({
    categorySelectionKind: "none",
    categoryName: "",
    categorySlug: "",
    subcategoryName: "",
    subcategorySlug: "",
  } as CreateSellerProductInput, "create");
  expect(incompleteDraft).not.toHaveProperty("categoryId");
  expect(incompleteDraft).not.toHaveProperty("categorySlug");
  const manualUpdate = buildSellerProductRequest({
    categorySelectionKind: "manual",
    categoryName: "Electronics",
    categorySlug: "electronics",
    subcategoryName: "Other",
    subcategorySlug: "electronics-other",
  }, "update");
  expect(manualUpdate).toMatchObject({ categoryId: null, categorySlug: null, subcategorySlug: null });
  expect(validateCategoryIntegrity("draft", null, "error", false)).toEqual({});
  expect(validateCategoryIntegrity("pending_review", null, "success", true)).toMatchObject({ category: expect.any(String) });

  const otherSelection = { ...leafSelection, leafId: `${ROOT_ID}-other`, isOther: true, isBackendCategory: false };
  expect(validateCategoryIntegrity("pending_review", otherSelection, "success", true)).toMatchObject({ category: expect.any(String) });
  expect(validateCategoryIntegrity("pending_review", leafSelection, "error", false)).toMatchObject({ categoryDetails: "Category attributes are unavailable." });
});

test("category change preserves compatible values and moves incompatible values to manual specifications", () => {
  const nextAttributes: CategoryAttributeOption[] = [{
    id: ATTRIBUTE_ID,
    name: "Storage capacity",
    slug: "storage",
    type: "text",
    options: null,
    isRequired: true,
    sortOrder: 1,
  }];
  const impact = reconcileCategoryFieldValues([
    { attributeId: "old-storage", name: "Storage", slug: "storage", value: "128GB" },
    { attributeId: "old-color", name: "Color", slug: "color", value: "Black" },
  ], nextAttributes);

  expect(impact.retained).toEqual([{ attributeId: ATTRIBUTE_ID, name: "Storage capacity", slug: "storage", value: "128GB" }]);
  expect(impact.movedToManual).toEqual([{ attributeId: "old-color", name: "Color", slug: "color", value: "Black" }]);
});

test("field-level 422 category errors map to category controls and governed attribute IDs", () => {
  const parsed = parseProductCategoryServerErrors(new ApiError("Invalid category fields", 422, {
    status: "fail",
    errors: [
      { field: "categoryId", message: "Choose a final category." },
      { field: "attributes.0.value", message: "Storage must be selected." },
      { field: `attributes.${ATTRIBUTE_ID}`, message: "Storage is required." },
    ],
  }), [{ attributeId: ATTRIBUTE_ID, name: "Storage", slug: "storage", value: "" }]);

  expect(parsed).toEqual({
    categoryMessage: "Choose a final category.",
    detailsMessage: "Some category details need attention.",
    attributeErrors: { [ATTRIBUTE_ID]: "Storage is required." },
    firstAttributeId: ATTRIBUTE_ID,
  });
  const bracketParsed = parseProductCategoryServerErrors(new ApiError("Invalid category fields", 422, {
    errors: [{ field: "attributes[0].value", message: "Storage is invalid." }],
  }), [{ attributeId: ATTRIBUTE_ID, name: "Storage", slug: "storage", value: "" }]);
  expect(bracketParsed?.attributeErrors).toEqual({ [ATTRIBUTE_ID]: "Storage is invalid." });
  const missingRequiredParsed = parseProductCategoryServerErrors(new ApiError("Invalid category fields", 422, {
    errors: [{ field: `attributes.${ATTRIBUTE_ID}`, message: "Storage is required." }],
  }), [], new Set([ATTRIBUTE_ID]));
  expect(missingRequiredParsed?.attributeErrors).toEqual({ [ATTRIBUTE_ID]: "Storage is required." });
  expect(parseProductCategoryServerErrors(new ApiError("Invalid", 400, { errors: [] }), [])).toBeNull();
});

test.describe("mocked Add Product browser integrity", () => {
  test.skip(!APP_BASE_URL, "STEP4A_BASE_URL is required for local browser verification.");

  test("390px preserves a draft and manual note when category loading fails", async ({ page }) => {
    categoryMode = "tree-error";
    await page.setViewportSize({ width: 390, height: 844 });
    await openSellerProductForm(page);

    await expect(page.getByRole("heading", { name: "Categories are unavailable" })).toBeVisible();
    await page.locator("#product-title").fill("Offline category draft");
    await page.locator("#product-category-fallback-note").fill("Portable solar lamp, 10W, includes charging cable.");
    await page.waitForTimeout(700);

    const savedDraft = await page.evaluate(() => Object.values(window.localStorage).find((value) => value.includes("Portable solar lamp")));
    expect(savedDraft).toContain("Portable solar lamp");
    await expect(page.getByRole("button", { name: "Submit for Review" })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "category-load-failure-390.png"), fullPage: true });
  });

  test("desktop keyboard category change shows preservation impact and restores focus", async ({ page }) => {
    categoryMode = "success";
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSellerProductForm(page);

    const categoryButton = page.locator("#product-category-selector");
    await categoryButton.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /Electronics/ }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /Mobile Phones/ }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Submit Category" }).click();
    await page.getByLabel(/Storage/).fill("128GB");

    await categoryButton.click();
    await page.getByRole("button", { name: /Electronics/ }).click();
    await page.getByRole("button", { name: /Laptops/ }).click();
    await page.getByRole("button", { name: "Submit Category" }).click();

    const dialog = page.getByRole("dialog", { name: "Change product category?" });
    await expect(dialog).toContainText("1 preserved as manual specifications");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "category-change-impact-1440.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(categoryButton).toBeFocused();
    await expect(categoryButton).toContainText("Mobile Phones");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});

function makeCategoryTreeResponse() {
  return {
    status: "success" as const,
    results: 1,
    data: {
      categories: [{
        ...makeNode(ROOT_ID, null, "Electronics", "electronics"),
        children: [makeNode(LEAF_ID, ROOT_ID, "Mobile Phones", "mobile-phones")],
      }],
    },
  };
}

function makeAttributesResponse() {
  return {
    status: "success" as const,
    data: {
      categoryId: LEAF_ID,
      categoryName: "Mobile Phones",
      categorySlug: "mobile-phones",
      attributes: [{
        id: ATTRIBUTE_ID,
        name: "Storage",
        slug: "storage",
        type: "text" as const,
        options: null,
        isRequired: true,
        sortOrder: 1,
      }],
    },
  };
}

function makeNode(id: string, parentId: string | null, name: string, slug: string) {
  return {
    id,
    name,
    slug,
    description: null,
    icon: null,
    parentId,
    isActive: true,
    sortOrder: 1,
    children: [],
  };
}

const fixtureServer = createServer((request, response) => {
  void handleFixtureRequest(request, response).catch((error) => {
    writeJson(response, 500, { status: "error", message: error instanceof Error ? error.message : "Fixture failure" });
  });
});

async function handleFixtureRequest(request: IncomingMessage, response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-CSRF-Token");
  if (request.method === "OPTIONS") return response.writeHead(204).end();

  const route = new URL(request.url ?? "/", FIXTURE_API_URL).pathname.replace(/^\/api\/v1/, "");
  if (route === "/user/me") {
    return writeJson(response, 200, { status: "success", data: { user: {
      id: "seller-step4a-user", firstName: "Step", lastName: "Four", email: "seller@fixture.invalid", role: "VENDOR", emailVerified: true, isActive: true,
    } } });
  }
  if (route === "/vendor/applications/me") {
    return writeJson(response, 200, { status: "success", data: { application: {
      id: "application-step4a", userId: "seller-step4a-user", sellerType: "INDIVIDUAL", status: "APPROVED", ownerFullName: "Step Four Seller", storeName: "Step Four Store", productCategories: ["Electronics"], createdAt: "2026-08-30T10:00:00.000Z", updatedAt: "2026-08-30T10:00:00.000Z",
    } } });
  }
  if (route === "/auth/csrf-token") {
    return writeJson(response, 200, { status: "success", data: { csrfToken: "fixture-csrf" } });
  }
  if (route === "/categories") {
    if (categoryMode === "tree-error") return writeJson(response, 500, { status: "error", message: "Category service unavailable" });
    const tree = makeCategoryTreeResponse();
    tree.data.categories[0]!.children!.push(makeNode(SECOND_LEAF_ID, ROOT_ID, "Laptops", "laptops"));
    return writeJson(response, 200, tree);
  }
  if (route === "/categories/mobile-phones/attributes") return writeJson(response, 200, makeAttributesResponse());
  if (route === "/categories/laptops/attributes") {
    return writeJson(response, 200, { status: "success", data: {
      categoryId: SECOND_LEAF_ID,
      categoryName: "Laptops",
      categorySlug: "laptops",
      attributes: [{ id: "55555555-5555-4555-8555-555555555555", name: "Processor", slug: "processor", type: "text", options: null, isRequired: true, sortOrder: 1 }],
    } });
  }
  return writeJson(response, 404, { status: "fail", message: `Unhandled fixture route: ${request.method} ${route}` });
}

async function openSellerProductForm(page: Page) {
  await page.goto(`${APP_BASE_URL}/seller/products/new`, { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/seller\/login/);
}

function writeJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}
