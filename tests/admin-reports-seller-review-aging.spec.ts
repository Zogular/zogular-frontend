import { expect, test } from "@playwright/test";
import { QueryClient } from "@tanstack/react-query";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import {
  ADMIN_SELLER_REVIEW_AGING_CONTRACT_VERSION,
  AdminSellerReviewAgingContractError,
  SELLER_REVIEW_AGING_CLOCK,
  SELLER_REVIEW_AGING_SCOPE,
  parseAdminSellerReviewAgingResponse,
} from "../src/features/admin-reports/lib/seller-review-aging-contract";
import {
  purgeSellerReviewAging,
  sellerReviewAgingAuthority,
  sellerReviewAgingKey,
} from "../src/features/admin-reports/lib/reports-cache";
import type { AdminIdentity } from "../src/services/admin/session";

const FRONTEND_PORT = 3322;
const BACKEND_PORT = 3323;
const FRONTEND_ORIGIN = `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_ORIGIN = `http://127.0.0.1:${BACKEND_PORT}`;

const execIdentity: AdminIdentity = {
  id: "exec-1",
  name: "Executive Operator",
  email: "exec@example.test",
  sessionStatus: "authenticated",
  claims: {
    role: "EXECUTIVE",
    permissions: ["access_admin_panel", "view_all_reports", "review_sellers"],
    authStrength: "password",
    issuedAt: "2026-11-27T10:00:00.000Z",
  },
};

function validReportPayload(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      report: {
        contractVersion: ADMIN_SELLER_REVIEW_AGING_CONTRACT_VERSION,
        asOf: "2026-11-27T12:00:00.000Z",
        scope: SELLER_REVIEW_AGING_SCOPE,
        clock: SELLER_REVIEW_AGING_CLOCK,
        total: 10,
        bands: {
          under24Hours: 3,
          hours24To72: 2,
          hours72To168: 2,
          over168Hours: 1,
        },
        ageUnavailable: 2,
        ...overrides,
      },
    },
  };
}

test("strict report parser validates contract and rejects malformed or inconsistent totals", () => {
  const parsed = parseAdminSellerReviewAgingResponse(validReportPayload());
  expect(parsed.total).toBe(10);
  expect(parsed.ageUnavailable).toBe(2);

  for (const invalid of [
    {},
    { status: "success", data: {} },
    validReportPayload({ total: 99 }),
    validReportPayload({ ageUnavailable: -1 }),
    validReportPayload({ asOf: "not-a-date" }),
    validReportPayload({ extraField: "forbidden" }),
  ]) {
    expect(() => parseAdminSellerReviewAgingResponse(invalid)).toThrow(
      AdminSellerReviewAgingContractError,
    );
  }
});

test("sellerReviewAgingAuthority requires access_admin_panel, view_all_reports, and review_sellers", () => {
  expect(sellerReviewAgingAuthority(execIdentity)).not.toBeNull();
  expect(sellerReviewAgingAuthority(null)).toBeNull();
  expect(sellerReviewAgingAuthority({ ...execIdentity, sessionStatus: "expired" })).toBeNull();
  expect(
    sellerReviewAgingAuthority({
      ...execIdentity,
      claims: { ...execIdentity.claims, permissions: ["access_admin_panel", "view_all_reports"] },
    }),
  ).toBeNull();
  expect(
    sellerReviewAgingAuthority({
      ...execIdentity,
      claims: { ...execIdentity.claims, permissions: ["access_admin_panel", "review_sellers"] },
    }),
  ).toBeNull();
});

test("purgeSellerReviewAging cancels in-flight query and clears cached report", async () => {
  const client = new QueryClient();
  const authority = sellerReviewAgingAuthority(execIdentity)!;
  const key = sellerReviewAgingKey(authority);
  let release!: (value: number) => void;
  let aborted = false;
  const req = client
    .fetchQuery({
      queryKey: key,
      queryFn: ({ signal }) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return new Promise<number>((resolve) => {
          release = resolve;
        });
      },
    })
    .catch(() => undefined);

  purgeSellerReviewAging(client, authority);
  expect(aborted).toBe(true);
  release(1);
  await req;
  expect(client.getQueryCache().findAll({ queryKey: ["admin-reports-seller-review-aging", authority] })).toHaveLength(0);
  client.clear();
});

