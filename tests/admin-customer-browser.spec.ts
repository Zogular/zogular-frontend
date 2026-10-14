/**
 * @file admin-customer-browser.spec.ts
 * @description
 * Browser integration, accessibility, responsive containment, and navigation tests for CM-F1.
 *
 * Requirements:
 * - Real rendered Next.js routes with synthetic local fixtures.
 * - Loopback network containment: serviceWorkers="block", aborts non-loopback requests.
 * - Search with 300ms debounce, status filtering, and sorting.
 * - List and Grid view presentation toggling.
 * - Keyboard-accessible detail links and detail inspection.
 * - Return navigation with scroll restoration.
 * - Restricted actor field masking (names and contacts).
 * - Comprehensive responsive containment tests across all 8 approved viewports:
 *   320, 375, 390, 430, 768, 1024, 1280, 1440.
 * - Saves screenshots to artifact directory for visual inspection.
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import path from "node:path";
import { resetApiClientSecurityStateForTests } from "../src/services/api";

const originalFetch = globalThis.fetch;
const repoRoot = path.resolve(__dirname, "..");
const BROWSER_PORT = 3230;
const BACKEND_PORT = 5030;
const BROWSER_ORIGIN = `http://127.0.0.1:${BROWSER_PORT}`;
const ARTIFACT_DIR =
  process.env.ARTIFACT_DIR ||
  path.join(repoRoot, "test-results", "artifacts");
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

// Synthetic Fixture Customers
function makeFixtureCustomers() {
  const base = [
    {
      id: "usr-cust-1",
      role: "CUSTOMER",
      isActive: true,
      emailVerified: true,
      phoneVerified: false,
      emailVerifiedAt: "2026-01-10T12:00:00.000Z",
      phoneVerifiedAt: null,
      createdAt: "2026-01-10T08:30:00.000Z",
      updatedAt: "2026-01-10T12:00:00.000Z",
      firstName: "Mwamba",
      lastName: "Mutale",
      email: "mwamba@example.zm",
      telephone: "+260971234567",
    },
    {
      id: "usr-cust-2",
      role: "CUSTOMER",
      isActive: false,
      emailVerified: false,
      phoneVerified: true,
      emailVerifiedAt: null,
      phoneVerifiedAt: "2026-01-12T14:20:00.000Z",
      createdAt: "2026-01-12T09:15:00.000Z",
      updatedAt: "2026-01-12T14:20:00.000Z",
      firstName: "Chileshe",
      lastName: "Banda",
      email: "chileshe@example.zm",
      telephone: "+260969876543",
    },
    {
      id: "usr-cust-3",
      role: "CUSTOMER",
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      emailVerifiedAt: "2026-01-14T10:00:00.000Z",
      phoneVerifiedAt: "2026-01-14T10:05:00.000Z",
      createdAt: "2026-01-14T10:00:00.000Z",
      updatedAt: "2026-01-14T10:05:00.000Z",
      firstName: "Thandiwe",
      lastName: "Phiri",
      email: "thandiwe@example.zm",
      telephone: null, // Null phone
    },
    {
      id: "usr-cust-extreme-overflow-name-token-12345",
      role: "CUSTOMER",
      isActive: true,
      emailVerified: true,
      phoneVerified: true,
      emailVerifiedAt: "2026-01-16T12:00:00.000Z",
      phoneVerifiedAt: "2026-01-16T12:00:00.000Z",
      createdAt: "2026-01-16T12:00:00.000Z",
      updatedAt: "2026-01-16T12:00:00.000Z",
      firstName: "Chileshe Chimwemwe Mwape-Banda Mwamba",
      lastName: "Longname The Third Of Zambia",
      email: "very.long.unbroken.customer.email.address.test@example.co.zm",
      telephone: "+260971234567890",
    },
  ];

  for (let i = 5; i <= 30; i++) {
    base.push({
      id: `usr-cust-${i}`,
      role: "CUSTOMER",
      isActive: i % 2 === 1,
      emailVerified: true,
      phoneVerified: i % 3 !== 0,
      emailVerifiedAt: "2026-01-10T12:00:00.000Z",
      phoneVerifiedAt: i % 3 !== 0 ? "2026-01-10T12:00:00.000Z" : null,
      createdAt: new Date(Date.UTC(2026, 0, 1 + (i % 25), 10, 0, 0)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 0, 1 + (i % 25), 12, 0, 0)).toISOString(),
      firstName: `Customer${i}Mwamba`,
      lastName: `Zambia${i}`,
      email: `customer${i}@example.zm`,
      telephone: `+2609710000${String(i).padStart(2, "0")}`,
    });
  }

  return base;
}

// Global server references
let backendFixture: Server | null = null;
let nextServer: ChildProcess | null = null;
let currentActorRole: "SUPER_ADMIN" | "OPERATIONS" = "SUPER_ADMIN";
let currentPermissions: string[] = [
  "access_admin_panel",
  "view_all_users",
  "view_user_sensitive_fields",
];
let listDelayMs = 0;
let listFailuresCount = 0;
let detailFailuresCount = 0;
let listForceStatus: number | null = null;
let detailForceStatus: number | null = null;
let listRequestCount = 0;

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await originalFetch(url);
      if (response.status < 500) return;
    } catch {
      // Retrying until server is ready
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

test.beforeEach(() => {
  listDelayMs = 0;
  listFailuresCount = 0;
  detailFailuresCount = 0;
  listForceStatus = null;
  detailForceStatus = null;
  listRequestCount = 0;
  currentActorRole = "SUPER_ADMIN";
  currentPermissions = [
    "access_admin_panel",
    "view_all_users",
    "view_user_sensitive_fields",
  ];
});

test.beforeAll(async () => {
  // 1. Start loopback fixture backend
  backendFixture = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${BACKEND_PORT}`);
    res.setHeader("content-type", "application/json");

    // Auth identity endpoint
    if (url.pathname === "/api/v1/user/me") {
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            user: {
              id: "admin-fixture",
              name: "Fixture Admin",
              email: "admin@example.test",
              role: currentActorRole,
              permissions: currentPermissions,
            },
          },
        }),
      );
      return;
    }

    // Customer list endpoint
    if (url.pathname === "/api/v1/admin/users") {
      listRequestCount++;
      if (listDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, listDelayMs));
      }
      if (listForceStatus) {
        const s = listForceStatus;
        listForceStatus = null;
        res.statusCode = s;
        res.end(JSON.stringify({ status: "fail", message: `Forced status ${s}` }));
        return;
      }
      if (listFailuresCount > 0) {
        listFailuresCount--;
        res.statusCode = 500;
        res.end(JSON.stringify({ status: "error", message: "Server connection failed" }));
        return;
      }

      const allCustomers = makeFixtureCustomers();
      const searchParam = url.searchParams.get("search")?.toLowerCase();
      const isActiveParam = url.searchParams.get("isActive");
      const canViewSensitive = currentPermissions.includes("view_user_sensitive_fields");

      const filtered = allCustomers.filter((c) => {
        // Status filter
        if (isActiveParam === "true" && !c.isActive) return false;
        if (isActiveParam === "false" && c.isActive) return false;

        // Search filter
        if (searchParam) {
          const matchId = c.id.toLowerCase().includes(searchParam);
          if (canViewSensitive) {
            const matchName =
              c.firstName.toLowerCase().includes(searchParam) ||
              c.lastName.toLowerCase().includes(searchParam);
            const matchEmail = c.email.toLowerCase().includes(searchParam);
            return matchId || matchName || matchEmail;
          }
          return matchId;
        }
        return true;
      });

      // Sorting
      const sortBy = url.searchParams.get("sortBy") ?? "createdAt";
      const sortOrder = url.searchParams.get("sortOrder") ?? "desc";
      filtered.sort((a, b) => {
        if (sortBy === "createdAt") {
          const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          return sortOrder === "asc" ? diff : -diff;
        }
        return 0;
      });

      // Mask sensitive fields if actor lacks permission
      const usersToReturn = filtered.map((c) => {
        if (!canViewSensitive) {
          const rest: Record<string, unknown> = { ...c };
          delete rest.firstName;
          delete rest.lastName;
          delete rest.email;
          delete rest.telephone;
          return rest;
        }
        return c;
      });

      const page = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 20);
      const total = usersToReturn.length;
      const pages = total === 0 ? 0 : Math.ceil(total / limit);

      res.end(
        JSON.stringify({
          status: "success",
          results: total,
          pagination: {
            total,
            page,
            limit,
            pages,
          },
          data: {
            users: usersToReturn,
          },
        }),
      );
      return;
    }

    // Customer detail endpoint
    if (url.pathname.startsWith("/api/v1/admin/users/")) {
      if (detailForceStatus) {
        const s = detailForceStatus;
        detailForceStatus = null;
        res.statusCode = s;
        res.end(JSON.stringify({ status: "fail", message: `Forced status ${s}` }));
        return;
      }
      if (detailFailuresCount > 0) {
        detailFailuresCount--;
        res.statusCode = 500;
        res.end(JSON.stringify({ status: "error", message: "Server connection failed" }));
        return;
      }

      const id = decodeURIComponent(url.pathname.replace("/api/v1/admin/users/", ""));
      const customer = makeFixtureCustomers().find((c) => c.id === id);

      if (!customer) {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: "fail", message: "User not found" }));
        return;
      }

      const canViewSensitive = currentPermissions.includes("view_user_sensitive_fields");
      let userRecord: Record<string, unknown> = { ...customer };
      if (!canViewSensitive) {
        const rest: Record<string, unknown> = { ...customer };
        delete rest.firstName;
        delete rest.lastName;
        delete rest.email;
        delete rest.telephone;
        userRecord = rest;
      }

      res.end(
        JSON.stringify({
          status: "success",
          data: {
            user: userRecord,
          },
        }),
      );
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ status: "fail", message: "Fixture route missing" }));
  });

  await new Promise<void>((resolve, reject) => {
    backendFixture!.once("error", reject);
    backendFixture!.listen(BACKEND_PORT, "127.0.0.1", resolve);
  });

  // 2. Start Next server targeting loopback
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
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${BACKEND_PORT}/api/v1`,
        NEXT_PUBLIC_API_PROXY_URL: "/api/backend",
      },
      stdio: "ignore",
    },
  );

  await waitForServer(`${BROWSER_ORIGIN}/admin/login`);
});

test.afterAll(async () => {
  if (nextServer && !nextServer.killed) nextServer.kill();
  await new Promise<void>((resolve) => backendFixture?.close(() => resolve()) ?? resolve());
  resetApiClientSecurityStateForTests();
  globalThis.fetch = originalFetch;
});

test.beforeEach(() => {
  currentActorRole = "SUPER_ADMIN";
  currentPermissions = [
    "access_admin_panel",
    "view_all_users",
    "view_user_sensitive_fields",
  ];
});

async function installNetworkContainment(context: BrowserContext): Promise<string[]> {
  const violations: string[] = [];

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["data:", "blob:", "about:", "chrome-extension:"].includes(url.protocol)) {
      return route.continue();
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

async function setupPage(context: BrowserContext): Promise<{ page: Page; violations: string[] }> {
  const violations = await installNetworkContainment(context);
  const page = await context.newPage();

  await context.addCookies([
    {
      name: "zogular_admin_session",
      value: "fixture-admin-token",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);

  return { page, violations };
}

test.describe("CM-F1 Customer Browser Integration & Workflows", () => {
  test.use({ serviceWorkers: "block" });

  test("renders customer workspace with desktop table and permitted customer rows", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("admin-buyers-workspace")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();

    // Table rows
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();
    await expect(table.getByText("Chileshe Banda")).toBeVisible();
    await expect(table.getByText("Thandiwe Phiri")).toBeVisible();

    // Verification and Status badges
    await expect(page.getByText("Active").first()).toBeVisible();

    expect(violations).toHaveLength(0);
  });

  test("search input filters customers with 300ms debounce", async ({ context }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });
    const searchInput = page.getByPlaceholder("Search by name, email, or customer ID...");
    await expect(searchInput).toBeVisible();

    // Type "Thandiwe"
    await searchInput.fill("Thandiwe");

    // Wait for 300ms debounce
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/search=Thandiwe/);

    // Results filtered
    const table = page.locator("table");
    await expect(table.getByText("Thandiwe Phiri")).toBeVisible();
    await expect(table.getByText("Mwamba Mutale")).toHaveCount(0);

    expect(violations).toHaveLength(0);
  });

  test("status filter toggles between Active, Inactive, and All", async ({ context }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });
    const table = page.locator("table");

    // Click Inactive filter
    await page.getByRole("button", { name: "Inactive" }).click();
    await expect(page).toHaveURL(/isActive=inactive/);
    await expect(table.getByText("Chileshe Banda")).toBeVisible(); // Inactive customer
    await expect(table.getByText("Mwamba Mutale")).toHaveCount(0); // Active customer hidden

    // Click Active filter
    await page.getByRole("button", { name: "Active", exact: true }).click();
    await expect(page).toHaveURL(/isActive=active/);
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();
    await expect(table.getByText("Chileshe Banda")).toHaveCount(0);

    // Click All Status
    await page.getByRole("button", { name: "All Status" }).click();
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();
    await expect(table.getByText("Chileshe Banda")).toBeVisible();

    expect(violations).toHaveLength(0);
  });

  test("toggles between List view and Grid view", async ({ context }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });
    await expect(page.locator("table")).toBeVisible();

    // Toggle to Grid view
    const gridToggle = page.getByRole("button", { name: "Grid view" });
    await gridToggle.click();
    await expect(page).toHaveURL(/view=grid/);

    // Table is hidden, card grid is visible
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.getByText("View Customer").first()).toBeVisible();

    // Toggle back to List view
    const listToggle = page.getByRole("button", { name: "List view" });
    await listToggle.click();
    await expect(page.locator("table")).toBeVisible();

    expect(violations).toHaveLength(0);
  });

  test("scroll restoration on return navigation preserves measured scroll on inner admin scroll container", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    // Start from non-default query parameters
    const targetQueryUrl = `${BROWSER_ORIGIN}/admin/buyers?search=m&isActive=active&page=1&view=list`;
    await page.goto(targetQueryUrl, {
      waitUntil: "networkidle",
    });
    const table = page.locator("table");
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();

    // Verify inner admin scroll container has genuine overflow
    const hasOverflow = await page.evaluate(() => {
      const adminScroll = document.querySelector<HTMLElement>(
        '[data-testid="admin-main-scroll"], [data-scroll-container="admin"]',
      );
      return adminScroll ? adminScroll.scrollHeight > adminScroll.clientHeight : false;
    });
    expect(hasOverflow).toBe(true);

    // Scroll inner admin container to a nonzero position
    await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="admin-main-scroll"]');
      if (el) el.scrollTop = 400;
      else window.scrollTo(0, 400);
    });
    await page.waitForTimeout(200);

    const inspectLinks = page.locator("table tbody tr").getByRole("link", { name: /Inspect/i });
    const targetLink = inspectLinks.nth(7);
    const linkHref = await targetLink.getAttribute("href");
    expect(linkHref).toContain("returnTo=");

    const savedPosition = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="admin-main-scroll"]');
      return el ? Math.round(el.scrollTop) : Math.round(window.scrollY);
    });
    expect(savedPosition).toBeGreaterThan(0);

    await targetLink.click();

    // Detail page loads
    await expect(page).toHaveURL(/\/admin\/buyers\/usr-cust-/);
    await expect(page.getByText("Read-Only Workspace Notice")).toBeVisible();

    // 1. Return back via Back button
    const backBtn = page.getByRole("button", { name: "Back" });
    await backBtn.click();

    // Expect return to exact non-default query URL
    await expect(page).toHaveURL(targetQueryUrl);
    await expect(table).toBeVisible();

    // Verify scroll position restored within tolerance using polling for animation frames
    await expect.poll(async () => {
      const restoredPosition = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="admin-main-scroll"]');
        return el ? Math.round(el.scrollTop) : Math.round(window.scrollY);
      });
      return Math.abs(restoredPosition - savedPosition);
    }, { timeout: 10_000 }).toBeLessThanOrEqual(60);

    // 2. Return back via Breadcrumb "Customers" link
    await targetLink.click();
    await expect(page).toHaveURL(/\/admin\/buyers\/usr-cust-/);
    await page.getByTestId("admin-main-scroll").getByRole("link", { name: "Customers", exact: true }).click();
    await expect(page).toHaveURL(targetQueryUrl);
    await expect(table).toBeVisible();

    await expect.poll(async () => {
      const restoredPosition = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="admin-main-scroll"]');
        return el ? Math.round(el.scrollTop) : Math.round(window.scrollY);
      });
      return Math.abs(restoredPosition - savedPosition);
    }, { timeout: 10_000 }).toBeLessThanOrEqual(60);

    // 3. Return back via Browser Back navigation
    await targetLink.click();
    await expect(page).toHaveURL(/\/admin\/buyers\/usr-cust-/);
    await page.goBack();
    await expect(page).toHaveURL(targetQueryUrl);
    await expect(table).toBeVisible();

    await expect.poll(async () => {
      const restoredPosition = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="admin-main-scroll"]');
        return el ? Math.round(el.scrollTop) : Math.round(window.scrollY);
      });
      return Math.abs(restoredPosition - savedPosition);
    }, { timeout: 10_000 }).toBeLessThanOrEqual(60);

    // 4. Unsafe returnTo target is safely sanitized to /admin/buyers
    await page.goto(`${BROWSER_ORIGIN}/admin/buyers/usr-cust-1?returnTo=https%3A%2F%2Fattacker.com%2Fevil`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(`${BROWSER_ORIGIN}/admin/buyers`);

    expect(violations).toHaveLength(0);
  });

  test("switching filters with a delayed response shows loading state without reusing prior active rows", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    // Initial load: active customer Mwamba Mutale is visible
    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });
    const table = page.locator("table");
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();

    // Inject delay for subsequent list queries
    listDelayMs = 600;

    // Switch to Inactive filter
    await page.getByRole("button", { name: "Inactive" }).click();

    // Active customer must immediately be absent (no stale data reuse across queries!)
    await expect(table.getByText("Mwamba Mutale")).toHaveCount(0);

    // After delay elapses, inactive customer Chileshe Banda is displayed
    await expect(table.getByText("Chileshe Banda")).toBeVisible({ timeout: 4000 });

    listDelayMs = 0;
    expect(violations).toHaveLength(0);
  });

  test("detail view immediately unmounts previous customer when navigating between different customer IDs", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers/usr-cust-1`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Mwamba Mutale" })).toBeVisible();

    // Navigate to customer 2
    await page.goto(`${BROWSER_ORIGIN}/admin/buyers/usr-cust-2`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Mwamba Mutale" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Chileshe Banda" })).toBeVisible();

    expect(violations).toHaveLength(0);
  });

  test("same-query background refresh failure retains visible rows and displays retry banner", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });
    const table = page.locator("table");
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();

    // Inject single failure for background refresh
    listFailuresCount = 1;

    // Trigger background refresh
    await page.getByRole("button", { name: "Refresh" }).click();

    // Customer rows MUST be retained (not replaced with a full-page error!)
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();

    // Compact stale warning banner MUST appear
    const staleBanner = page.getByTestId("admin-buyers-stale-banner");
    await expect(staleBanner).toBeVisible();
    await expect(staleBanner).toContainText("Background refresh failed");

    // Click retry inside banner (next request succeeds)
    await staleBanner.getByRole("button", { name: "Retry" }).click();

    // Stale banner disappears upon successful retry, rows remain visible
    await expect(staleBanner).toHaveCount(0);
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();

    expect(violations).toHaveLength(0);
  });

  test("same-record detail background refresh failure retains visible details and displays retry banner", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers/usr-cust-1`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Mwamba Mutale" })).toBeVisible();

    // Inject failure for detail refresh
    detailFailuresCount = 1;

    // Trigger background refresh
    await page.getByRole("button", { name: /Refresh Record/i }).click();

    // Record MUST be retained
    await expect(page.getByRole("heading", { name: "Mwamba Mutale" })).toBeVisible();
    await expect(page.getByText("Active Account")).toBeVisible();

    // Compact retry banner visible
    const staleBanner = page.getByTestId("admin-buyer-detail-stale-banner");
    await expect(staleBanner).toBeVisible();
    await expect(staleBanner).toContainText("Background refresh failed");

    // Click retry inside banner
    await staleBanner.getByRole("button", { name: "Retry" }).click();

    // Stale banner clears
    await expect(staleBanner).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Mwamba Mutale" })).toBeVisible();

    expect(violations).toHaveLength(0);
  });

  test("loss of view_all_users or 403 terminal state halts retry loops", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    listForceStatus = 403;
    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });

    // Terminal error message visible
    await expect(page.getByText(/permission to view customer accounts/i)).toBeVisible();

    const countBefore = listRequestCount;
    // Wait to ensure TanStack query retry is false and no infinite loop occurs
    await page.waitForTimeout(1000);
    expect(listRequestCount - countBefore).toBeLessThanOrEqual(1);

    expect(violations).toHaveLength(0);
  });

  test("purges customer data and query cache when operator authority is revoked or signed out", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    // Initial permitted state
    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("table").getByText("Mwamba Mutale")).toBeVisible();

    // Revoke view_all_users permission
    currentPermissions = ["access_admin_panel"];

    // Reload page to re-verify authority
    await page.reload({ waitUntil: "networkidle" });

    // Expect forbidden notice and zero customer records in DOM
    await expect(
      page.getByText(/This admin account cannot access this area|You do not have permission to view customer accounts/i),
    ).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.getByText("Mwamba Mutale")).toHaveCount(0);

    expect(violations).toHaveLength(0);
  });

  test("displays masked identity and contact when operator lacks sensitive field permission", async ({
    context,
  }) => {
    // Set restricted actor
    currentActorRole = "OPERATIONS";
    currentPermissions = ["access_admin_panel", "view_all_users"];

    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });

    // Honest search placeholder for ID-only search
    await expect(page.getByPlaceholder("Search by customer ID...")).toBeVisible();

    // Masked rows
    await expect(page.getByText("(Name Restricted)").first()).toBeVisible();
    await expect(page.getByText("(Email Restricted)").first()).toBeVisible();

    // Navigate to detail
    await page.getByRole("link", { name: /Inspect/i }).first().click();
    await expect(page).toHaveURL(/\/admin\/buyers\/usr-cust-/);

    // Detail shows restricted notices
    await expect(page.getByText("Sensitive Identity Restricted")).toBeVisible();
    await expect(page.getByText("Sensitive Contact Restricted")).toBeVisible();

    expect(violations).toHaveLength(0);
  });

  test("renders 404 state gracefully when navigating to non-existent customer", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers/non-existent-user-id`, {
      waitUntil: "networkidle",
    });

    await expect(page.getByText("Customer Account Not Found")).toBeVisible();
    const returnBtn = page.getByRole("link", { name: "Return to Customers" });
    await expect(returnBtn).toBeVisible();

    await returnBtn.click();
    await expect(page).toHaveURL(`${BROWSER_ORIGIN}/admin/buyers`);

    expect(violations).toHaveLength(0);
  });

  test("renders filtered zero state with reset button when search has no matches", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);

    await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });

    const searchInput = page.getByPlaceholder("Search by name, email, or customer ID...");
    await searchInput.fill("NoMatchCustomerQueryXYZ");
    await page.waitForTimeout(400);

    await expect(page.getByText("No customers match your filters")).toBeVisible();
    const resetBtn = page.getByRole("button", { name: "Reset Filters" }).first();
    await expect(resetBtn).toBeVisible();

    await resetBtn.click();
    const table = page.locator("table");
    await expect(table.getByText("Mwamba Mutale")).toBeVisible();

    expect(violations).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Mandatory Responsive Containment Across All 8 Viewports
  // --------------------------------------------------------------------------
  const VIEWPORTS = [320, 375, 390, 430, 768, 1024, 1280, 1440];

  for (const width of VIEWPORTS) {
    test(`responsive containment and bounding-box validation at ${width}px viewport width`, async ({
      context,
    }) => {
      const { page, violations } = await setupPage(context);
      await page.setViewportSize({ width, height: 800 });

      // 1. List view containment
      await page.goto(`${BROWSER_ORIGIN}/admin/buyers`, { waitUntil: "networkidle" });
      const listContained = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(listContained).toBe(true);

      // Capture screenshot for list view
      const listScreenshotPath = path.join(ARTIFACT_DIR, `customer-list-${width}.png`);
      await page.screenshot({
        path: listScreenshotPath,
        fullPage: false,
      });

      // 2. Grid view containment
      await page.goto(`${BROWSER_ORIGIN}/admin/buyers?view=grid`, {
        waitUntil: "networkidle",
      });
      const gridContained = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(gridContained).toBe(true);

      const gridScreenshotPath = path.join(ARTIFACT_DIR, `customer-grid-${width}.png`);
      await page.screenshot({
        path: gridScreenshotPath,
        fullPage: false,
      });

      // 3. Detail view containment and exact bounding-box validation
      await page.goto(`${BROWSER_ORIGIN}/admin/buyers/usr-cust-extreme-overflow-name-token-12345`, {
        waitUntil: "networkidle",
      });
      const detailContained = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(detailContained).toBe(true);

      // Verify Back button fits within viewport
      const backBtn = page.getByRole("button", { name: "Back" });
      await expect(backBtn).toBeVisible();
      const bboxBack = await backBtn.boundingBox();
      expect(bboxBack).not.toBeNull();
      expect(bboxBack!.x).toBeGreaterThanOrEqual(0);
      expect(bboxBack!.x + bboxBack!.width).toBeLessThanOrEqual(width);

      // Verify Refresh Record button fits within viewport
      const refreshBtn = page.getByRole("button", { name: /Refresh Record/i });
      await expect(refreshBtn).toBeVisible();
      const bboxRefresh = await refreshBtn.boundingBox();
      expect(bboxRefresh).not.toBeNull();
      expect(bboxRefresh!.x).toBeGreaterThanOrEqual(0);
      expect(bboxRefresh!.x + bboxRefresh!.width).toBeLessThanOrEqual(width);

      // Verify Status Badge fits within viewport
      const statusBadge = page.getByText("Active Account").first();
      await expect(statusBadge).toBeVisible();
      const bboxBadge = await statusBadge.boundingBox();
      expect(bboxBadge).not.toBeNull();
      expect(bboxBadge!.x).toBeGreaterThanOrEqual(0);
      expect(bboxBadge!.x + bboxBadge!.width).toBeLessThanOrEqual(width);

      const detailScreenshotPath = path.join(ARTIFACT_DIR, `customer-detail-${width}.png`);
      await page.screenshot({
        path: detailScreenshotPath,
        fullPage: false,
      });

      expect(violations).toHaveLength(0);
    });
  }
});

