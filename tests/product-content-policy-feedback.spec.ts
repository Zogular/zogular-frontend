import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ApiError } from "../src/services/api";
import {
  isProductSnapshotConflict,
  parseProductContentPolicyError,
  PRODUCT_CONTENT_POLICY_REASON_CODES,
  restoreProductContentPolicyIssues,
  storeSafeProductContentPolicyIssues,
} from "../src/services/product-content-policy";

const APP_BASE_URL = process.env.PACKAGE_2B_BASE_URL;
const FIXTURE_API_URL = process.env.PACKAGE_2B_FIXTURE_API_URL ?? "http://127.0.0.1:47823/api/v1";
const FIXTURE_ORIGIN = new URL(FIXTURE_API_URL).origin;
const FIXTURE_PORT = Number(new URL(FIXTURE_API_URL).port);
const SELLER_PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_PRODUCT_ID = "22222222-2222-4222-8222-222222222222";
const CATEGORY_ID = "33333333-3333-4333-8333-333333333333";
const CATEGORY_PARENT_ID = "44444444-4444-4444-8444-444444444444";
const ATTRIBUTE_ID = "55555555-5555-4555-8555-555555555555";
const SELLER_DRAFT_STORAGE_KEY = "zogular:seller-product-draft:v1:seller-fixture-user";
const SUBMISSION_RECOVERY_STORAGE_PREFIX = "zogular:product-submission-recovery:v1:";
const SCREENSHOT_DIR = path.resolve("output/playwright/package-2b-content-policy");
const DIRECT_GUIDANCE =
  "Remove phone numbers, email addresses, social handles, links, or messaging-app details.";

type FixtureMode = "success" | "policy" | "conflict" | "server-error" | "network";

type FixtureProduct = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

type FixtureState = {
  sellerProducts: Map<string, FixtureProduct>;
  adminProducts: Map<string, FixtureProduct>;
  sellerMode: FixtureMode;
  sellerPolicyFields: string[];
  adminSingleMode: FixtureMode;
  adminBulkMode: FixtureMode;
  adminPolicyFields: string[];
  createCount: number;
  submitCount: number;
  updateCount: number;
  requests: string[];
};

const fixtureState: FixtureState = createFixtureState();

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  if (!Number.isInteger(FIXTURE_PORT) || FIXTURE_PORT <= 0) {
    throw new Error("PACKAGE_2B_FIXTURE_API_URL must include an explicit local port.");
  }

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    fixtureServer.once("error", reject);
    fixtureServer.listen(FIXTURE_PORT, "127.0.0.1", () => resolve());
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    fixtureServer.close((error) => (error ? reject(error) : resolve()));
  });
});

test.beforeEach(() => resetFixtureState());

test("accepts only the exact 422 content-policy contract and strips diagnostics", () => {
  const error = makePolicyApiError(["description", "images[0].alt"]);
  const issues = parseProductContentPolicyError(error);

  expect(issues).toEqual([
    {
      field: "description",
      label: "Description",
      targetId: "product-description",
    },
    {
      field: "images[0].alt",
      label: "Image 1 alt text",
      targetId: "product-image-0-alt",
    },
  ]);
  expect(JSON.stringify(issues)).not.toContain("fixture-secret-hash");
  expect(JSON.stringify(issues)).not.toContain("fixture-detector-v1");
  expect(JSON.stringify(issues)).not.toContain("fixture-contact@example.invalid");
});

test("rejects non-422, wrong-code, empty, and malformed policy responses", () => {
  const validDetails = makePolicyDetails(["description"]);

  expect(parseProductContentPolicyError(new ApiError("Rejected", 400, validDetails))).toBeNull();
  expect(parseProductContentPolicyError(new ApiError("Rejected", 422, { ...validDetails, code: "OTHER" }))).toBeNull();
  expect(parseProductContentPolicyError(new ApiError("Rejected", 422, { ...validDetails, errors: [] }))).toBeNull();
  expect(parseProductContentPolicyError(new ApiError("Rejected", 422, { ...validDetails, errors: [{ field: "description" }] }))).toBeNull();
  expect(parseProductContentPolicyError(new Error("CONTENT_POLICY_VIOLATION"))).toBeNull();
});

test("rejects fields, reason codes, severities, sources, indices, and bulk IDs outside Package 2A", () => {
  for (const field of [
    "unknownField",
    "images[-1].alt",
    "images[01].alt",
    "images[1.5].alt",
    "images[999999999999999999999].alt",
    "attributes[-1].value",
    "attributes[0].unknown",
    "products.not-a-uuid.description",
    `products.${SELLER_PRODUCT_ID}.unknownField`,
  ]) {
    expect(parseProductContentPolicyError(makePolicyApiError([field]))).toBeNull();
  }

  expect(parseProductContentPolicyError(makePolicyApiError(["description"], { code: "UNKNOWN_CODE" }))).toBeNull();
  expect(parseProductContentPolicyError(makePolicyApiError(["description"], { severity: "REVIEW" }))).toBeNull();
  expect(parseProductContentPolicyError(makePolicyApiError(["description"], { source: "OCR" }))).toBeNull();
  expect(parseProductContentPolicyError(makePolicyApiError(["description"], { source: "QR" }))).toBeNull();
});

test("accepts only the backend reason-code allowlist with blocking text findings", () => {
  for (const code of PRODUCT_CONTENT_POLICY_REASON_CODES) {
    expect(parseProductContentPolicyError(makePolicyApiError(["description"], { code }))).not.toBeNull();
  }
});

