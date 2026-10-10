import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import path from "node:path";
import { ApiError, resetApiClientSecurityStateForTests } from "../src/services/api";
import {
  approveVendorApplication,
  restrictVendorApplication,
  suspendVendorApplication,
  getSellerReviewSafeError,
  getVendorApplicationById,
  shouldRetrySellerReviewQuery,
} from "../src/services/admin/vendor-applications";
import type { SellerApplicationStatus } from "../src/types/seller";
import {
  SellerReviewContractError,
  parseSellerReviewResponse,
} from "../src/features/admin-sellers/types/seller-review.contract";
import {
  adminSellerReviewQueryKey,
  sellerReviewMutationScope,
} from "../src/features/admin-sellers/hooks/use-seller-detail";
import { getSellerDocumentPresentation } from "../src/features/admin-sellers/sections/DocumentsSection";
import { getSensitiveEvidenceState } from "../src/features/admin-sellers/sections/TrustChecksSection";
import { canReturnToAdminSellerQueue } from "../src/features/admin-sellers/lib/seller-review-navigation";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const originalFetch = globalThis.fetch;
const BROWSER_PORT = 3226;
const BACKEND_PORT = 5026;
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
            permissions: [
              "access_admin_panel",
              "review_sellers",
              "manage_seller_status",
              "view_seller_sensitive_fields",
            ],
          },
        },
      }));
      return;
    }
    if (url.pathname.startsWith("/api/v1/admin/vendor-applications")) {
      response.end(JSON.stringify(reviewPayload()));
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

function reviewPayload() {
  return {
    status: "success",
    data: {
      application: {
        id: "11111111-1111-4111-8111-111111111111",
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
        history: [{
          id: "33333333-3333-4333-8333-333333333333",
          action: "INFORMATION_REQUESTED",
          previousStatus: "SUBMITTED",
          newStatus: "NEEDS_INFO",
          timestamp: "2026-08-29T08:45:00.000Z",
          actorId: "44444444-4444-4444-8444-444444444444",
          actorDisplayName: "Review Admin",
          actorRole: "SUPER_ADMIN",
          reason: "Confirm the shop address.",
        }],
      },
    },
  };
}

test("strictly parses the approved detail, capabilities, evidence, and history envelope", () => {
  const parsed = parseSellerReviewResponse(reviewPayload());
  expect(parsed.application.id).toBe("11111111-1111-4111-8111-111111111111");
  expect(parsed.review.capabilities.availableActions).toEqual(["APPROVE", "GRANT_PROVISIONAL", "REQUEST_INFO", "REJECT"]);
  expect(parsed.review.evidence.documents.PACRA_DOCUMENT).toBe(true);
  expect(parsed.review.history[0]).toMatchObject({ action: "INFORMATION_REQUESTED", actorDisplayName: "Review Admin" });
});

test("rejects malformed, expanded, incompatible, and sensitive-data-leaking detail responses atomically", () => {
  const cases = [
    { ...structuredClone(reviewPayload()), status: "ok" },
    (() => { const value = structuredClone(reviewPayload()); (value.data as Record<string, unknown>).extra = true; return value; })(),
    (() => { const value = structuredClone(reviewPayload()); value.data.review.capabilities.availableActions = ["SUSPEND"]; return value; })(),
    (() => { const value = structuredClone(reviewPayload()); value.data.review.evidence.documents.NRC_FRONT = "yes" as unknown as boolean; return value; })(),
    (() => { const value = structuredClone(reviewPayload()); value.data.review.capabilities.canViewSensitiveFields = false; return value; })(),
    (() => { const value = structuredClone(reviewPayload()); value.data.application.updatedAt = "yesterday"; return value; })(),
  ];
  for (const payload of cases) {
    expect(() => parseSellerReviewResponse(payload)).toThrow(SellerReviewContractError);
  }
});

test("accepts a permission-masked review only when every restricted field is null", () => {
  const payload = structuredClone(reviewPayload());
  payload.data.review.capabilities.canViewSensitiveFields = false;
  payload.data.review.capabilities.canManageStatus = false;
  payload.data.review.capabilities.availableActions = [];
  const application = payload.data.application as unknown as Record<string, unknown>;
  for (const field of ["nrcNumber", "pacraNumber", "tpin", "momoProvider", "momoPhone", "momoAccountName", "bankName", "bankAccountNumber", "bankAccountName", "bankBranch", "adminNotes"] as const) {
    application[field] = null;
  }
  expect(parseSellerReviewResponse(payload).review.capabilities.canViewSensitiveFields).toBe(false);
});

test("distinguishes restricted document evidence from absent evidence without exposing access", () => {
  expect(getSellerDocumentPresentation(true, false)).toBe("restricted");
  expect(getSellerDocumentPresentation(false, false)).toBe("absent");
  expect(getSellerDocumentPresentation(true, true)).toBe("available");
  expect(getSensitiveEvidenceState(true, false)).toBe("restricted");
  expect(getSensitiveEvidenceState(false, false)).toBe("missing");

  const documents = readSource("src/features/admin-sellers/sections/DocumentsSection.tsx");
  expect(documents).toContain('access === "available" ? (');
  expect(documents).toContain('access !== "available"');
  expect(documents).toContain('"Restricted access"');
  expect(documents).toContain('"Not provided"');
});

test("uses browser history only for a same-origin seller queue referrer", () => {
  const origin = "https://admin.zogular.test";
  expect(canReturnToAdminSellerQueue(`${origin}/admin/sellers?status=SUBMITTED&page=2`, origin, 3)).toBe(true);
  expect(canReturnToAdminSellerQueue(`${origin}/admin/sellers/application-1`, origin, 3)).toBe(false);
  expect(canReturnToAdminSellerQueue("https://attacker.test/admin/sellers", origin, 3)).toBe(false);
  expect(canReturnToAdminSellerQueue("//attacker.test/admin/sellers", origin, 3)).toBe(false);
  expect(canReturnToAdminSellerQueue(`${origin}/admin/sellers`, origin, 1)).toBe(false);
  expect(canReturnToAdminSellerQueue("not a URL", origin, 3)).toBe(false);

  const page = readSource("src/app/admin/(protected)/sellers/[id]/page.tsx");
  expect(page).toContain("canReturnToAdminSellerQueue(");
  expect(page).toContain("router.back()");
  expect(page).toContain("router.push(ADMIN_SELLER_QUEUE_PATH)");
  expect(page).not.toContain('<Link href="/admin/sellers"');
});

test("detail fetching consumes AbortSignal and preserves the application-scoped query identity", async () => {
  const controller = new AbortController();
  let requestHadSignal = false;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    requestHadSignal = Boolean(init?.signal);
    return new Response(JSON.stringify(reviewPayload()), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const detail = await getVendorApplicationById("seller/app", controller.signal);
  expect(detail.application.id).toBeTruthy();
  expect(requestHadSignal).toBe(true);
  expect(adminSellerReviewQueryKey("seller/app")).toEqual(["admin", "seller-applications", "detail", "seller/app"]);
  expect(sellerReviewMutationScope("seller/app")).toBe("admin-seller-review:seller/app");
});

test("decision mutations send expectedUpdatedAt with CSRF and strictly parse the returned review", async () => {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push({ url, init });
    if (url.pathname.endsWith("/auth/csrf-token")) return new Response(JSON.stringify({ status: "success", data: { csrfToken: "fixture-csrf" } }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(reviewPayload()), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  await approveVendorApplication("seller/app", { status: "APPROVED", expectedUpdatedAt: "2026-08-29T09:00:00.000Z", adminNotes: "Reviewed" });
  const request = requests.at(-1)!;
  expect(request.url.pathname).toContain("/admin/vendor-applications/seller%2Fapp/approve");
  expect(new Headers(request.init?.headers).get("X-CSRF-Token")).toBe("fixture-csrf");
  expect(JSON.parse(String(request.init?.body))).toEqual({ status: "APPROVED", expectedUpdatedAt: "2026-08-29T09:00:00.000Z", adminNotes: "Reviewed" });
});

test("restrict and suspend send seller-facing reasons separately from private notes", async () => {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requests.push({ url, init });
    if (url.pathname.endsWith("/auth/csrf-token")) return new Response(JSON.stringify({ status: "success", data: { csrfToken: "fixture-csrf" } }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(reviewPayload()), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  const payload = { reason: "Seller policy breach", adminNotes: "Internal review note", expectedUpdatedAt: "2026-08-29T09:00:00.000Z" };
  await restrictVendorApplication("seller/app", payload);
  await suspendVendorApplication("seller/app", payload);
  expect(requests.filter(({ url }) => !url.pathname.endsWith("/auth/csrf-token")).map(({ url }) => url.pathname)).toEqual([
    "/api/v1/admin/vendor-applications/seller%2Fapp/restrict",
    "/api/v1/admin/vendor-applications/seller%2Fapp/suspend",
  ]);
  for (const request of requests.filter(({ url }) => !url.pathname.endsWith("/auth/csrf-token"))) {
    expect(request.init?.method).toBe("PATCH");
    expect(JSON.parse(String(request.init?.body))).toEqual(payload);
  }
});

test("safe failures are distinct and retries remain bounded", () => {
  expect(getSellerReviewSafeError(new ApiError("raw", 401)).kind).toBe("unauthenticated");
  expect(getSellerReviewSafeError(new ApiError("raw", 403)).kind).toBe("forbidden");
  expect(getSellerReviewSafeError(new ApiError("raw", 404)).kind).toBe("not-found");
  expect(getSellerReviewSafeError(new ApiError("raw", 409)).kind).toBe("conflict");
  expect(getSellerReviewSafeError(new ApiError("raw", 408)).kind).toBe("timeout");
  expect(getSellerReviewSafeError(new SellerReviewContractError()).kind).toBe("malformed");
  expect(shouldRetrySellerReviewQuery(0, new ApiError("raw", 503))).toBe(true);
  expect(shouldRetrySellerReviewQuery(1, new ApiError("raw", 503))).toBe(false);
  expect(shouldRetrySellerReviewQuery(0, new ApiError("raw", 403))).toBe(false);
  expect(getSellerReviewSafeError(new ApiError("SECRET diagnostic", 500)).message).not.toContain("SECRET");
});

test("review source uses server actions, serialized decisions, strict cache updates, and conflict recovery", () => {
  const hook = readSource("src/features/admin-sellers/hooks/use-seller-detail.ts");
  const page = readSource("src/app/admin/(protected)/sellers/[id]/page.tsx");
  const documents = readSource("src/features/admin-sellers/sections/DocumentsSection.tsx");
  const sectionsIndex = readSource("src/features/admin-sellers/sections/index.ts");

  expect(hook).toContain("queryFn: ({ signal })");
  expect(hook).toContain("scope: { id: sellerReviewMutationScope(applicationId) }");
  expect(hook).toContain("retry: false");
  expect(hook).toContain("expectedUpdatedAt: application.updatedAt");
  expect(hook).toContain("setQueryData(queryKey, updated)");
  expect(hook).toContain("invalidateQueries({ queryKey: ADMIN_SELLER_LIST_QUERY_KEY })");
  expect(page).toContain("review.detail.review.capabilities");
  expect(page).toContain("refreshConflict");
  expect(documents).toContain("detail.review.evidence");
  expect(documents).toContain("detail.review.capabilities");
  expect(documents).not.toMatch(/nrcFrontUrl|nrcBackUrl|shopPhotoUrl|pacraDocumentUrl/);
  expect(sectionsIndex).not.toContain("FuturePlaceholders");
  expect(fs.existsSync(path.join(repoRoot, "src/features/admin-sellers/sections/FuturePlaceholders.tsx"))).toBe(false);
});

test("Step 2 list mutations include concurrency state and preserve the queue UI", () => {
  const hook = readSource("src/features/admin-sellers/hooks/use-sellers-list.ts");
  expect(hook).toContain("const expectedUpdatedAt = activeApplication.updatedAt");
  expect(hook).toContain("expectedUpdatedAt, adminNotes");
  expect(hook).toContain('safeError.kind === "conflict"');
  expect(hook).toContain("loadApplications()");
  expect(hook).toContain('reason: payload.reason ?? ""');
});

test("seller queue exposes list and grid modes and restores its scroll position", () => {
  const page = readSource("src/app/admin/(protected)/sellers/page.tsx");
  const table = readSource("src/features/admin-sellers/sections/SellersListTable.tsx");
  const grid = readSource("src/features/admin-sellers/sections/SellersListGrid.tsx");
  expect(page).toContain('useListScrollRestoration("/admin/sellers", !loading)');
  expect(page).toContain("<SellersListGrid");
  expect(page).toContain('aria-label="Seller results view"');
  expect(table).toContain('rememberListScroll("/admin/sellers")');
  expect(grid).toContain('aria-label="Seller applications grid"');
});

function reviewDetailPayload(status: SellerApplicationStatus = "SUBMITTED") {
  const base = reviewPayload();
  base.data.application.status = status;
  if (status === "APPROVED") {
    base.data.review.capabilities.availableActions = ["RESTRICT", "SUSPEND"];
  } else if (status === "PROVISIONAL") {
    base.data.review.capabilities.availableActions = ["APPROVE", "RESTRICT", "SUSPEND"];
  } else if (status === "SUBMITTED") {
    base.data.review.capabilities.availableActions = ["APPROVE", "GRANT_PROVISIONAL", "REQUEST_INFO", "REJECT"];
  } else if (status === "RESTRICTED") {
    base.data.review.capabilities.availableActions = ["SUSPEND"];
  } else {
    base.data.review.capabilities.availableActions = [];
  }
  return base;
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

async function installSellerReviewRoutes(
  page: Page,
  options: {
    initialStatus?: SellerApplicationStatus;
    forbidden?: boolean;
    conflictMutation?: boolean;
    conditionalConflict?: () => boolean;
    conditionalError?: () => boolean;
    holdMutation?: Promise<void>;
    onMutation?: (type: string, body: unknown, pathname: string) => void;
  } = {},
) {
  let currentDetail = reviewDetailPayload(options.initialStatus ?? "SUBMITTED");

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
              permissions: [
                "access_admin_panel",
                "review_sellers",
                "manage_seller_status",
                "view_seller_sensitive_fields",
              ],
            },
          },
        },
      });
    }

    if (pathname === "/auth/csrf-token") {
      return route.fulfill({ json: { data: { csrfToken: "fixture-csrf" } } });
    }

    if (pathname.match(/^\/admin\/vendor-applications\/[a-f0-9-]+$/) && route.request().method() === "GET") {
      if (options.forbidden) {
        return route.fulfill({
          status: 403,
          json: { status: "fail", message: "You do not have permission to view this application." },
        });
      }
      return route.fulfill({ json: currentDetail });
    }

    if (pathname.includes("/admin/vendor-applications/") && route.request().method() === "PATCH") {
      const actionType = pathname.split("/").pop();
      const body = JSON.parse(route.request().postData() ?? "{}");
      options.onMutation?.(actionType ?? "", body, pathname);

      if (options.holdMutation) {
        await options.holdMutation;
      }

      if (options.conditionalError?.()) {
        return route.fulfill({
          status: 422,
          json: { status: "fail", message: "Invalid submission data." },
        });
      }

      if (options.conflictMutation || options.conditionalConflict?.()) {
        return route.fulfill({
          status: 409,
          json: { status: "fail", message: "This application has been updated by another operator." },
        });
      }

      let newStatus: SellerApplicationStatus = "SUBMITTED";
      if (actionType === "restrict") newStatus = "RESTRICTED";
      else if (actionType === "suspend") newStatus = "SUSPENDED";
      else if (actionType === "needs-info") newStatus = "NEEDS_INFO";
      else if (actionType === "reject") newStatus = "REJECTED";
      else if (actionType === "approve") newStatus = ((body as { status?: string }).status as SellerApplicationStatus) ?? "APPROVED";

      currentDetail = reviewDetailPayload(newStatus);
      currentDetail.data.application.updatedAt = new Date().toISOString();

      return route.fulfill({ json: currentDetail });
    }

    return route.fulfill({ status: 404, json: { status: "fail", message: "Fixture route missing" } });
  });

  return {
    setStatus: (status: SellerApplicationStatus) => {
      currentDetail = reviewDetailPayload(status);
    },
  };
}

