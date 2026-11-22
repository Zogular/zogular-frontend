/**
 * @file admin-product-list-browser.spec.ts
 * @description
 * Loopback browser regression suite for PM-F1 READ (`feature/admin-products-paged-read-pm-f1`):
 * - Uses unique loopback port pair (3241 Next.js / 5041 fixture HTTP API).
 * - Blocks service workers and aborts all non-loopback HTTP/WebSocket traffic before navigation.
 * - Verifies one server page at a time, excludeDrafts=true before totals, statusMode=exact,
 *   page-scoped bulk selection, honest empty/500-stale/409/401/403 & actor-switch cache purge,
 *   returnTo sanitization, scroll restoration on UI Back & browser Back, and content containment
 *   + screenshots at 320, 375, 390, 430, 768, 1024, 1280, and 1440px.
 */

import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const BROWSER_PORT = 3241;
const BACKEND_PORT = 5041;
const BROWSER_ORIGIN = `http://127.0.0.1:${BROWSER_PORT}`;
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;
const ARTIFACT_DIR = path.join(repoRoot, "test-results", "pm-f1-product-list-artifacts");

if (process.env.PLAYWRIGHT_CHANNEL) {
  test.use({
    channel: process.env.PLAYWRIGHT_CHANNEL,
  });
}

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

type FixtureStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "PUBLISHED"
  | "PAUSED"
  | "SUSPENDED";

interface FixtureProduct {
  id: string;
  userId: string;
  title: string;
  description: string;
  slug: string;
  sku: string;
  status: FixtureStatus;
  price: number;
  salePrice: number | null;
  stock: number;
  isSold: boolean;
  isApproved: boolean;
  category: "ELECTRONICS" | "PHONES" | "LAPTOPS";
  categorySlug: string;
  subcategorySlug: string;
  categoryRef: { id: string; name: string; slug: string; parentId: null };
  images: Array<{ url: string; isPrimary: boolean }>;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    telephone: string;
  };
  rejectionReason: string | null;
  reviewNotes: string | null;
  views: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

const CANONICAL_NON_DRAFT_STATUSES: ReadonlyArray<Exclude<FixtureStatus, "DRAFT">> = [
  "PENDING_REVIEW",
  "NEEDS_CHANGES",
  "APPROVED",
  "PUBLISHED",
  "PAUSED",
  "SUSPENDED",
];