test("maps every protected product field family to an editable control", () => {
  const fields = [
    "title",
    "description",
    "location",
    "brand",
    "sku",
    "seoTitle",
    "seoDescription",
    "dimensions",
    "model",
    "ram",
    "storage",
    "batteryHealth",
    "size",
    "color",
    "material",
    "compatibility",
    "images[2].alt",
    "images[2].linkedVariantValue",
    "attributes[3].name",
    "attributes[3].value",
  ];
  const issues = parseProductContentPolicyError(makePolicyApiError(fields));

  expect(issues?.map((issue) => issue.targetId)).toEqual([
    "product-title",
    "product-description",
    "product-location",
    "product-brand",
    "product-sku",
    "product-seo-title",
    "product-seo-description",
    "product-dimensions-length",
    "product-legacy-model",
    "product-legacy-ram",
    "product-legacy-storage",
    "product-legacy-batteryHealth",
    "product-legacy-size",
    "product-legacy-color",
    "product-legacy-material",
    "product-legacy-compatibility",
    "product-image-2-alt",
    "product-image-2-variant",
    "product-attribute-3",
    "product-attribute-3",
  ]);
});

test("sanitizes bulk product prefixes and groups by affected product ID", () => {
  const issues = parseProductContentPolicyError(
    makePolicyApiError([
      `products.${SELLER_PRODUCT_ID}.description`,
      `products.${ADMIN_PRODUCT_ID}.images[0].alt`,
    ]),
  );

  expect(issues?.[0]).toMatchObject({
    productId: SELLER_PRODUCT_ID,
    field: "description",
  });
  expect(issues?.[1]).toMatchObject({
    productId: ADMIN_PRODUCT_ID,
    field: "images[0].alt",
  });
});

test("session recovery round-trips only sanitized issue metadata", () => {
  const parsed = parseProductContentPolicyError(makePolicyApiError(["description"]));
  expect(parsed).not.toBeNull();

  const stored = storeSafeProductContentPolicyIssues(parsed ?? []);
  expect(stored).toEqual([{ field: "description" }]);
  expect(restoreProductContentPolicyIssues(stored)).toEqual(parsed);
});

test("stored recovery metadata is rejected as a whole when its grammar is invalid", () => {
  const invalidStoredSets = [
    [{ field: "unknownField" }],
    [{ field: "description", productId: "not-a-uuid" }],
    [{ field: `products.${SELLER_PRODUCT_ID}.description` }],
    [{ field: "images[01].alt" }],
    [{ field: "description", diagnostic: "server-controlled-string" }],
  ] as unknown as Array<Parameters<typeof restoreProductContentPolicyIssues>[0]>;

  for (const stored of invalidStoredSets) {
    expect(restoreProductContentPolicyIssues(stored)).toEqual([]);
  }

  expect(storeSafeProductContentPolicyIssues([{
    field: "unknownField",
    label: "Server-controlled label",
    targetId: "server-controlled-target",
  }])).toEqual([]);
});

test("recognizes snapshot conflicts without treating other errors as conflicts", () => {
  expect(isProductSnapshotConflict(new ApiError("Conflict", 409))).toBe(true);
  expect(isProductSnapshotConflict(new ApiError("Invalid", 422))).toBe(false);
  expect(isProductSnapshotConflict(new Error("409"))).toBe(false);
});

test("create-and-submit source creates one draft and submits that exact ID", () => {
  const source = readFileSync(
    path.resolve("src/app/seller/products/new/_components/ProductListingStudioForm.tsx"),
    "utf8",
  );

  expect(source).toContain("const draft = await createSellerCatalogProduct({");
  expect(source).toContain('status: "draft"');
  expect(source).toContain("createdDraftId = draft.id;");
  expect(source).toContain("clearProductDraft(draftStorageKey);");
  expect(source).toContain("await submitSellerProductForReview(draft.id);");
  expect(source).toContain("router.replace(getProductSubmissionRecoveryHref(createdDraftId, recoveryHint));");
});

