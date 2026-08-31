import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ApiError, resetApiClientSecurityStateForTests } from "../src/services/api";
import {
  AdminDashboardSummaryContractError,
  parseAdminDashboardSummaryResponse,
} from "../src/features/admin-overview/lib/dashboard-summary";
import {
  getNeedsAttentionItems,
  isAdminOverviewEmpty,
} from "../src/features/admin-overview/lib/overview-presentation";
import {
  INITIAL_ADMIN_OVERVIEW_STATE,
  reduceAdminOverviewState,
} from "../src/features/admin-overview/lib/overview-state";
import {
  fetchAdminDashboardSummary,
  getAdminOverviewSafeError,
} from "../src/services/admin/dashboard";
import type { AdminIdentity } from "../src/services/admin/session";
import type {
  AdminDashboardMetric,
  AdminDashboardSummary,
} from "../src/features/admin-overview/types/dashboard-summary";

test.describe.configure({ mode: "serial" });

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClientSecurityStateForTests();
});

type Dimension =
  | "APPLICATION_STATUS"
  | "PRODUCT_STATUS"
  | "ORDER_STATUS"
  | "TICKET_STATUS"
  | "ROLE";

function metric(dimension: Dimension, count: number): AdminDashboardMetric {
  return {
    availability: "AVAILABLE",
    count,
    definition: { dimension, values: [`${dimension}_VALUE`] },
  } as const;
}

function unavailable(
  dimension: Dimension,
  reason: "PERMISSION_REQUIRED" | "DATA_SOURCE_UNAVAILABLE",
): AdminDashboardMetric {
  return {
    availability: "UNAVAILABLE",
    reason,
    definition: { dimension, values: [`${dimension}_VALUE`] },
  } as const;
}

function fixturePayload(): {
  status: "success";
  data: { summary: AdminDashboardSummary };
} {
  return {
    status: "success",
    data: {
      summary: {
        version: 1,
        generatedAt: "2026-08-29T08:30:00.000Z",
        priorities: {
          availability: "AVAILABLE",
          sellerReviews: metric("APPLICATION_STATUS", 4),
          productReviews: metric("PRODUCT_STATUS", 9),
          ordersNeedingAction: metric("ORDER_STATUS", 6),
          openSupportRequests: metric("TICKET_STATUS", 2),
        },
        snapshot: {
          availability: "AVAILABLE",
          activeSellers: metric("APPLICATION_STATUS", 18),
          publishedProducts: metric("PRODUCT_STATUS", 73),
          customers: metric("ROLE", 124),
          openOrders: metric("ORDER_STATUS", 6),
        },
      },
    },
  };
}

const fullIdentity: AdminIdentity = {
  id: "admin-1",
  name: "Admin One",
  email: "admin@example.test",
  claims: {
    role: "super_admin",
    permissions: [
      "view_dashboard",
      "view_sellers",
      "view_products",
      "view_orders",
      "view_support_tickets",
    ],
    authStrength: "password",
    issuedAt: "2026-08-29T08:00:00.000Z",
  },
  sessionStatus: "authenticated",
};

