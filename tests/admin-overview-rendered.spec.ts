import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { containAuditNetwork } from "./helpers/ui-audit-checks";

const FRONTEND_PORT = 3320;
const BACKEND_PORT = 3321;
const FRONTEND_ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;
const DAY_MS = 86_400_000;

let backendServer: http.Server | null = null;
let frontendProcess: ChildProcess | null = null;
let frontendOutput = "";
let frontendClosed: Promise<void> | undefined;
let overviewStatus = 200;
let overviewRequests = 0;
let nextIdentity: "principal" | "claims" | null = null;
let overviewGate: Promise<void> | null = null;

async function checkPort(port: number) {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      probe.close(error => error ? reject(error) : resolve());
    });
  });
}

test.describe.configure({ mode: "serial", timeout: 120_000 });
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await containAuditNetwork(context, [FRONTEND_ORIGIN, BACKEND_ORIGIN]);
});

test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(120_000);
  await checkPort(FRONTEND_PORT);
  await checkPort(BACKEND_PORT);
  backendServer = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", BACKEND_ORIGIN);
    response.setHeader("content-type", "application/json");

    if (url.pathname === "/api/v1/auth/csrf-token") {
      response.end(JSON.stringify({ csrfToken: "fixture-csrf" }));
      return;
    }
    if (url.pathname === "/api/v1/auth/logout" && request.method === "POST") {
      response.end(JSON.stringify({ status: "success" }));
      return;
    }
    const login = url.pathname === "/api/v1/auth/login" && request.method === "POST";
    if (login || url.pathname === "/api/v1/user/me") {
      const changed = login || request.headers.authorization === "Bearer fixture-next-session";
      if (!login && !changed && request.headers.authorization !== "Bearer synthetic-rendered-admin-token") {
        response.writeHead(401).end(JSON.stringify({ status: "fail" }));
        return;
      }
      response.end(JSON.stringify({
        status: "success",
        data: {
          ...(login ? { accessToken: "fixture-next-session" } : {}),
          user: {
            id: changed && nextIdentity === "principal" ? "admin-second" : "admin-rendered-overview",
            name: changed ? "Updated Operator" : "Rendered Admin",
            email: "rendered.admin@example.test",
            role: "SUPER_ADMIN",
            permissions: [
              "access_admin_panel",
              "review_sellers",
              "view_all_products",
              ...(changed && nextIdentity === "claims" ? [] : ["view_all_orders"]),
              "view_support_tickets",
            ],
            authStrength: "password",
          },
        },
      }));
      return;
    }

    if (url.pathname === "/api/v1/admin/dashboard/overview") {
      overviewRequests++;
      if (overviewGate) await overviewGate;
      if (overviewStatus !== 200) {
        response.writeHead(overviewStatus);
        response.end(JSON.stringify({ status: "fail", message: "Overview unavailable" }));
        return;
      }
      const envelope = overviewEnvelope(url);
      if (nextIdentity) envelope.data.overview.snapshot.activeSellers.value = 87;
      response.end(JSON.stringify(envelope));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ status: "fail", message: "Not found" }));
  });

  await new Promise<void>((resolve, reject) => {
    backendServer!.once("error", reject);
    backendServer!.listen({ port: BACKEND_PORT, host: "127.0.0.1", exclusive: true }, resolve);
  });

  frontendProcess = spawn(
    process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(FRONTEND_PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ADMIN_API_URL: `${BACKEND_ORIGIN}/api/v1`,
        INTERNAL_BACKEND_URL: `${BACKEND_ORIGIN}/api/v1`,
        NEXT_PUBLIC_API_URL: `${BACKEND_ORIGIN}/api/v1`,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  frontendClosed = new Promise(resolve => frontendProcess!.once("close", () => resolve()));
  frontendProcess.once("error", error => {
    frontendOutput = (frontendOutput + error.message).slice(-8192);
  });
  const append = (chunk: Buffer) => { frontendOutput = (frontendOutput + chunk.toString()).slice(-8192); };
  frontendProcess.stdout?.on("data", append);
  frontendProcess.stderr?.on("data", append);

  await waitForFrontend();
});