test.describe("controlled fixture seller and admin recovery", () => {
  test.describe.configure({ timeout: 60_000 });
  test.skip(!APP_BASE_URL, "PACKAGE_2B_BASE_URL is required for controlled browser QA.");

  test.beforeEach(async ({ page }) => {
    await page.route("https://va.vercel-scripts.com/**", async (route) => {
      await route.fulfill({
        status: 204,
        contentType: "application/javascript",
        body: "",
      });
    });
  });

  test("draft save accepts seller content without invoking protected submission", async ({ page }) => {
    const diagnostics = collectDiagnostics(page);
    await openSellerPage(page, "/seller/products/new");
    await fillCreateForm(page, "Call 0970000000 only in this retained draft");
    await clickVisibleButton(page, "Save Draft");

    await expect(page).toHaveURL(/\/seller\/products(?:\?|$)/);
    expect(fixtureState.createCount).toBe(1);
    expect(fixtureState.submitCount).toBe(0);
    expect(Array.from(fixtureState.sellerProducts.values()).some((product) =>
      String(product.description).includes("0970000000"),
    )).toBe(true);
    assertDiagnosticsClean(diagnostics);
  });

  test("create rejection keeps one draft, transfers safe issues, and retries without duplication", async ({ page }) => {
    fixtureState.sellerMode = "policy";
    fixtureState.sellerPolicyFields = ["title"];
    const diagnostics = collectDiagnostics(page);

    await openSellerPage(page, "/seller/products/new");
    await fillCreateForm(page, "Fixture description for review submission");
    await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), SELLER_DRAFT_STORAGE_KEY)).not.toBeNull();
    await clickVisibleButton(page, "Submit for Review");

    await expectRecoveryEditorUrl(page, "created-1", "content-policy");
    await expect(visiblePolicyFeedback(page)).toHaveCount(1);
    await expect(visiblePolicyFeedback(page)).toContainText(DIRECT_GUIDANCE);
    expect(fixtureState.createCount).toBe(1);
    expect(fixtureState.submitCount).toBe(1);
    await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), SELLER_DRAFT_STORAGE_KEY)).toBeNull();
    await expect(page.locator("#product-title")).toBeFocused();
    await expect(page.locator("#product-attribute-0")).toBeVisible();

    const recoveryStorage = await page.evaluate(() =>
      Object.entries(window.sessionStorage).map(([key, value]) => `${key}:${value}`).join("\n"),
    );
    expect(recoveryStorage).not.toContain("fixture-secret-hash");
    expect(recoveryStorage).not.toContain("fixture-detector-v1");
    expect(recoveryStorage).not.toContain("fixture-contact@example.invalid");

    await clickVisibleButton(page, "Submit for Review");
    expect(fixtureState.createCount).toBe(1);
    await expect.poll(() => fixtureState.updateCount).toBe(1);

    fixtureState.sellerMode = "success";
    await page.locator("#product-title").fill("Corrected fixture product");
    await clickVisibleButton(page, "Submit for Review");
    await expect(page).toHaveURL(/\/seller\/products\/created-1$/);
    expect(fixtureState.createCount).toBe(1);
    expect(fixtureState.updateCount).toBe(2);
    assertDiagnosticsClean(diagnostics);
  });

  test("edit rejection focuses every field, image, legacy specification, and attribute target", async ({ page }) => {
    fixtureState.sellerMode = "policy";
    const diagnostics = collectDiagnostics(page);
    await openSellerPage(page, `/seller/products/${SELLER_PRODUCT_ID}/edit`);
    await expect(page.locator("#product-attribute-0")).toBeVisible();

    const targets: Array<[string, string]> = [
      ["title", "product-title"],
      ["description", "product-description"],
      ["location", "product-location"],
      ["brand", "product-brand"],
      ["sku", "product-sku"],
      ["seoTitle", "product-seo-title"],
      ["seoDescription", "product-seo-description"],
      ["dimensions", "product-dimensions-length"],
      ["model", "product-legacy-model"],
      ["images[0].alt", "product-image-0-alt"],
      ["images[0].linkedVariantValue", "product-image-0-variant"],
      ["attributes[0].value", "product-attribute-0"],
    ];

    for (const [field, targetId] of targets) {
      fixtureState.sellerPolicyFields = [field];
      await clickVisibleButton(page, "Submit for Review");
      await expect(visiblePolicyFeedback(page)).toHaveCount(1);
      await expect(page.locator(`#${targetId}`)).toBeFocused();
    }

    await expect(page.getByText("Product updated and submitted for review.")).toHaveCount(0);
    await assertNoUnsafeDiagnostics(page);
    assertDiagnosticsClean(diagnostics);
  });

  test("list and preview submission failures open the same editable recovery path", async ({ page }) => {
    fixtureState.sellerMode = "policy";
    fixtureState.sellerPolicyFields = ["description"];
    const diagnostics = collectDiagnostics(page);

    await openSellerPage(page, "/seller/products");
    await page.getByRole("button", { name: /Open product actions for Seller Fixture Product/ }).click();
    await page.getByText("Submit for Review", { exact: true }).click();
    await expectRecoveryEditorUrl(page, SELLER_PRODUCT_ID, "content-policy");
    await expect(visiblePolicyFeedback(page)).toHaveCount(1);
    await expect(page.locator("#product-description")).toBeFocused();

    await openSellerPage(page, `/seller/products/${SELLER_PRODUCT_ID}`);
    await clickVisibleButton(page, "Submit for Review");
    await expectRecoveryEditorUrl(page, SELLER_PRODUCT_ID, "content-policy");
    await expect(visiblePolicyFeedback(page)).toHaveCount(1);
    await expect(page.locator("#product-description")).toBeFocused();
    assertDiagnosticsClean(diagnostics);
  });

  test("admin single rejection retains the dialog and 409 keeps state honest", async ({ page, context }) => {
    await setAdminCookie(context);
    const diagnostics = collectDiagnostics(page);
    fixtureState.adminSingleMode = "policy";
    fixtureState.adminPolicyFields = ["description"];

    await page.goto(`${APP_BASE_URL}/admin/products/${ADMIN_PRODUCT_ID}`, { waitUntil: "networkidle" });
    await clickVisibleButton(page, "Approve Product");
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Approve Product" }).click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("product-content-policy-feedback")).toContainText(DIRECT_GUIDANCE);
    expect(fixtureState.adminProducts.get(ADMIN_PRODUCT_ID)?.status).toBe("PENDING_REVIEW");

    fixtureState.adminSingleMode = "conflict";
    await dialog.getByRole("button", { name: "Approve Product" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Reload the latest version/)).toBeVisible();
    expect(fixtureState.adminProducts.get(ADMIN_PRODUCT_ID)?.status).toBe("PENDING_REVIEW");
    await assertNoUnsafeDiagnostics(page);
    assertDiagnosticsClean(diagnostics);
  });

  test("bulk approval preserves selection and groups findings by product ID", async ({ page, context }) => {
    await setAdminCookie(context);
    fixtureState.adminBulkMode = "policy";
    fixtureState.adminPolicyFields = ["description", "images[0].alt"];
    const diagnostics = collectDiagnostics(page);

    await page.goto(`${APP_BASE_URL}/admin/products`, { waitUntil: "networkidle" });
    const checkbox = page.getByRole("checkbox", { name: "Select Admin Fixture Product" }).first();
    await checkbox.check();
    await clickVisibleButton(page, "Approve");

    const feedback = visiblePolicyFeedback(page);
    await expect(feedback).toHaveCount(1);
    await expect(feedback).toContainText(`Product ID: ${ADMIN_PRODUCT_ID}`);
    await expect(feedback).toContainText("Description");
    await expect(feedback).toContainText("Image 1 alt text");
    await expect(checkbox).toBeChecked();
    expect(fixtureState.adminProducts.get(ADMIN_PRODUCT_ID)?.status).toBe("PENDING_REVIEW");
    await assertNoUnsafeDiagnostics(page);
    assertDiagnosticsClean(diagnostics);
  });

  test("malformed policy responses use generic handling without exposing diagnostics", async ({ page }) => {
    fixtureState.sellerMode = "policy";
    fixtureState.sellerPolicyFields = [];
    const diagnostics = collectDiagnostics(page);

    await openSellerPage(page, `/seller/products/${SELLER_PRODUCT_ID}/edit`);
    await clickVisibleButton(page, "Submit for Review");

    await expect(visiblePolicyFeedback(page)).toHaveCount(0);
    await expect(
      page
        .getByText("Unable to submit this product for review. Try again.")
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
    await assertNoUnsafeDiagnostics(page);
    assertDiagnosticsClean(diagnostics);
  });

  for (const failureMode of ["server-error", "network"] as const) {
    test(`${failureMode} after draft creation recovers the exact draft without duplication`, async ({ page }) => {
      fixtureState.sellerMode = failureMode;

      await openSellerPage(page, "/seller/products/new");
      await fillCreateForm(page, `Fixture ${failureMode} recovery product`);
      await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), SELLER_DRAFT_STORAGE_KEY)).not.toBeNull();
      await clickVisibleButton(page, "Submit for Review");

      await expectRecoveryEditorUrl(page, "created-1", "submit-failed");
      await expect(visibleRecoveryFallback(page)).toContainText(
        "Draft saved, submission incomplete",
      );
      await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), SELLER_DRAFT_STORAGE_KEY)).toBeNull();
      expect(fixtureState.createCount).toBe(1);
      expect(fixtureState.submitCount).toBe(1);

      await clickVisibleButton(page, "Submit for Review");
      await expect.poll(() => fixtureState.updateCount).toBe(1);
      expect(fixtureState.createCount).toBe(1);
      await expect(page).toHaveURL(new RegExp(`/seller/products/created-1/edit`));
    });
  }

  test("sessionStorage set denial keeps the backend rejection and opens safe fallback UI", async ({ page }) => {
    await denyRecoveryStorageOperation(page, "setItem");
    fixtureState.sellerMode = "policy";
    fixtureState.sellerPolicyFields = ["description"];

    await openSellerPage(page, "/seller/products/new");
    await fillCreateForm(page, "Fixture storage-denied product");
    await clickVisibleButton(page, "Submit for Review");

    await expectRecoveryEditorUrl(page, "created-1", "content-policy");
    await expect(visibleRecoveryFallback(page)).toContainText(
      "Draft kept for correction",
    );
    expect(fixtureState.createCount).toBe(1);
    expect(fixtureState.submitCount).toBe(1);
  });

  test("sessionStorage get denial does not crash recovery", async ({ page }) => {
    await denyRecoveryStorageOperation(page, "getItem");
    await openSellerPage(
      page,
      `/seller/products/${SELLER_PRODUCT_ID}/edit?submissionRecovery=content-policy`,
    );

    await expect(visibleRecoveryFallback(page)).toContainText(
      "Draft kept for correction",
    );
  });

  test("sessionStorage remove denial preserves valid sanitized recovery", async ({ page }) => {
    await seedRecoveryAndDenyRemove(page, SELLER_PRODUCT_ID);
    await openSellerPage(
      page,
      `/seller/products/${SELLER_PRODUCT_ID}/edit?submissionRecovery=content-policy`,
    );

    await expect(visiblePolicyFeedback(page)).toHaveCount(1);
    await expect(page.locator("#product-description")).toBeFocused();
  });

  for (const viewport of [
    { name: "mobile-320x568", width: 320, height: 568 },
    { name: "mobile-390x844", width: 390, height: 844 },
    { name: "tablet-768x1024", width: 768, height: 1024 },
    { name: "desktop-1440x900", width: 1440, height: 900 },
  ]) {
    test(`${viewport.name} seller and admin feedback remain visible, bounded, and error-free`, async ({ page, context }) => {
      await page.setViewportSize(viewport);
      const diagnostics = collectDiagnostics(page);
      fixtureState.sellerMode = "policy";
      fixtureState.sellerPolicyFields = ["location"];

      await openSellerPage(page, `/seller/products/${SELLER_PRODUCT_ID}/edit`);
      await clickVisibleButton(page, "Submit for Review");
      await assertVisibleFeedbackGeometry(page);
      if (viewport.width < 768) {
        await expect(
          page
            .getByTestId("product-listing-mobile-actions")
            .getByTestId("product-content-policy-feedback"),
        ).toHaveCount(0);
        await visiblePolicyFeedback(page).getByRole("button", { name: "Product location" }).click();
        await expect(page.locator("#product-location")).toBeFocused();
        await assertTargetBetweenMobileChrome(page, "#product-location");
        await assertVisibleFeedbackGeometry(page);
      }
      await assertNoHorizontalOverflow(page);
      await assertNoUnsafeDiagnostics(page);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `seller-${viewport.name}.png`),
        fullPage: false,
      });

      await setAdminCookie(context);
      fixtureState.adminSingleMode = "policy";
      fixtureState.adminPolicyFields = ["description"];
      await page.goto(`${APP_BASE_URL}/admin/products/${ADMIN_PRODUCT_ID}`, { waitUntil: "networkidle" });
      await clickVisibleButton(page, "Approve Product");
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Approve Product" }).click();
      await expect(dialog).toBeVisible();
      await assertVisibleFeedbackGeometry(page);
      await assertNoHorizontalOverflow(page);
      await assertNoUnsafeDiagnostics(page);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `admin-${viewport.name}.png`),
        fullPage: false,
      });

      assertDiagnosticsClean(diagnostics);
    });
  }
});

