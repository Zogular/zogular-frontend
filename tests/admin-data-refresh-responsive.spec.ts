import { expect, test, type Request } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const FRONTEND_PORT = 3330;
const BACKEND_PORT = 3331;
const FRONTEND_ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;
const screenshotDir = path.resolve(__dirname, "../test-results/responsive-refresh");

let backendServer: http.Server | null = null;
let frontendProcess: ChildProcess | null = null;

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000);
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  backendServer = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", BACKEND_ORIGIN);
    response.setHeader("content-type", "application/json");

    if (url.pathname === "/api/v1/user/me") {
      response.end(JSON.stringify({
        status: "success",
        data: {
          user: {
            id: "admin-refresh-test",
            name: "Refresh Admin",
            email: "refresh.admin@example.test",
            role: "SUPER_ADMIN",
            permissions: [
              "access_admin_panel",
              "review_sellers",
              "view_all_products",
              "view_all_orders",
              "view_support_tickets",
            ],
            authStrength: "password",
          },
        },
      }));
      return;
    }

    if (url.pathname === "/api/v1/admin/dashboard/overview") {
      response.end(JSON.stringify({
        status: "success",
        data: {
          period: "LAST_30_DAYS",
          comparison: "PREVIOUS_PERIOD",
          groupBy: "DAY",
          generatedAt: new Date().toISOString(),
          queues: {
            availability: "AVAILABLE",
            sellersPendingReview: { value: 12, change: 0.1, status: "fresh" },
            productsPendingModeration: { value: 5, change: -0.2, status: "fresh" },
            disputesNeedingAction: { value: 2, change: 0, status: "fresh" },
            supportTicketsDue: { value: 8, change: 0.05, status: "fresh" },
          },
          snapshot: {
            availability: "AVAILABLE",
            activeSellers: { value: 140, change: 0.08, status: "fresh" },
            activeBuyers: { value: 2300, change: 0.15, status: "fresh" },
            grossMerchandiseValue: { value: 540000, change: 0.22, status: "fresh" },
            orderCount: { value: 820, change: 0.12, status: "fresh" },
          },
          periodFlows: {
            availability: "AVAILABLE",
            completedOrders: { value: 780, change: 0.1, status: "fresh" },
            returnedOrders: { value: 15, change: -0.05, status: "fresh" },
            cancelledOrders: { value: 25, change: 0, status: "fresh" },
          },
          operationalActivity: {
            availability: "AVAILABLE",
            series: [
              { label: "Day 1", current: 20, previous: 15 },
              { label: "Day 2", current: 35, previous: 28 },
            ],
          },
        },
      }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ status: "fail", message: "Not found" }));
  });

  await new Promise<void>((resolve, reject) => {
    backendServer!.once("error", reject);
    backendServer!.listen(BACKEND_PORT, "127.0.0.1", resolve);
  });

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  frontendProcess = spawn(
    `${npmCommand} run start -- --hostname 127.0.0.1 --port ${FRONTEND_PORT}`,
    {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        ADMIN_API_URL: `${BACKEND_ORIGIN}/api/v1`,
        INTERNAL_BACKEND_URL: `${BACKEND_ORIGIN}/api/v1`,
        NEXT_PUBLIC_API_URL: `${BACKEND_ORIGIN}/api/v1`,
      },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  await waitForFrontend();
});

