import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ApiError, resetApiClientSecurityStateForTests } from "../src/services/api";
import {
  approveVendorApplication,
  getSellerReviewSafeError,
  getVendorApplicationById,
  rejectVendorApplication,
  requestVendorApplicationInfo,
  restrictVendorApplication,
  shouldRetrySellerReviewQuery,
  suspendVendorApplication,
} from "../src/services/admin/vendor-applications";
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
});

test("SellerReviewActionDialog and ActionMenu provide distinct visual cues, auto-closing, and separated destructive actions", () => {
  const actionMenuSource = readSource("src/components/ui/action-menu.tsx");
  const dialogSource = readSource("src/features/admin-sellers/sections/SellerReviewActionDialog.tsx");
  const tableSource = readSource("src/features/admin-sellers/sections/SellersListTable.tsx");
  const gridSource = readSource("src/features/admin-sellers/sections/SellersListGrid.tsx");
  const panelSource = readSource("src/features/admin-sellers/sections/SellerActionPanel.tsx");
  const detailHookSource = readSource("src/features/admin-sellers/hooks/use-seller-detail.ts");
  const listHookSource = readSource("src/features/admin-sellers/hooks/use-sellers-list.ts");

  // ActionMenu auto-close on selection
  expect(actionMenuSource).toContain("menu?.setOpen(false)");
  expect(actionMenuSource).toContain("useActionMenu");

  // Distinct banners and theme styling
  expect(dialogSource).toContain('bannerTone === "amber"');
  expect(dialogSource).toContain('bannerTone === "rose"');
  expect(dialogSource).toContain('bannerTone === "emerald"');
  expect(dialogSource).toContain('bannerTone === "sky"');

  // Plain operator language guidance in SellerReviewActionDialog
  expect(dialogSource).toContain("This records your request and moves the application to Needs Info.");
  expect(dialogSource).toContain("This records the decision and moves the application to Rejected. Selling access remains unavailable.");

  // Strict negative delivery and technical jargon constraints on SellerReviewActionDialog
  for (const forbidden of ["notification", "email", "dispatch", "external", "configured", "queue", "resubmit", "will be notified"]) {
    expect(dialogSource).not.toContain(forbidden);
  }

  // Canonical dialog titles and confirm buttons
  expect(dialogSource).toContain('title: "Approve seller"');
  expect(dialogSource).toContain('confirmLabel: "Approve seller"');
  expect(dialogSource).toContain('title: "Grant provisional access"');
  expect(dialogSource).toContain('confirmLabel: "Grant provisional access"');
  expect(dialogSource).toContain('title: "Request information"');
  expect(dialogSource).toContain('confirmLabel: "Request information"');
  expect(dialogSource).toContain('title: "Decline application"');
  expect(dialogSource).toContain('confirmLabel: "Decline application"');
  expect(dialogSource).toContain('title: "Restrict account"');
  expect(dialogSource).toContain('confirmLabel: "Restrict account"');
  expect(dialogSource).toContain('title: "Suspend account"');
  expect(dialogSource).toContain('confirmLabel: "Suspend account"');

  // Scoped ActionMenuItem portal-safe literal semantic colors in Table and Grid
  for (const source of [tableSource, gridSource]) {
    const actionMenuItemMatches = source.match(/<ActionMenuItem[\s\S]*?<\/ActionMenuItem>/g) || [];
    expect(actionMenuItemMatches.length).toBeGreaterThan(0);
    for (const itemBlock of actionMenuItemMatches) {
      expect(itemBlock).not.toContain("var(--admin-");
    }
    expect(source).toContain("text-emerald-700");
    expect(source).toContain("text-sky-700");
    expect(source).toContain("text-amber-700");
    expect(source).toContain("text-rose-700");

    // Canonical list menu action labels
    expect(source).toContain("Approve seller");
    expect(source).toContain("Grant provisional access");
    expect(source).toContain("Request information");
    expect(source).toContain("Decline application");
    expect(source).toContain("Restrict account");
    expect(source).toContain("Suspend account");

    // Prohibited list menu action labels
    expect(source).not.toContain("Full approval");
    expect(source).not.toContain("Provisional access");
  }

  // Canonical detail action panel button labels
  expect(panelSource).toContain('label: "Approve seller"');
  expect(panelSource).toContain('label: "Grant provisional access"');
  expect(panelSource).toContain('label: "Request information"');
  expect(panelSource).toContain('label: "Decline application"');
  expect(panelSource).toContain('label: "Restrict account"');
  expect(panelSource).toContain('label: "Suspend account"');
  expect(panelSource).not.toContain('label: "Reject application"');
  expect(panelSource).not.toContain('label: "Restrict seller"');
  expect(panelSource).not.toContain('label: "Suspend seller"');

  // Canonical mutation success toasts across detail and list hooks
  for (const hookSource of [detailHookSource, listHookSource]) {
    expect(hookSource).toContain("Seller approved.");
    expect(hookSource).toContain("Provisional access granted.");
    expect(hookSource).toContain("Clarification request recorded.");
    expect(hookSource).toContain("Seller application declined.");
    expect(hookSource).toContain("Seller account restricted.");
    expect(hookSource).toContain("Seller account suspended.");

    // Prohibited competing toast strings
    expect(hookSource).not.toContain("Needs-info request sent.");
    expect(hookSource).not.toContain("Information request sent.");
    expect(hookSource).not.toContain("Seller application rejected.");
    expect(hookSource).not.toContain("Seller restricted.");
    expect(hookSource).not.toContain("Seller suspended.");
  }
});