function createFixtureState(): FixtureState {
  return {
    sellerProducts: new Map(),
    adminProducts: new Map(),
    sellerMode: "success",
    sellerPolicyFields: ["description"],
    adminSingleMode: "success",
    adminBulkMode: "success",
    adminPolicyFields: ["description"],
    createCount: 0,
    submitCount: 0,
    updateCount: 0,
    requests: [],
  };
}

function resetFixtureState() {
  const next = createFixtureState();
  Object.assign(fixtureState, next);
  fixtureState.sellerProducts = new Map([
    [SELLER_PRODUCT_ID, makeProduct(SELLER_PRODUCT_ID, "Seller Fixture Product", "DRAFT")],
  ]);
  fixtureState.adminProducts = new Map([
    [ADMIN_PRODUCT_ID, makeProduct(ADMIN_PRODUCT_ID, "Admin Fixture Product", "PENDING_REVIEW")],
  ]);
}

function makeProduct(id: string, title: string, status: string): FixtureProduct {
  return {
    id,
    slug: title.toLowerCase().split(" ").join("-"),
    title,
    description: "Fixture product description",
    location: "Lusaka",
    price: 250,
    salePrice: null,
    images: [{
      url: "/file.svg",
      publicId: `fixture/${id}`,
      alt: "Front view",
      isPrimary: true,
      sortOrder: 0,
      linkedVariantValue: "Black",
      width: 800,
      height: 800,
    }],
    condition: "NEW",
    category: "ELECTRONICS",
    categoryId: CATEGORY_ID,
    categorySlug: "electronics",
    subcategorySlug: "mobile-phones",
    categoryRef: {
      id: CATEGORY_ID,
      name: "Mobile Phones",
      slug: "mobile-phones",
      parentId: CATEGORY_PARENT_ID,
    },
    attributeValues: [{
      id: "attribute-value-1",
      attributeId: ATTRIBUTE_ID,
      slug: "serial-note",
      name: "Serial Note",
      value: "Retail unit",
    }],
    status,
    sku: "FIXTURE-SKU",
    stock: 5,
    isSold: false,
    lowStockThreshold: 1,
    deliveryType: "STANDARD",
    weightKG: 1,
    dimensions: "10x20x30",
    seoTitle: "Fixture SEO title",
    seoDescription: "Fixture SEO description",
    brand: "Fixture Brand",
    model: "Fixture Model",
    ram: null,
    storage: null,
    batteryHealth: null,
    size: null,
    color: null,
    material: null,
    compatibility: null,
    isApproved: status === "APPROVED" || status === "PUBLISHED",
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    reviewNotes: null,
    createdAt: "2026-08-08T08:00:00.000Z",
    updatedAt: "2026-08-08T08:00:00.000Z",
    user: {
      id: "seller-fixture-user",
      firstName: "Fixture",
      lastName: "Seller",
      email: "seller@fixture.invalid",
    },
  };
}