test("parses the exact versioned summary envelope and calls one dedicated endpoint", async () => {
  const payload = fixturePayload();
  const calls: URL[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const result = await fetchAdminDashboardSummary();

  expect(result).toEqual(payload.data.summary);
  expect(calls).toHaveLength(1);
  expect(calls[0].pathname).toBe("/api/v1/admin/dashboard/summary");
});

test("uses the shared auth refresh path before retrying an expired summary request", async () => {
  const payload = fixturePayload();
  const calls: string[] = [];
  let summaryAttempts = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url ?? String(input));
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    calls.push(`${method} ${url.pathname}`);

    if (url.pathname === "/api/v1/admin/dashboard/summary") {
      summaryAttempts += 1;
      if (summaryAttempts === 1) {
        return new Response(JSON.stringify({ status: "error" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/api/v1/auth/csrf-token") {
      return new Response(
        JSON.stringify({ status: "success", data: { csrfToken: "test-csrf-token" } }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }

    if (url.pathname === "/api/v1/auth/refresh-token") {
      return new Response(JSON.stringify({ status: "success" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  }) as typeof fetch;

  await expect(fetchAdminDashboardSummary()).resolves.toEqual(payload.data.summary);
  expect(calls).toEqual([
    "GET /api/v1/admin/dashboard/summary",
    "GET /api/v1/auth/csrf-token",
    "POST /api/v1/auth/refresh-token",
    "GET /api/v1/admin/dashboard/summary",
  ]);
});

test("rejects malformed, partial-looking, and internally inconsistent responses atomically", () => {
  const cases: unknown[] = [
    fixturePayload().data.summary,
    { ...fixturePayload(), status: "ok" },
    { ...fixturePayload(), data: { summary: { ...fixturePayload().data.summary, version: 2 } } },
    { ...fixturePayload(), data: { summary: { ...fixturePayload().data.summary, generatedAt: "not-a-date" } } },
    {
      ...fixturePayload(),
      data: {
        summary: {
          ...fixturePayload().data.summary,
          priorities: {
            ...fixturePayload().data.summary.priorities,
            sellerReviews: metric("APPLICATION_STATUS", -1),
          },
        },
      },
    },
    {
      ...fixturePayload(),
      data: {
        summary: {
          ...fixturePayload().data.summary,
          priorities: {
            ...fixturePayload().data.summary.priorities,
            sellerReviews: {
              ...metric("APPLICATION_STATUS", 1),
              definition: { dimension: "ROLE", values: ["CUSTOMER"] },
            },
          },
        },
      },
    },
    {
      ...fixturePayload(),
      data: {
        summary: {
          ...fixturePayload().data.summary,
          priorities: {
            ...fixturePayload().data.summary.priorities,
            availability: "PARTIAL",
          },
        },
      },
    },
    {
      ...fixturePayload(),
      data: {
        summary: {
          ...fixturePayload().data.summary,
          snapshot: {
            ...fixturePayload().data.summary.snapshot,
            customers: {
              ...unavailable("ROLE", "PERMISSION_REQUIRED"),
              count: 0,
            },
          },
        },
      },
    },
  ];

  for (const payload of cases) {
    expect(() => parseAdminDashboardSummaryResponse(payload)).toThrow(
      AdminDashboardSummaryContractError,
    );
  }
});

test("keeps permission and data unavailability distinct from a genuine zero", () => {
  const payload = fixturePayload();
  payload.data.summary.priorities = {
    ...payload.data.summary.priorities,
    availability: "PARTIAL",
    sellerReviews: unavailable("APPLICATION_STATUS", "PERMISSION_REQUIRED"),
    productReviews: unavailable("PRODUCT_STATUS", "DATA_SOURCE_UNAVAILABLE"),
    ordersNeedingAction: metric("ORDER_STATUS", 0),
  };
  payload.data.summary.snapshot = {
    ...payload.data.summary.snapshot,
    availability: "PARTIAL",
    customers: unavailable("ROLE", "PERMISSION_REQUIRED"),
  };

  const result = parseAdminDashboardSummaryResponse(payload);
  expect(result.priorities.sellerReviews).toEqual(
    unavailable("APPLICATION_STATUS", "PERMISSION_REQUIRED"),
  );
  expect(result.priorities.productReviews).toEqual(
    unavailable("PRODUCT_STATUS", "DATA_SOURCE_UNAVAILABLE"),
  );
  expect(result.priorities.ordersNeedingAction).toMatchObject({
    availability: "AVAILABLE",
    count: 0,
  });
  expect(isAdminOverviewEmpty(result)).toBe(false);
});

test("recognizes a genuine all-zero response without treating unavailable metrics as empty", () => {
  const payload = fixturePayload();
  payload.data.summary.priorities = {
    availability: "AVAILABLE",
    sellerReviews: metric("APPLICATION_STATUS", 0),
    productReviews: metric("PRODUCT_STATUS", 0),
    ordersNeedingAction: metric("ORDER_STATUS", 0),
    openSupportRequests: metric("TICKET_STATUS", 0),
  };
  payload.data.summary.snapshot = {
    availability: "AVAILABLE",
    activeSellers: metric("APPLICATION_STATUS", 0),
    publishedProducts: metric("PRODUCT_STATUS", 0),
    customers: metric("ROLE", 0),
    openOrders: metric("ORDER_STATUS", 0),
  };

  expect(isAdminOverviewEmpty(parseAdminDashboardSummaryResponse(payload))).toBe(true);

  payload.data.summary.snapshot = {
    ...payload.data.summary.snapshot,
    availability: "PARTIAL",
    customers: unavailable("ROLE", "PERMISSION_REQUIRED"),
  };
  expect(isAdminOverviewEmpty(parseAdminDashboardSummaryResponse(payload))).toBe(false);
});

test("ranks only available authorized priority links", () => {
  const summary = parseAdminDashboardSummaryResponse(fixturePayload());
  expect(getNeedsAttentionItems(summary, fullIdentity).map((item) => item.key)).toEqual([
    "productReviews",
    "ordersNeedingAction",
    "sellerReviews",
    "openSupportRequests",
  ]);

  const limitedIdentity: AdminIdentity = {
    ...fullIdentity,
    claims: { ...fullIdentity.claims, permissions: ["view_dashboard", "view_orders"] },
  };
  expect(getNeedsAttentionItems(summary, limitedIdentity).map((item) => item.key)).toEqual([
    "ordersNeedingAction",
  ]);
});

test("refresh failure preserves last verified values and stale responses cannot replace newer state", () => {
  const first = parseAdminDashboardSummaryResponse(fixturePayload());
  const refreshedPayload = fixturePayload();
  refreshedPayload.data.summary.priorities.productReviews = metric("PRODUCT_STATUS", 12);
  const refreshed = parseAdminDashboardSummaryResponse(refreshedPayload);
  const error = getAdminOverviewSafeError(new ApiError("private database detail", 503));

  let state = reduceAdminOverviewState(INITIAL_ADMIN_OVERVIEW_STATE, {
    type: "request-started",
    requestId: 1,
    refresh: false,
  });
  state = reduceAdminOverviewState(state, {
    type: "request-succeeded",
    requestId: 1,
    data: first,
    refresh: false,
  });
  state = reduceAdminOverviewState(state, {
    type: "request-started",
    requestId: 2,
    refresh: true,
  });
  state = reduceAdminOverviewState(state, {
    type: "request-failed",
    requestId: 2,
    error,
    refresh: true,
  });
  expect(state.data).toBe(first);
  expect(state.error).toEqual(error);
  expect(state.liveMessage).not.toContain("private database detail");

  const staleAttempt = reduceAdminOverviewState(state, {
    type: "request-succeeded",
    requestId: 1,
    data: refreshed,
    refresh: true,
  });
  expect(staleAttempt).toBe(state);
});

test("safe overview failures never expose raw response details", () => {
  const raw = "database host internal.example and stack trace";
  for (const error of [
    new ApiError(raw, 401, { raw }),
    new ApiError(raw, 403, { raw }),
    new ApiError(raw, 408, { raw }),
    new ApiError(raw, 503, { raw }),
    new AdminDashboardSummaryContractError(),
  ]) {
    const safe = getAdminOverviewSafeError(error);
    expect(safe.message).not.toContain(raw);
    expect(safe.message).not.toMatch(/stack trace|internal\.example/i);
  }
});

test("overview and shell use the approved routes, labels, motion, and accessible controls", () => {
  const pageSource = readSource("src/app/admin/(protected)/dashboard/page.tsx");
  const shellSource = readSource("src/components/admin/AdminShell.tsx");
  const paletteSource = readSource("src/components/admin/admin-theme.module.css");
  const capabilitySource = readSource("src/features/admin-platform/config/capability-registry.ts");
  const shellNavigationSource = [
    "src/features/admin-shell/components/AdminNavigation.tsx",
    "src/features/admin-shell/components/AdminSidebar.tsx",
    "src/features/admin-shell/components/AdminHeader.tsx",
  ].map(readSource).join("\n");
  const overviewSource = [
    "src/features/admin-overview/components/AdminOverview.tsx",
    "src/features/admin-overview/components/OverviewHeader.tsx",
    "src/features/admin-overview/components/OverviewStates.tsx",
    "src/features/admin-overview/components/PrioritySummary.tsx",
    "src/features/admin-overview/components/NeedsAttention.tsx",
    "src/features/admin-overview/components/MarketplaceSnapshot.tsx",
  ].map(readSource).join("\n");

  expect(pageSource).toContain("<AdminOverview");
  expect(pageSource).not.toMatch(/getVendorApplications|adminOrdersApi|adminProductsApi|adminSupportApi/);
  for (const [label, href] of [
    ["Overview", "/admin/dashboard"],
    ["Sellers", "/admin/sellers"],
    ["Customers", "/admin/buyers"],
    ["Products and Moderation", "/admin/products"],
    ["Categories and Attributes", "/admin/categories"],
    ["Orders and Fulfillment", "/admin/orders"],
    ["Support", "/admin/support"],
    ["Admins, Teams, and Roles", "/admin/access"],
  ]) {
    expect(capabilitySource).toContain(`label: "${label}"`);
    expect(capabilitySource).toContain(`currentRoute: "${href}"`);
  }
  expect(shellSource).toContain("<Sheet");
  expect(shellSource).toContain("buildAdminShellNavigation(identity)");
  expect(shellSource).not.toContain("ADMIN_NAV_ITEMS");
  expect(shellNavigationSource).toContain("prefetch={false}");
  expect(shellNavigationSource).toContain('aria-current={active ? "page" : undefined}');
  expect(shellNavigationSource).toContain('aria-label="Open admin menu"');
  expect(shellNavigationSource).toContain("size-11");
  expect(shellSource).toContain('const ADMIN_DESKTOP_MEDIA_QUERY = "(min-width: 64rem)"');
  expect(shellSource).toContain('desktopViewport.addEventListener("change", closeMobileMenuAtDesktop)');
  expect(shellSource).toContain('desktopViewport.removeEventListener("change", closeMobileMenuAtDesktop)');
  expect(shellSource).toContain('style={{ width: "min(19rem, calc(100vw - 1rem))", maxWidth: "none" }}');
  expect(shellSource).toContain('data-testid="admin-shell-root"');
  expect(shellSource).toContain('data-testid="admin-desktop-sidebar"');
  expect(shellSource).toContain('data-testid="admin-main-scroll"');
  expect(shellSource).toContain("theme.mobileDrawer");
  expect(paletteSource).toContain('data-slot="sheet-overlay"');
  expect(paletteSource).toContain(":global(body):has(.mobileDrawer)");
  expect(paletteSource).toContain("backdrop-filter: none");
  expect(paletteSource).toContain("will-change: transform, opacity");
  expect(overviewSource).toContain('from "motion/react"');
  expect(overviewSource).toContain("useReducedMotion()");
  expect(overviewSource).toContain('aria-live="polite"');
  expect(overviewSource).toContain('role="tooltip"');
  expect(overviewSource).toContain("prefetch={false}");
  for (const [token, value] of [
    ["canvas-warm", "#efe5d6"],
    ["canvas-depth", "#e4d4bf"],
    ["surface-cream", "#fff8ec"],
    ["surface-mist", "#f6eedf"],
    ["ink", "#171a16"],
    ["ink-soft", "#5f625a"],
    ["canopy", "#075b36"],
    ["canopy-deep", "#063b29"],
    ["ember", "#d96a1f"],
    ["escalation", "#b83b32"],
    ["copper-muted", "#b88746"],
  ]) {
    expect(paletteSource).toContain(`--admin-${token}: ${value}`);
  }
  expect(shellSource).toContain("theme.adminScope");
  expect(shellSource).toContain("bg-[var(--admin-canopy-deep)]");
  expect(shellSource).toContain("bg-[var(--admin-canvas-warm)]");
  expect(shellNavigationSource).toContain("bg-[var(--admin-surface-cream)]");
  expect(`${shellSource}\n${overviewSource}`).not.toMatch(/\bbg-(?:white|zinc-(?:50|100|950))\b/);
  expect(overviewSource).toContain("Marketplace activity board");
  expect(overviewSource).toContain("Loading current marketplace activity");
  for (const label of [
    "Seller reviews",
    "Product reviews",
    "Orders needing action",
    "Open support requests",
    "Active sellers",
    "Published products",
    "Customers",
    "Open orders",
  ]) {
    expect(overviewSource).toContain(label);
  }
  expect(overviewSource).toContain('aria-busy="true"');
  expect(overviewSource).toContain("theme.activityRail");
  expect(overviewSource).not.toContain("animate-pulse");
  expect(paletteSource).toContain("@media (prefers-reduced-motion: reduce)");
  expect(overviewSource).not.toMatch(
    /\b(?:backend|frontend|MVP|launch-control|demo|source|signal|truth|contract|environment)\b/i,
  );
  expect(shellSource).not.toMatch(/Backend session active|Privileged Session|radial-gradient|linear-gradient/);
  expect(`${shellSource}\n${shellNavigationSource}`).not.toMatch(/Sellers CRM|Master Catalog|Order Queue|Support Hub|Access Control/);
  expect(readSource("src/services/admin/dashboard.ts")).not.toContain("skipAuthRefresh");
});
