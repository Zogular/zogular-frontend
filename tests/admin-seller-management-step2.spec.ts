import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import path from "node:path";
import { resetApiClientSecurityStateForTests } from "../src/services/api";
import {
  AdminVendorApplicationListContractError,
  buildAdminVendorApplicationListQuery,
  getVendorApplications,
  parseAdminVendorApplicationListResponse,
  SELLER_APPLICATION_STATUSES,
} from "../src/services/admin/vendor-applications";
import {
  applySellerListUrlUpdates,
  INITIAL_SELLER_LIST_REQUEST_STATE,
  parseSellerListQuery,
  reduceSellerListRequestState,
  sellerListQueryKey,
} from "../src/features/admin-sellers/lib/seller-list-state";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const originalFetch = globalThis.fetch;
const BROWSER_PORT = 3225;
const BACKEND_PORT = 5025;
const BROWSER_ORIGIN = `http://127.0.0.1:${BROWSER_PORT}`;

let nextServer: ChildProcess | null = null;
let backendFixture: Server | null = null;

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await originalFetch(url);
      if (response.status < 500) return;
    } catch {
      // The isolated Next server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

test.beforeAll(async () => {
  backendFixture = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${BACKEND_PORT}`);
    response.setHeader("content-type", "application/json");
    if (url.pathname === "/api/v1/user/me") {
      response.end(JSON.stringify({
        status: "success",
        data: {
          user: {
            id: "admin-fixture",
            name: "Fixture Admin",
            email: "admin@example.test",
            role: "SUPER_ADMIN",
            permissions: ["access_admin_panel", "review_sellers", "manage_seller_status", "view_seller_sensitive_fields"],
          },
        },
      }));
      return;
    }
    if (url.pathname.startsWith("/api/v1/admin/vendor-applications")) {
      response.end(JSON.stringify(listPayload()));
      return;
    }
    if (url.pathname === "/api/v1/auth/csrf-token") {
      response.end(JSON.stringify({ status: "success", data: { csrfToken: "fixture-csrf" } }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ status: "fail", message: "Fixture route missing" }));
  });

  await new Promise<void>((resolve, reject) => {
    backendFixture!.once("error", reject);
    backendFixture!.listen(BACKEND_PORT, "127.0.0.1", resolve);
  });

  nextServer = spawn(
    process.execPath,
    [
      fs.existsSync(path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"))
        ? path.join(repoRoot, "node_modules", "next", "dist", "bin", "next")
        : require.resolve("next/dist/bin/next"),
      "start",
      "-p",
      String(BROWSER_PORT),
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        INTERNAL_BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}/api/v1`,
        ADMIN_API_URL: `http://127.0.0.1:${BACKEND_PORT}/api/v1`,
      },
      stdio: "ignore",
    },
  );
  await waitForServer(`${BROWSER_ORIGIN}/admin/login`);
});

test.afterAll(async () => {
  if (nextServer && !nextServer.killed) nextServer.kill();
  await new Promise<void>((resolve) => backendFixture?.close(() => resolve()) ?? resolve());
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClientSecurityStateForTests();
});

function listPayload(overrides: Record<string, unknown> = {}) {
  const byStatus = Object.fromEntries(SELLER_APPLICATION_STATUSES.map((status) => [status, status === "SUBMITTED" ? 1 : 0]));
  return {
    status: "success",
    results: 1,
    pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    facets: { byStatus },
    data: {
      applications: [{
        id: "11111111-1111-4111-8111-111111111111",
        sellerType: "INDIVIDUAL",
        status: "SUBMITTED",
        ownerFullName: "Ada Seller",
        storeName: "Ada Market",
        createdAt: "2026-08-29T08:00:00.000Z",
        updatedAt: "2026-08-29T09:00:00.000Z",
        submittedAt: "2026-08-29T08:30:00.000Z",
      }],
    },
    ...overrides,
  };
}