type PolicyFindingOverrides = Partial<{
  code: string;
  severity: string;
  source: string;
}>;

function makePolicyApiError(fields: string[], overrides: PolicyFindingOverrides = {}) {
  return new ApiError("Rejected", 422, makePolicyDetails(fields, overrides));
}

function makePolicyDetails(fields: string[], overrides: PolicyFindingOverrides = {}) {
  return {
    status: "fail",
    code: "CONTENT_POLICY_VIOLATION",
    message: "Remove contact or external-channel information before continuing.",
    errors: fields.map((field) => ({
      field,
      code: "CONTACT_EMAIL",
      severity: "BLOCK",
      source: "TEXT",
      detectorVersion: "fixture-detector-v1",
      maskedMatch: "fi***@example.invalid",
      start: 4,
      end: 31,
      contentHash: "fixture-secret-hash",
      remediation: "Unsafe backend remediation detail",
      rawContact: "fixture-contact@example.invalid",
      ...overrides,
    })),
  };
}

const fixtureServer = createServer(async (request, response) => {
  try {
    await handleFixtureRequest(request, response);
  } catch (error) {
    writeJson(response, 500, {
      status: "error",
      message: error instanceof Error ? error.message : "Fixture failure",
    });
  }
});

async function handleFixtureRequest(request: IncomingMessage, response: ServerResponse) {
  setCorsHeaders(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url ?? "/", FIXTURE_ORIGIN);
  const route = url.pathname.replace(/^\/api\/v1/, "");
  const method = request.method ?? "GET";
  fixtureState.requests.push(`${method} ${route}`);

  if (route === "/cloudinary-upload" && method === "POST") {
    writeJson(response, 200, {
      secure_url: `${APP_BASE_URL}/file.svg`,
      public_id: "fixture/uploaded-product-image",
      width: 800,
      height: 800,
    });
    return;
  }

  if (route === "/auth/csrf-token" && method === "GET") {
    response.setHeader("X-CSRF-Token", "fixture-csrf-token");
    writeJson(response, 200, { status: "success", data: { csrfToken: "fixture-csrf-token" } });
    return;
  }

  if (route === "/user/me" && method === "GET") {
    const isAdmin = request.headers.authorization === "Bearer fixture-admin-session";
    writeJson(response, 200, {
      status: "success",
      data: {
        user: isAdmin
          ? {
              id: "fixture-admin",
              firstName: "Fixture",
              lastName: "Admin",
              email: "admin@fixture.invalid",
              role: "SUPER_ADMIN",
              permissions: ["view_products", "moderate_products"],
              authStrength: "mfa",
            }
          : {
              id: "seller-fixture-user",
              firstName: "Fixture",
              lastName: "Seller",
              email: "seller@fixture.invalid",
              role: "VENDOR",
              emailVerified: true,
              isActive: true,
            },
      },
    });
    return;
  }

  if (route === "/vendor/applications/me" && method === "GET") {
    writeJson(response, 200, {
      status: "success",
      data: {
        application: {
          id: "fixture-application",
          userId: "seller-fixture-user",
          sellerType: "INDIVIDUAL",
          status: "APPROVED",
          ownerFullName: "Fixture Seller",
          storeName: "Fixture Store",
          legalBusinessName: "Fixture Store",
          productCategories: ["Electronics"],
          createdAt: "2026-08-08T08:00:00.000Z",
          updatedAt: "2026-08-08T08:00:00.000Z",
        },
      },
    });
    return;
  }

  if (route === "/categories" && method === "GET") {
    writeJson(response, 200, {
      status: "success",
      results: 1,
      data: {
        categories: [{
          id: CATEGORY_PARENT_ID,
          name: "Electronics",
          slug: "electronics",
          description: null,
          icon: null,
          parentId: null,
          isActive: true,
          sortOrder: 1,
          children: [{
            id: CATEGORY_ID,
            name: "Mobile Phones",
            slug: "mobile-phones",
            description: null,
            icon: null,
            parentId: CATEGORY_PARENT_ID,
            isActive: true,
            sortOrder: 1,
          }],
        }],
      },
    });
    return;
  }

  if (route === "/categories/mobile-phones/attributes" && method === "GET") {
    writeJson(response, 200, {
      status: "success",
      data: {
        categoryId: CATEGORY_ID,
        categoryName: "Mobile Phones",
        categorySlug: "mobile-phones",
        attributes: [{
          id: ATTRIBUTE_ID,
          name: "Serial Note",
          slug: "serial-note",
          type: "text",
          options: null,
          isRequired: true,
          sortOrder: 1,
        }],
      },
    });
    return;
  }

  if (route === "/vendor/uploads/product-image/signature" && method === "POST") {
    writeJson(response, 200, {
      status: "success",
      data: {
        timestamp: 1,
        signature: "fixture-signature",
        apiKey: "fixture-key",
        cloudName: "fixture-cloud",
        folder: "fixture-products",
        publicId: "fixture-image",
        resourceType: "image",
        uploadUrl: `${FIXTURE_ORIGIN}/cloudinary-upload`,
        allowedFormats: ["png", "jpg", "jpeg", "webp"],
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        maxFileSize: 3_000_000,
      },
    });
    return;
  }

  if (route === "/vendor/products" && method === "GET") {
    const products = Array.from(fixtureState.sellerProducts.values());
    writeJson(response, 200, {
      status: "success",
      results: products.length,
      pagination: { total: products.length, page: 1, limit: 20, pages: 1 },
      data: {
        products,
        summary: {
          total: products.length,
          buyerVisible: 0,
          pendingReview: products.filter((product) => product.status === "PENDING_REVIEW").length,
          lowStock: 0,
          outOfStock: 0,
        },
        facets: {
          categories: [],
          statuses: { DRAFT: products.filter((product) => product.status === "DRAFT").length },
          stock: { inStock: products.length, lowStock: 0, outOfStock: 0 },
        },
      },
    });
    return;
  }

  if (route === "/vendor/products" && method === "POST") {
    const body = await readJsonBody(request);
    fixtureState.createCount += 1;
    const id = `created-${fixtureState.createCount}`;
    const product = mergeProductInput(makeProduct(id, String(body.title ?? "Untitled"), "DRAFT"), body);
    fixtureState.sellerProducts.set(id, product);
    writeJson(response, 201, { status: "success", data: { product } });
    return;
  }

  const sellerSubmitMatch = /^\/vendor\/products\/([^/]+)\/submit-review$/.exec(route);
  if (sellerSubmitMatch && method === "PATCH") {
    fixtureState.submitCount += 1;
    const id = decodeURIComponent(sellerSubmitMatch[1]);
    const product = fixtureState.sellerProducts.get(id);
    if (!product) return writeJson(response, 404, { status: "fail", message: "Not found" });
    if (fixtureState.sellerMode === "policy") {
      return writePolicyResponse(response, fixtureState.sellerPolicyFields);
    }
    if (fixtureState.sellerMode === "conflict") {
      return writeJson(response, 409, { status: "fail", message: "Product changed while this action was in progress." });
    }
    if (fixtureState.sellerMode === "server-error") {
      return writeJson(response, 500, { status: "error", message: "Fixture submit failure" });
    }
    if (fixtureState.sellerMode === "network") {
      response.destroy();
      return;
    }
    const updated = { ...product, status: "PENDING_REVIEW", updatedAt: new Date().toISOString() };
    fixtureState.sellerProducts.set(id, updated);
    writeJson(response, 200, { status: "success", data: { product: updated } });
    return;
  }

  const sellerProductMatch = /^\/vendor\/products\/([^/]+)$/.exec(route);
  if (sellerProductMatch && method === "GET") {
    const product = fixtureState.sellerProducts.get(decodeURIComponent(sellerProductMatch[1]));
    writeJson(response, product ? 200 : 404, product
      ? { status: "success", data: { product } }
      : { status: "fail", message: "Not found" });
    return;
  }
  if (sellerProductMatch && method === "PATCH") {
    fixtureState.updateCount += 1;
    const id = decodeURIComponent(sellerProductMatch[1]);
    const product = fixtureState.sellerProducts.get(id);
    if (!product) return writeJson(response, 404, { status: "fail", message: "Not found" });
    const body = await readJsonBody(request);
    const isProtected = body.status === "PENDING_REVIEW" || body.status === "APPROVED" || body.status === "PUBLISHED";
    if (isProtected && fixtureState.sellerMode === "policy") {
      return writePolicyResponse(response, fixtureState.sellerPolicyFields);
    }
    if (isProtected && fixtureState.sellerMode === "conflict") {
      return writeJson(response, 409, { status: "fail", message: "Product changed while this action was in progress." });
    }
    if (isProtected && fixtureState.sellerMode === "server-error") {
      return writeJson(response, 500, { status: "error", message: "Fixture update failure" });
    }
    if (isProtected && fixtureState.sellerMode === "network") {
      response.destroy();
      return;
    }
    const updated = mergeProductInput(product, body);
    fixtureState.sellerProducts.set(id, updated);
    writeJson(response, 200, { status: "success", data: { product: updated } });
    return;
  }

  if (route === "/admin/products" && method === "GET") {
    const products = Array.from(fixtureState.adminProducts.values());
    writeJson(response, 200, { status: "success", results: products.length, data: { products } });
    return;
  }

  if (route === "/admin/products/bulk-approve" && method === "POST") {
    const body = await readJsonBody(request);
    const productIds = Array.isArray(body.productIds) ? body.productIds.map(String) : [];
    if (fixtureState.adminBulkMode === "policy") {
      return writePolicyResponse(
        response,
        productIds.flatMap((productId) =>
          fixtureState.adminPolicyFields.map((field) => `products.${productId}.${field}`),
        ),
      );
    }
    if (fixtureState.adminBulkMode === "conflict") {
      return writeJson(response, 409, { status: "fail", message: "Product changed while this action was in progress." });
    }
    productIds.forEach((id) => {
      const product = fixtureState.adminProducts.get(id);
      if (product) fixtureState.adminProducts.set(id, { ...product, status: "APPROVED" });
    });
    writeJson(response, 200, { status: "success", data: { count: productIds.length } });
    return;
  }

  const adminApproveMatch = /^\/admin\/products\/([^/]+)\/approve$/.exec(route);
  if (adminApproveMatch && method === "PATCH") {
    const id = decodeURIComponent(adminApproveMatch[1]);
    if (fixtureState.adminSingleMode === "policy") {
      return writePolicyResponse(response, fixtureState.adminPolicyFields);
    }
    if (fixtureState.adminSingleMode === "conflict") {
      return writeJson(response, 409, { status: "fail", message: "Product changed while this action was in progress." });
    }
    const product = fixtureState.adminProducts.get(id);
    if (!product) return writeJson(response, 404, { status: "fail", message: "Not found" });
    const updated = { ...product, status: "APPROVED", isApproved: true };
    fixtureState.adminProducts.set(id, updated);
    writeJson(response, 200, { status: "success", data: { product: updated } });
    return;
  }

  const adminProductMatch = /^\/admin\/products\/([^/]+)$/.exec(route);
  if (adminProductMatch && method === "GET") {
    const product = fixtureState.adminProducts.get(decodeURIComponent(adminProductMatch[1]));
    writeJson(response, product ? 200 : 404, product
      ? { status: "success", data: { product } }
      : { status: "fail", message: "Not found" });
    return;
  }

  writeJson(response, 404, { status: "fail", message: `Unhandled fixture route: ${method} ${route}` });
}

