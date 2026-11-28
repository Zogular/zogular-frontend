/**
 * @file admin-support-drawer-browser.spec.ts
 * @description
 * Browser integration, responsive containment, bounding-box, and workflow tests for Support Drawer (F8-S1).
 *
 * Requirements:
 * - Real rendered Next.js routes with synthetic loopback-only fixtures (ports 3242 / 5042).
 * - Loopback network containment: serviceWorkers="block", HTTP/WS route guards installed before navigation.
 * - Responsive containment across 320, 375, 390, 430, 767, 768, 1024, 1280, 1440 and short mobile heights.
 * - Panel & content bounding-box assertions, zero Close/header overlap, zero horizontal overflow, vertical scroll.
 * - Keyboard/Escape/focus, read-only vs manage actor permissions, and no lost draft on failed reply.
 */

import { expect, test, type BrowserContext, type Page, type Request, type Route } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http, { type Server } from "node:http";
import path from "node:path";
import { resetApiClientSecurityStateForTests } from "../src/services/api";

const originalFetch = globalThis.fetch;
const repoRoot = path.resolve(__dirname, "..");
const BROWSER_PORT = 3242;
const BACKEND_PORT = 5042;
const BROWSER_ORIGIN = `http://127.0.0.1:${BROWSER_PORT}`;
const ARTIFACT_DIR =
  process.env.ARTIFACT_DIR ||
  path.join(repoRoot, "test-results", "support-drawer-artifacts");
const PHASE_PREFIX = process.env.SUPPORT_DRAWER_PHASE || "passing";
const PLAYWRIGHT_CHANNEL = process.env.PLAYWRIGHT_CHANNEL as
  | "msedge"
  | "chrome"
  | undefined;

test.use({
  serviceWorkers: "block",
  ...(PLAYWRIGHT_CHANNEL ? { channel: PLAYWRIGHT_CHANNEL } : {}),
});

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

interface FixtureMessage {
  id: string;
  senderType: "seller" | "support" | "system";
  senderName: string;
  body: string;
  createdAt: string;
}

interface FixtureTicket {
  id: string;
  subject: string;
  category: "order" | "payout" | "inventory" | "tech" | "account" | "general";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "waiting-seller" | "waiting-support" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  seller: {
    userId: string;
    vendorApplicationId: string;
    displayName: string;
    email: string;
    storeName: string | null;
    applicationStatus: string | null;
  };
  messages: FixtureMessage[];
}

function makeFixtureTickets(): FixtureTicket[] {
  return [
    {
      id: "tkt-overflow-extreme-000000000000000000000000000001",
      subject:
        "URGENT_PAYOUT_RECONCILIATION_FAILURE_REF_2026_ZOGULAR_LUSAKA_00000000000000999",
      category: "payout",
      priority: "urgent",
      status: "waiting-support",
      createdAt: "2026-11-20T08:00:00.000Z",
      updatedAt: "2026-11-22T09:15:00.000Z",
      resolvedAt: null,
      seller: {
        userId: "usr-seller-overflow-1",
        vendorApplicationId: "app-overflow-1",
        displayName: "Chileshe_Mwamba_Lusaka_Operations_Lead_000000000000001",
        email:
          "very.long.unbroken.seller.operations.contact.address@zogular-lusaka-marketplace.co.zm",
        storeName:
          "Lusaka_Electronics_And_Solar_Distribution_Superstore_Limited_2026",
        applicationStatus: "APPROVED_PROVISIONAL_VERIFICATION_PENDING_2026",
      },
      messages: [
        {
          id: "msg-1",
          senderType: "seller",
          senderName: "Chileshe_Mwamba_Lusaka_Operations_Lead_000000000000001",
          body: "Hello support team, our payout batch has not settled yet. Reference URL: https://payments.example.zm/settlements/reconciliation/batch/2026-11-22/tx_99887766554433221100aabbccddeeff",
          createdAt: "2026-11-20T08:05:00.000Z",
        },
        {
          id: "msg-2",
          senderType: "support",
          senderName: "Fixture Admin",
          body: "We are reviewing the settlement batch reference and checking the MoMo gateway logs.",
          createdAt: "2026-11-20T09:10:00.000Z",
        },
        {
          id: "msg-3",
          senderType: "seller",
          senderName: "Chileshe_Mwamba_Lusaka_Operations_Lead_000000000000001",
          body: "Additional trace ID: MOMO_TX_2026_11_20_ZAMBIA_LUSAKA_00000000000000000000000000088123",
          createdAt: "2026-11-20T10:20:00.000Z",
        },
        {
          id: "msg-4",
          senderType: "support",
          senderName: "Fixture Admin",
          body: "Confirmed the trace ID is queued for manual verification with the settlement partner.",
          createdAt: "2026-11-20T11:30:00.000Z",
        },
        {
          id: "msg-5",
          senderType: "seller",
          senderName: "Chileshe_Mwamba_Lusaka_Operations_Lead_000000000000001",
          body: "Please let us know if we need to re-upload our bank or mobile money confirmation.",
          createdAt: "2026-11-21T08:45:00.000Z",
        },
        {
          id: "msg-6",
          senderType: "support",
          senderName: "Fixture Admin",
          body: "No re-upload needed yet. Monitoring the settlement callback window.",
          createdAt: "2026-11-21T14:00:00.000Z",
        },
        {
          id: "msg-7",
          senderType: "seller",
          senderName: "Chileshe_Mwamba_Lusaka_Operations_Lead_000000000000001",
          body: "Checking in again before end of day in Lusaka.",
          createdAt: "2026-11-22T07:30:00.000Z",
        },
        {
          id: "msg-8",
          senderType: "seller",
          senderName: "Chileshe_Mwamba_Lusaka_Operations_Lead_000000000000001",
          body: "FINAL_THREAD_MESSAGE_MARKER: Please confirm once the batch is reconciled.",
          createdAt: "2026-11-22T09:15:00.000Z",
        },
      ],
    },
    {
      id: "tkt-normal-1",
      subject: "Inventory sync question for Lusaka warehouse",
      category: "inventory",
      priority: "medium",
      status: "open",
      createdAt: "2026-11-21T10:00:00.000Z",
      updatedAt: "2026-11-22T08:00:00.000Z",
      resolvedAt: null,
      seller: {
        userId: "usr-seller-2",
        vendorApplicationId: "app-2",
        displayName: "Mwamba Mutale",
        email: "mwamba.seller@example.zm",
        storeName: "Kabulonga Tech Hub",
        applicationStatus: "APPROVED",
      },
      messages: [
        {
          id: "msg-n1",
          senderType: "seller",
          senderName: "Mwamba Mutale",
          body: "How do I update stock quantities for 15 SKUs?",
          createdAt: "2026-11-21T10:05:00.000Z",
        },
      ],
    },
  ];
}

