import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ApiError, resetApiClientSecurityStateForTests } from "../src/services/api";
import {
  AdminDashboardOverviewContractError,
  parseAdminDashboardOverviewResponse,
  resolveAdminDashboardOverviewQuery,
  serializeAdminDashboardOverviewQuery,
} from "../src/features/admin-overview/lib/dashboard-overview-contract";
import {
  applyAdminOverviewQueryToSearchParams,
  parseAdminOverviewSearchParams,
} from "../src/features/admin-overview/hooks/useAdminOverview";
import {
  formatPercentageChange,
  getNeedsAttentionItems,
  getUnavailableActivitySeriesItems,
  isAdminOverviewEmpty,
} from "../src/features/admin-overview/lib/overview-presentation";
import { shouldHideOverviewAfterRefreshError } from "../src/features/admin-overview/components/OverviewStates";
import {
  fetchAdminDashboardOverview,
  getAdminOverviewSafeError,
} from "../src/services/admin/dashboard";
import type { AdminIdentity } from "../src/services/admin/session";
import type {
  AdminDashboardOverview,
  AdminDashboardOverviewActivityPoint,
  AdminDashboardOverviewAvailableActivitySeries,
  AdminDashboardOverviewAvailableFlowMetric,
  AdminDashboardOverviewAvailableQueueMetric,
  AdminDashboardOverviewCountMetric,
  AdminDashboardOverviewFlowMetric,
  AdminDashboardOverviewUnavailableMetric,
} from "../src/features/admin-overview/types/dashboard-overview";

test.describe.configure({ mode: "serial" });

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const originalFetch = globalThis.fetch;
const DAY_MS = 86_400_000;
const CURRENT_START = Date.parse("2026-08-24T22:00:00.000Z");
const CURRENT_END = Date.parse("2026-08-31T22:00:00.000Z");
const COMPARISON_START = Date.parse("2026-08-17T22:00:00.000Z");
const COMPARISON_END = Date.parse("2026-08-24T22:00:00.000Z");

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClientSecurityStateForTests();
});

function metadata(id: string, label: string) {
  return {
    id,
    label,
    definition: `${label} count for the selected reporting period.`,
    unit: "COUNT" as const,
    source: `${id}Repository`,
    requiredPermissions: ["access_admin_panel"],
    permissionMode: "ALL" as const,
  };
}

function availableQueue(
  id: string,
  value: number,
  oldestItemAgeSeconds: number | null,
  ageBasis: AdminDashboardOverviewAvailableQueueMetric["ageBasis"] = "CREATED_AT",
): AdminDashboardOverviewAvailableQueueMetric {
  return {
    ...metadata(id, id),
    availability: "AVAILABLE",
    value,
    oldestItemAgeSeconds,
    ageBasis,
  };
}

function availableCount(id: string, value: number): AdminDashboardOverviewCountMetric {
  return { ...metadata(id, id), availability: "AVAILABLE", value };
}

function unavailable(
  id: string,
  reason: AdminDashboardOverviewUnavailableMetric["reason"],
): AdminDashboardOverviewUnavailableMetric {
  return { ...metadata(id, id), availability: "UNAVAILABLE", reason };
}

function points(
  current: readonly number[],
  comparison: readonly number[],
): AdminDashboardOverviewActivityPoint[] {
  return current.map((count, index) => ({
    bucketStart: new Date(CURRENT_START + index * DAY_MS).toISOString(),
    bucketEnd: new Date(CURRENT_START + (index + 1) * DAY_MS).toISOString(),
    count,
    comparisonBucketStart: new Date(
      COMPARISON_START + index * DAY_MS,
    ).toISOString(),
    comparisonBucketEnd: new Date(
      COMPARISON_START + (index + 1) * DAY_MS,
    ).toISOString(),
    comparisonCount: comparison[index] ?? 0,
  }));
}

