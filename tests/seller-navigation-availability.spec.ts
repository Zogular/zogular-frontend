/**
 * @file seller-navigation-availability.spec.ts
 * @description
 * Isolated loopback Playwright verification for ZG-SELLER-R2 Navigation & Notification Availability:
 * - Explicit 127.0.0.1 Next child binding on independent ports (3282 / 5082) with fail-closed port pre-checks & awaited shutdown
 * - serviceWorkers="block" + explicit HTTP & WebSocket loopback allowlists + inert Vercel analytics stubs
 * - Covers PROVISIONAL and APPROVED seller statuses at 320x568, 390x844, and 1440x900
 * - Verifies "Visit marketplace" storefront links, zero nested interactive controls, honest notifications without fake unread dot,
 *   capability-appropriate links on /seller/notifications, and status-gated nav availability
 */

import { expect, test, type BrowserContext, type TestInfo } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { resetApiClientSecurityStateForTests } from "../src/services/api";

test.use({ channel: process.env.SELLER_NAV_BROWSER_CHANNEL });

const originalFetch = globalThis.fetch;
const repoRoot = path.resolve(__dirname, "..");
const BROWSER_HOST = "127.0.0.1";
const BROWSER_PORT = 3282;
const BACKEND_PORT = 5082;
const BROWSER_ORIGIN = `http://${BROWSER_HOST}:${BROWSER_PORT}`;
const BACKEND_ORIGIN = `http://${BROWSER_HOST}:${BACKEND_PORT}`;
const ALLOWED_HTTP_ORIGINS = new Set([BROWSER_ORIGIN, BACKEND_ORIGIN]);
const ALLOWED_WS_ORIGINS = new Set([
  `ws://${BROWSER_HOST}:${BROWSER_PORT}`,
  `ws://${BROWSER_HOST}:${BACKEND_PORT}`,
]);
const ALLOWED_NON_HTTP_PROTOCOLS = new Set(["data:", "blob:", "about:"]);
const MAX_STDIO_CHARS = 4096;

const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

const SELLER_STATUSES = ["PROVISIONAL", "APPROVED"] as const;

let backendFixture: Server | null = null;
let nextServer: ChildProcess | null = null;
let nextExitPromise: Promise<void> | null = null;
let activeSellerStatus: "PROVISIONAL" | "APPROVED" = "APPROVED";

function appendBounded(current: string, chunk: Buffer | string): string {
  const combined = current + (typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  return combined.length > MAX_STDIO_CHARS ? combined.slice(-MAX_STDIO_CHARS) : combined;
}

async function assertPortFree(host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", (err: NodeJS.ErrnoException) => {
      reject(new Error(`Required loopback port ${host}:${port} is already in use (${err.code ?? err.message}); failing closed without killing existing processes.`));
    });
    probe.listen(port, host, () => {
      probe.close((closeErr) => {
        if (closeErr) reject(closeErr);
        else resolve();
      });
    });
  });
}

async function waitForNextServer(
  url: string,
  child: ChildProcess,
  getLogs: () => { stdout: string; stderr: string; spawnError: Error | null; exitInfo: string | null },
) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const logs = getLogs();
    if (logs.spawnError) {
      throw new Error(`Next server failed to spawn: ${logs.spawnError.message}\nstderr: ${logs.stderr}\nstdout: ${logs.stdout}`);
    }
    if (logs.exitInfo !== null) {
      throw new Error(`Next server exited early before becoming ready (${logs.exitInfo}).\nstderr: ${logs.stderr}\nstdout: ${logs.stdout}`);
    }
    try {
      const response = await originalFetch(url);
      if (response.status < 500) {
        if (!child.pid || child.exitCode !== null) {
          throw new Error(`Next server did not remain running (pid=${String(child.pid)}, exitCode=${String(child.exitCode)}).`);
        }
        return;
      }
    } catch {
      // Retrying until loopback Next server responds
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const logs = getLogs();
  throw new Error(`Timed out waiting for ${url}.\nstderr: ${logs.stderr}\nstdout: ${logs.stdout}`);
}

async function stopChildProcess(child: ChildProcess | null, exitPromise: Promise<void> | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  child.kill("SIGTERM");
  const forceKillTimer = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
    }
  }, 3000);

  try {
    await (exitPromise ?? new Promise<void>((resolve) => child.once("close", () => resolve())));
  } finally {
    clearTimeout(forceKillTimer);
  }
}