test.describe("Admin Seller Review Browser Acceptance", () => {
  const detailId = "11111111-1111-4111-8111-111111111111";

  test("review detail renders truthful seller evidence, verification, and documents", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerReviewRoutes(page, { initialStatus: "SUBMITTED" });
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });

    // Header & identity
    await expect(page.getByRole("heading", { name: "Ada Market" })).toBeVisible();
    await expect(page.getByText("Registered business").first()).toBeVisible();
    await expect(page.getByText("Plot 10, Cairo Road", { exact: true })).toBeVisible();
    await expect(page.getByText("+260970000001").first()).toBeVisible();

    // Evidence & trust cards
    await expect(page.getByText("Business email")).toBeVisible();
    await expect(page.getByText("Business phone")).toBeVisible();

    // Action panel capabilities for SUBMITTED application
    await expect(page.getByRole("button", { name: "Approve seller" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Grant provisional access" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Request information" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject application" })).toBeVisible();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("decision dialogs verify separate seller-facing reason and private notes for restrict and suspend", async ({ browser }) => {
    const recordedMutations: Array<{ type: string; body: Record<string, unknown>; pathname: string }> = [];
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerReviewRoutes(page, {
      initialStatus: "APPROVED",
      onMutation: (type, body, pathname) => recordedMutations.push({ type, body: body as Record<string, unknown>, pathname }),
    });
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });

    // 1. Restrict seller
    await page.getByRole("button", { name: "Restrict seller" }).first().click();
    const restrictDialog = page.getByRole("dialog", { name: "Restrict seller" });
    await expect(restrictDialog).toBeVisible();
    await expect(page.getByText("Give the seller a clear reason; private admin notes are optional.")).toBeVisible();
    await expect(page.getByLabel("Reason shown to seller")).toBeVisible();
    await expect(page.getByLabel("Private admin notes")).toBeVisible();

    // Blank reason blocks submission (form requires reason)
    await expect(restrictDialog.getByRole("button", { name: "Restrict seller" })).toBeDisabled();
    expect(recordedMutations).toHaveLength(0);

    // Provide reason and optional private admin notes
    await page.getByLabel("Reason shown to seller").fill("Terms of service policy breach");
    await page.getByLabel("Private admin notes").fill("Internal audit ref #104");
    await expect(restrictDialog.getByRole("button", { name: "Restrict seller" })).toBeEnabled();
    await restrictDialog.getByRole("button", { name: "Restrict seller" }).click();
    await expect(restrictDialog).toHaveCount(0);

    expect(recordedMutations).toHaveLength(1);
    expect(recordedMutations[0].type).toBe("restrict");
    expect(recordedMutations[0].pathname).toBe(`/admin/vendor-applications/${detailId}/restrict`);
    expect(recordedMutations[0].body).toEqual({
      reason: "Terms of service policy breach",
      expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
      adminNotes: "Internal audit ref #104",
    });

    await expect(page.getByText("Restricted", { exact: true })).toBeVisible();

    // After restrict, status is RESTRICTED so Suspend seller is available
    await page.getByRole("button", { name: "Suspend seller" }).first().click();
    const suspendDialog = page.getByRole("dialog", { name: "Suspend seller" });
    await expect(suspendDialog).toBeVisible();
    await expect(page.getByLabel("Reason shown to seller")).toBeVisible();
    await expect(page.getByLabel("Private admin notes")).toBeVisible();

    // Blank reason blocks submission
    await page.getByLabel("Reason shown to seller").clear();
    await expect(suspendDialog.getByRole("button", { name: "Suspend seller" })).toBeDisabled();

    await page.getByLabel("Reason shown to seller").fill("Suspected fraud risk");
    await page.getByLabel("Private admin notes").fill("Escalated to investigation team");
    await expect(suspendDialog.getByRole("button", { name: "Suspend seller" })).toBeEnabled();
    await suspendDialog.getByRole("button", { name: "Suspend seller" }).click();
    await expect(suspendDialog).toHaveCount(0);

    expect(recordedMutations).toHaveLength(2);
    expect(recordedMutations[1].type).toBe("suspend");
    expect(recordedMutations[1].pathname).toBe(`/admin/vendor-applications/${detailId}/suspend`);
    expect(recordedMutations[1].body).toEqual({
      reason: "Suspected fraud risk",
      expectedUpdatedAt: expect.any(String),
      adminNotes: "Escalated to investigation team",
    });

    await expect(page.getByText("Suspended", { exact: true })).toBeVisible();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("decision mutations support request info, reject, and approve", async ({ browser }) => {
    const recordedMutations: Array<{ type: string; body: Record<string, unknown>; pathname: string }> = [];
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    const routes = await installSellerReviewRoutes(page, {
      initialStatus: "SUBMITTED",
      onMutation: (type, body, pathname) => recordedMutations.push({ type, body: body as Record<string, unknown>, pathname }),
    });
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });

    // 1. Request Info
    await page.getByRole("button", { name: "Request information" }).first().click();
    const infoDialog = page.getByRole("dialog", { name: "Request more information" });
    await expect(infoDialog).toBeVisible();
    await page.getByLabel("Needs-info reason").fill("Submit valid PACRA registration document");
    await page.getByRole("button", { name: "Send needs-info request" }).click();
    await expect(infoDialog).toHaveCount(0);

    expect(recordedMutations).toHaveLength(1);
    expect(recordedMutations[0].type).toBe("needs-info");
    expect(recordedMutations[0].pathname).toBe(`/admin/vendor-applications/${detailId}/needs-info`);
    expect(recordedMutations[0].body).toEqual({
      needsInfoReason: "Submit valid PACRA registration document",
      expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    });

    await expect(page.getByText("More info needed", { exact: true })).toBeVisible();
    await expect(page.getByText("Rejected", { exact: true })).toHaveCount(0);

    // Reset status to SUBMITTED and reload page to test Reject
    routes.setStatus("SUBMITTED");
    await page.reload({ waitUntil: "networkidle" });
    recordedMutations.length = 0;

    // 2. Reject
    await page.getByRole("button", { name: "Reject application" }).first().click();
    const rejectDialog = page.getByRole("dialog", { name: "Reject application" });
    await expect(rejectDialog).toBeVisible();
    await page.getByLabel("Rejection reason").fill("Counterfeit goods history");
    await page.getByRole("button", { name: "Reject application" }).last().click();
    await expect(rejectDialog).toHaveCount(0);

    expect(recordedMutations).toHaveLength(1);
    expect(recordedMutations[0].type).toBe("reject");
    expect(recordedMutations[0].pathname).toBe(`/admin/vendor-applications/${detailId}/reject`);
    expect(recordedMutations[0].body).toEqual({
      rejectionReason: "Counterfeit goods history",
      expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    });

    await expect(page.getByText("Rejected", { exact: true })).toBeVisible();

    // Reset status to SUBMITTED and reload page to test Approve
    routes.setStatus("SUBMITTED");
    await page.reload({ waitUntil: "networkidle" });
    recordedMutations.length = 0;

    // 3. Approve
    await page.getByRole("button", { name: "Approve seller" }).first().click();
    const approveDialog = page.getByRole("dialog", { name: "Approve seller" });
    await expect(approveDialog).toBeVisible();
    await page.getByRole("button", { name: "Approve as approved" }).click();
    await expect(approveDialog).toHaveCount(0);

    expect(recordedMutations).toHaveLength(1);
    expect(recordedMutations[0].type).toBe("approve");
    expect(recordedMutations[0].pathname).toBe(`/admin/vendor-applications/${detailId}/approve`);
    expect(recordedMutations[0].body).toEqual({
      status: "APPROVED",
      expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    });

    await expect(page.getByText("Approved", { exact: true })).toBeVisible();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("review detail handles 403 forbidden and 409 conflict states honestly", async ({ browser }) => {
    // 1. 403 Forbidden
    const context403 = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const netViolations403 = await installNetworkContainment(context403);
    const page403 = await context403.newPage();
    await installSellerReviewRoutes(page403, { forbidden: true });
    await context403.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page403.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });
    await expect(page403.getByText(/You do not have permission|Access Denied|Forbidden/i)).toBeVisible();
    expect(netViolations403).toEqual([]);
    await context403.close();

    // 2. 409 Conflict
    const context409 = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const netViolations409 = await installNetworkContainment(context409);
    const page409 = await context409.newPage();
    await installSellerReviewRoutes(page409, { initialStatus: "SUBMITTED", conflictMutation: true });
    await context409.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page409.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });
    await page409.getByRole("button", { name: "Approve seller" }).first().click();
    await page409.getByRole("button", { name: "Approve as approved" }).click();

    // Verify conflict notice renders honestly
    await expect(page409.getByRole("alert").filter({ hasText: "Another reviewer changed this application" })).toBeVisible();
    await expect(page409.getByText("Another reviewer changed this application. Refresh before taking another action.")).toBeVisible();
    expect(netViolations409).toEqual([]);
    await context409.close();
  });

  test("seller review detail remains horizontally contained across approved viewports", async ({ browser }, testInfo) => {
    test.setTimeout(90_000);
    for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
      const context = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 900 } });
      const networkViolations = await installNetworkContainment(context);
      const page = await context.newPage();
      await installSellerReviewRoutes(page);
      await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

      await page.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      await page.screenshot({ path: testInfo.outputPath(`seller-review-${width}.png`) });

      // Open decision dialog
      const approveBtn = page.getByRole("button", { name: "Approve seller" }).filter({ visible: true });
      await expect(approveBtn).toBeVisible();
      await approveBtn.click();

      const dialog = page.getByRole("dialog", { name: "Approve seller" });
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

      await page.screenshot({ path: testInfo.outputPath(`seller-review-dialog-${width}.png`) });

      // Escape to close
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(approveBtn).toBeFocused();

      // Repeated open/close and Cancel button dismissal with focus return
      await approveBtn.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
      await expect(approveBtn).toBeFocused();

      expect(networkViolations).toEqual([]);
      await context.close();
    }
  });

  test("seller review action dialog falls back to queue return button when action button is hidden or removed", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerReviewRoutes(page, { initialStatus: "SUBMITTED" });
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });

    const approveBtn = page.getByRole("button", { name: "Approve seller" }).filter({ visible: true });
    await expect(approveBtn).toBeVisible();

    // 1. Hidden trigger fallback
    await approveBtn.click();
    const dialog = page.getByRole("dialog", { name: "Approve seller" });
    await expect(dialog).toBeVisible();

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Approve seller"));
      if (btn) btn.style.display = "none";
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    const backBtn = page.locator("#seller-review-back-button");
    await expect(backBtn).toBeFocused();

    // Restore trigger visibility
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Approve seller"));
      if (btn) btn.style.display = "";
    });
    await expect(approveBtn).toBeVisible();

    // 2. Removed trigger fallback
    await approveBtn.click();
    await expect(dialog).toBeVisible();

    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes("Approve seller"));
      if (btn) btn.remove();
    });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(backBtn).toBeFocused();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("seller review action dialog blocks dismissal during pending mutation and recovers on release", async ({ browser }) => {
    let releaseMutation: (() => void) | null = null;
    const holdMutation = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    const recordedMutations: Array<{ type: string; body: unknown; pathname: string }> = [];

    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerReviewRoutes(page, {
      initialStatus: "SUBMITTED",
      holdMutation,
      onMutation: (type, body, pathname) => recordedMutations.push({ type, body, pathname }),
    });
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });

    const approveBtn = page.getByRole("button", { name: "Approve seller" }).filter({ visible: true });
    await approveBtn.click();

    const dialog = page.getByRole("dialog", { name: "Approve seller" });
    await expect(dialog).toBeVisible();

    const confirmBtn = dialog.getByRole("button", { name: "Approve as approved" });
    const cancelBtn = dialog.getByRole("button", { name: "Cancel" });

    // Submit mutation
    await confirmBtn.click();
    await expect.poll(() => recordedMutations.length).toBe(1);

    // 1. Assert exactly one request sent
    expect(recordedMutations).toHaveLength(1);
    expect(recordedMutations[0].type).toBe("approve");

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

    // 6. Safe closure after release and correct resulting status
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await expect(page.locator("#seller-review-back-button")).toBeFocused();

    expect(networkViolations).toEqual([]);
    await context.close();
  });

  test("seller decision form preserves typed fields on failed mutation and clears them after success or deliberate dismissal", async ({ browser }) => {
    let failNextMutation = true;
    const recordedMutations: Array<{ type: string; body: Record<string, unknown>; pathname: string }> = [];

    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });
    const networkViolations = await installNetworkContainment(context);
    const page = await context.newPage();
    await installSellerReviewRoutes(page, {
      initialStatus: "APPROVED",
      onMutation: (type, body, pathname) => {
        recordedMutations.push({ type, body: body as Record<string, unknown>, pathname });
      },
      conditionalError: () => failNextMutation,
    });
    await context.addCookies([{ name: "zogular_admin_session", value: "fixture-token", domain: "127.0.0.1", path: "/" }]);

    await page.goto(`${BROWSER_ORIGIN}/admin/sellers/${detailId}`, { waitUntil: "networkidle" });

    // Verify initial status is APPROVED
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();

    // 1. Open "Restrict seller" dialog and fill both seller-facing reason and private adminNotes
    const restrictBtn = page.getByRole("button", { name: "Restrict seller" }).filter({ visible: true }).first();
    await restrictBtn.click();
    const restrictDialog = page.getByRole("dialog", { name: "Restrict seller" });
    await expect(restrictDialog).toBeVisible();

    const reasonInput = page.getByLabel("Reason shown to seller");
    const notesInput = page.getByLabel("Private admin notes");
    await reasonInput.fill("Policy violation regarding restricted listings");
    await notesInput.fill("Internal note: verified by trust team");

    // 2. Submit mutation that fails synthetically (422) leaving dialog open
    const confirmRestrictBtn = restrictDialog.getByRole("button", { name: "Restrict seller" });
    await confirmRestrictBtn.click();

    // Verify dialog remains open AND BOTH values remain
    await expect(restrictDialog).toBeVisible();
    await expect(reasonInput).toHaveValue("Policy violation regarding restricted listings");
    await expect(notesInput).toHaveValue("Internal note: verified by trust team");

    // 3. Deliberate dismissal via Cancel button
    await restrictDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(restrictDialog).toHaveCount(0);

    // 4. Reopen Restrict seller: verify BOTH fields are EMPTY after deliberate dismissal
    await restrictBtn.click();
    await expect(restrictDialog).toBeVisible();
    await expect(page.getByLabel("Reason shown to seller")).toHaveValue("");
    await expect(page.getByLabel("Private admin notes")).toHaveValue("");

    // 5. Fill both fields and submit successfully
    failNextMutation = false;
    await page.getByLabel("Reason shown to seller").fill("Prohibited goods discovered in catalog");
    await page.getByLabel("Private admin notes").fill("Internal note: escalated to compliance");
    await confirmRestrictBtn.click();
    await expect(restrictDialog).toHaveCount(0);
    await expect(page.getByText("Restricted", { exact: true })).toBeVisible();

    // Verify mutation payload contained both reason and adminNotes
    expect(recordedMutations).toHaveLength(2);
    expect(recordedMutations[1].type).toBe("restrict");
    expect(recordedMutations[1].body).toMatchObject({
      reason: "Prohibited goods discovered in catalog",
      adminNotes: "Internal note: escalated to compliance",
    });

    // 6. In the SAME mounted page (no reload/navigation/remount), open Suspend seller
    const suspendBtn = page.getByRole("button", { name: "Suspend seller" }).filter({ visible: true }).first();
    await suspendBtn.click();
    const suspendDialog = page.getByRole("dialog", { name: "Suspend seller" });
    await expect(suspendDialog).toBeVisible();

    // 7. Assert BOTH fields start completely empty in the subsequent decision
    await expect(page.getByLabel("Reason shown to seller")).toHaveValue("");
    await expect(page.getByLabel("Private admin notes")).toHaveValue("");
    await suspendDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(suspendDialog).toHaveCount(0);

    expect(networkViolations).toEqual([]);
    await context.close();
  });
});