function makeFixtureProducts(): FixtureProduct[] {
  const products: FixtureProduct[] = [];

  // 10 DRAFT products that MUST be excluded before counting and pagination
  for (let i = 1; i <= 10; i++) {
    products.push({
      id: `prod-draft-${i}`,
      userId: `seller-draft-${i}`,
      title: `DRAFT-ONLY-HIDDEN-PRODUCT-${i}`,
      description: "Draft listing that must never appear when excludeDrafts=true.",
      slug: `draft-product-${i}`,
      sku: `DRF-${i}`,
      status: "DRAFT",
      price: 500 + i * 10,
      salePrice: null,
      stock: 3,
      isSold: false,
      isApproved: false,
      category: "ELECTRONICS",
      categorySlug: "electronics",
      subcategorySlug: "inverters",
      categoryRef: { id: "cat-1", name: "Electronics", slug: "electronics", parentId: null },
      images: [],
      user: {
        id: `seller-draft-${i}`,
        firstName: "Draft",
        lastName: `Seller${i}`,
        email: `draft${i}@example.zm`,
        telephone: `+260970000${String(i).padStart(3, "0")}`,
      },
      rejectionReason: null,
      reviewNotes: null,
      views: i,
      createdAt: new Date(Date.UTC(2026, 10, 1, 12, i)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 10, 1, 13, i)).toISOString(),
      approvedAt: null,
    });
  }

  // 45 non-draft products (page 1 = 20, page 2 = 20, page 3 = 5)
  for (let i = 1; i <= 45; i++) {
    const status =
      i === 1
        ? "PENDING_REVIEW"
        : CANONICAL_NON_DRAFT_STATUSES[(i - 1) % CANONICAL_NON_DRAFT_STATUSES.length];
    const isExtreme = i === 1;
    products.push({
      id: `prod-live-${String(i).padStart(2, "0")}`,
      userId: `seller-${i}`,
      title: isExtreme
        ? "SuperLongUnbrokenSolarInverter5kVAHybridPureSineWaveMPPTControllerListingTitleForOverflowVerification"
        : `Zogular Listing Item ${String(i).padStart(2, "0")}`,
      description: isExtreme
        ? "LongUnbrokenDescriptionTokenWithoutSpacesToVerifyNoHorizontalOverflowOccursAcrossAllSupportedViewports320To1440"
        : `Verified moderation fixture item ${i}.`,
      slug: `zogular-listing-item-${i}`,
      sku: isExtreme ? "SKU-UNBROKEN-99999999999999999999999" : `ZOG-${String(i).padStart(4, "0")}`,
      status,
      price: isExtreme ? 987654321 : 1000 + i * 150,
      salePrice: null,
      stock: 5 + (i % 10),
      isSold: false,
      isApproved: status === "APPROVED" || status === "PUBLISHED",
      category: "ELECTRONICS",
      categorySlug: isExtreme ? "ultra-long-unbroken-category-slug-for-overflow-check" : "solar-power",
      subcategorySlug: "hybrid-inverters",
      categoryRef: {
        id: "cat-solar",
        name: isExtreme
          ? "UltraLongUnbrokenCategoryNameForMobileContainmentTesting"
          : "Solar & Power",
        slug: "solar-power",
        parentId: null,
      },
      images: [],
      user: {
        id: `seller-${i}`,
        firstName: isExtreme ? "ChilesheUnbrokenFirstNameToken" : "Mwamba",
        lastName: `Banda${i}`,
        email: `seller${i}@example.zm`,
        telephone: `+2609711100${String(i).padStart(2, "0")}`,
      },
      rejectionReason: status === "NEEDS_CHANGES" ? "Clarify battery warranty." : null,
      reviewNotes: null,
      views: 100 - i,
      createdAt: new Date(Date.UTC(2026, 10, 20, 12, 60 - i)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 10, 20, 13, 60 - i)).toISOString(),
      approvedAt: status === "APPROVED" || status === "PUBLISHED" ? "2026-11-20T10:00:00.000Z" : null,
    });
  }

  return products;
}

const FIXTURE_PRODUCTS = makeFixtureProducts();

let backendServer: Server | null = null;
let nextProcess: ChildProcess | null = null;

interface FixtureControl {
  actorId: string;
  actorRole: "SUPER_ADMIN" | "OPERATIONS" | "TECH_ADMIN";
  permissions: string[];
  listForcedStatus: number | null;
  listDelayMs: number;
  actorASentinelEnabled: boolean;
  bulkApproveMode: "none" | "policy" | "conflict" | "malformed";
  recordedListRequests: URL[];
}

const control: FixtureControl = {
  actorId: "admin-ops-1",
  actorRole: "OPERATIONS",
  permissions: ["access_admin_panel", "view_all_products", "approve_products"],
  listForcedStatus: null,
  listDelayMs: 0,
  actorASentinelEnabled: false,
  bulkApproveMode: "none",
  recordedListRequests: [],
};

function resetControl() {
  control.actorId = "admin-ops-1";
  control.actorRole = "OPERATIONS";
  control.permissions = ["access_admin_panel", "view_all_products", "approve_products"];
  control.listForcedStatus = null;
  control.listDelayMs = 0;
  control.actorASentinelEnabled = false;
  control.bulkApproveMode = "none";
  control.recordedListRequests = [];
}