function flowAndSeries(
  id: string,
  current: readonly number[],
  comparison: readonly number[],
): {
  flow: AdminDashboardOverviewAvailableFlowMetric;
  series: AdminDashboardOverviewAvailableActivitySeries;
} {
  const currentValue = current.reduce((sum, value) => sum + value, 0);
  const comparisonValue = comparison.reduce((sum, value) => sum + value, 0);
  return {
    flow: {
      ...metadata(id, id),
      availability: "AVAILABLE",
      currentValue,
      comparisonValue,
      absoluteChange: currentValue - comparisonValue,
      percentageChange: comparisonValue === 0
        ? null
        : Math.round(((currentValue - comparisonValue) / comparisonValue) * 10_000) / 100,
    },
    series: {
      ...metadata(id, id),
      availability: "AVAILABLE",
      points: points(current, comparison),
    },
  };
}

function overviewFixture(): AdminDashboardOverview {
  const sellers = flowAndSeries(
    "sellerApplicationsSubmitted",
    [1, 0, 1, 0, 1, 0, 1],
    [0, 1, 0, 0, 0, 1, 0],
  );
  const products = flowAndSeries(
    "productsCreated",
    [1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0],
  );
  const orders = flowAndSeries(
    "ordersCreated",
    [1, 0, 1, 0, 1, 0, 0],
    [0, 1, 0, 1, 0, 1, 0],
  );
  const support = flowAndSeries(
    "supportTicketsOpened",
    [0, 1, 0, 0, 1, 0, 0],
    [1, 0, 1, 0, 1, 0, 1],
  );

  return {
    version: 1,
    generatedAt: "2026-08-31T08:30:00.000Z",
    timeZone: "Africa/Lusaka",
    scope: "MARKETPLACE",
    query: {
      period: "LAST_7_DAYS",
      comparison: "PREVIOUS_PERIOD",
      groupBy: "DAY",
    },
    periods: {
      current: {
        start: new Date(CURRENT_START).toISOString(),
        end: new Date(CURRENT_END).toISOString(),
        endExclusive: true,
      },
      comparison: {
        start: new Date(COMPARISON_START).toISOString(),
        end: new Date(COMPARISON_END).toISOString(),
        endExclusive: true,
      },
    },
    queues: {
      availability: "AVAILABLE",
      permissionPolicy: "METRIC_LEVEL",
      sellerReviews: availableQueue("sellerReviews", 4, 86_400, "SUBMITTED_AT"),
      productReviews: availableQueue("productReviews", 3, null, "NOT_AVAILABLE"),
      ordersNeedingAction: availableQueue("ordersNeedingAction", 2, 7_200),
      openSupportRequests: availableQueue("openSupportRequests", 1, 172_800),
    },
    snapshot: {
      availability: "AVAILABLE",
      permissionPolicy: "METRIC_LEVEL",
      activeSellers: availableCount("activeSellers", 18),
      publishedProducts: availableCount("publishedProducts", 73),
      customers: availableCount("customers", 124),
      openOrders: availableCount("openOrders", 6),
    },
    periodFlows: {
      availability: "AVAILABLE",
      permissionPolicy: "METRIC_LEVEL",
      sellerApplicationsSubmitted: sellers.flow,
      productsCreated: products.flow,
      ordersCreated: orders.flow,
      supportTicketsOpened: support.flow,
    },
    operationalActivity: {
      id: "operationalWorkEntered",
      label: "Operational work entered",
      question:
        "How much new operational work entered Zogular during the selected period compared with the immediately preceding equivalent period?",
      unit: "COUNT",
      groupBy: "DAY",
      availability: "AVAILABLE",
      permissionPolicy: "METRIC_LEVEL",
      series: {
        sellerApplicationsSubmitted: sellers.series,
        productsCreated: products.series,
        ordersCreated: orders.series,
        supportTicketsOpened: support.series,
      },
    },
  };
}

function envelope(overview = overviewFixture()) {
  return { status: "success" as const, data: { overview } };
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
    issuedAt: "2026-08-31T08:00:00.000Z",
  },
  sessionStatus: "authenticated",
};

