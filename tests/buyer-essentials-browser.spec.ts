/**
 * @file buyer-essentials-browser.spec.ts
 * @description
 * Isolated loopback Playwright verification for ZG-LAUNCH-R1 Buyer Essentials:
 * - Explicit 127.0.0.1 Next child binding with fail-closed port pre-checks, bounded startup error forwarding, and awaited shutdown
 * - serviceWorkers="block" + explicit HTTP & WebSocket synthetic loopback origin allowlists + inert Vercel analytics/speed-insights stubs
 * - Source-verified fixture paths, _csrf cookie, session/local storage shapes, and product/auth/cart contracts
 * - Screenshots attached in Playwright test output at 320, 390, and 1440
 */

import { expect, test, type BrowserContext, type Locator, type TestInfo } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { resetApiClientSecurityStateForTests } from "../src/services/api";

const originalFetch = globalThis.fetch;
const repoRoot = path.resolve(__dirname, "..");
const BROWSER_HOST = "127.0.0.1";
const BROWSER_PORT = 3231;
const BACKEND_PORT = 5031;
const BROWSER_ORIGIN = `http://${BROWSER_HOST}:${BROWSER_PORT}`;
const BACKEND_ORIGIN = `http://${BROWSER_HOST}:${BACKEND_PORT}`;
const ALLOWED_HTTP_ORIGINS = new Set([BROWSER_ORIGIN, BACKEND_ORIGIN]);
const ALLOWED_WS_ORIGINS = new Set([
  `ws://${BROWSER_HOST}:${BROWSER_PORT}`,
  `ws://${BROWSER_HOST}:${BACKEND_PORT}`,
]);
const ALLOWED_NON_HTTP_PROTOCOLS = new Set(["data:", "blob:", "about:"]);
const EXPECTED_BLOCKED_BACKDROP_ORIGIN = "https://images.unsplash.com";
const MAX_STDIO_CHARS = 4096;

const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

let backendFixture: Server | null = null;
let nextServer: ChildProcess | null = null;
let nextExitPromise: Promise<void> | null = null;
let verifyCodeCalls: Array<{ email: string; code: string }> = [];
let verifyCodeDelayMs = 0;

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

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function installNetworkContainment(context: BrowserContext): Promise<{
  unexpectedHttpViolations: string[];
  wsViolations: string[];
}> {
  const unexpectedHttpViolations: string[] = [];
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

    if (url.origin !== EXPECTED_BLOCKED_BACKDROP_ORIGIN) {
      unexpectedHttpViolations.push(`${route.request().method()} ${url.toString()}`);
    }
    return route.abort("blockedbyclient");
  });

  return { unexpectedHttpViolations, wsViolations };
}

async function assertBoxMinSize(locator: Locator, minWidth = 44, minHeight = 44) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(minWidth);
  expect(box!.height).toBeGreaterThanOrEqual(minHeight);
  return box!;
}

function assertBoxesDoNotOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  const separated =
    a.x + a.width <= b.x + 0.5 ||
    b.x + b.width <= a.x + 0.5 ||
    a.y + a.height <= b.y + 0.5 ||
    b.y + b.height <= a.y + 0.5;
  expect(separated).toBe(true);
}

function assertBoxContainedIn(
  child: { x: number; y: number; width: number; height: number },
  container: { x: number; y: number; width: number; height: number },
) {
  expect(child.x).toBeGreaterThanOrEqual(container.x - 0.5);
  expect(child.y).toBeGreaterThanOrEqual(container.y - 0.5);
  expect(child.x + child.width).toBeLessThanOrEqual(container.x + container.width + 0.5);
  expect(child.y + child.height).toBeLessThanOrEqual(container.y + container.height + 0.5);
}

async function attachScreenshot(
  page: { screenshot: (options?: { fullPage?: boolean }) => Promise<Buffer> },
  testInfo: TestInfo,
  name: string,
  fullPage = false,
) {
  const body = await page.screenshot({ fullPage });
  await testInfo.attach(name, { body, contentType: "image/png" });
}