async function installNetworkContainment(context: BrowserContext): Promise<{
  httpViolations: string[];
  wsViolations: string[];
}> {
  const httpViolations: string[] = [];
  const wsViolations: string[] = [];

  await context.routeWebSocket("**/*", (ws) => {
    const url = new URL(ws.url());
    if (ALLOWED_WS_ORIGINS.has(url.origin)) {
      ws.connectToServer();
      return;
    }
    wsViolations.push(url.toString());
    void ws.close({ code: 1008, reason: "Blocked external WebSocket origin in isolated test" });
  });

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());

    if (ALLOWED_NON_HTTP_PROTOCOLS.has(url.protocol)) {
      return route.continue();
    }

    if (url.origin === BROWSER_ORIGIN && (
      url.pathname.startsWith("/_vercel/insights") ||
      url.pathname.startsWith("/_vercel/speed-insights")
    )) {
      return route.fulfill({
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: "/* analytics disabled in isolated fixture */",
      });
    }

    if (ALLOWED_HTTP_ORIGINS.has(url.origin)) {
      return route.continue();
    }

    httpViolations.push(`${route.request().method()} ${url.toString()}`);
    return route.abort("blockedbyclient");
  });

  return { httpViolations, wsViolations };
}

async function attachScreenshot(
  page: { screenshot: (options?: { path?: string }) => Promise<Buffer> },
  testInfo: TestInfo,
  name: string,
) {
  const screenshotPath = testInfo.outputPath(name);
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach(name, { path: screenshotPath, contentType: "image/png" });
}