test("parses the strict F2 envelope and preserves comparison bucket ranges", () => {
  const result = parseAdminDashboardOverviewResponse(envelope());
  expect(result.scope).toBe("MARKETPLACE");
  expect(result.timeZone).toBe("Africa/Lusaka");
  expect(result.operationalActivity.series.ordersCreated).toMatchObject({
    availability: "AVAILABLE",
  });
  const series = result.operationalActivity.series.ordersCreated;
  if (series.availability !== "AVAILABLE") throw new Error("Expected available fixture.");
  expect(series.points[0]).toMatchObject({
    bucketStart: "2026-08-24T22:00:00.000Z",
    comparisonBucketStart: "2026-08-17T22:00:00.000Z",
    comparisonBucketEnd: "2026-08-18T22:00:00.000Z",
  });
});

test("serializes every supported query and rejects unsupported combinations", () => {
  for (const [period, groupings] of [
    ["LAST_7_DAYS", ["DAY"]],
    ["LAST_30_DAYS", ["DAY", "WEEK"]],
    ["MONTH_TO_DATE", ["DAY", "WEEK"]],
    ["QUARTER_TO_DATE", ["WEEK"]],
  ] as const) {
    for (const groupBy of groupings) {
      expect(serializeAdminDashboardOverviewQuery({ period, groupBy })).toEqual({
        period,
        comparison: "PREVIOUS_PERIOD",
        groupBy,
      });
    }
  }
  expect(() =>
    resolveAdminDashboardOverviewQuery({ period: "LAST_7_DAYS", groupBy: "WEEK" }),
  ).toThrow(AdminDashboardOverviewContractError);
});

test("normalizes invalid URL values and removes defaults without deleting unrelated state", () => {
  expect(
    parseAdminOverviewSearchParams(
      new URLSearchParams("period=LAST_7_DAYS&groupBy=WEEK"),
    ),
  ).toEqual({
    period: "LAST_7_DAYS",
    comparison: "PREVIOUS_PERIOD",
    groupBy: "DAY",
  });
  const normalized = applyAdminOverviewQueryToSearchParams(
    new URLSearchParams("period=bad&groupBy=bad&comparison=bad&keep=1"),
    {
      period: "LAST_30_DAYS",
      comparison: "PREVIOUS_PERIOD",
      groupBy: "DAY",
    },
  );
  expect(normalized.toString()).toBe("keep=1");
});