test.beforeAll(async () => {
  await assertPortFree(BROWSER_HOST, BACKEND_PORT);
  await assertPortFree(BROWSER_HOST, BROWSER_PORT);

  backendFixture = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", BACKEND_ORIGIN);
    res.setHeader("content-type", "application/json");

    if (url.pathname === "/api/v1/user/me") {
      res.statusCode = 401;
      res.end(JSON.stringify({ status: "fail", message: "Not authenticated" }));
      return;
    }

    if (url.pathname === "/api/v1/auth/csrf-token") {
      res.setHeader("set-cookie", "_csrf=test-csrf-cookie; Path=/; HttpOnly; SameSite=Lax");
      res.end(JSON.stringify({ status: "success", data: { csrfToken: "test-csrf-token" } }));
      return;
    }

    if (url.pathname === "/api/v1/auth/verify-code" && req.method === "POST") {
      const body = await readJsonBody(req);
      const email = String(body.email ?? "");
      const code = String(body.code ?? "");
      verifyCodeCalls.push({ email, code });

      if (verifyCodeDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, verifyCodeDelayMs));
      }

      if (code === "482913") {
        res.end(JSON.stringify({ status: "success", message: "Code verified." }));
      } else {
        res.statusCode = 400;
        res.end(JSON.stringify({ status: "fail", message: "Invalid or expired verification code." }));
      }
      return;
    }

    if (url.pathname === "/api/v1/products/test-solar-inverter") {
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            product: {
              id: "prod-solar-1",
              slug: "test-solar-inverter",
              title: "Pure Sine Wave Hybrid Solar Inverter 5kVA",
              description: "Synthetic fixture product for mobile sticky purchase bar validation.",
              price: 149999,
              salePrice: 125000,
              images: [{ url: "/file.svg", alt: "Solar Inverter", isPrimary: true }],
              condition: "NEW",
              category: "ELECTRONICS",
              categoryRef: { id: "cat-1", name: "Solar & Energy", slug: "solar-energy" },
              categorySlug: "solar-energy",
              subcategorySlug: "inverters",
              location: "Lusaka",
              stock: 5,
              status: "PUBLISHED",
              isApproved: true,
              isSold: false,
              user: { id: "seller-1" },
            },
          },
        }),
      );
      return;
    }

    if (url.pathname === "/api/v1/products/prod-solar-1/related") {
      res.end(JSON.stringify({ status: "success", results: 0, data: { products: [] } }));
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

  await waitForNextServer(`${BROWSER_ORIGIN}/auth/login`, nextServer, () => ({
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
  verifyCodeCalls = [];
  verifyCodeDelayMs = 0;
});

for (const viewport of VIEWPORTS) {
  test.describe(`Buyer essentials @ ${viewport.name}`, () => {
    test("product detail sticky bar & desktop quantity selector meet bounds", async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        serviceWorkers: "block",
      });
      const containment = await installNetworkContainment(context);
      const page = await context.newPage();

      await page.goto(`${BROWSER_ORIGIN}/product/test-solar-inverter`, { waitUntil: "domcontentloaded" });

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);

      const stickyBar = page.getByTestId("mobile-sticky-purchase-bar");
      if (viewport.width < 768) {
        await expect(stickyBar).toBeVisible();

        const price = stickyBar.getByTestId("mobile-sticky-price");
        await expect(price).toHaveText("K125,000");
        const isTruncated = await price.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(isTruncated).toBe(false);

        const decBtn = stickyBar.getByRole("button", { name: "Decrease quantity" });
        const incBtn = stickyBar.getByRole("button", { name: "Increase quantity" });
        const addBtn = stickyBar.getByRole("button", { name: /^Add$/ });

        const decBox = await assertBoxMinSize(decBtn, 44, 44);
        const incBox = await assertBoxMinSize(incBtn, 44, 44);
        const addBox = await assertBoxMinSize(addBtn, 112, 44);

        assertBoxesDoNotOverlap(decBox, incBox);
        assertBoxesDoNotOverlap(incBox, addBox);

        await incBtn.click();
        await expect(stickyBar).toContainText("2");
        await decBtn.click();
        await expect(stickyBar).toContainText("1");
      } else {
        await expect(stickyBar).toBeHidden();
        const desktopInc = page.getByRole("button", { name: "Increase quantity" }).first();
        await expect(desktopInc).toBeVisible();
      }

      await attachScreenshot(page, testInfo, `product-detail-${viewport.name}.png`);
      expect(containment.unexpectedHttpViolations).toEqual([]);
      expect(containment.wsViolations).toEqual([]);
      await context.close();
    });

    test("login page associates labels, autocomplete, >=44px targets, and has no nested controls", async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        serviceWorkers: "block",
      });
      const containment = await installNetworkContainment(context);
      const page = await context.newPage();

      await page.goto(`${BROWSER_ORIGIN}/auth/login`, { waitUntil: "domcontentloaded" });

      const emailInput = page.getByLabel("Email Address", { exact: true });
      const passwordInput = page.getByLabel("Password", { exact: true });
      await expect(emailInput).toHaveAttribute("autocomplete", "email");
      await expect(passwordInput).toHaveAttribute("autocomplete", "current-password");

      const nestedInteractive = await page.locator("a button, button a, a a, button button").count();
      expect(nestedInteractive).toBe(0);

      await assertBoxMinSize(page.getByRole("link", { name: "Go back", exact: true }), 44, 44);
      await assertBoxMinSize(page.getByRole("button", { name: "Show password", exact: true }), 44, 44);
      await assertBoxMinSize(page.getByRole("button", { name: "Continue to your account", exact: true }), 44, 44);

      if (viewport.width >= 1024) {
        await assertBoxMinSize(page.getByRole("link", { name: "Close login page", exact: true }), 44, 44);
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);

      await attachScreenshot(page, testInfo, `login-${viewport.name}.png`);
      expect(containment.unexpectedHttpViolations).toEqual([]);
      expect(containment.wsViolations).toEqual([]);
      await context.close();
    });

    test("cart page renders honest items-only subtotal without invented fees", async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        serviceWorkers: "block",
      });
      const containment = await installNetworkContainment(context);
      const page = await context.newPage();

      await page.addInitScript(() => {
        window.localStorage.setItem(
          "zogular-cart-storage",
          JSON.stringify({
            state: {
              items: [
                {
                  id: "prod-solar-1",
                  slug: "test-solar-inverter",
                  name: "Pure Sine Wave Hybrid Solar Inverter 5kVA",
                  price: 125000,
                  image: "/file.svg",
                  quantity: 2,
                  variant: null,
                },
              ],
              ownerId: null,
              checkoutOutcomeOwnerId: null,
              suspendedOwnerId: null,
              suspendedItems: [],
              pendingDeletions: [],
              pendingAnonymousMerge: [],
            },
            version: 0,
          }),
        );
      });

      await page.goto(`${BROWSER_ORIGIN}/cart`, { waitUntil: "domcontentloaded" });

      await expect(page.getByText("Items subtotal (2 items)")).toBeVisible();
      await expect(page.getByTestId("cart-items-subtotal")).toHaveText("K250,000");
      await expect(page.getByText("Calculated at checkout", { exact: true })).toBeVisible();
      await expect(page.getByText(/Items subtotal only\./)).toBeVisible();
      await expect(page.locator("aside").getByText(/^Total$/)).toHaveCount(0);

      const cartCard = page
        .locator("main section")
        .filter({ has: page.getByRole("button", { name: "Increase quantity", exact: true }) });
      const cartCardBox = await cartCard.boundingBox();
      expect(cartCardBox).not.toBeNull();

      const unitPrice = cartCard.getByText("K125,000", { exact: true });
      await expect(unitPrice).toBeVisible();
      const unitPriceBox = await unitPrice.boundingBox();
      expect(unitPriceBox).not.toBeNull();
      assertBoxContainedIn(unitPriceBox!, cartCardBox!);

      const decCartBtn = cartCard.getByRole("button", { name: "Decrease quantity", exact: true });
      const incCartBtn = cartCard.getByRole("button", { name: "Increase quantity", exact: true });
      const decCartBox = await assertBoxMinSize(decCartBtn, 44, 44);
      const incCartBox = await assertBoxMinSize(incCartBtn, 44, 44);

      assertBoxesDoNotOverlap(decCartBox, incCartBox);
      assertBoxContainedIn(decCartBox, cartCardBox!);
      assertBoxContainedIn(incCartBox, cartCardBox!);

      await incCartBtn.click();
      await expect(page.getByText("Items subtotal (3 items)")).toBeVisible();
      await expect(page.getByTestId("cart-items-subtotal")).toHaveText("K375,000");
      await decCartBtn.click();
      await expect(page.getByText("Items subtotal (2 items)")).toBeVisible();
      await expect(page.getByTestId("cart-items-subtotal")).toHaveText("K250,000");

      await assertBoxMinSize(page.getByRole("link", { name: "Proceed to checkout" }), 44, 44);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);

      await attachScreenshot(page, testInfo, `cart-${viewport.name}.png`);
      expect(containment.unexpectedHttpViolations).toEqual([]);
      expect(containment.wsViolations).toEqual([]);
      await context.close();
    });
  });
}

