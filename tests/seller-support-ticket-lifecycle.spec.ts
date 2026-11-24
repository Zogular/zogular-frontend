/**
 * @file seller-support-ticket-lifecycle.spec.ts
 * @description
 * Isolated loopback Playwright verification for ZG-SELLER-R1 Support Ticket Lifecycle:
 * - Explicit 127.0.0.1 Next child binding with fail-closed port pre-checks, bounded startup error forwarding, and awaited shutdown
 * - serviceWorkers="block" + explicit HTTP & WebSocket synthetic loopback origin allowlists + inert Vercel analytics stubs
 * - Per-ticket draft, error, and pending-state isolation across real clicks (A -> B -> A) during delayed reply & resolve
 * - Failed reply preserves draft and isolates error to the target ticket; retry + synchronous duplicate submit guard sends 1 request
 * - Edited draft during in-flight reply is preserved
 * - Responsive containment and attached screenshots at 320x568, 390x844, and 1440x900
 */

import { expect, test, type BrowserContext, type Locator, type TestInfo } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { resetApiClientSecurityStateForTests } from "../src/services/api";

test.use({ channel: process.env.SELLER_SUPPORT_BROWSER_CHANNEL });

const originalFetch = globalThis.fetch;
const repoRoot = path.resolve(__dirname, "..");
const BROWSER_HOST = "127.0.0.1";
const BROWSER_PORT = 3281;
const BACKEND_PORT = 5081;
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

type FixtureTicket = {
  id: string;
  subject: string;
  status: "open" | "waiting-seller" | "waiting-support" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  category: "order" | "payout" | "inventory" | "tech" | "account" | "general";
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    senderType: "support" | "seller" | "system";
    senderName: string;
    body: string;
    createdAt: string;
  }>;
};

let backendFixture: Server | null = null;
let nextServer: ChildProcess | null = null;
let nextExitPromise: Promise<void> | null = null;

let fixtureTickets: Record<string, FixtureTicket> = {};
let replyCalls: Array<{ ticketId: string; message: string }> = [];
let resolveCalls: string[] = [];
let replyDelaysMsByTicket: Record<string, number> = {};
let resolveDelaysMsByTicket: Record<string, number> = {};
let failNextReplyForTicket: Record<string, number> = {};

function resetFixtureState() {
  fixtureTickets = {
    "TKT-101": {
      id: "TKT-101",
      subject: "Payout schedule verification",
      status: "waiting-seller",
      priority: "high",
      category: "payout",
      createdAt: "2026-11-20T09:00:00.000Z",
      updatedAt: "2026-11-24T09:00:00.000Z",
      messages: [
        {
          id: "msg-101-1",
          senderType: "support",
          senderName: "Zogular Operations",
          body: "Please confirm your registered mobile money account name.",
          createdAt: "2026-11-24T09:00:00.000Z",
        },
      ],
    },
    "TKT-102": {
      id: "TKT-102",
      subject: "Product image moderation question",
      status: "open",
      priority: "medium",
      category: "inventory",
      createdAt: "2026-11-21T10:00:00.000Z",
      updatedAt: "2026-11-24T08:00:00.000Z",
      messages: [
        {
          id: "msg-102-1",
          senderType: "seller",
          senderName: "Lusaka Solar Hub",
          body: "Can I upload a spec sheet photo alongside product images?",
          createdAt: "2026-11-24T08:00:00.000Z",
        },
      ],
    },
    "TKT-103": {
      id: "TKT-103",
      subject: "Delivery pickup window inquiry",
      status: "waiting-support",
      priority: "low",
      category: "order",
      createdAt: "2026-11-22T11:00:00.000Z",
      updatedAt: "2026-11-24T07:00:00.000Z",
      messages: [
        {
          id: "msg-103-1",
          senderType: "seller",
          senderName: "Lusaka Solar Hub",
          body: "What is the cutoff time for same-day Lusaka pickup?",
          createdAt: "2026-11-24T07:00:00.000Z",
        },
      ],
    },
  };
  replyCalls = [];
  resolveCalls = [];
  replyDelaysMsByTicket = {};
  resolveDelaysMsByTicket = {};
  failNextReplyForTicket = {};
}

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
  page: { screenshot: (options?: { fullPage?: boolean; path?: string }) => Promise<Buffer> },
  testInfo: TestInfo,
  name: string,
) {
  const screenshotPath = testInfo.outputPath(name);
  await page.screenshot({ fullPage: false, path: screenshotPath });
  await testInfo.attach(name, { path: screenshotPath, contentType: "image/png" });
}