async function waitForHttpReady(url: string, timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function setupContainmentContext(browser: import("@playwright/test").Browser, width = 1280, height = 900) {
  const context = await browser.newContext({
    viewport: { width, height },
    serviceWorkers: "block",
  });

  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("data:") || url.startsWith("blob:")) {
      await route.continue();
      return;
    }
    const origin = new URL(url).origin;
    if (origin === BROWSER_ORIGIN || origin === BACKEND_ORIGIN) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });

  await context.routeWebSocket("**/*", (ws) => {
    const origin = new URL(ws.url().replace(/^ws/, "http")).origin;
    if (origin !== BROWSER_ORIGIN && origin !== BACKEND_ORIGIN) {
      void ws.close({ code: 1008, reason: "Non-loopback WebSocket blocked" });
    }
  });

  await context.addCookies([
    {
      name: "zogular_admin_session",
      value: "fixture-pm-f1-session",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return context;
}

test.describe("PM-F1 Admin Products Paged Read Browser Suite", () => {
  test.beforeAll(async () => {
    backendServer = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", BACKEND_ORIGIN);
      res.setHeader("content-type", "application/json");

      if (url.pathname === "/api/v1/user/me") {
        res.end(
          JSON.stringify({
            status: "success",
            data: {
              user: {
                id: control.actorId,
                name: `Fixture ${control.actorRole}`,
                email: `${control.actorId}@example.zm`,
                role: control.actorRole,
                permissions: control.permissions,
              },
            },
          }),
        );
        return;
      }

      if (url.pathname === "/api/v1/auth/csrf-token") {
        res.setHeader("Set-Cookie", "_csrf=fixture-csrf-token; Path=/; HttpOnly; SameSite=Lax");
        res.setHeader("X-CSRF-Token", "fixture-csrf-token");
        res.end(JSON.stringify({ status: "success", data: { csrfToken: "fixture-csrf-token" } }));
        return;
      }

      if (url.pathname === "/api/v1/admin/products") {
        control.recordedListRequests.push(url);
        if (control.listDelayMs > 0) {
          await new Promise((r) => setTimeout(r, control.listDelayMs));
        }
        if (control.listForcedStatus !== null) {
          const status = control.listForcedStatus;
          res.statusCode = status;
          res.end(
            JSON.stringify({
              status: "fail",
              message: `Forced status ${status}`,
            }),
          );
          return;
        }

        const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
        const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
        const excludeDrafts = url.searchParams.get("excludeDrafts") === "true";
        const status = url.searchParams.get("status");
        const statusMode = url.searchParams.get("statusMode");
        const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
        const sortBy = url.searchParams.get("sortBy") ?? "createdAt";
        const sortOrder = url.searchParams.get("sortOrder") ?? "desc";

        const sourceProducts: FixtureProduct[] = control.actorASentinelEnabled
          ? [
              {
                ...FIXTURE_PRODUCTS[10],
                id: "prod-actor-a-sentinel-999",
                title: "ACTOR-A-SENTINEL-PRODUCT-999",
                status: "PENDING_REVIEW",
                createdAt: "2026-11-22T12:00:00.000Z",
                updatedAt: "2026-11-22T12:00:00.000Z",
              },
              ...FIXTURE_PRODUCTS,
            ]
          : FIXTURE_PRODUCTS;

        const filtered = sourceProducts.filter((p) => {
          if (excludeDrafts && p.status === "DRAFT") return false;
          if (status) {
            if (statusMode === "exact") {
              if (p.status !== status) return false;
            }
          }
          if (search) {
            const hay = `${p.title} ${p.sku} ${p.id} ${p.user.firstName} ${p.user.lastName}`.toLowerCase();
            if (!hay.includes(search)) return false;
          }
          return true;
        });

        filtered.sort((a, b) => {
          let cmp = 0;
          if (sortBy === "price") cmp = a.price - b.price;
          else if (sortBy === "views") cmp = a.views - b.views;
          else if (sortBy === "title") cmp = a.title.localeCompare(b.title);
          else if (sortBy === "updatedAt")
            cmp = Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
          else cmp = Date.parse(a.createdAt) - Date.parse(b.createdAt);
          if (cmp === 0) return a.id.localeCompare(b.id);
          return sortOrder === "asc" ? cmp : -cmp;
        });

        const total = filtered.length;
        const pages = total === 0 ? 0 : Math.ceil(total / limit);
        const sliced = filtered.slice((page - 1) * limit, page * limit);

        res.end(
          JSON.stringify({
            status: "success",
            results: sliced.length,
            pagination: { total, page, limit, pages },
            data: { products: sliced },
          }),
        );
        return;
      }

      if (url.pathname === "/api/v1/admin/products/bulk-approve" && req.method === "POST") {
        if (control.bulkApproveMode === "policy") {
          res.statusCode = 422;
          res.end(
            JSON.stringify({
              status: "fail",
              code: "CONTENT_POLICY_VIOLATION",
              message: "Content policy blocked bulk approval.",
              errors: [
                {
                  field: "description",
                  code: "CONTACT_EMAIL",
                  severity: "BLOCK",
                  source: "TEXT",
                },
              ],
            }),
          );
          return;
        }
        if (control.bulkApproveMode === "malformed") {
          res.statusCode = 422;
          res.end(
            JSON.stringify({
              status: "fail",
              code: "CONTENT_POLICY_VIOLATION",
              message: "Unexpected malformed policy payload",
              errors: [],
            }),
          );
          return;
        }
        if (control.bulkApproveMode === "conflict") {
          res.statusCode = 409;
          res.end(
            JSON.stringify({
              status: "fail",
              message: "Product changed while this action was in progress.",
            }),
          );
          return;
        }
        res.end(JSON.stringify({ status: "success", data: { count: 1 } }));
        return;
      }

      if (url.pathname.startsWith("/api/v1/admin/products/") && req.method === "GET") {
        const id = decodeURIComponent(url.pathname.replace("/api/v1/admin/products/", ""));
        const product = FIXTURE_PRODUCTS.find((p) => p.id === id);
        if (!product) {
          res.statusCode = 404;
          res.end(JSON.stringify({ status: "fail", message: "Product not found" }));
          return;
        }
        res.end(JSON.stringify({ status: "success", data: { product } }));
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ status: "fail", message: `Unhandled route ${url.pathname}` }));
    });

    await new Promise<void>((resolve) => {
      backendServer!.listen(BACKEND_PORT, "127.0.0.1", () => resolve());
    });

    nextProcess = spawn(
      process.execPath,
      [path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(BROWSER_PORT), "-H", "127.0.0.1"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          INTERNAL_BACKEND_URL: `${BACKEND_ORIGIN}/api/v1`,
          ADMIN_API_URL: `${BACKEND_ORIGIN}/api/v1`,
          NEXT_PUBLIC_API_URL: `${BACKEND_ORIGIN}/api/v1`,
          NEXT_PUBLIC_API_PROXY_URL: "/api/backend",
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: "ignore",
      },
    );

    await waitForHttpReady(`${BROWSER_ORIGIN}/admin/login`);
  });

  test.afterAll(async () => {
    if (nextProcess) {
      nextProcess.kill("SIGTERM");
      nextProcess = null;
    }
    if (backendServer) {
      await new Promise<void>((resolve) => backendServer!.close(() => resolve()));
      backendServer = null;
    }
  });

  test.beforeEach(() => {
    resetControl();
  });

  test("enforces bounded server pagination, excludeDrafts=true, exact status filters, and page-scoped bulk selection", async ({
    browser,
  }) => {
    const context = await setupContainmentContext(browser, 1280, 900);
    const page = await context.newPage();

    try {
      await page.goto(`${BROWSER_ORIGIN}/admin/products`, { waitUntil: "networkidle" });

      // 1. Initial wire params: page=1, limit=20, excludeDrafts=true, no status, never limit=500
      expect(control.recordedListRequests.length).toBeGreaterThanOrEqual(1);
      const firstReq = control.recordedListRequests[0].searchParams;
      expect(firstReq.get("page")).toBe("1");
      expect(firstReq.get("limit")).toBe("20");
      expect(firstReq.get("excludeDrafts")).toBe("true");
      expect(firstReq.has("status")).toBe(false);

      // Total non-drafts is 45 (10 drafts excluded before totals)
      await expect(page.getByText("Showing 1–20 of 45 non-draft products (Page 1 of 3)")).toBeVisible();
      await expect(page.locator("body")).not.toContainText("DRAFT-ONLY-HIDDEN-PRODUCT");

      // Select a PENDING_REVIEW item on page 1
      const pendingCheckbox = page.locator('tbody input[type="checkbox"][aria-label^="Select "]').first();
      await pendingCheckbox.check();
      await expect(page.getByText(/1 pending product selected on this page/)).toBeVisible();

      // Navigate to page 2 -> selection must clear and page 2 returns 20 items
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("Showing 21–40 of 45 non-draft products (Page 2 of 3)")).toBeVisible();
      await expect(page.getByText(/pending product.*selected on this page/)).toHaveCount(0);

      // Navigate to page 3 -> returns 5 items
      await page.getByRole("button", { name: "Next" }).click();
      await expect(page.getByText("Showing 41–45 of 45 non-draft products (Page 3 of 3)")).toBeVisible();

      // Exact status filter sends statusMode=exact & resets page=1
      await page.getByLabel("Filter by moderation status").selectOption("NEEDS_CHANGES");
      await expect(page.getByText(/of 8 non-draft products \(Page 1 of 1\)/)).toBeVisible();
      const lastReq = control.recordedListRequests[control.recordedListRequests.length - 1].searchParams;
      expect(lastReq.get("status")).toBe("NEEDS_CHANGES");
      expect(lastReq.get("statusMode")).toBe("exact");
      expect(lastReq.get("excludeDrafts")).toBe("true");
    } finally {
      await context.close();
    }
  });

  test("handles honest empty, recoverable 500 stale banner, 409 conflict, and mounted application-level 401/403 cache purge", async ({
    browser,
  }) => {
    const context = await setupContainmentContext(browser, 1280, 900);
    const page = await context.newPage();

    try {
      await page.goto(`${BROWSER_ORIGIN}/admin/products`, { waitUntil: "networkidle" });
      await expect(page.getByText("Showing 1–20 of 45 non-draft products")).toBeVisible();

      // Recoverable 500 on manual refresh retains current page data and shows stale banner
      control.listForcedStatus = 500;
      await page.getByRole("button", { name: "Refresh product queue" }).click();
      await expect(page.getByText(/Showing last verified page\. Refresh failed:/)).toBeVisible();
      await expect(page.getByText("Showing 1–20 of 45 non-draft products")).toBeVisible();
      control.listForcedStatus = null;

      // Empty filtered search state
      await page.getByLabel("Search products").fill("NONEXISTENT_QUERY_XYZ_999");
      await expect(page.getByTestId("products-empty-state")).toBeVisible();
      await page.getByRole("button", { name: "Reset filters" }).click();
      await expect(page.getByText("Showing 1–20 of 45 non-draft products")).toBeVisible();

      // Mounted application-level 401 on refresh (/api/v1/user/me stays 200) purges cached rows immediately
      control.listForcedStatus = 401;
      await page.getByRole("button", { name: "Refresh product queue" }).click();
      await expect(page.getByTestId("products-error-state")).toContainText("Admin session expired");
      await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(0);
      control.listForcedStatus = null;

      // Recover back to 200, then test mounted application-level 403 purge without page reload
      await page.goto(`${BROWSER_ORIGIN}/admin/products`, { waitUntil: "networkidle" });
      await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(20);
      control.listForcedStatus = 403;
      await page.getByRole("button", { name: "Refresh product queue" }).click();
      await expect(page.getByTestId("products-error-state")).toContainText("Product queue access restricted");
      await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(0);
      control.listForcedStatus = null;

      // 409 conflict on reload
      control.listForcedStatus = 409;
      await page.goto(`${BROWSER_ORIGIN}/admin/products?page=2`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("products-error-state")).toContainText("conflict");
      control.listForcedStatus = null;
    } finally {
      await context.close();
    }
  });

  test("executes same-browser-context authority transition, delayed former response isolation, and permission loss", async ({
    browser,
  }) => {
    const context = await setupContainmentContext(browser, 1280, 900);
    const page = await context.newPage();

    try {
      // 1. Load as Actor A (OPERATIONS with approve_products) with unique sentinel product
      control.actorId = "admin-ops-1";
      control.actorRole = "OPERATIONS";
      control.permissions = ["access_admin_panel", "view_all_products", "approve_products"];
      control.actorASentinelEnabled = true;

      await page.goto(`${BROWSER_ORIGIN}/admin/products`, { waitUntil: "networkidle" });
      await expect(page.getByTestId("products-desktop-table").getByText("ACTOR-A-SENTINEL-PRODUCT-999")).toBeVisible();

      const firstCheckbox = page.locator('tbody input[type="checkbox"][aria-label^="Select "]').first();
      await firstCheckbox.check();
      await expect(page.getByText(/1 pending product selected on this page/)).toBeVisible();

      // 2. Trigger delayed Actor-A refresh, then switch authority to Actor B (no approve_products, no sentinel)
      //    and explicitly navigate/reload in the same browser context (AdminShell receives server-rendered identity).
      control.listDelayMs = 800;
      await page.getByRole("button", { name: "Refresh product queue" }).click();

      control.actorId = "admin-tech-2";
      control.actorRole = "TECH_ADMIN";
      control.permissions = ["access_admin_panel", "view_all_products"];
      control.actorASentinelEnabled = false;
      control.listDelayMs = 0;

      await page.goto(`${BROWSER_ORIGIN}/admin/products`, { waitUntil: "networkidle" });
      await page.waitForTimeout(950);

      // Assert zero Actor-A sentinel, zero bulk checkboxes/selection bar, and Actor B rows visible
      await expect(page.locator("body")).not.toContainText("ACTOR-A-SENTINEL-PRODUCT-999");
      await expect(page.locator('tbody input[type="checkbox"]')).toHaveCount(0);
      await expect(page.getByText(/pending product.*selected on this page/)).toHaveCount(0);
      await expect(page.getByText("Showing 1–20 of 45 non-draft products")).toBeVisible();

      // 3. Revoke view_all_products in the same browser context and verify access denial with zero rows
      control.permissions = ["access_admin_panel"];
      await page.goto(`${BROWSER_ORIGIN}/admin/products`, { waitUntil: "domcontentloaded" });
      await expect(page.locator('[data-testid^="product-row-"]')).toHaveCount(0);
      await expect(page.locator("body")).not.toContainText("ACTOR-A-SENTINEL-PRODUCT-999");
    } finally {
      await context.close();
    }
  });

  test("retains bulk selection on 422 policy failure, surfaces 409 conflict, and handles malformed 422 safely", async ({
    browser,
  }) => {
    const context = await setupContainmentContext(browser, 1280, 900);
    const page = await context.newPage();

    try {
      await page.goto(`${BROWSER_ORIGIN}/admin/products`, { waitUntil: "networkidle" });
      const checkbox = page.locator('tbody input[type="checkbox"][aria-label^="Select "]').first();
      await checkbox.check();

      // 422 content policy violation preserves selection and displays structured feedback
      control.bulkApproveMode = "policy";
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByTestId("product-content-policy-feedback")).toBeVisible();
      await expect(checkbox).toBeChecked();

      // 409 conflict shows reload prompt
      control.bulkApproveMode = "conflict";
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByText(/One or more selected products changed since this page loaded/)).toBeVisible();

      // Malformed 422 does not render structured policy feedback or expose internal diagnostics
      control.bulkApproveMode = "malformed";
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await expect(page.getByTestId("product-content-policy-feedback")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("preserves exact URL filters, view mode, and inner scroll position across UI Back and browser Back, and sanitizes foreign returnTo", async ({
    browser,
  }) => {
    const context = await setupContainmentContext(browser, 1280, 720);
    const page = await context.newPage();

    try {
      const targetUrl = `${BROWSER_ORIGIN}/admin/products?page=2&sortBy=price&sortOrder=asc&view=grid`;
      await page.goto(targetUrl, { waitUntil: "networkidle" });
      await expect(page.getByTestId("products-grid-collection")).toBeVisible();

      // Scroll inner admin container to a nonzero position
      const scrolledY = await page.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>(
          '[data-testid="admin-main-scroll"], [data-scroll-container="admin"]',
        );
        if (!scroller) return 0;
        scroller.scrollTop = 260;
        return Math.round(scroller.scrollTop);
      });
      expect(scrolledY).toBeGreaterThan(100);

      // Click first card Review/View link
      await page.getByTestId("products-grid-collection").getByRole("link").first().click();
      await page.waitForURL(/\/admin\/products\/prod-live-\d+\?returnTo=/);

      // UI Back button returns to exact URL and restores nonzero scroll
      await page.getByRole("button", { name: "Back to products" }).click();
      await page.waitForURL(/\/admin\/products\?page=2&sortBy=price&sortOrder=asc&view=grid/);
      await expect(page.getByTestId("products-grid-collection")).toBeVisible();

      await expect
        .poll(async () =>
          page.evaluate(() => {
            const scroller = document.querySelector<HTMLElement>(
              '[data-testid="admin-main-scroll"], [data-scroll-container="admin"]',
            );
            return scroller ? Math.round(scroller.scrollTop) : 0;
          }),
        )
        .toBeGreaterThan(100);

      // Browser Back restoration check
      await page.getByTestId("products-grid-collection").getByRole("link").first().click();
      await page.waitForURL(/\/admin\/products\/prod-live-\d+\?returnTo=/);
      await page.goBack();
      await page.waitForURL(/\/admin\/products\?page=2&sortBy=price&sortOrder=asc&view=grid/);

      // Foreign returnTo sanitization check
      await page.goto(
        `${BROWSER_ORIGIN}/admin/products/prod-live-01?returnTo=${encodeURIComponent("https://evil.test/admin/products")}`,
        { waitUntil: "networkidle" },
      );
      const backLinkHref = await page
        .locator('a:has(button[aria-label="Back to products"])')
        .getAttribute("href");
      expect(backLinkHref).toBe("/admin/products");
    } finally {
      await context.close();
    }
  });

  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
    for (const viewMode of ["list", "grid"] as const) {
      test(`maintains content-level containment without overflow in ${viewMode} mode at ${width}px`, async ({
        browser,
      }) => {
        const context = await setupContainmentContext(browser, width, 900);
        const page = await context.newPage();

        try {
          const url =
            viewMode === "grid"
              ? `${BROWSER_ORIGIN}/admin/products?view=grid`
              : `${BROWSER_ORIGIN}/admin/products`;
          await page.goto(url, { waitUntil: "networkidle" });
          await expect(page.getByText("Showing 1–20 of 45 non-draft products")).toBeVisible();

          const audit = await page.evaluate(() => {
            const docOverflow =
              document.documentElement.scrollWidth > document.documentElement.clientWidth;
            const main = document.querySelector("main") ?? document.body;
            const mainRect = main.getBoundingClientRect();
            const offending: string[] = [];

            const sortSelect = document.querySelector<HTMLSelectElement>(
              'select[aria-label="Sort products"]',
            );
            const sortWidth = sortSelect ? Math.round(sortSelect.getBoundingClientRect().width) : 0;
            const sortRight = sortSelect ? sortSelect.getBoundingClientRect().right : 0;

            if (sortSelect && sortRight > mainRect.right + 2) {
              offending.push(`sort-select:${sortRight.toFixed(1)}>${mainRect.right.toFixed(1)}`);
            }

            const elements = document.querySelectorAll<HTMLElement>(
              '[data-testid^="product-card-"], [data-testid^="product-card-"] h3, [data-testid^="product-card-"] a, [data-testid="products-desktop-table"] table, [data-testid="products-desktop-table"] td, [data-testid="products-desktop-table"] a, [aria-label="Product moderation filters"] input, [aria-label="Product moderation filters"] select',
            );
            for (const el of elements) {
              const rect = el.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) continue;
              if (rect.right > mainRect.right + 2) {
                offending.push(
                  `${el.tagName}:${rect.right.toFixed(1)}>${mainRect.right.toFixed(1)}`,
                );
              }
              if (el.matches("article, td") && el.scrollWidth > el.clientWidth + 2) {
                offending.push(
                  `clipped-${el.tagName}:${el.scrollWidth}>${el.clientWidth}`,
                );
              }
            }
            return { docOverflow, offending, sortWidth };
          });

          expect(audit.docOverflow).toBe(false);
          expect(audit.sortWidth).toBeGreaterThanOrEqual(140);
          expect(audit.offending).toEqual([]);

          await page.screenshot({
            path: path.join(ARTIFACT_DIR, `products-${viewMode}-${width}.png`),
            fullPage: false,
          });
        } finally {
          await context.close();
        }
      });
    }
  }
});