test.afterAll(async () => {
  try {
    if (frontendProcess?.pid && frontendProcess.exitCode === null && frontendProcess.signalCode === null) {
      frontendProcess.kill();
      const force = setTimeout(() => frontendProcess?.kill("SIGKILL"), 5000);
      try { await frontendClosed; } finally { clearTimeout(force); }
    } else await frontendClosed;
  } finally {
    if (backendServer?.listening) await new Promise<void>((resolve, reject) => {
      backendServer!.close(error => error ? reject(error) : resolve());
      backendServer!.closeAllConnections();
    });
  }
});

for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440] as const) {
  test(`renders admin Overview without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.context().addCookies([
      {
        name: "zogular_admin_session",
        value: "synthetic-rendered-admin-token",
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto(`${FRONTEND_ORIGIN}/admin/dashboard`, { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByTestId("overview-content")).toBeVisible();
    await expect(page.getByTestId("marketplace-pulse")).toBeVisible();
    await expect(page.getByTestId("marketplace-snapshot")).toBeVisible();
    await expect(page.getByTestId("operational-activity")).toBeVisible();
    await expect(page.getByText("Recharts provides")).toHaveCount(0);

    await assertNoHorizontalOverflow(page);
    await assertVisibleWidth(page, "[data-testid='admin-main-scroll']");
    await assertVisibleWidth(page, "[data-testid='marketplace-pulse']");
    await assertVisibleWidth(page, "[data-testid='operational-activity']");

    await page.getByRole("button", { name: "Weekly" }).click();
    await expect(page).toHaveURL(/groupBy=WEEK/);
    await expect(page.getByTestId("overview-content")).toBeVisible();
    await expect(page.getByTestId("operational-activity")).toContainText("Weekly view");

    const activityDataSummary = page.locator("summary").filter({ hasText: "View activity data" });
    await activityDataSummary.scrollIntoViewIfNeeded();
    await activityDataSummary.click();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Current range" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Previous range" }).first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    if (width < 1024) {
      await expect(page.getByTestId("admin-menu-button")).toBeVisible();
      await page.getByTestId("admin-menu-button").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    } else {
      await expect(page.getByTestId("admin-desktop-sidebar")).toBeVisible();
    }
  });
}

for (const change of ["principal", "claims"] as const) {
  test(`client sign-out and sign-in isolates the ${change} change before fresh data arrives`, async ({ page }) => {
    await page.context().addCookies([{
      name: "zogular_admin_session", value: "synthetic-rendered-admin-token",
      domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax",
    }]);
    await page.goto(`${FRONTEND_ORIGIN}/admin/dashboard`);
    const snapshot = page.getByTestId("snapshot-activeSellers");
    await expect(snapshot).toContainText("12");
    const documentStart = await page.evaluate(() => performance.timeOrigin);
    await page.getByTestId("admin-profile-trigger").click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/login/);

    let release!: () => void;
    overviewGate = new Promise<void>(resolve => { release = resolve; });
    nextIdentity = change;
    try {
      const before = overviewRequests;
      await page.getByLabel("Admin email").fill("rendered.admin@example.test");
      await page.locator("#admin-password").fill("fixture-password");
      await page.getByRole("button", { name: "Sign in to admin" }).click();
      await expect(page).toHaveURL(/\/admin\/dashboard/);
      await expect(page.getByTestId("admin-profile-trigger")).toHaveAccessibleName(/Updated Operator/);
      await expect.poll(() => overviewRequests).toBeGreaterThan(before);
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
      await expect(page.getByTestId("overview-loading")).toBeVisible();
      await expect(snapshot).toHaveCount(0);
      release();
      await expect(snapshot).toContainText("87");
    } finally {
      release();
      overviewGate = null;
      nextIdentity = null;
    }
  });
}

for (const status of [401, 403]) {
  test(`terminal ${status} clears retained Overview and does not retry on period change`, async ({ page }) => {
    await page.context().addCookies([{
      name: "zogular_admin_session", value: "synthetic-rendered-admin-token",
      domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax",
    }]);
    await page.goto(`${FRONTEND_ORIGIN}/admin/dashboard`);
    await expect(page.getByTestId("overview-content")).toBeVisible();
    try {
      overviewStatus = status;
      await page.getByTestId("overview-refresh").click();
      await expect(page.getByTestId("overview-error")).toBeVisible();
      await expect(page.getByTestId("overview-content")).toHaveCount(0);
      await expect(page.getByTestId("overview-refresh")).toBeDisabled();
      const afterDenial = overviewRequests;
      await page.getByRole("button", { name: "Weekly" }).click();
      await expect(page).toHaveURL(/groupBy=WEEK/);
      await expect(page.getByTestId("overview-error")).toBeVisible();
      await expect(page.getByTestId("overview-content")).toHaveCount(0);
      expect(overviewRequests).toBe(afterDenial);
    } finally {
      overviewStatus = 200;
    }
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
  }));

  expect(overflow.documentOverflow).toBeLessThanOrEqual(1);
  expect(overflow.bodyOverflow).toBeLessThanOrEqual(1);
}

async function assertVisibleWidth(page: Page, selector: string) {
  const box = await page.locator(selector).first().boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
}

async function waitForFrontend() {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < 60_000) {
    if (!frontendProcess?.pid || frontendProcess.exitCode !== null || frontendProcess.signalCode !== null) {
      throw new Error(`Next fixture exited during startup: ${frontendOutput}`);
    }
    try {
      if (/ready in/i.test(frontendOutput)) {
        const response = await fetch(`${FRONTEND_ORIGIN}/admin/login`, { redirect: "manual", signal: AbortSignal.timeout(2000) });
        await response.body?.cancel();
        if (response.status === 200) return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(
    `Timed out waiting for admin Overview production fixture frontend. Run npm run build before this rendered QA test. Last error: ${String(lastError)}\n${frontendOutput.slice(-4_000)}`,
  );
}

function metric(id: string, label: string) {
  return {
    id,
    label,
    definition: `${label} count for rendered Overview validation.`,
    unit: "COUNT",
    source: "renderedOverviewFixture",
    requiredPermissions: ["access_admin_panel"],
    permissionMode: "ALL",
  };
}

function queue(id: string, label: string, value: number) {
  return {
    ...metric(id, label),
    availability: "AVAILABLE",
    value,
    oldestItemAgeSeconds: value > 0 ? 3600 : null,
    ageBasis: value > 0 ? "CREATED_AT" : "NOT_AVAILABLE",
  };
}

function count(id: string, label: string, value: number) {
  return { ...metric(id, label), availability: "AVAILABLE", value };
}

function flow(id: string, label: string, currentValue: number, comparisonValue: number) {
  return {
    ...metric(id, label),
    availability: "AVAILABLE",
    currentValue,
    comparisonValue,
    absoluteChange: currentValue - comparisonValue,
    percentageChange: comparisonValue === 0
      ? null
      : Math.round(((currentValue - comparisonValue) / comparisonValue) * 10_000) / 100,
  };
}

function series(
  id: string,
  label: string,
  currentValues: readonly number[],
  comparisonValues: readonly number[],
  groupBy: "DAY" | "WEEK",
) {
  const start = Date.parse("2026-08-15T22:00:00.000Z");
  const stepDays = groupBy === "DAY" ? 1 : 7;
  const currentBuckets = bucketValues(currentValues, stepDays);
  const comparisonBuckets = bucketValues(comparisonValues, stepDays);

  return {
    ...metric(id, label),
    availability: "AVAILABLE",
    points: currentBuckets.map((count, index) => ({
      bucketStart: new Date(start + index * stepDays * DAY_MS).toISOString(),
      bucketEnd: new Date(start + Math.min((index + 1) * stepDays, currentValues.length) * DAY_MS).toISOString(),
      count,
      comparisonBucketStart: new Date(start - currentValues.length * DAY_MS + index * stepDays * DAY_MS).toISOString(),
      comparisonBucketEnd: new Date(start - currentValues.length * DAY_MS + Math.min((index + 1) * stepDays, comparisonValues.length) * DAY_MS).toISOString(),
      comparisonCount: comparisonBuckets[index] ?? 0,
    })),
  };
}

function overviewEnvelope(url: URL) {
  const requestedGroupBy = url.searchParams.get("groupBy");
  const groupBy = requestedGroupBy === "WEEK" ? "WEEK" : "DAY";
  // Keep this fixture structurally strict instead of hand-waving chart data.
  // The live page fail-closes when period totals, bucket boundaries, or grouping
  // drift, so rendered QA has to exercise the same contract pressure.
  const query = {
    period: "LAST_30_DAYS",
    comparison: "PREVIOUS_PERIOD",
    groupBy,
  };
  const datasets = {
    sellerApplicationsSubmitted: {
      label: "Seller applications submitted",
      current: [1, 0, 1, 0, 2, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
      comparison: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    },
    productsCreated: {
      label: "Products created",
      current: [1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1],
      comparison: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    },
    ordersCreated: {
      label: "Orders created",
      current: [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
      comparison: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    },
    supportTicketsOpened: {
      label: "Support tickets opened",
      current: [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      comparison: Array(30).fill(0) as number[],
    },
  } as const;

  return {
    status: "success",
    data: {
      overview: {
        version: 1,
        generatedAt: "2026-09-14T05:12:00.000Z",
        timeZone: "Africa/Lusaka",
        scope: "MARKETPLACE",
        query,
        periods: {
          current: {
            start: "2026-08-15T22:00:00.000Z",
            end: "2026-09-14T22:00:00.000Z",
            endExclusive: true,
          },
          comparison: {
            start: "2026-07-16T22:00:00.000Z",
            end: "2026-08-15T22:00:00.000Z",
            endExclusive: true,
          },
        },
        queues: {
          availability: "AVAILABLE",
          permissionPolicy: "METRIC_LEVEL",
          sellerReviews: queue("sellerReviews", "Seller reviews", 2),
          productReviews: queue("productReviews", "Product reviews", 1),
          ordersNeedingAction: queue("ordersNeedingAction", "Orders needing action", 1),
          openSupportRequests: queue("openSupportRequests", "Open support requests", 1),
        },
        snapshot: {
          availability: "AVAILABLE",
          permissionPolicy: "METRIC_LEVEL",
          activeSellers: count("activeSellers", "Active sellers", 12),
          publishedProducts: count("publishedProducts", "Published products", 34),
          customers: count("customers", "Customers", 56),
          openOrders: count("openOrders", "Open orders", 3),
        },
        periodFlows: {
          availability: "AVAILABLE",
          permissionPolicy: "METRIC_LEVEL",
          sellerApplicationsSubmitted: datasetFlow("sellerApplicationsSubmitted", datasets.sellerApplicationsSubmitted),
          productsCreated: datasetFlow("productsCreated", datasets.productsCreated),
          ordersCreated: datasetFlow("ordersCreated", datasets.ordersCreated),
          supportTicketsOpened: datasetFlow("supportTicketsOpened", datasets.supportTicketsOpened),
        },
        operationalActivity: {
          id: "operationalWorkEntered",
          label: "Operational work entered",
          question: "How much new operational work entered Zogular during the selected period compared with the immediately preceding equivalent period?",
          unit: "COUNT",
          groupBy,
          availability: "AVAILABLE",
          permissionPolicy: "METRIC_LEVEL",
          series: {
            sellerApplicationsSubmitted: datasetSeries("sellerApplicationsSubmitted", datasets.sellerApplicationsSubmitted, groupBy),
            productsCreated: datasetSeries("productsCreated", datasets.productsCreated, groupBy),
            ordersCreated: datasetSeries("ordersCreated", datasets.ordersCreated, groupBy),
            supportTicketsOpened: datasetSeries("supportTicketsOpened", datasets.supportTicketsOpened, groupBy),
          },
        },
      },
    },
  };
}

function datasetFlow(
  id: string,
  dataset: { readonly label: string; readonly current: readonly number[]; readonly comparison: readonly number[] },
) {
  return flow(id, dataset.label, sum(dataset.current), sum(dataset.comparison));
}

function datasetSeries(
  id: string,
  dataset: { readonly label: string; readonly current: readonly number[]; readonly comparison: readonly number[] },
  groupBy: "DAY" | "WEEK",
) {
  return series(id, dataset.label, dataset.current, dataset.comparison, groupBy);
}

function bucketValues(values: readonly number[], step: number) {
  const buckets: number[] = [];
  for (let index = 0; index < values.length; index += step) {
    buckets.push(sum(values.slice(index, index + step)));
  }
  return buckets;
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}