test.beforeAll(async () => {
  await assertPortFree(BROWSER_HOST, BACKEND_PORT);
  await assertPortFree(BROWSER_HOST, BROWSER_PORT);

  backendFixture = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", BACKEND_ORIGIN);
    res.setHeader("content-type", "application/json");

    if (url.pathname === "/api/v1/user/me") {
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            user: {
              id: "seller-nav-1",
              firstName: "Mwape",
              lastName: "Banda",
              email: "seller@example.zm",
              role: "VENDOR",
              emailVerified: true,
            },
          },
        }),
      );
      return;
    }

    if (url.pathname === "/api/v1/vendor/applications/me") {
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            vendorApplication: {
              id: "app-nav-1",
              userId: "seller-nav-1",
              sellerType: "REGISTERED_BUSINESS",
              status: activeSellerStatus,
              ownerFullName: "Mwape Banda",
              storeName: "Lusaka Solar Hub",
              legalBusinessName: "Lusaka Solar Hub Ltd",
              businessAddress: "Cairo Road, Lusaka",
              district: "Lusaka",
              businessPhone: "+260971112233",
              businessEmail: "seller@example.zm",
              productCategories: ["Solar & Energy"],
              createdAt: "2026-10-01T00:00:00.000Z",
              updatedAt: "2026-10-05T00:00:00.000Z",
            },
          },
        }),
      );
      return;
    }

    if (url.pathname === "/api/v1/auth/csrf-token") {
      res.setHeader("set-cookie", "_csrf=test-csrf-cookie; Path=/; HttpOnly; SameSite=Lax");
      res.end(JSON.stringify({ status: "success", data: { csrfToken: "test-csrf-token" } }));
      return;
    }

    if (url.pathname === "/api/v1/vendor/support/tickets" && req.method === "GET") {
      res.end(JSON.stringify({ status: "success", data: { tickets: [] } }));
      return;
    }

    if (url.pathname === "/api/v1/vendor/products" && req.method === "GET") {
      res.end(
        JSON.stringify({
          status: "success",
          results: 0,
          pagination: { page: 1, limit: 20, total: 0, pages: 0 },
          data: {
            products: [],
            summary: { total: 0, buyerVisible: 0, pendingReview: 0, lowStock: 0, outOfStock: 0 },
            facets: { categories: [], statuses: {}, stock: { inStock: 0, lowStock: 0, outOfStock: 0 } },
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
    backendFixture!.listen(BACKEND_PORT, BROWSER_HOST, resolve);
  });

  let stdout = "";
  let stderr = "";
  let spawnError: Error | null = null;
  let exitInfo: string | null = null;

  nextServer = spawn(
    process.execPath,
    [
      fs.existsSync(path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"))
        ? path.join(repoRoot, "node_modules", "next", "dist", "bin", "next")
        : require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      BROWSER_HOST,
      "-p",
      String(BROWSER_PORT),
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        INTERNAL_BACKEND_URL: `${BACKEND_ORIGIN}/api/v1`,
        ADMIN_API_URL: `${BACKEND_ORIGIN}/api/v1`,
        NEXT_PUBLIC_API_URL: `${BACKEND_ORIGIN}/api/v1`,
        NEXT_PUBLIC_API_PROXY_URL: "/api/backend",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  nextServer.stdout?.on("data", (chunk: Buffer | string) => {
    stdout = appendBounded(stdout, chunk);
  });
  nextServer.stderr?.on("data", (chunk: Buffer | string) => {
    stderr = appendBounded(stderr, chunk);
  });
  nextServer.once("error", (err) => {
    spawnError = err;
  });
  nextExitPromise = new Promise<void>((resolve) => {
    nextServer!.once("close", (code, signal) => {
      exitInfo = `code=${String(code)}, signal=${String(signal)}`;
      resolve();
    });
  });

  await waitForNextServer(`${BROWSER_ORIGIN}/seller/login`, nextServer, () => ({
    stdout,
    stderr,
    spawnError,
    exitInfo,
  }));
});

test.afterAll(async () => {
  await stopChildProcess(nextServer, nextExitPromise);
  await new Promise<void>((resolve) => backendFixture?.close(() => resolve()) ?? resolve());
  resetApiClientSecurityStateForTests();
  globalThis.fetch = originalFetch;
});

test.beforeEach(() => {
  activeSellerStatus = "APPROVED";
});

for (const status of SELLER_STATUSES) {
  for (const viewport of VIEWPORTS) {
    test(`seller navigation & notifications truth for ${status} @ ${viewport.name}`, async ({ browser }, testInfo) => {
      activeSellerStatus = status;

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        serviceWorkers: "block",
      });
      const containment = await installNetworkContainment(context);
      const page = await context.newPage();

      await page.goto(`${BROWSER_ORIGIN}/seller/notifications`, { waitUntil: "domcontentloaded" });

      const content = page.getByRole("main");
      await expect(content.getByRole("heading", { level: 1, name: "Notifications", exact: true })).toBeVisible();
      await expect(content.getByRole("heading", { level: 2, name: "Notifications are not available yet", exact: true })).toBeVisible();

      // No legacy "View Public Store" label, and no fake unread orange dot inside the Notifications bell link.
      await expect(page.getByText("View Public Store", { exact: true })).toHaveCount(0);
      const bellLink = page.getByRole("link", { name: "Open notifications", exact: true }).first();
      await expect(bellLink).toBeVisible();
      await expect(bellLink).toHaveAttribute("href", "/seller/notifications");
      expect(await bellLink.locator("span").count()).toBe(0);

      // Capability-gated View orders CTA on /seller/notifications.
      const supportLink = page.getByRole("link", { name: "Contact support", exact: true });
      await expect(supportLink).toHaveAttribute("href", "/seller/support");

      if (status === "APPROVED") {
        await expect(page.getByRole("link", { name: "View orders", exact: true })).toHaveAttribute("href", "/seller/orders");
      } else {
        await expect(page.getByRole("link", { name: "View orders", exact: true })).toHaveCount(0);
      }

      if (viewport.width >= 768) {
        const marketplaceLink = page.getByRole("link", { name: "Visit marketplace", exact: true });
        await expect(marketplaceLink).toBeVisible();
        await expect(marketplaceLink).toHaveAttribute("href", "/");

        const sidebarNav = page.locator("aside nav");
        await expect(sidebarNav.getByRole("link", { name: "Products", exact: true })).toHaveAttribute("href", "/seller/products");
        await expect(sidebarNav.getByRole("link", { name: "Support", exact: true })).toHaveAttribute("href", "/seller/support");

        if (status === "APPROVED") {
          await expect(sidebarNav.getByRole("link", { name: "Orders", exact: true })).toHaveAttribute("href", "/seller/orders");
        } else {
          await expect(sidebarNav.getByRole("link", { name: "Orders", exact: true })).toHaveCount(0);
          await expect(sidebarNav.locator('[aria-disabled="true"]', { hasText: "Orders" })).toBeVisible();
          await expect(sidebarNav.locator('[aria-disabled="true"]', { hasText: "Analytics" })).toBeVisible();
          await expect(sidebarNav.locator('[aria-disabled="true"]', { hasText: "Payouts" })).toBeVisible();
        }
      } else {
        const moreButton = page.getByRole("button", { name: "Open more seller tools", exact: true });
        await moreButton.click();
        await expect(page.getByRole("link", { name: "Support", exact: true })).toHaveAttribute("href", "/seller/support");

        if (status === "PROVISIONAL") {
          await expect(page.locator('[aria-disabled="true"]', { hasText: "Orders" }).filter({ visible: true }).first()).toBeVisible();
        }
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);

      await attachScreenshot(page, testInfo, `seller-nav-${status.toLowerCase()}-${viewport.name}.png`);
      expect(containment.httpViolations).toEqual([]);
      expect(containment.wsViolations).toEqual([]);
      await context.close();
    });
  }
}