function mergeProductInput(product: FixtureProduct, body: Record<string, unknown>): FixtureProduct {
  const attributes = Array.isArray(body.attributes)
    ? body.attributes.map((attribute, index) => ({
        id: `attribute-value-${index + 1}`,
        ...(attribute as Record<string, unknown>),
      }))
    : product.attributeValues;

  return {
    ...product,
    ...body,
    id: product.id,
    slug: product.slug,
    status: typeof body.status === "string" ? body.status : product.status,
    categoryRef: product.categoryRef,
    attributeValues: attributes,
    updatedAt: new Date().toISOString(),
  };
}

function writePolicyResponse(response: ServerResponse, fields: string[]) {
  writeJson(response, 422, makePolicyDetails(fields));
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-CSRF-Token");
}

function writeJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as Record<string, unknown> : {};
}

async function openSellerPage(page: Page, route: string) {
  await page.goto(`${APP_BASE_URL}${route}`, { waitUntil: "networkidle" });
  await expect(page).not.toHaveURL(/\/seller\/login/);
}

async function fillCreateForm(page: Page, description: string) {
  await page.locator("#product-title").fill("Create recovery fixture product");
  await page.locator("#product-location").fill("Lusaka");
  await page.getByRole("button", { name: /Select product category/ }).click();
  await page.getByRole("button", { name: /Electronics/ }).click();
  await page.getByRole("button", { name: /Mobile Phones/ }).click();
  await page.getByRole("button", { name: "Submit Category" }).click();
  await page.locator("#product-description").fill(description);
  await page.locator('input[placeholder="0.00"]').first().fill("250");
  await page.locator('input[placeholder="0"]').first().fill("5");
  await page.getByLabel(/Serial Note/).fill("Retail unit");
  await page.getByLabel("Upload product images").setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4XQAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByText("Uploaded", { exact: true })).toBeVisible();
  await page.locator("#product-image-0-alt").fill("Fixture product front view");
}