let backendFixture: Server | null = null;
let nextServer: ChildProcess | null = null;
let fixtureTickets: FixtureTicket[] = makeFixtureTickets();
let currentActorRole: "SUPER_ADMIN" | "EXECUTIVE" = "SUPER_ADMIN";
let currentPermissions: string[] = [
  "access_admin_panel",
  "view_support_tickets",
  "reply_support_tickets",
  "manage_support_tickets",
];
let replyForceStatus: number | null = null;

async function waitForServer(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await originalFetch(url);
      if (response.status < 500) return;
    } catch {
      // Retry until server responds
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

test.beforeEach(() => {
  fixtureTickets = makeFixtureTickets();
  currentActorRole = "SUPER_ADMIN";
  currentPermissions = [
    "access_admin_panel",
    "view_support_tickets",
    "reply_support_tickets",
    "manage_support_tickets",
  ];
  replyForceStatus = null;
});

test.beforeAll(async () => {
  backendFixture = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${BACKEND_PORT}`);
    res.setHeader("content-type", "application/json");

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

    if (url.pathname === "/api/v1/auth/csrf-token") {
      res.setHeader("set-cookie", "_csrf=fixture-csrf-secret; Path=/; HttpOnly");
      res.end(
        JSON.stringify({
          status: "success",
          data: { csrfToken: "fixture-csrf-token" },
        }),
      );
      return;
    }

    if (url.pathname === "/api/v1/admin/support/tickets" && req.method === "GET") {
      const search = url.searchParams.get("search")?.toLowerCase() || "";
      const status = url.searchParams.get("status");
      const priority = url.searchParams.get("priority");
      const category = url.searchParams.get("category");

      const filtered = fixtureTickets.filter((t) => {
        if (status && t.status !== status) return false;
        if (priority && t.priority !== priority) return false;
        if (category && t.category !== category) return false;
        if (search) {
          return (
            t.subject.toLowerCase().includes(search) ||
            t.seller.displayName.toLowerCase().includes(search) ||
            t.seller.email.toLowerCase().includes(search) ||
            (t.seller.storeName || "").toLowerCase().includes(search)
          );
        }
        return true;
      });

      const page = Number(url.searchParams.get("page") ?? 1);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      const total = filtered.length;
      const pages = Math.max(1, Math.ceil(total / limit));

      res.end(
        JSON.stringify({
          status: "success",
          results: total,
          pagination: { page, limit, total, pages },
          data: { tickets: filtered },
        }),
      );
      return;
    }

    const messageMatch = url.pathname.match(
      /^\/api\/v1\/admin\/support\/tickets\/([^/]+)\/messages$/,
    );
    if (messageMatch && req.method === "POST") {
      if (replyForceStatus) {
        const s = replyForceStatus;
        replyForceStatus = null;
        res.statusCode = s;
        res.end(
          JSON.stringify({
            status: "error",
            message: `Synthetic reply failure (${s})`,
          }),
        );
        return;
      }

      const id = decodeURIComponent(messageMatch[1]);
      const ticket = fixtureTickets.find((t) => t.id === id);
      if (!ticket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: "fail", message: "Ticket not found" }));
        return;
      }

      const raw = await readBody(req);
      const parsed = JSON.parse(raw || "{}") as { message?: string };
      const newMsg: FixtureMessage = {
        id: `msg-${Date.now()}`,
        senderType: "support",
        senderName: "Fixture Admin",
        body: parsed.message || "",
        createdAt: new Date().toISOString(),
      };
      ticket.messages.push(newMsg);
      ticket.status = "waiting-seller";
      ticket.updatedAt = new Date().toISOString();

      res.end(
        JSON.stringify({
          status: "success",
          data: { message: newMsg },
        }),
      );
      return;
    }

    const statusMatch = url.pathname.match(
      /^\/api\/v1\/admin\/support\/tickets\/([^/]+)\/status$/,
    );
    if (statusMatch && req.method === "PATCH") {
      const id = decodeURIComponent(statusMatch[1]);
      const ticket = fixtureTickets.find((t) => t.id === id);
      if (!ticket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: "fail", message: "Ticket not found" }));
        return;
      }

      const raw = await readBody(req);
      const parsed = JSON.parse(raw || "{}") as {
        status: FixtureTicket["status"];
      };
      ticket.status = parsed.status;
      ticket.updatedAt = new Date().toISOString();

      res.end(
        JSON.stringify({
          status: "success",
          data: { ticket },
        }),
      );
      return;
    }

    const detailMatch = url.pathname.match(
      /^\/api\/v1\/admin\/support\/tickets\/([^/]+)$/,
    );
    if (detailMatch && req.method === "GET") {
      const id = decodeURIComponent(detailMatch[1]);
      const ticket = fixtureTickets.find((t) => t.id === id);
      if (!ticket) {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: "fail", message: "Ticket not found" }));
        return;
      }
      res.end(
        JSON.stringify({
          status: "success",
          data: { ticket },
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

  nextServer = spawn(
    process.execPath,
    [
      fs.existsSync(path.join(repoRoot, "node_modules", "next", "dist", "bin", "next"))
        ? path.join(repoRoot, "node_modules", "next", "dist", "bin", "next")
        : require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
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
  if (nextServer && nextServer.exitCode === null && nextServer.signalCode === null && nextServer.pid) {
    const exited = once(nextServer, "exit");
    nextServer.kill();
    await exited;
  }
  if (backendFixture?.listening) {
    const closed = once(backendFixture, "close");
    backendFixture.close();
    backendFixture.closeAllConnections();
    await closed;
  }
  resetApiClientSecurityStateForTests();
  globalThis.fetch = originalFetch;
});

async function installNetworkContainment(context: BrowserContext): Promise<string[]> {
  const violations: string[] = [];

  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["data:", "blob:", "about:", "chrome-extension:"].includes(url.protocol)) {
      return route.continue();
    }
    if (url.origin === BROWSER_ORIGIN) {
      return route.fallback();
    }
    violations.push(url.href);
    return route.abort();
  });

  await context.routeWebSocket("**/*", (ws) => {
    try {
      const url = new URL(ws.url());
      if (url.protocol !== "ws:" || `http://${url.host}` !== BROWSER_ORIGIN) {
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

async function setupPage(
  context: BrowserContext,
): Promise<{ page: Page; violations: string[] }> {
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

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

async function openExtremeTicketDrawer(page: Page, width: number, listScreenshot?: string, verifyHeader?: () => Promise<void>) {
  await page.goto(`${BROWSER_ORIGIN}/admin/support`, { waitUntil: "networkidle" });
  await verifyHeader?.();
  const extremeSubject =
    "URGENT_PAYOUT_RECONCILIATION_FAILURE_REF_2026_ZOGULAR_LUSAKA_00000000000000999";

  if (width < 1024) {
    const mobileCard = page
      .locator("article")
      .filter({ hasText: extremeSubject })
      .first();
    await expect(mobileCard).toBeVisible();
    if (listScreenshot) await page.screenshot({ path: listScreenshot, animations: "disabled" });
    await mobileCard.getByRole("button", { name: "Open" }).click();
  } else {
    const row = page.locator("tr").filter({ hasText: extremeSubject }).first();
    await expect(row).toBeVisible();
    const open = row.getByRole("button", { name: "Open ticket" });
    if (listScreenshot) {
      await expect(open).toBeInViewport({ ratio: 1 });
      await expect(row.getByText("Waiting Support", { exact: true })).toBeInViewport({ ratio: 1 });
      expect(await row.evaluate((el) => {
        const scroller = el.closest("table")?.parentElement;
        return !!scroller && scroller.scrollWidth <= scroller.clientWidth + 1;
      })).toBe(true);
      await page.screenshot({ path: listScreenshot, animations: "disabled" });
    }
    await open.click();
  }

  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Seller Context")).toBeVisible();
  return sheet;
}

function openDesktopTicket(page: Page, ticket: FixtureTicket) {
  return page.getByRole("row").filter({ hasText: ticket.subject })
    .getByRole("button", { name: "Open ticket", exact: true }).click();
}

async function holdSupportResponse(
  page: Page,
  ticket: FixtureTicket,
  operation: "detail" | "reply" | "status",
  json: object,
) {
  const method = { detail: "GET", reply: "POST", status: "PATCH" }[operation];
  const suffix = { detail: "", reply: "/messages", status: "/status" }[operation];
  const url = `${BROWSER_ORIGIN}/api/backend/admin/support/tickets/${ticket.id}${suffix}`;
  const marker = `${operation}:${ticket.id}`;
  const markerHeader = "x-support-fixture-gate";
  let resolveRequest!: (request: Request) => void;
  const requestReceived = new Promise<Request>((resolve) => { resolveRequest = resolve; });
  let release!: (action: "deliver" | "abort") => void;
  const responseReleased = new Promise<"deliver" | "abort">((resolve) => { release = resolve; });
  let resolveHandled!: () => void;
  const routeHandled = new Promise<void>((resolve) => { resolveHandled = resolve; });
  let captured = false;

  // Keep the page interceptor registered while other ticket responses are held.
  // Expiring both handlers on match can make Playwright forward a still-held request.
  const handler = async (route: Route) => {
    if (captured || route.request().method() !== method) return route.fallback();
    captured = true;
    resolveRequest(route.request());
    try {
      if (await responseReleased === "deliver") {
        await route.fulfill({ json, headers: { [markerHeader]: marker } });
      } else {
        await route.abort("aborted");
      }
    } finally {
      resolveHandled();
    }
  };
  await page.route(url, handler);

  return {
    request: requestReceived,
    async dispose() {
      if (captured) {
        release("abort");
        await routeHandled;
      }
      await page.unroute(url, handler);
    },
    async deliver() {
      const request = await requestReceived;
      release("deliver");
      const response = await request.response();
      if (!response) throw new Error(`No response for held Support fixture: ${marker}`);
      expect(response.ok()).toBe(true);
      expect(await response.headerValue(markerHeader)).toBe(marker);
      await response.finished();
      // Give the delivered fetch body and React update a render turn before checking absence.
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
    },
  };
}

async function verifySupportHeader(page: Page, width: number, profileScreenshot: string) {
  const header = page.locator("header").filter({ has: page.getByTestId("admin-profile-trigger") });
  const menu = header.getByRole("button", { name: "Open admin menu" });
  const profile = header.getByRole("button", { name: "Open admin profile for Fixture Admin" });
  const command = header.getByRole("button", { name: "Navigate admin" });
  const notifications = header.getByRole("button", { name: "Notifications are not available yet" });
  const title = await header.getByText("Support", { exact: true }).boundingBox();
  expect(title?.width, "route title retains space").toBeGreaterThan(0);
  let rightEdge = 0;
  for (const control of [...(width < 1024 ? [menu] : []), command, notifications, profile]) {
    await expect(control).toBeInViewport({ ratio: 1 });
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(rightEdge - 1);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width, "header action right edge").toBeLessThanOrEqual(width);
    if (control === command) expect(box!.x).toBeGreaterThanOrEqual(title!.x + title!.width - 1);
    rightEdge = box!.x + box!.width;
  }
  await expect(notifications).toBeDisabled();
  await expect(notifications).toHaveAttribute("aria-disabled", "true");
  if (width >= 1024) await expect(menu).toBeHidden();
  if (width === 320) {
    await profile.click();
    const profileDialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: "Sign out" }) });
    await expect(profileDialog).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: profileScreenshot, animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(profile).toHaveAttribute("aria-expanded", "false");

    await menu.click();
    const navigation = page.getByRole("dialog", { name: "Admin navigation" });
    await expect(navigation.getByRole("link", { name: "Support", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(navigation).toBeHidden();
  }
}

test("VIS-05 support search placeholder fits and filters at 320x568", async ({ context }, testInfo) => {
  const { page, violations } = await setupPage(context);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${BROWSER_ORIGIN}/admin/support`);
  const search = page.getByPlaceholder("Search tickets", { exact: true });
  const [unmatched, matched] = fixtureTickets.map(({ subject }) =>
    page.locator("article").filter({ hasText: subject }));
  await expect(unmatched).toBeVisible();
  await expect(matched).toBeVisible();
  await search.scrollIntoViewIfNeeded();
  await expect(search).toBeInViewport({ ratio: 1 });
  await expect(search).toHaveValue("");

  const { textWidth, availableWidth } = await search.evaluate((input: HTMLInputElement) => {
    const style = getComputedStyle(input);
    const placeholder = getComputedStyle(input, "::placeholder");
    const canvas = document.createElement("canvas").getContext("2d")!;
    canvas.font = `${placeholder.fontWeight} ${placeholder.fontSize} ${placeholder.fontFamily}`;
    return {
      textWidth: canvas.measureText(input.placeholder).width,
      availableWidth: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    };
  });
  expect(textWidth).toBeGreaterThan(0);
  expect(textWidth).toBeLessThanOrEqual(availableWidth);
  await page.screenshot({ path: testInfo.outputPath("support-search-320x568.png"), animations: "disabled" });

  const term = "Inventory sync";
  const response = page.waitForResponse((result) => {
    const url = new URL(result.url());
    return url.origin === BROWSER_ORIGIN && url.pathname === "/api/backend/admin/support/tickets"
      && result.request().method() === "GET" && url.searchParams.get("search") === term;
  });
  await search.fill(term);
  expect((await response).status()).toBe(200);
  await expect(matched).toBeVisible();
  await expect(unmatched).toHaveCount(0);
  expect(violations).toEqual([]);
});

test.describe("F8-S1 Support Drawer Containment & Workflows", () => {

  const VIEWPORT_CASES: Array<{ width: number; height: number; label: string }> = [
    { width: 320, height: 568, label: "320x568" },
    { width: 375, height: 667, label: "375x667" },
    { width: 390, height: 600, label: "390x600" },
    { width: 430, height: 800, label: "430x800" },
    { width: 767, height: 800, label: "767x800" },
    { width: 768, height: 800, label: "768x800" },
    { width: 1024, height: 800, label: "1024x800" },
    { width: 1280, height: 800, label: "1280x800" },
    { width: 1440, height: 800, label: "1440x800" },
  ];

  for (const vp of VIEWPORT_CASES) {
    test(`drawer containment, bounding-boxes, and scroll at ${vp.label}`, async ({
      context,
    }, testInfo) => {
      const { page, violations } = await setupPage(context);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const sheet = await openExtremeTicketDrawer(
        page,
        vp.width,
        path.join(ARTIFACT_DIR, `${PHASE_PREFIX}-support-list-${vp.label}.png`),
        [320, 390, 768, 1024, 1440].includes(vp.width)
          ? () => test.step("VIS-03 header containment", () => verifySupportHeader(page, vp.width, testInfo.outputPath("support-header-profile.png")))
          : undefined,
      );
      await sheet.evaluate(async (element) => {
        await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
      });

      // Screenshot capture for visual inspection
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, `${PHASE_PREFIX}-support-drawer-${vp.label}.png`),
        fullPage: false,
      });

      // 1. Page-level horizontal containment
      const pageContained = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(pageContained, "page horizontal overflow").toBe(true);

      // 2. Panel bounding box fits viewport & fills narrow mobile / compact desktop
      const panelBox = await sheet.boundingBox();
      expect(panelBox).not.toBeNull();
      expect(panelBox!.x).toBeGreaterThanOrEqual(0);
      expect(panelBox!.y).toBeGreaterThanOrEqual(0);
      expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(vp.width + 1);
      expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(vp.height + 1);

      if (vp.width <= 430) {
        expect(
          panelBox!.width,
          `narrow viewport ${vp.width}px drawer should fill viewport`,
        ).toBeGreaterThanOrEqual(vp.width - 2);
      } else {
        expect(
          panelBox!.width,
          `desktop/tablet ${vp.width}px drawer should have compact readable width`,
        ).toBeGreaterThanOrEqual(480);
        expect(panelBox!.width).toBeLessThanOrEqual(600);
      }

      // 3. Close button & header title/description containment + zero overlap
      const closeBtn = sheet.locator('[data-slot="sheet-close"]');
      const titleEl = sheet.locator('[data-slot="sheet-title"]');
      const descEl = sheet.locator('[data-slot="sheet-description"]');

      const closeBox = await closeBtn.boundingBox();
      const titleBox = await titleEl.boundingBox();
      const descBox = await descEl.boundingBox();

      expect(closeBox).not.toBeNull();
      expect(titleBox).not.toBeNull();
      expect(descBox).not.toBeNull();

      expect(closeBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
      expect(closeBox!.x + closeBox!.width).toBeLessThanOrEqual(
        panelBox!.x + panelBox!.width + 1,
      );
      expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(
        panelBox!.x + panelBox!.width + 1,
      );
      expect(descBox!.x + descBox!.width).toBeLessThanOrEqual(
        panelBox!.x + panelBox!.width + 1,
      );

      expect(
        rectsOverlap(closeBox!, titleBox!),
        "close button must not overlap sheet title",
      ).toBe(false);
      expect(
        rectsOverlap(closeBox!, descBox!),
        "close button must not overlap sheet description",
      ).toBe(false);

      // 4. Scroll body horizontal containment & vertical scrollability
      const scrollBody = sheet.locator("div.overflow-y-auto").first();
      const bodyMetrics = await scrollBody.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(
        bodyMetrics.scrollWidth,
        "drawer scroll body must not overflow horizontally",
      ).toBeLessThanOrEqual(bodyMetrics.clientWidth);
      expect(
        bodyMetrics.scrollHeight,
        "long thread must require vertical scroll inside drawer",
      ).toBeGreaterThan(bodyMetrics.clientHeight);

      // 5. Action buttons fit inside panel & status buttons do not overlap
      const sendBtn = sheet.getByRole("button", { name: /Send Reply/i });
      const waitingBtn = sheet.getByRole("button", { name: /Mark Waiting Support/i });
      const resolvedBtn = sheet.getByRole("button", { name: /Mark Resolved/i });
      const closeTicketBtn = sheet.getByRole("button", { name: /Close Ticket/i });

      const actionButtons = [sendBtn, waitingBtn, resolvedBtn, closeTicketBtn];
      const actionBoxes: Rect[] = [];
      for (const btn of actionButtons) {
        const box = await btn.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          panelBox!.x + panelBox!.width + 1,
        );
        actionBoxes.push(box!);
      }

      // Check status buttons pairwise non-overlap
      const statusBoxes = actionBoxes.slice(1);
      for (let i = 0; i < statusBoxes.length; i += 1) {
        for (let j = i + 1; j < statusBoxes.length; j += 1) {
          expect(
            rectsOverlap(statusBoxes[i], statusBoxes[j]),
            `status buttons ${i} and ${j} must not overlap`,
          ).toBe(false);
        }
      }

      // 6. Scroll to bottom on short mobile heights to verify final message is reachable
      await scrollBody.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(
        sheet.getByText(/FINAL_THREAD_MESSAGE_MARKER/),
      ).toBeInViewport();

      expect(violations).toHaveLength(0);
    });
  }

  test("keyboard Escape closes drawer and focus enters dialog", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);
    await page.setViewportSize({ width: 1280, height: 800 });

    const sheet = await openExtremeTicketDrawer(page, 1280);
    const focusInsideDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[data-slot="sheet-content"]');
      return Boolean(dialog && dialog.contains(document.activeElement));
    });
    expect(focusInsideDialog).toBe(true);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    expect(violations).toHaveLength(0);
  });

  test("read-only actor cannot reply or mutate status while manage actor can", async ({
    context,
  }) => {
    // 1. Read-only actor (EXECUTIVE with view_support_tickets only)
    currentActorRole = "EXECUTIVE";
    currentPermissions = ["access_admin_panel", "view_support_tickets"];

    const { page: roPage, violations: roViolations } = await setupPage(context);
    await roPage.setViewportSize({ width: 1280, height: 800 });
    const roSheet = await openExtremeTicketDrawer(roPage, 1280);

    await expect(
      roSheet.getByPlaceholder("Type your reply to the seller..."),
    ).toBeDisabled();
    await expect(roSheet.getByRole("button", { name: /Send Reply/i })).toBeDisabled();
    await expect(
      roSheet.getByRole("button", { name: /Mark Waiting Support/i }),
    ).toBeDisabled();
    await expect(roSheet.getByRole("button", { name: /Mark Resolved/i })).toBeDisabled();
    await expect(roSheet.getByRole("button", { name: /Close Ticket/i })).toBeDisabled();
    expect(roViolations).toHaveLength(0);
    await roPage.close();

    // 2. Manage actor can send reply and update status
    currentActorRole = "SUPER_ADMIN";
    currentPermissions = [
      "access_admin_panel",
      "view_support_tickets",
      "reply_support_tickets",
      "manage_support_tickets",
    ];

    const { page: rwPage, violations: rwViolations } = await setupPage(context);
    await rwPage.setViewportSize({ width: 1280, height: 800 });
    const rwSheet = await openExtremeTicketDrawer(rwPage, 1280);

    const textarea = rwSheet.getByPlaceholder("Type your reply to the seller...");
    await textarea.fill("Settlement confirmed via Lusaka reconciliation desk.");
    await rwSheet.getByRole("button", { name: /Send Reply/i }).click();

    await expect(
      rwSheet.locator("p", {
        hasText: "Settlement confirmed via Lusaka reconciliation desk.",
      }),
    ).toBeVisible();
    await expect(textarea).toHaveValue("");

    await rwSheet.getByRole("button", { name: /Mark Resolved/i }).click();
    await expect(rwSheet.getByRole("button", { name: /Mark Resolved/i })).toBeDisabled();
    expect(rwViolations).toHaveLength(0);
  });

  test("keeps a failed detail read recoverable inside the drawer", async ({ context }, testInfo) => {
    const { page, violations } = await setupPage(context);
    await page.setViewportSize({ width: 320, height: 568 });
    const ticket = fixtureTickets[0]!;
    let reads = 0;
    const detailUrl = new URL(`/api/backend/admin/support/tickets/${ticket.id}`, BROWSER_ORIGIN).href;
    await page.route(detailUrl, async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      if (++reads !== 1) return route.fallback();
      await route.fulfill({
        status: 503,
        json: { status: "fail", message: "synthetic private detail diagnostic" },
      });
    });

    await page.goto(`${BROWSER_ORIGIN}/admin/support`, { waitUntil: "networkidle" });
    await page.locator("article").filter({ hasText: ticket.subject }).getByRole("button", { name: "Open" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("alert")).toHaveText("We couldn't load this ticket.");
    await expect(sheet.getByText("synthetic private detail diagnostic")).toHaveCount(0);
    await expect(sheet.getByText("Seller Context")).toHaveCount(0);
    expect(reads).toBe(1);
    const retry = sheet.getByRole("button", { name: "Retry ticket details" });
    await expect(retry).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath("support-detail-unavailable-320.png"), animations: "disabled" });
    await retry.click();
    await expect(sheet.getByText("Seller Context")).toBeVisible();
    await expect(retry).toHaveCount(0);
    expect(reads).toBe(2);
    expect(violations).toHaveLength(0);
  });

  test("preserves a failed reply draft and sends it once on explicit retry", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const sheet = await openExtremeTicketDrawer(page, 1280);

    replyForceStatus = 500;
    const posts: Request[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/messages")) posts.push(request);
    });
    const draft = "Draft reply that must not be lost on 500 error.";
    const textarea = sheet.getByPlaceholder("Type your reply to the seller...");
    await textarea.fill(draft);
    await sheet.getByRole("button", { name: /Send Reply/i }).click();

    await expect(page.getByText("Failed to send reply.")).toBeVisible();
    await expect(textarea).toHaveValue(draft);
    const send = sheet.getByRole("button", { name: /Send Reply/i });
    await expect(send).toBeEnabled();
    expect(posts).toHaveLength(1);
    await send.click();
    await expect(sheet.getByText(draft, { exact: true })).toHaveCount(1);
    await expect(textarea).toHaveValue("");
    expect(posts.map((request) => request.postDataJSON())).toEqual([{ message: draft }, { message: draft }]);
    expect(violations).toHaveLength(0);
  });

  test("does not carry an unsent draft to another ticket or a reopened ticket", async ({ context }) => {
    const { page, violations } = await setupPage(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const [first, second] = fixtureTickets;
    const posts: Request[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith("/messages")) posts.push(request);
    });

    const sheet = await openExtremeTicketDrawer(page, 1280);
    const draft = sheet.getByPlaceholder("Type your reply to the seller...");
    const send = sheet.getByRole("button", { name: "Send Reply" });
    await draft.fill("Unsent draft for the first seller only.");
    await expect(send).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await openDesktopTicket(page, second);
    await expect(sheet.getByRole("heading", { name: second.subject })).toBeVisible();
    await expect(draft).toHaveValue("");
    await expect(send).toBeDisabled();
    expect(posts).toHaveLength(0);

    const secondReply = "Reply intended for the inventory ticket only.";
    const replyPath = `/api/backend/admin/support/tickets/${second.id}/messages`;
    await draft.fill(secondReply);
    const replyRequest = page.waitForRequest((request) =>
      request.method() === "POST" && request.url() === `${BROWSER_ORIGIN}${replyPath}`,
    );
    await send.click();
    await replyRequest;
    await expect(sheet.locator("p").and(sheet.getByText(secondReply, { exact: true }))).toBeVisible();
    await expect(draft).toHaveValue("");
    expect(posts.map((request) => ({
      path: new URL(request.url()).pathname,
      body: request.postDataJSON(),
    }))).toEqual([{
      path: replyPath,
      body: { message: secondReply },
    }]);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await openDesktopTicket(page, first);
    await expect(sheet.getByRole("heading", { name: first.subject })).toBeVisible();
    await expect(draft).toHaveValue("");
    await expect(send).toBeDisabled();
    expect(violations).toHaveLength(0);
  });

  for (const reopenSameTicket of [false, true]) {
    test(`ignores late detail after ${reopenSameTicket ? "reopening the same ticket" : "opening another ticket"}`, async ({ context }) => {
      const { page, violations } = await setupPage(context);
      await page.setViewportSize({ width: 1280, height: 800 });
      const [first, second] = fixtureTickets;
      const latest = reopenSameTicket ? first : second;
      const staleSubject = "Obsolete ticket details";
      const held = await holdSupportResponse(page, first, "detail", {
        status: "success",
        data: { ticket: { ...first, subject: staleSubject } },
      });
      const sheet = page.getByRole("dialog");

      try {
        await page.goto(`${BROWSER_ORIGIN}/admin/support`, { waitUntil: "networkidle" });
        await openDesktopTicket(page, first);
        await held.request;
        await expect(sheet.getByRole("heading", { name: "Support ticket", exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(sheet).toBeHidden();

        await openDesktopTicket(page, latest);
        await expect(sheet.getByRole("heading", { name: latest.subject })).toBeVisible();
        await held.deliver();

        await expect(sheet.getByRole("heading", { name: latest.subject })).toBeVisible();
        await expect(sheet.getByRole("heading", { name: staleSubject })).toHaveCount(0);
        await expect(sheet.getByText(latest.messages[0].body, { exact: true })).toBeVisible();
        expect(violations).toHaveLength(0);
      } finally {
        await held.dispose();
      }
    });
  }

  for (const operation of ["reply", "status"] as const) {
    test(`late ${operation} cannot alter another ticket or unlock its pending action`, async ({ context }) => {
      const { page, violations } = await setupPage(context);
      await page.setViewportSize({ width: 1280, height: 800 });
      const [first, second] = fixtureTickets;
      const firstReply = "Reply in flight for the first ticket.";
      const oldPayload = operation === "reply"
        ? { message: { id: "late-message", senderType: "support", senderName: "Fixture Admin", body: firstReply, createdAt: first.updatedAt } }
        : { ticket: { ...first, status: "resolved" } };
      const held = await holdSupportResponse(page, first, operation, { status: "success", data: oldPayload });
      const current = await holdSupportResponse(page, second, "status", {
        status: "success",
        data: { ticket: { ...second, status: "resolved" } },
      });

      try {
        const sheet = await openExtremeTicketDrawer(page, 1280);
        const draft = sheet.getByPlaceholder("Type your reply to the seller...");
        const resolve = sheet.getByRole("button", { name: "Mark Resolved" });
        if (operation === "reply") {
          await draft.fill(firstReply);
          await sheet.getByRole("button", { name: "Send Reply" }).click();
        } else {
          await resolve.click();
        }
        const firstRequest = await held.request;
        expect(firstRequest.postDataJSON()).toEqual(
          operation === "reply" ? { message: firstReply } : { status: "resolved" },
        );
        await expect(draft).toBeDisabled();
        await page.keyboard.press("Escape");
        await expect(sheet).toBeHidden();

        await openDesktopTicket(page, second);
        await expect(sheet.getByRole("heading", { name: second.subject })).toBeVisible();
        const secondDraft = "Keep this separate draft for the inventory ticket.";
        await draft.fill(secondDraft);
        await resolve.click();
        const secondRequest = await current.request;
        expect(secondRequest.postDataJSON()).toEqual({ status: "resolved" });
        await expect(draft).toBeDisabled();
        await held.deliver();

        await expect(sheet.getByRole("heading", { name: second.subject })).toBeVisible();
        await expect(sheet.getByText(firstReply, { exact: true })).toHaveCount(0);
        await expect(draft).toHaveValue(secondDraft);
        await expect(draft).toBeDisabled();
        await expect(resolve).toBeDisabled();
        await expect(page.getByText(operation === "reply" ? "Reply sent." : "Ticket moved to Resolved.", { exact: true })).toHaveCount(0);

        await current.deliver();
        await expect(page.getByText("Ticket moved to Resolved.", { exact: true })).toBeVisible();
        await expect(resolve).toBeDisabled();
        await expect(draft).toBeEnabled();
        await expect(draft).toHaveValue(secondDraft);
        expect(violations).toHaveLength(0);
      } finally {
        await Promise.all([held.dispose(), current.dispose()]);
      }
    });
  }
});