test.afterAll(async () => {
  if (frontendProcess && frontendProcess.pid) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(frontendProcess.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      frontendProcess.kill();
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  if (backendServer) {
    await new Promise<void>((resolve, reject) => {
      backendServer!.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

async function waitForFrontend() {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    try {
      const response = await fetch(`${FRONTEND_ORIGIN}/api/backend/admin/overview`, {
        signal: AbortSignal.timeout(1_500),
      });
      if (response.status < 500) return;
    } catch {
      // Retry until ready
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Frontend failed to start within 60s");
}

const VIEWPORTS = [320, 375, 390, 430, 768, 1024, 1280, 1440] as const;

for (const width of VIEWPORTS) {
  test(`responsive check at ${width}px: verifies header notification control, refresh settings popover, and zero notification network requests`, async ({ page }) => {
    // 1. Intercept and monitor all network requests
    const forbiddenRequests: string[] = [];
    page.on("request", (req: Request) => {
      const url = req.url();
      if (
        url.includes("/events/stream") ||
        url.includes("/notifications") ||
        url.includes("/admin/events") ||
        url.startsWith("ws://") ||
        url.startsWith("wss://")
      ) {
        forbiddenRequests.push(`${req.method()} ${url}`);
      }
    });

    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.context().addCookies([
      {
        name: "zogular_admin_session",
        value: "synthetic-refresh-test-token",
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    // 2. Navigate to Admin Dashboard
    await page.goto(`${FRONTEND_ORIGIN}/admin/dashboard`, { waitUntil: "networkidle" });

    // 3. Verify Header Notification Control is visibly disabled and non-clickable
    const notificationTrigger = page.getByTestId("admin-notification-trigger");
    await expect(notificationTrigger).toBeVisible();
    await expect(notificationTrigger).toHaveAttribute("aria-label", "Notifications are not available yet");
    await expect(notificationTrigger).toBeDisabled();

    // 4. Verify Overview dynamic refresh status (5 minutes default)
    const refreshStatus = page.getByTestId("overview-refresh-status");
    await expect(refreshStatus).toBeVisible();
    await expect(refreshStatus).toContainText("Auto-refreshes every 5 minutes while this page is visible");

    // 5. Verify Refresh Settings Popover
    const refreshSettingsTrigger = page.getByTestId("admin-refresh-settings-trigger");
    await expect(refreshSettingsTrigger).toBeVisible();
    await refreshSettingsTrigger.click();

    const refreshSettingsPopover = page.getByTestId("admin-refresh-settings-popover");
    await expect(refreshSettingsPopover).toBeVisible();

    const interval5m = page.getByTestId("refresh-interval-300000");
    await expect(interval5m).toBeVisible();
    await expect(interval5m).toHaveAttribute("role", "radio");
    await expect(interval5m).toHaveAttribute("aria-checked", "true");

    const interval1m = page.getByTestId("refresh-interval-60000");
    await expect(interval1m).toBeVisible();
    await expect(interval1m).toHaveAttribute("role", "radio");
    await expect(interval1m).toHaveAttribute("aria-checked", "false");

    const intervalManual = page.getByTestId("refresh-interval-0");
    await expect(intervalManual).toBeVisible();
    await expect(intervalManual).toHaveAttribute("role", "radio");
    await expect(intervalManual).toHaveAttribute("aria-checked", "false");

    const optionBox = await interval5m.boundingBox();
    expect(optionBox).not.toBeNull();
    if (optionBox) {
      expect(optionBox.width).toBeGreaterThanOrEqual(100);
      expect(optionBox.height).toBeGreaterThanOrEqual(30);
    }

    await expect(page.getByTestId("refresh-hidden-tab-notice")).toBeVisible();
    await expect(page.getByTestId("refresh-toggle-on-navigation")).toBeVisible();

    // Assert real bounding-box measurements for popover viewport containment
    const popoverBox = await refreshSettingsPopover.boundingBox();
    expect(popoverBox).not.toBeNull();
    const viewportHeight = width < 768 ? 844 : 900;
    if (popoverBox) {
      // 1. Horizontal containment: popover must not overflow the viewport width
      expect(popoverBox.x).toBeGreaterThanOrEqual(0);
      expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(width + 1);

      // 2. Vertical containment: popover must remain within the visible viewport bounds
      expect(popoverBox.y).toBeGreaterThanOrEqual(0);
      expect(popoverBox.y + popoverBox.height).toBeLessThanOrEqual(viewportHeight + 1);

      // 3. Accessible internal scroll container exists for long content
      const scrollBody = page.getByTestId("admin-refresh-settings-body");
      await expect(scrollBody).toBeVisible();
      const overflowY = await scrollBody.evaluate((el) => window.getComputedStyle(el).overflowY);
      expect(["auto", "scroll"]).toContain(overflowY);

      // 4. Pinned footer reset action is visible and contained within viewport
      const resetBtn = page.getByTestId("refresh-reset-defaults");
      await expect(resetBtn).toBeVisible();
      const resetBox = await resetBtn.boundingBox();
      expect(resetBox).not.toBeNull();
      if (resetBox) {
        expect(resetBox.y + resetBox.height).toBeLessThanOrEqual(viewportHeight + 1);
      }
    }

    // Capture responsive screenshots at requested widths: 320, 375, 390, 430, 768, 1024, 1280, and 1440
    await page.waitForTimeout(200);
    await page.screenshot({
      path: path.join(screenshotDir, `admin-refresh-popover-open-${width}px.png`),
      fullPage: false,
    });

    // Close settings popover
    await page.keyboard.press("Escape");
    await expect(refreshSettingsPopover).toBeHidden();

    // Normal state screenshot
    await page.screenshot({
      path: path.join(screenshotDir, `admin-refresh-${width}px.png`),
      fullPage: false,
    });

    // Assert strictly ZERO live notification / SSE / WebSocket requests occurred
    expect(forbiddenRequests).toEqual([]);
  });
}

test("rendered browser evidence: verifies hidden-tab pause and manual mode in live UI", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.context().addCookies([
    {
      name: "zogular_admin_session",
      value: "synthetic-refresh-test-token",
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto(`${FRONTEND_ORIGIN}/admin/dashboard`, { waitUntil: "networkidle" });
  const refreshStatus = page.getByTestId("overview-refresh-status");
  await expect(refreshStatus).toBeVisible();

  // State 1: Default pause when hidden
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await expect(refreshStatus).toContainText("Auto-refresh paused while tab is hidden");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-refresh-hidden-tab-paused.png"),
    fullPage: false,
  });

  // Return tab to visible
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(refreshStatus).toContainText("Auto-refreshes every 5 minutes while this page is visible");

  // State 2: Select Manual only (which is the canonical off state)
  const refreshSettingsTrigger = page.getByTestId("admin-refresh-settings-trigger");
  await refreshSettingsTrigger.click();

  const manualOption = page.getByTestId("refresh-interval-0");
  await manualOption.click();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("admin-refresh-settings-popover")).toBeHidden();

  await expect(refreshStatus).toContainText("Manual refresh only");
  await page.screenshot({
    path: path.join(screenshotDir, "admin-refresh-manual-state.png"),
    fullPage: false,
  });

  // State 3: Switch to Every minute
  await refreshSettingsTrigger.click();
  const option1m = page.getByTestId("refresh-interval-60000");
  await option1m.click();
  await expect(option1m).toHaveAttribute("aria-checked", "true");

  await page.screenshot({
    path: path.join(screenshotDir, "admin-refresh-popover-1m-selected.png"),
    fullPage: false,
  });

  // Reset to defaults (5 minutes)
  await page.getByTestId("refresh-reset-defaults").click();
  const option5m = page.getByTestId("refresh-interval-300000");
  await expect(option5m).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
});