test("requestVendorApplicationInfo and rejectVendorApplication send exact payload contracts", async () => {
  const requests: Array<{ url: URL; body: Record<string, unknown> | null }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, body });
    if (url.pathname.endsWith("/auth/csrf-token")) {
      return new Response(JSON.stringify({ status: "success", data: { csrfToken: "fixture-csrf" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify(reviewPayload()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  await requestVendorApplicationInfo("seller-1", {
    reason: "Please provide a clearer shop photo",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    adminNotes: "Internal note for request info",
  });

  const needsInfoReq = requests.find((r) => r.url.pathname.endsWith("/needs-info"))!;
  expect(needsInfoReq).toBeDefined();
  expect(needsInfoReq.body).toEqual({
    needsInfoReason: "Please provide a clearer shop photo",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    adminNotes: "Internal note for request info",
  });
  expect(needsInfoReq.body.reason).toBeUndefined();

  await rejectVendorApplication("seller-1", {
    reason: "Invalid business registration documentation",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    adminNotes: "Internal note for reject",
  });

  const rejectReq = requests.find((r) => r.url.pathname.endsWith("/reject"))!;
  expect(rejectReq).toBeDefined();
  expect(rejectReq.body).toEqual({
    rejectionReason: "Invalid business registration documentation",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    adminNotes: "Internal note for reject",
  });
  expect(rejectReq.body.reason).toBeUndefined();

  await restrictVendorApplication("seller-1", {
    reason: "Store policy violations detected",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    adminNotes: "Internal compliance review note",
  });

  const restrictReq = requests.find((r) => r.url.pathname.endsWith("/restrict"))!;
  expect(restrictReq).toBeDefined();
  expect(restrictReq.body).toEqual({
    reason: "Store policy violations detected",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    adminNotes: "Internal compliance review note",
  });
  expect(restrictReq.body.reason).toBe("Store policy violations detected");
  expect(restrictReq.body.reason).not.toBe("");
  expect(restrictReq.body.reason).not.toBe(restrictReq.body.adminNotes);

  await suspendVendorApplication("seller-1", {
    reason: "Repeated non-fulfillment of customer orders",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    adminNotes: "Escalated case #991",
  });

  const suspendReq = requests.find((r) => r.url.pathname.endsWith("/suspend"))!;
  expect(suspendReq).toBeDefined();
  expect(suspendReq.body).toEqual({
    reason: "Repeated non-fulfillment of customer orders",
    expectedUpdatedAt: "2026-08-29T09:00:00.000Z",
    adminNotes: "Escalated case #991",
  });
  expect(suspendReq.body.reason).toBe("Repeated non-fulfillment of customer orders");
  expect(suspendReq.body.reason).not.toBe("");
  expect(suspendReq.body.reason).not.toBe(suspendReq.body.adminNotes);

  const dialogSource = readSource("src/features/admin-sellers/sections/SellerReviewActionDialog.tsx");
  expect(dialogSource).toContain('reasonLabel: "Reason for restriction (visible to seller)"');
  expect(dialogSource).toContain('reasonLabel: "Reason for suspension (visible to seller)"');
  expect(dialogSource).toContain('noteLabel: "Internal admin notes (private)"');
  expect(dialogSource).toContain('noteLabel: "Internal compliance notes (private)"');
});

test("ActionMenu is portal-safe and does not leak admin CSS tokens", () => {
  const actionMenuSource = readSource("src/components/ui/action-menu.tsx");
  expect(actionMenuSource).not.toContain("var(--admin-");
  expect(actionMenuSource).toContain("bg-white");
  expect(actionMenuSource).toContain("border-zinc-200");
});

test("seller queue fail-closed 401 handling unmounts data and purges query cache", () => {
  const hookSource = readSource("src/features/admin-sellers/hooks/use-sellers-list.ts");
  const pageSource = readSource("src/app/admin/(protected)/sellers/page.tsx");

  expect(hookSource).toContain('queryClient.removeQueries({ queryKey: ["seller-list"] })');
  expect(hookSource).toContain('isUnauthenticated ? [] : data?.applications ?? []');
  expect(pageSource).toContain('error?.kind === "unauthenticated"');
  expect(pageSource).toContain("Session Expired");
  expect(pageSource).toContain("/admin/login");
});

test("VendorApplicationReviewUI retains no compatibility re-exports or dead action code", () => {
  const legacySource = readSource("src/components/admin/sellers/VendorApplicationReviewUI.tsx");
  expect(legacySource).not.toContain("SellerReviewActionDialog");
  expect(legacySource).not.toContain("ACTION_COPY");
  expect(legacySource).not.toContain("AdminSellerActionButtons");
  expect(legacySource).not.toContain("export { formatAdminDate");
  expect(legacySource).not.toContain("export { getStatusMeta");
  expect(legacySource).not.toContain("export { StatusBadge");
  expect(legacySource).not.toContain("export { getApplicationPrimaryName");
  expect(legacySource).not.toContain("export {\n  getStatusMeta");
});