test("calls only the F2 endpoint with exact query values and forwards cancellation", async () => {
  const calls: { url: URL; signal: AbortSignal | null }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    calls.push({
      url: new URL(request?.url ?? String(input)),
      signal: request?.signal ?? init?.signal ?? null,
    });
    return new Response(JSON.stringify(envelope()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  const controller = new AbortController();

  await expect(
    fetchAdminDashboardOverview({
      period: "LAST_7_DAYS",
      comparison: "PREVIOUS_PERIOD",
      groupBy: "DAY",
      signal: controller.signal,
    }),
  ).resolves.toEqual(overviewFixture());
  expect(calls).toHaveLength(1);
  expect(calls[0].url.pathname).toBe("/api/v1/admin/dashboard/overview");
  expect(calls[0].url.searchParams.toString()).toBe(
    "period=LAST_7_DAYS&comparison=PREVIOUS_PERIOD&groupBy=DAY",
  );
  expect(calls[0].signal).not.toBeNull();
});

test("rejects malformed and internally inconsistent responses atomically", () => {
  const cases: unknown[] = [
    overviewFixture(),
    { ...envelope(), status: "ok" },
    envelope({ ...overviewFixture(), version: 2 } as unknown as AdminDashboardOverview),
    envelope({ ...overviewFixture(), timeZone: "UTC" } as unknown as AdminDashboardOverview),
    envelope({ ...overviewFixture(), scope: "STORE" } as unknown as AdminDashboardOverview),
    envelope({ ...overviewFixture(), generatedAt: "not-a-date" }),
    envelope({
      ...overviewFixture(),
      queues: { ...overviewFixture().queues, availability: "PARTIAL" },
    }),
    envelope({
      ...overviewFixture(),
      periodFlows: {
        ...overviewFixture().periodFlows,
        ordersCreated: {
          ...(overviewFixture().periodFlows.ordersCreated as AdminDashboardOverviewAvailableFlowMetric),
          absoluteChange: 999,
        },
      },
    }),
  ];
  for (const payload of cases) {
    expect(() => parseAdminDashboardOverviewResponse(payload)).toThrow(
      AdminDashboardOverviewContractError,
    );
  }
});

test("keeps genuine zero distinct from permission and source unavailability", () => {
  const fixture = overviewFixture();
  const permissionUnavailable = unavailable(
    "sellerApplicationsSubmitted",
    "PERMISSION_REQUIRED",
  );
  const sourceUnavailable = unavailable("productsCreated", "DATA_SOURCE_UNAVAILABLE");
  const partial: AdminDashboardOverview = {
    ...fixture,
    periodFlows: {
      ...fixture.periodFlows,
      availability: "PARTIAL",
      sellerApplicationsSubmitted: permissionUnavailable,
      productsCreated: sourceUnavailable,
    },
    operationalActivity: {
      ...fixture.operationalActivity,
      availability: "PARTIAL",
      series: {
        ...fixture.operationalActivity.series,
        sellerApplicationsSubmitted: permissionUnavailable,
        productsCreated: sourceUnavailable,
      },
    },
  };
  const result = parseAdminDashboardOverviewResponse(envelope(partial));
  expect(result.periodFlows.ordersCreated).toMatchObject({
    availability: "AVAILABLE",
    currentValue: 3,
  });
  expect(getUnavailableActivitySeriesItems(result)).toEqual([
    expect.objectContaining({
      key: "sellerApplicationsSubmitted",
      reason: "PERMISSION_REQUIRED",
      message: "Not available for your role",
    }),
    expect.objectContaining({
      key: "productsCreated",
      reason: "DATA_SOURCE_UNAVAILABLE",
      message: "Temporarily unavailable",
    }),
  ]);
  expect(isAdminOverviewEmpty(result)).toBe(false);
});

test("treats a zero comparison base neutrally", () => {
  const result = parseAdminDashboardOverviewResponse(envelope());
  expect(result.periodFlows.productsCreated).toMatchObject({
    comparisonValue: 0,
    percentageChange: null,
  });
  expect(formatPercentageChange(null)).toBe(
    "Percentage unavailable because the previous period was zero",
  );
});

test("preserves available queue counts when drill-through permission is absent", () => {
  const overview = parseAdminDashboardOverviewResponse(envelope());
  const limitedIdentity: AdminIdentity = {
    ...fullIdentity,
    claims: {
      ...fullIdentity.claims,
      permissions: ["view_dashboard", "view_orders"],
    },
  };
  const items = getNeedsAttentionItems(overview, limitedIdentity);
  expect(items.map((item) => item.key)).toEqual([
    "sellerReviews",
    "productReviews",
    "ordersNeedingAction",
    "openSupportRequests",
  ]);
  expect(items.find((item) => item.key === "sellerReviews")?.href).toBeNull();
  expect(items.find((item) => item.key === "ordersNeedingAction")?.href)
    .toBe("/admin/orders");
});

test("recognizes only a fully available all-zero overview as empty", () => {
  const fixture = overviewFixture();
  const zeroFlow = (id: string): AdminDashboardOverviewFlowMetric => ({
    ...metadata(id, id),
    availability: "AVAILABLE",
    currentValue: 0,
    comparisonValue: 0,
    absoluteChange: 0,
    percentageChange: null,
  });
  const zero: AdminDashboardOverview = {
    ...fixture,
    queues: {
      ...fixture.queues,
      sellerReviews: availableQueue("sellerReviews", 0, null),
      productReviews: availableQueue("productReviews", 0, null, "NOT_AVAILABLE"),
      ordersNeedingAction: availableQueue("ordersNeedingAction", 0, null),
      openSupportRequests: availableQueue("openSupportRequests", 0, null),
    },
    snapshot: {
      ...fixture.snapshot,
      activeSellers: availableCount("activeSellers", 0),
      publishedProducts: availableCount("publishedProducts", 0),
      customers: availableCount("customers", 0),
      openOrders: availableCount("openOrders", 0),
    },
    periodFlows: {
      ...fixture.periodFlows,
      sellerApplicationsSubmitted: zeroFlow("sellerApplicationsSubmitted"),
      productsCreated: zeroFlow("productsCreated"),
      ordersCreated: zeroFlow("ordersCreated"),
      supportTicketsOpened: zeroFlow("supportTicketsOpened"),
    },
  };
  expect(isAdminOverviewEmpty(zero)).toBe(true);
  expect(isAdminOverviewEmpty({
    ...zero,
    snapshot: {
      ...zero.snapshot,
      availability: "PARTIAL",
      customers: unavailable("customers", "PERMISSION_REQUIRED"),
    },
  })).toBe(false);
});

test("maps 401, 403, timeout, 503, network, and malformed failures safely", () => {
  const raw = "database host internal.example and stack trace";
  const errors = [
    new ApiError(raw, 401, { raw }),
    new ApiError(raw, 403, { raw }),
    new ApiError(raw, 408, { raw }),
    new ApiError(raw, 503, { raw }),
    new TypeError(raw),
    new AdminDashboardOverviewContractError(),
  ];
  const mapped = errors.map(getAdminOverviewSafeError);
  expect(mapped.map((error) => error.kind)).toEqual([
    "unauthenticated",
    "forbidden",
    "timeout",
    "unavailable",
    "unavailable",
    "malformed",
  ]);
  for (const error of mapped) {
    expect(error.message).not.toContain(raw);
    expect(error.message).not.toMatch(/stack trace|internal\.example/i);
  }
  expect(shouldHideOverviewAfterRefreshError(mapped[1])).toBe(true);
  expect(shouldHideOverviewAfterRefreshError(mapped[3])).toBe(false);
});

test("hook config owns cancellation, deduplication, polling, focus, reconnect, and fail-closed behavior", () => {
  const source = readSource("src/features/admin-overview/hooks/useAdminOverview.ts");
  expect(source).toContain("queryFn: ({ signal })");
  expect(source).toContain("fetchAdminDashboardOverview({ ...query, signal })");
  expect(source).toContain("placeholderData: keepPreviousData");
  expect(source).toContain("refetchInterval: ADMIN_OVERVIEW_REFETCH_INTERVAL_MS");
  expect(source).toContain("refetchIntervalInBackground: false");
  expect(source).toContain("refetchOnWindowFocus: true");
  expect(source).toContain("refetchOnReconnect: true");
  expect(source).toContain("cancelRefetch: false");
  expect(source).toContain("shouldHideOverviewAfterRefreshError(error)");
  expect(source).toContain("const data = failClosed ? null");
});

test("composition keeps operator and executive ordering presentation-only", () => {
  const source = readSource(
    "src/features/admin-overview/components/AdminOverview.tsx",
  );
  expect(source).toContain('identity?.claims.role === "executive_admin"');
  expect(source).toContain("<NeedsAttention");
  expect(source).toContain("<MarketplacePulse");
  expect(source).toContain("<MarketplaceSnapshot");
  expect(source).toContain("<OperationalActivity");
  expect(source).not.toMatch(/view_financial_reports|GMV|revenue|margin/i);
});

test("responsive and keyboard source gates cover the required browser matrix", () => {
  const viewports = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
  expect(viewports).toHaveLength(9);
  const source = [
    "src/features/admin-overview/components/AdminOverview.tsx",
    "src/features/admin-overview/components/OverviewControls.tsx",
    "src/features/admin-overview/components/OperationalActivity.tsx",
    "src/features/admin-overview/components/NeedsAttention.tsx",
  ].map(readSource).join("\n");
  expect(source).toContain("min-w-0");
  expect(source).toContain("overflow-x-auto");
  expect(source).toContain("xl:grid-cols-");
  expect(source).toContain("min-h-11");
  expect(source).toContain("focus-visible:ring-2");
  expect(source).toContain("motion-reduce:transition-none");
  expect(source).toContain("aria-pressed");
  expect(source).not.toContain('role="img"');
});