test("verify-code supports 6-digit paste and simulated autofill without auto-submit, allows invalid retry, and blocks duplicate submit", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const containment = await installNetworkContainment(context);
  const page = await context.newPage();

  await page.addInitScript(() => {
    const createdAt = Date.now() - 1000;
    window.sessionStorage.setItem(
      "zogular_password_recovery_intent",
      JSON.stringify({
        version: 1,
        purpose: "password-reset",
        intentId: "11111111222233334444555566667777",
        email: "buyer@example.zm",
        nextPath: null,
        stage: "code-requested",
        createdAt,
        expiresAt: createdAt + 15 * 60 * 1000,
      }),
    );
  });

  await page.goto(`${BROWSER_ORIGIN}/auth/verify-code`, { waitUntil: "domcontentloaded" });

  await assertBoxMinSize(page.getByRole("link", { name: "Restart password recovery", exact: true }), 44, 44);

  const digits = Array.from({ length: 6 }, (_, index) =>
    page.getByLabel(`Verification code digit ${index + 1}`, { exact: true }),
  );

  // 1. Formatted 6-digit paste populates all boxes without auto-submitting
  await digits[0].focus();
  await digits[0].evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "Code: 482-913");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  for (const [index, expected] of ["4", "8", "2", "9", "1", "3"].entries()) {
    await expect(digits[index]).toHaveValue(expected);
  }
  expect(verifyCodeCalls).toHaveLength(0);

  // 2. Simulated browser/OS autofill into box 1 (not real OS SMS/email autofill)
  await digits[0].fill("000000");
  for (const box of digits) {
    await expect(box).toHaveValue("0");
  }
  expect(verifyCodeCalls).toHaveLength(0);

  // 3. Invalid OTP shows error and permits retry
  const submitButton = page.getByRole("button", { name: "Verify Code", exact: true });
  await submitButton.click();
  await expect(page.locator("form").getByRole("alert")).toContainText(/That code is invalid or has expired/i);
  expect(verifyCodeCalls).toEqual([{ email: "buyer@example.zm", code: "000000" }]);
  await attachScreenshot(page, testInfo, "verify-code-invalid-390.png");

  // 4. Retry with valid code and test duplicate-submit guard during delayed response
  await digits[0].fill("482913");
  expect(verifyCodeCalls).toHaveLength(1);

  verifyCodeDelayMs = 250;
  await submitButton.click();
  await page.locator("form").evaluate((form) => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  await page.waitForURL(/\/auth\/reset-password$/);
  expect(verifyCodeCalls).toEqual([
    { email: "buyer@example.zm", code: "000000" },
    { email: "buyer@example.zm", code: "482913" },
  ]);

  expect(containment.unexpectedHttpViolations).toEqual([]);
  expect(containment.wsViolations).toEqual([]);
  await context.close();
});
