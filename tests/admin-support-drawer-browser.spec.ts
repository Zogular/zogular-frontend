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

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
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
  await new Promise<void>(
    (resolve) => backendFixture?.close(() => resolve()) ?? resolve(),
  );
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

async function openExtremeTicketDrawer(page: Page, width: number) {
  await page.goto(`${BROWSER_ORIGIN}/admin/support`, { waitUntil: "networkidle" });
  const extremeSubject =
    "URGENT_PAYOUT_RECONCILIATION_FAILURE_REF_2026_ZOGULAR_LUSAKA_00000000000000999";

  if (width < 1024) {
    const mobileCard = page
      .locator("article")
      .filter({ hasText: extremeSubject })
      .first();
    await expect(mobileCard).toBeVisible();
    await mobileCard.getByRole("button", { name: "Open" }).click();
  } else {
    const row = page.locator("tr").filter({ hasText: extremeSubject }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Open ticket" }).click();
  }

  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Seller Context")).toBeVisible();
  return sheet;
}

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
    }) => {
      const { page, violations } = await setupPage(context);
      await page.setViewportSize({ width: vp.width, height: vp.height });

      const sheet = await openExtremeTicketDrawer(page, vp.width);
      await page.waitForTimeout(250);

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

  test("preserves reply draft when synthetic reply request fails", async ({
    context,
  }) => {
    const { page, violations } = await setupPage(context);
    await page.setViewportSize({ width: 1280, height: 800 });
    const sheet = await openExtremeTicketDrawer(page, 1280);

    replyForceStatus = 500;
    const draft = "Draft reply that must not be lost on 500 error.";
    const textarea = sheet.getByPlaceholder("Type your reply to the seller...");
    await textarea.fill(draft);
    await sheet.getByRole("button", { name: /Send Reply/i }).click();

    await expect(page.getByText("Failed to send reply.")).toBeVisible();
    await expect(textarea).toHaveValue(draft);
    expect(violations).toHaveLength(0);
  });
});