async function assertBoxInsideViewport(locator: Locator, viewportWidth: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-0.5);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 0.5);
  return box!;
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
              id: "seller-fixture-1",
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
              id: "app-fixture-1",
              userId: "seller-fixture-1",
              sellerType: "REGISTERED_BUSINESS",
              status: "APPROVED",
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
      res.end(
        JSON.stringify({
          status: "success",
          data: {
            tickets: Object.values(fixtureTickets),
          },
        }),
      );
      return;
    }

    const detailMatch = url.pathname.match(/^\/api\/v1\/vendor\/support\/tickets\/([^/]+)$/);
    if (detailMatch && req.method === "GET") {
      const ticket = fixtureTickets[decodeURIComponent(detailMatch[1])];
      if (!ticket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: "fail", message: "Ticket not found" }));
        return;
      }
      res.end(JSON.stringify({ status: "success", data: { ticket } }));
      return;
    }

    const replyMatch = url.pathname.match(/^\/api\/v1\/vendor\/support\/tickets\/([^/]+)\/messages$/);
    if (replyMatch && req.method === "POST") {
      const ticketId = decodeURIComponent(replyMatch[1]);
      const ticket = fixtureTickets[ticketId];
      if (!ticket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: "fail", message: "Ticket not found" }));
        return;
      }

      const body = await readJsonBody(req);
      const messageText = String(body.message ?? "");
      replyCalls.push({ ticketId, message: messageText });

      const delayMs = replyDelaysMsByTicket[ticketId] ?? 0;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const failStatus = failNextReplyForTicket[ticketId];
      if (failStatus) {
        delete failNextReplyForTicket[ticketId];
        res.statusCode = failStatus;
        res.end(JSON.stringify({ status: "error", message: "Simulated support reply failure" }));
        return;
      }

      const nowIso = new Date().toISOString();
      const newMessage = {
        id: `msg-${ticketId}-${ticket.messages.length + 1}`,
        senderType: "seller" as const,
        senderName: "Lusaka Solar Hub",
        body: messageText,
        createdAt: nowIso,
      };
      ticket.messages.push(newMessage);
      ticket.status = "waiting-support";
      ticket.updatedAt = nowIso;

      res.end(JSON.stringify({ status: "success", data: { message: newMessage } }));
      return;
    }

    const resolveMatch = url.pathname.match(/^\/api\/v1\/vendor\/support\/tickets\/([^/]+)\/resolve$/);
    if (resolveMatch && req.method === "PATCH") {
      const ticketId = decodeURIComponent(resolveMatch[1]);
      const ticket = fixtureTickets[ticketId];
      if (!ticket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: "fail", message: "Ticket not found" }));
        return;
      }

      resolveCalls.push(ticketId);
      const delayMs = resolveDelaysMsByTicket[ticketId] ?? 0;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      ticket.status = "resolved";
      ticket.updatedAt = new Date().toISOString();
      res.end(JSON.stringify({ status: "success", data: { ticket } }));
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
  resetFixtureState();
});