async function clickVisibleButton(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).filter({ visible: true }).click();
}

async function setAdminCookie(context: BrowserContext) {
  if (!APP_BASE_URL) return;
  const appUrl = new URL(APP_BASE_URL);
  await context.addCookies([{
    name: "zogular_admin_session",
    value: "fixture-admin-session",
    domain: appUrl.hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: appUrl.protocol === "https:",
  }]);
}

function visiblePolicyFeedback(page: Page) {
  return page.getByTestId("product-content-policy-feedback").filter({ visible: true });
}

function visibleRecoveryFallback(page: Page) {
  return page.getByTestId("product-submission-recovery-fallback").filter({ visible: true });
}

async function expectRecoveryEditorUrl(
  page: Page,
  productId: string,
  hint: "content-policy" | "snapshot-conflict" | "submit-failed",
) {
  await expect(page).toHaveURL(
    new RegExp(`/seller/products/${productId}/edit\\?submissionRecovery=${hint}$`),
  );
}

async function denyRecoveryStorageOperation(
  page: Page,
  operation: "getItem" | "setItem" | "removeItem",
) {
  await page.addInitScript(
    ({ prefix, deniedOperation }) => {
      if (deniedOperation === "getItem") {
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function getItem(key: string) {
          if (key.startsWith(prefix)) throw new DOMException("Storage denied", "SecurityError");
          return original.call(this, key);
        };
      } else if (deniedOperation === "setItem") {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function setItem(key: string, value: string) {
          if (key.startsWith(prefix)) throw new DOMException("Storage denied", "SecurityError");
          return original.call(this, key, value);
        };
      } else {
        const original = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function removeItem(key: string) {
          if (key.startsWith(prefix)) throw new DOMException("Storage denied", "SecurityError");
          return original.call(this, key);
        };
      }
    },
    { prefix: SUBMISSION_RECOVERY_STORAGE_PREFIX, deniedOperation: operation },
  );
}

async function seedRecoveryAndDenyRemove(page: Page, productId: string) {
  await page.addInitScript(
    ({ prefix, id }) => {
      const key = `${prefix}${id}`;
      window.sessionStorage.setItem(key, JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        kind: "content-policy",
        issues: [{ field: "description" }],
      }));
      const original = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function removeItem(storageKey: string) {
        if (storageKey.startsWith(prefix)) {
          throw new DOMException("Storage denied", "SecurityError");
        }
        return original.call(this, storageKey);
      };
    },
    { prefix: SUBMISSION_RECOVERY_STORAGE_PREFIX, id: productId },
  );
}

type Diagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  badResponses: string[];
  failedRequests: string[];
  unexpectedOrigins: string[];
};

function collectDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    badResponses: [],
    failedRequests: [],
    unexpectedOrigins: [],
  };
  const appOrigin = new URL(APP_BASE_URL!).origin;
  const allowedOrigins = new Set([appOrigin, FIXTURE_ORIGIN]);

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const isExpectedContractStatus =
      /^Failed to load resource: the server responded with a status of (409 \(Conflict\)|422 \(Unprocessable Entity\))$/.test(
        text,
      );
    if (!isExpectedContractStatus) diagnostics.consoleErrors.push(text);
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const responseUrl = new URL(response.url());
    const isExpectedContractStatus = response.status() === 409 || response.status() === 422;
    const isExpectedFixturePath =
      responseUrl.origin === FIXTURE_ORIGIN &&
      (responseUrl.pathname.startsWith("/api/v1/vendor/product-management/products") ||
        responseUrl.pathname.startsWith("/api/v1/admin/products"));
    const isExpectedProxyPath =
      responseUrl.origin === appOrigin &&
      (responseUrl.pathname.startsWith("/api/backend/vendor/products") ||
        responseUrl.pathname.startsWith("/api/backend/admin/products"));
    const isExpectedContractResponse =
      isExpectedContractStatus && (isExpectedFixturePath || isExpectedProxyPath);
    if (!isExpectedContractResponse) {
      diagnostics.badResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!failure.includes("ERR_ABORTED")) diagnostics.failedRequests.push(`${failure} ${request.url()}`);
  });
  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;
    const origin = new URL(url).origin;
    if (origin === "https://va.vercel-scripts.com") return;
    if (!allowedOrigins.has(origin)) diagnostics.unexpectedOrigins.push(url);
  });

  return diagnostics;
}

function assertDiagnosticsClean(diagnostics: Diagnostics) {
  expect(diagnostics).toEqual({
    consoleErrors: [],
    pageErrors: [],
    badResponses: [],
    failedRequests: [],
    unexpectedOrigins: [],
  });
}

async function assertNoUnsafeDiagnostics(page: Page) {
  await expect(page.locator("body")).not.toContainText(
    /fixture-secret-hash|fixture-detector-v1|fixture-contact@example\.invalid|fi\*\*\*@example\.invalid/,
  );
}

async function assertVisibleFeedbackGeometry(page: Page) {
  const feedback = visiblePolicyFeedback(page);
  await expect(feedback).toHaveCount(1);
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText(DIRECT_GUIDANCE);
  await feedback.scrollIntoViewIfNeeded();

  const feedbackBox = await feedback.boundingBox();
  const viewport = await page.viewportSize();
  expect(feedbackBox).not.toBeNull();
  expect(feedbackBox?.width).toBeGreaterThan(0);
  expect(feedbackBox?.height).toBeGreaterThan(0);
  expect(feedbackBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(feedbackBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((feedbackBox?.x ?? -1) + (feedbackBox?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);
  expect((feedbackBox?.y ?? -1) + (feedbackBox?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);

  const hiddenAncestor = await feedback.evaluate((element) => {
    let current: Element | null = element;
    while (current) {
      const style = window.getComputedStyle(current);
      const rect = current.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) {
        return current.tagName;
      }
      current = current.parentElement;
    }
    return null;
  });
  expect(hiddenAncestor).toBeNull();

  const occludingElement = await feedback.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const points = [
      [rect.left + rect.width / 2, rect.top + 1],
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + rect.width / 2, rect.bottom - 1],
    ];
    for (const [index, [x, y]] of points.entries()) {
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== element && !element.contains(hit)) {
        return {
          point: index,
          tagName: hit.tagName,
          className: hit.getAttribute("class"),
          testId: hit.getAttribute("data-testid"),
          feedbackPointerEvents: window.getComputedStyle(element).pointerEvents,
          hitText: hit.textContent?.trim().slice(0, 80),
        };
      }
    }
    return null;
  });
  expect(occludingElement).toBeNull();

  const activeActionBoxes = await page
    .getByRole("button", { name: /^(Submit for Review|Approve Product)$/ })
    .filter({ visible: true })
    .evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }));
  expect(activeActionBoxes.length).toBeGreaterThan(0);
  for (const actionBox of activeActionBoxes) {
    const overlaps =
      (feedbackBox?.x ?? 0) < actionBox.x + actionBox.width &&
      (feedbackBox?.x ?? 0) + (feedbackBox?.width ?? 0) > actionBox.x &&
      (feedbackBox?.y ?? 0) < actionBox.y + actionBox.height &&
      (feedbackBox?.y ?? 0) + (feedbackBox?.height ?? 0) > actionBox.y;
    expect(overlaps).toBe(false);
  }
}

async function assertTargetBetweenMobileChrome(page: Page, selector: string) {
  const target = page.locator(selector);
  const header = page.getByTestId("product-listing-studio-header");
  const actions = page.getByTestId("product-listing-mobile-actions");

  await expect(target).toBeVisible();
  await expect(header).toBeVisible();
  await expect(actions).toBeVisible();

  await expect.poll(async () => {
    const [targetBox, headerBox, actionsBox, viewport] = await Promise.all([
      target.boundingBox(),
      header.boundingBox(),
      actions.boundingBox(),
      page.viewportSize(),
    ]);
    if (!targetBox || !headerBox || !actionsBox || !viewport) return false;

    return (
      targetBox.y >= headerBox.y + headerBox.height &&
      targetBox.y + targetBox.height <= actionsBox.y &&
      targetBox.x >= 0 &&
      targetBox.x + targetBox.width <= viewport.width
    );
  }).toBe(true);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}