test("serializes every allowlisted server query field", async () => {
  expect(buildAdminVendorApplicationListQuery({
    page: 3,
    limit: 40,
    search: "  Ada  ",
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  })).toEqual({
    page: 3,
    limit: 40,
    search: "Ada",
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  });

  let requestedUrl: URL | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = new URL(input instanceof Request ? input.url : String(input));
    return new Response(JSON.stringify(listPayload()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  await getVendorApplications({
    page: 3,
    limit: 40,
    search: "Ada",
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  });

  expect(Object.fromEntries(requestedUrl!.searchParams)).toEqual({
    page: "3",
    limit: "40",
    search: "Ada",
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  });
});

test("strictly parses pagination, all status facets, and application identity fields", () => {
  const parsed = parseAdminVendorApplicationListResponse(listPayload());
  expect(parsed.pagination).toEqual({ total: 1, page: 1, limit: 20, pages: 1 });
  expect(parsed.applications).toHaveLength(1);
  expect(parsed.applications[0]).toMatchObject({
    id: "11111111-1111-4111-8111-111111111111",
    sellerType: "INDIVIDUAL",
    status: "SUBMITTED",
  });
  expect(Object.keys(parsed.facets.byStatus)).toEqual(SELLER_APPLICATION_STATUSES);
  expect(parsed.facets.byStatus.REJECTED).toBe(0);
});

test("rejects malformed pagination, missing facets, unexpected statuses, and invalid rows atomically", () => {
  const base = listPayload();
  const cases: unknown[] = [
    { ...base, status: "ok" },
    { ...base, pagination: { total: 21, page: 1, limit: 20, pages: 1 } },
    { ...base, facets: undefined },
    {
      ...base,
      facets: {
        byStatus: {
          ...((base.facets as { byStatus: Record<string, number> }).byStatus),
          REJECTED: undefined,
        },
      },
    },
    {
      ...base,
      data: {
        ...(base.data as Record<string, unknown>),
        applications: [{ id: "", sellerType: "INDIVIDUAL", status: "SUBMITTED" }],
      },
    },
  ];
  for (const payload of cases) {
    expect(() => parseAdminVendorApplicationListResponse(payload)).toThrow(AdminVendorApplicationListContractError);
  }
});

test("rejects facets nested under data instead of the approved root envelope", () => {
  const payload = listPayload();
  const nestedPayload = {
    ...payload,
    facets: undefined,
    data: {
      ...(payload.data as Record<string, unknown>),
      facets: payload.facets,
    },
  };

  expect(() => parseAdminVendorApplicationListResponse(nestedPayload)).toThrow(
    AdminVendorApplicationListContractError,
  );
});

test("restores normalized URL state and resets page for filter changes", () => {
  const restored = parseSellerListQuery(new URLSearchParams("search=Ada&page=4&limit=40&status=SUBMITTED&sellerType=INDIVIDUAL&sort=storeName&direction=asc"));
  expect(restored).toEqual({
    search: "Ada",
    page: 4,
    limit: 40,
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  });

  const reset = applySellerListUrlUpdates(new URLSearchParams("page=4&status=SUBMITTED"), {
    status: "APPROVED",
    page: "",
  });
  expect(reset.toString()).toBe("status=APPROVED");
});

test("stale responses and stale failures cannot replace the latest request", () => {
  const firstQuery = parseSellerListQuery(new URLSearchParams("search=first"));
  const secondQuery = parseSellerListQuery(new URLSearchParams("search=second"));
  const firstKey = sellerListQueryKey(firstQuery);
  const secondKey = sellerListQueryKey(secondQuery);
  const data = parseAdminVendorApplicationListResponse(listPayload());

  let state = reduceSellerListRequestState(INITIAL_SELLER_LIST_REQUEST_STATE, {
    type: "request-started",
    requestId: 1,
    queryKey: firstKey,
  });
  state = reduceSellerListRequestState(state, {
    type: "request-started",
    requestId: 2,
    queryKey: secondKey,
  });
  const staleSuccess = reduceSellerListRequestState(state, {
    type: "request-succeeded",
    requestId: 1,
    queryKey: firstKey,
    data,
  });
  expect(staleSuccess).toBe(state);

  const currentSuccess = reduceSellerListRequestState(state, {
    type: "request-succeeded",
    requestId: 2,
    queryKey: secondKey,
    data,
  });
  expect(currentSuccess.data).toBe(data);
  expect(currentSuccess.dataQueryKey).toBe(secondKey);

  const refreshing = reduceSellerListRequestState(currentSuccess, {
    type: "request-started",
    requestId: 3,
    queryKey: secondKey,
  });
  expect(refreshing.isRefreshing).toBe(true);
  const failedRefresh = reduceSellerListRequestState(refreshing, {
    type: "request-failed",
    requestId: 3,
    queryKey: secondKey,
    error: { kind: "unavailable", message: "The seller queue is temporarily unavailable. Try again." },
  });
  expect(failedRefresh.data).toBe(data);
  expect(failedRefresh.error?.kind).toBe("unavailable");
  expect(failedRefresh.isRefreshing).toBe(false);
});

test("seller list source preserves permission actions and contains honest operational states", () => {
  const page = readSource("src/app/admin/(protected)/sellers/page.tsx");
  const hook = readSource("src/features/admin-sellers/hooks/use-sellers-list.ts");
  const filters = readSource("src/features/admin-sellers/sections/SellersListFilters.tsx");
  const table = readSource("src/features/admin-sellers/sections/SellersListTable.tsx");

  expect(hook).toContain("new AbortController()");
  expect(hook).toContain("requestIdRef");
  expect(hook).toContain("300");
  expect(hook).not.toContain("matchesApplicationSearch");
  expect(hook).not.toContain("visibleCount");
  expect(hook).not.toContain("limit: 100");
  expect(hook).toContain('adminIdentityHasPermission(identity, "manage_seller_status")');
  expect(page).toContain("Export current page ({currentPageRows})");
  expect(page).toContain("The seller queue is empty");
  expect(page).toContain("No seller applications match this view");
  expect(page).toContain("Could not verify the seller queue");
  expect(page).not.toContain("AdminMetricCard");
  expect(page).not.toContain("animate-pulse");
  expect(filters).toContain('placeholder="Search seller records"');
  expect(filters).toContain('aria-describedby="seller-queue-search-scope"');
  expect(filters).toContain("Store, owner, email, phone, or application ID.");
  expect(filters).toContain("facets?.[status]");
  expect(table).toContain("getAvailableVendorActions");
  expect(table).toContain("/admin/sellers/${application.id}");
});

function makeMockApplications(count = 20) {
  return Array.from({ length: count }, (_, i) => ({
    id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}`,
    sellerType: i % 2 === 0 ? ("INDIVIDUAL" as const) : ("REGISTERED_BUSINESS" as const),
    status: "SUBMITTED" as const,
    ownerFullName: `Seller ${i + 1}`,
    storeName: `Store ${i + 1} Market`,
    createdAt: "2026-08-29T08:00:00.000Z",
    updatedAt: "2026-08-29T09:00:00.000Z",
    submittedAt: "2026-08-29T08:30:00.000Z",
  }));
}

async function installSellerListRoutes(
  page: Page,
  applications = makeMockApplications(20),
  options: {
    holdMutation?: Promise<void>;
    onMutation?: (actionType: string, body: unknown, pathname: string) => void;
  } = {},
) {
  const byStatus = Object.fromEntries(
    SELLER_APPLICATION_STATUSES.map((status) => [status, status === "SUBMITTED" ? applications.length : 0]),
  );

  await page.route("**/api/backend/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api/backend", "");

    if (pathname === "/user/me") {
      return route.fulfill({
        json: {
          status: "success",
          data: {
            user: {
              id: "admin-fixture",
              name: "Fixture Admin",
              email: "admin@example.test",
              role: "SUPER_ADMIN",
              permissions: ["access_admin_panel", "review_sellers", "manage_seller_status", "view_seller_sensitive_fields"],
            },
          },
        },
      });
    }

    if (pathname.match(/^\/admin\/vendor-applications\/[a-f0-9-]+$/) && route.request().method() === "GET") {
      const id = pathname.split("/").pop();
      return route.fulfill({
        json: {
          status: "success",
          data: {
            application: {
              id,
              userId: "22222222-2222-4222-8222-222222222222",
              sellerType: "REGISTERED_BUSINESS",
              status: "SUBMITTED",
              ownerFullName: "Ada Seller",
              storeName: "Ada Market",
              legalBusinessName: "Ada Market Limited",
              businessAddress: "Plot 10, Cairo Road",
              district: "Lusaka",
              businessPhone: "+260970000001",
              businessEmail: "seller@example.test",
              productCategories: ["Computing"],
              nrcNumber: "123456/78/9",
              pacraNumber: "PACRA-123",
              tpin: "1000000000",
              payoutMode: "MOBILE_MONEY",
              momoProvider: "MTN",
              momoPhone: "+260970000001",
              momoAccountName: "Ada Seller",
              bankName: null,
              bankAccountNumber: null,
              bankAccountName: null,
              bankBranch: null,
              submittedAt: "2026-08-29T08:30:00.000Z",
              reviewedAt: null,
              rejectionReason: null,
              adminNotes: null,
              needsInfoReason: null,
              createdAt: "2026-08-29T08:00:00.000Z",
              updatedAt: "2026-08-29T09:00:00.000Z",
              account: {
                id: "22222222-2222-4222-8222-222222222222",
                firstName: "Ada",
                lastName: "Seller",
                email: "seller@example.test",
                telephone: "+260970000001",
                role: "SELLER",
              },
            },
            review: {
              capabilities: {
                canManageStatus: true,
                canViewSensitiveFields: true,
                availableActions: ["APPROVE", "GRANT_PROVISIONAL", "REQUEST_INFO", "REJECT"],
              },
              evidence: {
                emailVerified: true,
                phoneVerified: true,
                accountActive: true,
                documents: { NRC_FRONT: true, NRC_BACK: true, SHOP_PHOTO: true, PACRA_DOCUMENT: true },
                payoutDestinationAvailable: true,
              },
              history: [],
            },
          },
        },
      });
    }

    if (pathname.startsWith("/admin/vendor-applications") && route.request().method() === "GET") {
      const search = url.searchParams.get("search");
      const statusParam = url.searchParams.get("status");
      let filtered = applications;
      if (search) {
        filtered = filtered.filter((app) => app.storeName.toLowerCase().includes(search.toLowerCase()));
      }
      if (statusParam && statusParam !== "all") {
        filtered = filtered.filter((app) => app.status === statusParam);
      }

      const total = filtered.length;
      const pages = Math.ceil(total / 20);

      return route.fulfill({
        json: {
          status: "success",
          results: total,
          pagination: { total, page: 1, limit: 20, pages },
          facets: { byStatus },
          data: { applications: filtered },
        },
      });
    }

    if (pathname === "/auth/csrf-token") {
      return route.fulfill({ json: { data: { csrfToken: "fixture-csrf" } } });
    }

    if (pathname.includes("/admin/vendor-applications/") && route.request().method() === "PATCH") {
      const actionType = pathname.split("/").pop() ?? "";
      const body = JSON.parse(route.request().postData() ?? "{}");
      options.onMutation?.(actionType, body, pathname);

      if (options.holdMutation) {
        await options.holdMutation;
      }

      return route.fulfill({
        json: {
          status: "success",
          data: {
            application: {
              id: applications[0]?.id ?? "11111111-1111-4111-8111-000000000001",
              userId: "22222222-2222-4222-8222-222222222222",
              sellerType: "REGISTERED_BUSINESS",
              status: actionType === "approve" ? "APPROVED" : "SUBMITTED",
              ownerFullName: "Ada Seller",
              storeName: "Ada Market",
              legalBusinessName: "Ada Market Limited",
              businessAddress: "Plot 10, Cairo Road",
              district: "Lusaka",
              businessPhone: "+260970000001",
              businessEmail: "seller@example.test",
              productCategories: ["Computing"],
              nrcNumber: "123456/78/9",
              pacraNumber: "PACRA-123",
              tpin: "1000000000",
              payoutMode: "MOBILE_MONEY",
              momoProvider: "MTN",
              momoPhone: "+260970000001",
              momoAccountName: "Ada Seller",
              bankName: null,
              bankAccountNumber: null,
              bankAccountName: null,
              bankBranch: null,
              submittedAt: "2026-08-29T08:30:00.000Z",
              reviewedAt: null,
              rejectionReason: null,
              adminNotes: null,
              needsInfoReason: null,
              createdAt: "2026-08-29T08:00:00.000Z",
              updatedAt: new Date().toISOString(),
              account: {
                id: "22222222-2222-4222-8222-222222222222",
                firstName: "Ada",
                lastName: "Seller",
                email: "seller@example.test",
                telephone: "+260970000001",
                role: "SELLER",
              },
            },
            review: {
              capabilities: {
                canManageStatus: true,
                canViewSensitiveFields: true,
                availableActions: actionType === "approve" ? ["RESTRICT", "SUSPEND"] : ["APPROVE", "GRANT_PROVISIONAL", "REQUEST_INFO", "REJECT"],
              },
              evidence: {
                emailVerified: true,
                phoneVerified: true,
                accountActive: true,
                documents: { NRC_FRONT: true, NRC_BACK: true, SHOP_PHOTO: true, PACRA_DOCUMENT: true },
                payoutDestinationAvailable: true,
              },
              history: [],
            },
          },
        },
      });
    }

    return route.fulfill({ status: 404, json: { status: "fail", message: "Fixture route missing" } });
  });
}

async function installNetworkContainment(context: BrowserContext) {
  const violations: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["data:", "blob:", "about:", "chrome-extension:"].includes(url.protocol)) {
      return route.fallback();
    }
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      return route.fallback();
    }
    violations.push(url.href);
    return route.abort();
  });

  await context.routeWebSocket("**/*", (ws) => {
    try {
      const url = new URL(ws.url());
      if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
        violations.push(ws.url());
        ws.close();
        return;
      }
    } catch {
      violations.push(ws.url());
      ws.close();
      return;
    }
    ws.connectToServer();
  });

  return violations;
}

test.describe("Admin Seller Management Browser Acceptance", () => {
  test("seller queue toggles between list and grid views and updates aria-pressed", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerListRoutes(page);
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers`, { waitUntil: "networkidle" });

    const listBtn = page.getByRole("button", { name: "List" });
    const gridBtn = page.getByRole("button", { name: "Grid" });

    // Initial view: list mode
    await expect(listBtn).toHaveAttribute("aria-pressed", "true");
    await expect(gridBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("table")).toBeVisible();

    // Toggle to grid mode
    await gridBtn.click();
    await expect(gridBtn).toHaveAttribute("aria-pressed", "true");
    await expect(listBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('section[aria-label="Seller applications grid"]')).toBeVisible();

    // Toggle back to list mode
    await listBtn.click();
    await expect(listBtn).toHaveAttribute("aria-pressed", "true");
    await expect(gridBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("table")).toBeVisible();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("search and status filters update the seller queue request", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerListRoutes(page);
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers`, { waitUntil: "networkidle" });

    const searchInput = page.getByPlaceholder("Search seller records");
    await expect(searchInput).toBeVisible();

    const searchRequestPromise = page.waitForRequest((req) =>
      req.url().includes("/admin/vendor-applications") && req.url().includes("search=Store+1")
    );
    await searchInput.fill("Store 1");
    await searchRequestPromise;

    await expect(page.getByRole("link", { name: "Store 1 Market" }).first()).toBeVisible();

    const statusRequestPromise = page.waitForRequest((req) =>
      req.url().includes("/admin/vendor-applications") && req.url().includes("status=APPROVED")
    );
    await page.getByRole("group", { name: "Filter seller queue by status" }).getByRole("button").filter({ hasText: /^Approved/ }).click();
    await statusRequestPromise;

    await expect(page.getByText("No seller applications match this view")).toBeVisible();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("scroll position is preserved within tolerance on return navigation", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 800 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerListRoutes(page);
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers`, { waitUntil: "networkidle" });
    await expect(page.locator("table")).toBeVisible();

    // Scroll down inside the admin scroll container
    await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="admin-main-scroll"]');
      if (el) el.scrollTop = 500;
      else window.scrollTo(0, 500);
    });

    await page.waitForTimeout(200);

    // Click Review on the 10th application
    const reviewLinks = page.getByRole("link", { name: "Review" });
    await expect(reviewLinks.nth(9)).toBeVisible();

    const savedPosition = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="admin-main-scroll"]');
      return el ? el.scrollTop : window.scrollY;
    });
    expect(savedPosition).toBeGreaterThan(0);

    await reviewLinks.nth(9).click();

    // Navigated to detail page
    await page.waitForURL(/\/admin\/sellers\/[a-f0-9-]+/);
    await expect(page.getByRole("heading", { name: "Ada Market" })).toBeVisible();

    // Return to seller queue via browser back
    await page.goBack();
    await page.waitForURL(/\/admin\/sellers(\?.*)?$/);
    await expect(page.locator("table")).toBeVisible();

    // Scroll position should be restored within +/-60px tolerance
    await expect.poll(async () => {
      const restoredPosition = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="admin-main-scroll"]');
        return el ? el.scrollTop : window.scrollY;
      });
      return Math.abs(restoredPosition - savedPosition);
    }, { timeout: 10_000 }).toBeLessThanOrEqual(60);

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("seller queue remains horizontally contained across approved viewports", async ({ browser }, testInfo) => {
    test.setTimeout(90_000);
    for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
      const context = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 900 } });
      const networkViolations = await installNetworkContainment(context);
      const page = await context.newPage();
      await installSellerListRoutes(page);
      await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

      await page.goto(`${BROWSER_ORIGIN}/admin/sellers`, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      await page.screenshot({ path: testInfo.outputPath(`seller-queue-${width}.png`) });

      // Open seller action dialog across viewports
      const manageBtn = page.getByRole("button", { name: /^Manage /i }).filter({ visible: true }).first();
      await expect(manageBtn).toBeVisible();
      await manageBtn.click();

      const approveItem = page.getByRole("button", { name: "Approve", exact: true });
      await expect(approveItem).toBeVisible();
      await approveItem.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      const box = await dialog.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(900);
      expect(box!.height).toBeGreaterThan(0);
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();

      // Forward wrapping from final focusable control and reverse wrapping from first
      const focusables = dialog.locator('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])').filter({ visible: true });
      const firstControl = focusables.first();
      const lastControl = focusables.last();

      await lastControl.focus();
      await page.keyboard.press("Tab");
      expect(await firstControl.evaluate((el) => el === document.activeElement)).toBe(true);

      await firstControl.focus();
      await page.keyboard.press("Shift+Tab");
      expect(await lastControl.evaluate((el) => el === document.activeElement)).toBe(true);

      await page.screenshot({ path: testInfo.outputPath(`seller-queue-dialog-${width}.png`) });

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(manageBtn).toBeFocused();

      // Repeated open/close and Cancel button dismissal with focus return
      await manageBtn.click();
      await approveItem.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      await expect(manageBtn).toBeFocused();

      expect(networkViolations).toEqual([]);
      await context.close();
    }
  });

  test("seller queue action dialog falls back to queue search when initiating trigger is hidden or removed", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerListRoutes(page);
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers`, { waitUntil: "networkidle" });

    const manageBtn = page.getByRole("button", { name: /^Manage /i }).filter({ visible: true }).first();
    await expect(manageBtn).toBeVisible();

    // 1. Hidden trigger fallback
    await manageBtn.click();
    const approveItem = page.getByRole("button", { name: "Approve", exact: true });
    await expect(approveItem).toBeVisible();
    await approveItem.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('button[id^="seller-manage-trigger-"]').forEach((btn) => {
        btn.style.display = "none";
      });
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const searchInput = page.locator("#seller-queue-search");
    await expect(searchInput).toBeFocused();

    // Restore trigger visibility
    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('button[id^="seller-manage-trigger-"]').forEach((btn) => {
        btn.style.display = "";
      });
    });
    await expect(manageBtn).toBeVisible();

    // 2. Removed trigger fallback
    await manageBtn.click();
    await approveItem.click();
    await expect(dialog).toBeVisible();

    await page.evaluate(() => {
      document.querySelectorAll<HTMLElement>('button[id^="seller-manage-trigger-"]').forEach((btn) => {
        btn.remove();
      });
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(searchInput).toBeFocused();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("seller queue action dialog blocks dismissal during pending mutation and recovers on release", async ({ browser }) => {
    let releaseMutation: (() => void) | null = null;
    const holdMutation = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    const recordedMutations: Array<{ actionType: string; body: unknown; pathname: string }> = [];

    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerListRoutes(page, makeMockApplications(20), {
      holdMutation,
      onMutation: (actionType, body, pathname) => recordedMutations.push({ actionType, body, pathname }),
    });
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers`, { waitUntil: "networkidle" });

    const manageBtn = page.getByRole("button", { name: /^Manage /i }).filter({ visible: true }).first();
    await manageBtn.click();
    const approveItem = page.getByRole("button", { name: "Approve", exact: true });
    await approveItem.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const confirmBtn = dialog.getByRole("button", { name: "Approve as approved" });
    const cancelBtn = dialog.getByRole("button", { name: "Cancel" });

    // Submit mutation
    await confirmBtn.click();
    await expect.poll(() => recordedMutations.length).toBe(1);

    // 1. Assert exactly one request sent
    expect(recordedMutations).toHaveLength(1);
    expect(recordedMutations[0].actionType).toBe("approve");

    // 2. Submitting state: confirm and cancel buttons are disabled
    await expect(confirmBtn).toBeDisabled();
    await expect(cancelBtn).toBeDisabled();

    // 3. Blocked Escape
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    // 4. Blocked backdrop dismissal
    await page.mouse.click(10, 10);
    await expect(dialog).toBeVisible();

    // 5. No duplicate confirmation
    await confirmBtn.dispatchEvent("click");
    expect(recordedMutations).toHaveLength(1);

    // Release synthetic mutation
    releaseMutation!();

    // 6. Safe closure after release and focus restored
    await expect(dialog).toBeHidden();
    await expect(manageBtn).toBeFocused();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("seller queue action dialog restores focus to fallback on responsive switch", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerListRoutes(page);
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers`, { waitUntil: "networkidle" });

    // Open dialog from desktop view
    const manageBtn = page.getByRole("button", { name: /^Manage /i }).filter({ visible: true }).first();
    await manageBtn.click();
    const approveItem = page.getByRole("button", { name: "Approve", exact: true });
    await approveItem.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Resize viewport to mobile width (375px) where table is hidden
    await page.setViewportSize({ width: 375, height: 812 });

    // Dismiss dialog via Escape
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Focus must reach the visible workspace fallback: #seller-queue-search
    await expect(page.locator("#seller-queue-search")).toBeFocused();

    expect(networkViolations).toEqual([]);
    await context.close();
  });
});