test("isolates drafts across tickets and keeps delayed reply & resolve scoped across A -> B -> A", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  const containment = await installNetworkContainment(context);
  const page = await context.newPage();

  await page.goto(`${BROWSER_ORIGIN}/seller/support`, { waitUntil: "domcontentloaded" });

  const ticketAButton = page.getByRole("button", { name: /TKT-101/ });
  const ticketBButton = page.getByRole("button", { name: /TKT-102/ });
  const composer = page.getByLabel("Reply message", { exact: true });

  // Open Ticket A, type draft, and confirm draft does not leak into Ticket B.
  await ticketAButton.click();
  await expect(page.getByRole("heading", { level: 2, name: "Payout schedule verification", exact: true })).toBeVisible();
  await composer.fill("Draft reply for Ticket A");

  await ticketBButton.click();
  await expect(page.getByRole("heading", { level: 2, name: "Product image moderation question", exact: true })).toBeVisible();
  await expect(composer).toHaveValue("");

  // Return to A, trigger delayed reply, and immediately switch to B before it finishes.
  await ticketAButton.click();
  await expect(composer).toHaveValue("Draft reply for Ticket A");

  replyDelaysMsByTicket["TKT-101"] = 350;
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await ticketBButton.click();

  // Ticket B remains active, editable, and unaffected when A's delayed reply finishes.
  await expect(page.getByRole("heading", { level: 2, name: "Product image moderation question", exact: true })).toBeVisible();
  await composer.fill("Ticket B draft stays intact");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();

  await expect.poll(() => replyCalls.length).toBe(1);
  await page.waitForTimeout(450);

  await expect(page.getByRole("heading", { level: 2, name: "Product image moderation question", exact: true })).toBeVisible();
  await expect(composer).toHaveValue("Ticket B draft stays intact");

  // Switching back to A shows A's persisted reply and cleared draft.
  await ticketAButton.click();
  await expect(page.getByText("Draft reply for Ticket A")).toBeVisible();
  await expect(composer).toHaveValue("");

  // Trigger delayed resolve on A, switch to B, and verify B stays open & unaffected.
  resolveDelaysMsByTicket["TKT-101"] = 350;
  await page.getByRole("button", { name: "Mark as Resolved", exact: true }).click();
  await ticketBButton.click();
  await expect(page.getByRole("heading", { level: 2, name: "Product image moderation question", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as Resolved", exact: true })).toBeEnabled();

  await expect.poll(() => resolveCalls).toEqual(["TKT-101"]);
  await page.waitForTimeout(450);
  await expect(page.getByRole("heading", { level: 2, name: "Product image moderation question", exact: true })).toBeVisible();
  await expect(composer).toBeVisible();

  // Switching back to A reflects resolved state (no composer / resolve button).
  await ticketAButton.click();
  await expect(page.getByRole("button", { name: "Mark as Resolved", exact: true })).toHaveCount(0);
  await expect(composer).toHaveCount(0);

  expect(containment.httpViolations).toEqual([]);
  expect(containment.wsViolations).toEqual([]);
  await context.close();
});

test("preserves failed draft, isolates error to ticket, blocks duplicate pending submit, and preserves edited in-flight draft", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  });
  const containment = await installNetworkContainment(context);
  const page = await context.newPage();

  await page.goto(`${BROWSER_ORIGIN}/seller/support`, { waitUntil: "domcontentloaded" });

  const ticketBButton = page.getByRole("button", { name: /TKT-102/ });
  const ticketCButton = page.getByRole("button", { name: /TKT-103/ });
  const composer = page.getByLabel("Reply message", { exact: true });
  const sendButton = page.getByRole("button", { name: "Send", exact: true });

  // 1. Failed reply on B preserves draft and scopes error strictly to B.
  await ticketBButton.click();
  await composer.fill("Retryable reply for B");
  failNextReplyForTicket["TKT-102"] = 500;
  await sendButton.click();

  const threadError = page.getByTestId("support-action-error");
  await expect(threadError).toBeVisible();
  await expect(threadError).toHaveAttribute("role", "alert");
  await expect(threadError).toContainText(/could not|try again/i);
  await expect(composer).toHaveValue("Retryable reply for B");

  // Switching to C shows no error from B.
  await ticketCButton.click();
  await expect(threadError).toHaveCount(0);
  await expect(composer).toHaveValue("");

  // 2. Return to B, retry with delayed response + synchronous cancelable submit event -> only 1 retry POST.
  await ticketBButton.click();
  await expect(composer).toHaveValue("Retryable reply for B");
  await expect(threadError).toBeVisible();

  replyDelaysMsByTicket["TKT-102"] = 300;
  await sendButton.click();
  await page.locator("form").evaluate((form) => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  await expect(page.getByText("Retryable reply for B")).toBeVisible();
  await expect(composer).toHaveValue("");
  expect(replyCalls.filter((call) => call.ticketId === "TKT-102")).toHaveLength(2);

  // 3. Editing C's draft while C's reply is in-flight preserves the new edited draft.
  await ticketCButton.click();
  await composer.fill("Initial C message");
  replyDelaysMsByTicket["TKT-103"] = 300;
  await sendButton.click();
  await composer.fill("Follow-up edit typed while in-flight");

  await expect.poll(() => replyCalls.filter((call) => call.ticketId === "TKT-103").length).toBe(1);
  await page.waitForTimeout(400);
  await expect(page.getByText("Initial C message")).toBeVisible();
  await expect(composer).toHaveValue("Follow-up edit typed while in-flight");

  expect(containment.httpViolations).toEqual([]);
  expect(containment.wsViolations).toEqual([]);
  await context.close();
});

for (const viewport of VIEWPORTS) {
  test(`renders support workspace without clipping at ${viewport.name}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      serviceWorkers: "block",
    });
    const containment = await installNetworkContainment(context);
    const page = await context.newPage();

    await page.goto(`${BROWSER_ORIGIN}/seller/support`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Support Center", exact: true })).toBeVisible();

    const listOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(listOverflow).toBe(false);
    await assertBoxInsideViewport(page.getByRole("button", { name: "Contact Support", exact: true }), viewport.width);
    await assertBoxInsideViewport(page.getByLabel("Filter by Status", { exact: true }), viewport.width);
    await assertBoxInsideViewport(page.getByLabel("Filter by Priority", { exact: true }), viewport.width);
    await attachScreenshot(page, testInfo, `support-list-${viewport.name}.png`);

    await page.getByRole("button", { name: /TKT-101/ }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Payout schedule verification", exact: true })).toBeVisible();

    const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(detailOverflow).toBe(false);
    await assertBoxInsideViewport(page.getByRole("button", { name: "Mark as Resolved", exact: true }), viewport.width);
    await assertBoxInsideViewport(page.getByLabel("Reply message", { exact: true }), viewport.width);
    await assertBoxInsideViewport(page.getByRole("button", { name: "Send", exact: true }), viewport.width);
    await attachScreenshot(page, testInfo, `support-detail-${viewport.name}.png`);

    expect(containment.httpViolations).toEqual([]);
    expect(containment.wsViolations).toEqual([]);
    await context.close();
  });
}