async function checkPort(port: number) {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      probe.close((err) => (err ? reject(err) : resolve()));
    });
  });
}

const runBrowserSuite = Boolean(process.env.ADMIN_REPORTS_BASE_URL);

test.describe("admin reports operational seller-review aging browser acceptance", () => {
  test.skip(!runBrowserSuite, "ADMIN_REPORTS_BASE_URL is required for installed-Chrome acceptance.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ serviceWorkers: "block" });

  let backendServer: http.Server | null = null;
  let frontendProcess: ChildProcess | null = null;
  let reportMode: "valid" | "zero" | "error503" | "forbidden403" = "valid";
  let currentPermissions: string[] = ["access_admin_panel", "view_all_reports", "review_sellers"];
  let reportRequests = 0;
  let vendorAppRequests = 0;

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(120_000);
    await checkPort(FRONTEND_PORT);
    await checkPort(BACKEND_PORT);

    backendServer = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", BACKEND_ORIGIN);
      res.setHeader("content-type", "application/json");

      if (url.pathname === "/api/v1/auth/csrf-token") {
        res.end(JSON.stringify({ csrfToken: "fixture-csrf" }));
        return;
      }
      if (url.pathname === "/api/v1/auth/login" && req.method === "POST") {
        res.end(
          JSON.stringify({
            status: "success",
            data: {
              accessToken: "fixture-admin-token",
              user: {
                id: "admin-reports-operator",
                name: "Reports Admin",
                email: "reports.admin@example.test",
                role: "SUPER_ADMIN",
                permissions: currentPermissions,
                authStrength: "password",
              },
            },
          }),
        );
        return;
      }
      if (url.pathname === "/api/v1/user/me") {
        if (req.headers.authorization !== "Bearer fixture-admin-token") {
          res.writeHead(401).end(JSON.stringify({ status: "fail" }));
          return;
        }
        res.end(
          JSON.stringify({
            status: "success",
            data: {
              user: {
                id: "admin-reports-operator",
                name: "Reports Admin",
                email: "reports.admin@example.test",
                role: "SUPER_ADMIN",
                permissions: currentPermissions,
                authStrength: "password",
              },
            },
          }),
        );
        return;
      }
      if (url.pathname === "/api/v1/admin/vendor-applications") {
        vendorAppRequests += 1;
        res.end(JSON.stringify({ status: "success", data: { applications: [] } }));
        return;
      }
      if (url.pathname === "/api/v1/admin/reports/seller-review-aging") {
        reportRequests += 1;
        if (reportMode === "error503") {
          res.writeHead(503).end(
            JSON.stringify({ status: "error", message: "Seller review aging report is temporarily unavailable." }),
          );
          return;
        }
        if (reportMode === "forbidden403") {
          res.writeHead(403).end(JSON.stringify({ status: "fail", message: "Forbidden" }));
          return;
        }
        if (reportMode === "zero") {
          res.end(
            JSON.stringify(
              validReportPayload({
                total: 0,
                bands: { under24Hours: 0, hours24To72: 0, hours72To168: 0, over168Hours: 0 },
                ageUnavailable: 0,
              }),
            ),
          );
          return;
        }
        res.end(JSON.stringify(validReportPayload()));
        return;
      }

      res.writeHead(404).end(JSON.stringify({ status: "fail", message: "Not found" }));
    });

    await new Promise<void>((resolve, reject) => {
      backendServer!.once("error", reject);
      backendServer!.listen(BACKEND_PORT, "127.0.0.1", () => resolve());
    });

    frontendProcess = spawn(
      process.execPath,
      [path.resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(FRONTEND_PORT)],
      {
        env: {
          ...process.env,
          INTERNAL_BACKEND_URL: `${BACKEND_ORIGIN}/api/v1`,
          NEXT_PUBLIC_API_URL: `${BACKEND_ORIGIN}/api/v1`,
        },
        stdio: "ignore",
      },
    );

    for (let i = 0; i < 40; i += 1) {
      try {
        const res = await fetch(`${FRONTEND_ORIGIN}/admin/login`);
        if (res.ok) break;
      } catch {
        // wait
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  test.afterAll(async () => {
    if (frontendProcess && !frontendProcess.killed) {
      frontendProcess.kill("SIGTERM");
    }
    if (backendServer) {
      await new Promise<void>((resolve) => backendServer!.close(() => resolve()));
    }
  });

  test.beforeEach(async ({ page }) => {
    reportMode = "valid";
    currentPermissions = ["access_admin_panel", "view_all_reports", "review_sellers"];
    reportRequests = 0;
    vendorAppRequests = 0;
    await page.addInitScript(() => Reflect.deleteProperty(Navigator.prototype, "serviceWorker"));
  });

  async function signInAsAdmin(page: import("@playwright/test").Page) {
    await page.context().clearCookies();
    await page.goto(`${FRONTEND_ORIGIN}/admin/login`, { waitUntil: "networkidle" });
    await page.getByLabel(/email/i).fill("reports.admin@example.test");
    await page.getByRole("textbox", { name: "Password" }).fill("FixturePassword123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/admin") && url.pathname !== "/admin/login");
  }

  for (const vp of [
    { name: "320x568", width: 320, height: 568 },
    { name: "390x844", width: 390, height: 844 },
    { name: "1440x900", width: 1440, height: 900 },
  ] as const) {
    test(`renders operational aging table and Financial unavailable notice cleanly at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await signInAsAdmin(page);
      await page.goto(`${FRONTEND_ORIGIN}/admin/reports`, { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { name: "Operational Reports" })).toBeVisible();
      await expect(page.getByText("Under 24 hours", { exact: true })).toBeVisible();
      await expect(page.getByText("24 to 72 hours", { exact: true })).toBeVisible();
      await expect(page.getByText("72 to 168 hours", { exact: true })).toBeVisible();
      await expect(page.getByText("168 hours or more", { exact: true })).toBeVisible();
      await expect(page.getByText("Age unavailable", { exact: true })).toBeVisible();
      await expect(page.getByText("Total awaiting review", { exact: true })).toBeVisible();
      await expect(page.getByText(/Africa\/Lusaka/)).toBeVisible();
      await expect(page.getByText("Financial reporting unavailable")).toBeVisible();
      await expect(page.getByText(/overdue|sla/i)).toHaveCount(0);

      expect(reportRequests).toBe(1);
      expect(vendorAppRequests).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      await page.screenshot({
        path: path.resolve(`output/playwright/admin-reports/seller-review-aging-viewport-${vp.name}.png`),
        fullPage: false,
      });
    });
  }

  test("handles zero queue, 503 retry recovery, missing review_sellers zero-fetch, and terminal 403 purge", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsAdmin(page);

    const totalCell = page.getByRole("row", { name: /Total awaiting review/ }).getByRole("cell");
    const staleNotice = page.getByText(/Showing last confirmed snapshot\./);
    const refreshButton = page.getByRole("button", { name: "Refresh" });

    reportMode = "zero";
    await page.goto(`${FRONTEND_ORIGIN}/admin/reports`, { waitUntil: "networkidle" });
    await expect(page.getByText("No seller applications are currently awaiting review.")).toBeVisible();
    await expect(totalCell).toHaveText("0");

    reportMode = "error503";
    await refreshButton.click();
    await expect(page.getByText(/temporarily unavailable/i)).toBeVisible();
    await expect(staleNotice).toBeVisible();
    await expect(totalCell).toHaveText("0");

    reportMode = "valid";
    await refreshButton.click();
    await expect(totalCell).toHaveText("10");
    await expect(staleNotice).toHaveCount(0);
    await expect(page.getByText("No seller applications are currently awaiting review.")).toHaveCount(0);

    // Terminal 403 purges cached data fail-closed and disables refresh with no extra requests
    reportMode = "forbidden403";
    await refreshButton.click();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(refreshButton).toBeDisabled();
    const requestsAfter403 = reportRequests;
    await page.waitForTimeout(250);
    expect(reportRequests).toBe(requestsAfter403);

    // Operator with view_all_reports but without review_sellers makes 0 report requests
    currentPermissions = ["access_admin_panel", "view_all_reports"];
    reportRequests = 0;
    await signInAsAdmin(page);
    await page.goto(`${FRONTEND_ORIGIN}/admin/reports`, { waitUntil: "networkidle" });
    await expect(page.getByText("Seller review aging report is unavailable for your current permissions.")).toBeVisible();
    expect(reportRequests).toBe(0);
  });
});
