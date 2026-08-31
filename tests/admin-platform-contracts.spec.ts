import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ApiError } from "../src/services/api";
import {
  ADMIN_CAPABILITY_GROUPS,
  ADMIN_CAPABILITY_IDS,
  ADMIN_CAPABILITY_REGISTRY,
  ADMIN_OPERATOR_TERMS,
  ADMIN_PRIMARY_DESTINATION_LABELS,
  AdminAssignmentSchema,
  AdminAuditSummarySchema,
  AdminCapabilityDefinitionSchema,
  AdminChartSchema,
  AdminExportJobSchema,
  AdminExportRequestSchema,
  AdminFreshnessSchema,
  AdminHandoffSchema,
  AdminInternalNoteSchema,
  AdminLinkedEntitySchema,
  AdminMetricSchema,
  SafeAdminErrorSchema,
  containsProhibitedPrimaryTerm,
  createAdminCollectionSchema,
  createAdminRequestStateSchema,
  evaluateCapabilityNavigation,
  getCapabilityNavigationDecision,
  getNavigationEligibleCapabilities,
  toSafeAdminError,
  toSafeAdminFetchError,
} from "../src/features/admin-platform";

test.describe.configure({ mode: "serial" });

const repoRoot = path.resolve(__dirname, "..");
const generatedAt = "2026-08-31T10:00:00.000Z";
const period = {
  start: "2026-08-01T00:00:00.000Z",
  end: "2026-09-01T00:00:00.000Z",
  timeZone: "Africa/Lusaka",
} as const;
const freshness = {
  version: 1,
  generatedAt,
  lastSuccessfulAt: generatedAt,
  status: "fresh",
  retryEligible: false,
} as const;
const linkedEntity = {
  version: 1,
  type: "seller",
  id: "seller-1",
  maskedLabel: "Seller •••• 4821",
  route: "/admin/sellers/seller-1",
  visibility: "masked",
} as const;
const owner = {
  type: "admin",
  id: "admin-1",
  maskedLabel: "Admin D.",
} as const;

const ItemSchema = z.strictObject({
  id: z.string().min(1),
  status: z.enum(["open", "closed"]),
});
const CollectionSchema = createAdminCollectionSchema(ItemSchema);
const RequestStateSchema = createAdminRequestStateSchema(CollectionSchema);

function collectionFixture() {
  return {
    version: 1,
    items: [{ id: "item-1", status: "open" }],
    sort: [{ field: "createdAt", direction: "desc" }],
    filters: [{ key: "status", values: ["open"] }],
    facets: [{ key: "status", label: "Status", buckets: [{ value: "open", label: "Open", count: 1 }] }],
    pagination: { kind: "offset", page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    total: { availability: "available", value: 1 },
    generatedAt,
    completeness: "complete",
    warnings: [],
  } as const;
}

function metricFixture() {
  return {
    version: 1,
    key: "approvedSellers",
    label: "Approved sellers",
    definition: "Sellers currently approved to operate on the marketplace.",
    source: "Backend seller application status summary.",
    unit: { kind: "count" },
    period,
    current: { availability: "available", value: 0 },
    comparison: {
      availability: "available",
      value: 2,
      label: "Previous month",
      period: {
        start: "2026-07-01T00:00:00.000Z",
        end: "2026-08-01T00:00:00.000Z",
        timeZone: "Africa/Lusaka",
      },
    },
    generatedAt,
    permissionState: "allowed",
    drillThrough: { capabilityId: "sellers", route: "/admin/sellers" },
  } as const;
}

function availableChartFixture() {
  return {
    version: 1,
    key: "sellerReviews",
    label: "Seller reviews",
    definition: "Seller reviews completed during the selected period.",
    period,
    generatedAt,
    permissionState: "allowed",
    availability: "available",
    series: [{ key: "completed", label: "Completed", unit: { kind: "count" } }],
    points: [{ kind: "time_series", timestamp: generatedAt, seriesKey: "completed", value: 4 }],
    accessibility: {
      textSummary: "Four seller reviews were completed.",
      tableCaption: "Completed seller reviews",
      columns: ["Time", "Completed"],
      rows: [[generatedAt, 4]],
    },
  } as const;
}

function completedExportJobFixture() {
  return {
    version: 1,
    ownership: "backend",
    requestId: "request-1",
    jobId: "job-1",
    state: "completed",
    createdAt: "2026-08-31T09:00:00.000Z",
    updatedAt: "2026-08-31T10:00:00.000Z",
    completedAt: "2026-08-31T09:30:00.000Z",
    expiresAt: "2026-08-31T11:00:00.000Z",
    downloadUrl: "https://downloads.example.test/admin-export.csv",
    error: null,
    permissionState: "allowed",
  } as const;
}

test("valid collection, freshness, metric, chart, entity, collaboration, audit, export, and error fixtures parse", () => {
  const collection = CollectionSchema.parse(collectionFixture());
  expect(collection.items).toHaveLength(1);
  expect(AdminFreshnessSchema.parse(freshness).status).toBe("fresh");
  expect(AdminMetricSchema.parse(metricFixture()).current).toEqual({ availability: "available", value: 0 });
  const chart = AdminChartSchema.parse(availableChartFixture());
  expect(chart.availability).toBe("available");
  if (chart.availability !== "available") throw new Error("Expected an available chart fixture.");
  expect(chart.points).toHaveLength(1);
  expect(AdminLinkedEntitySchema.parse(linkedEntity).visibility).toBe("masked");
  expect(
    AdminAssignmentSchema.parse({
      version: 1,
      ownership: "backend",
      id: "assignment-1",
      entity: linkedEntity,
      assignee: owner,
      priority: "high",
      status: "active",
      assignedAt: generatedAt,
      dueAt: null,
    }).ownership,
  ).toBe("backend");
  expect(
    AdminHandoffSchema.parse({
      version: 1,
      ownership: "backend",
      id: "handoff-1",
      entity: linkedEntity,
      from: owner,
      to: { type: "team", id: "team-1", maskedLabel: "Seller review team" },
      reason: "Specialist review required.",
      handedOffAt: generatedAt,
    }).ownership,
  ).toBe("backend");
  expect(
    AdminInternalNoteSchema.parse({
      version: 1,
      ownership: "backend",
      id: "note-1",
      entity: linkedEntity,
      author: owner,
      body: "Evidence requires a second review.",
      visibility: "internal_only",
      createdAt: generatedAt,
      editedAt: null,
    }).visibility,
  ).toBe("internal_only");
  expect(
    AdminAuditSummarySchema.parse({
      version: 1,
      ownership: "backend",
      id: "audit-1",
      actor: owner,
      action: "SELLER_REVIEWED",
      actionLabel: "Seller reviewed",
      entity: linkedEntity,
      occurredAt: generatedAt,
      reasonSummary: null,
      detailsVisibility: "masked",
    }).detailsVisibility,
  ).toBe("masked");
  expect(
    AdminExportRequestSchema.parse({
      version: 1,
      ownership: "backend",
      requestId: "request-1",
      capabilityId: "sellers",
      scope: { kind: "all_authorized" },
      format: "csv",
      requestedAt: generatedAt,
      permissionState: "allowed",
    }).ownership,
  ).toBe("backend");
  expect(
    AdminExportJobSchema.parse(completedExportJobFixture()).state,
  ).toBe("completed");
  expect(
    SafeAdminErrorSchema.parse({
      version: 1,
      kind: "timeout",
      status: 408,
      title: "Request timed out",
      message: "The request took too long. It is safe to try again.",
      action: "retry",
      retryEligible: true,
    }).retryEligible,
  ).toBe(true);
});

test("malformed versions, dates, counts, cursors, enums, currency, comparisons, entity types, export states, and partial payloads fail atomically", () => {
  const fixture = collectionFixture();
  const malformedCollections: unknown[] = [
    { ...fixture, version: 2 },
    { ...fixture, generatedAt: "not-a-date" },
    { ...fixture, items: [{ id: "item-1", status: "unknown" }] },
    { ...fixture, pagination: { ...fixture.pagination, totalItems: -1 } },
    { ...fixture, total: { availability: "available", value: -1 } },
    { ...fixture, total: { availability: "available", value: 2 } },
    { ...fixture, completeness: "partial", warnings: [] },
    { ...fixture, unexpected: true },
    {
      ...fixture,
      pagination: { kind: "cursor", nextCursor: "", previousCursor: null, hasNext: true, hasPrevious: false },
    },
  ];
  for (const malformed of malformedCollections) expect(() => CollectionSchema.parse(malformed)).toThrow();

  expect(() => AdminFreshnessSchema.parse({ ...freshness, generatedAt: "tomorrow" })).toThrow();
  expect(() => AdminMetricSchema.parse({ ...metricFixture(), unit: { kind: "currency", currency: "zmw" } })).toThrow();
  expect(() => AdminMetricSchema.parse({ ...metricFixture(), comparison: { availability: "available", value: 1 } })).toThrow();
  expect(() => AdminLinkedEntitySchema.parse({ ...linkedEntity, type: "wallet" })).toThrow();
  expect(() => AdminLinkedEntitySchema.parse({ ...linkedEntity, visibility: "forbidden" })).toThrow();
  expect(() =>
    AdminExportJobSchema.parse({
      version: 1,
      ownership: "backend",
      requestId: "request-1",
      jobId: "job-1",
      state: "processing",
      createdAt: "2026-08-31T09:00:00.000Z",
      updatedAt: "2026-08-31T10:00:00.000Z",
      completedAt: null,
      expiresAt: null,
      downloadUrl: "https://downloads.example.test/early.csv",
      error: null,
      permissionState: "allowed",
    }),
  ).toThrow();
  expect(() => SafeAdminErrorSchema.parse({
    version: 1,
    kind: "forbidden",
    status: 403,
    title: "No access",
    message: "No access.",
    action: "request_access",
    retryEligible: true,
  })).toThrow();
});

test("metric and chart contracts hide every data-bearing field without confirmed permission", () => {
  const hiddenMetric = {
    ...metricFixture(),
    permissionState: "forbidden",
    current: { availability: "unavailable", reason: "permission_required" },
    comparison: { availability: "unavailable", reason: "permission_required" },
    drillThrough: null,
  } as const;
  expect(AdminMetricSchema.parse(hiddenMetric).permissionState).toBe("forbidden");
  for (const leakingMetric of [
    { ...hiddenMetric, current: { availability: "available", value: 0 } },
    {
      ...hiddenMetric,
      comparison: metricFixture().comparison,
    },
    {
      ...hiddenMetric,
      drillThrough: { capabilityId: "sellers", route: "/admin/sellers" },
    },
    {
      ...hiddenMetric,
      permissionState: "unknown",
      current: { availability: "unavailable", reason: "data_source_unavailable" },
    },
  ]) {
    expect(() => AdminMetricSchema.parse(leakingMetric)).toThrow();
  }

  const hiddenChart = {
    version: 1,
    key: "sellerReviews",
    label: "Seller reviews",
    definition: "Seller reviews completed during the selected period.",
    period,
    generatedAt,
    permissionState: "forbidden",
    availability: "unavailable",
    reason: "permission_required",
    accessibility: { textSummary: "Chart data is unavailable." },
  } as const;
  expect(AdminChartSchema.parse(hiddenChart).availability).toBe("unavailable");
  for (const leakingChart of [
    { ...hiddenChart, accessibility: { textSummary: "Four seller reviews were completed." } },
    { ...hiddenChart, series: availableChartFixture().series },
    { ...hiddenChart, points: availableChartFixture().points },
    {
      ...hiddenChart,
      accessibility: {
        textSummary: "Chart data is unavailable.",
        tableCaption: "Hidden values",
        columns: ["Value"],
        rows: [[4]],
      },
    },
    { ...hiddenChart, reason: "data_source_unavailable" },
    { ...availableChartFixture(), permissionState: "forbidden" },
  ]) {
    expect(() => AdminChartSchema.parse(leakingChart)).toThrow();
  }
});

test("freshness timestamps and retry eligibility follow explicit snapshot semantics", () => {
  expect(AdminFreshnessSchema.parse(freshness).retryEligible).toBe(false);
  expect(AdminFreshnessSchema.parse({ ...freshness, status: "stale", retryEligible: true }).status).toBe("stale");
  expect(AdminFreshnessSchema.parse({ ...freshness, status: "degraded", retryEligible: true }).status).toBe("degraded");
  expect(() => AdminFreshnessSchema.parse({ ...freshness, retryEligible: true })).toThrow();
  expect(() => AdminFreshnessSchema.parse({ ...freshness, status: "stale", retryEligible: false })).toThrow();
  expect(() => AdminFreshnessSchema.parse({ ...freshness, status: "degraded", retryEligible: false })).toThrow();
  expect(() =>
    AdminFreshnessSchema.parse({
      ...freshness,
      generatedAt: "2026-08-31T10:00:01.000Z",
      lastSuccessfulAt: "2026-08-31T10:00:00.000Z",
    }),
  ).toThrow();
  expect(
    AdminFreshnessSchema.parse({
      ...freshness,
      generatedAt: "2026-08-31T09:59:59.000Z",
      lastSuccessfulAt: "2026-08-31T10:00:00.000Z",
    }).generatedAt,
  ).toBe("2026-08-31T09:59:59.000Z");
});

test("offset collections enforce coherent counts, page bounds, sort fields, and facet buckets", () => {
  const fixture = collectionFixture();
  const empty = {
    ...fixture,
    items: [],
    facets: [],
    pagination: { kind: "offset", page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    total: { availability: "available", value: 0 },
  } as const;
  expect(CollectionSchema.parse(empty).pagination).toMatchObject({ page: 1, totalPages: 0 });

  for (const malformed of [
    { ...fixture, pagination: { ...fixture.pagination, totalPages: 2 } },
    { ...fixture, pagination: { ...fixture.pagination, page: 2 } },
    { ...fixture, pagination: { ...fixture.pagination, totalItems: 0, totalPages: 0 }, total: { availability: "available", value: 0 } },
    { ...empty, pagination: { ...empty.pagination, page: 2 } },
    { ...empty, pagination: { ...empty.pagination, totalPages: 1 } },
    { ...fixture, sort: [...fixture.sort, { field: "createdAt", direction: "asc" }] },
    {
      ...fixture,
      facets: [{
        ...fixture.facets[0],
        buckets: [
          ...fixture.facets[0].buckets,
          { value: "open", label: "Open again", count: 0 },
        ],
      }],
    },
  ]) {
    expect(() => CollectionSchema.parse(malformed)).toThrow();
  }

  expect(
    CollectionSchema.parse({
      ...fixture,
      pagination: { kind: "offset", page: 2, pageSize: 25, totalItems: 26, totalPages: 2 },
      total: { availability: "available", value: 26 },
    }).pagination,
  ).toMatchObject({ page: 2, totalPages: 2 });
});

test("request states keep authorization failures out of failed and degraded states", () => {
  const forbidden = toSafeAdminError(new ApiError("raw", 403));
  const unauthenticated = toSafeAdminError(new ApiError("raw", 401));
  const unavailable = toSafeAdminError(new ApiError("raw", 503));
  const degradedFreshness = { ...freshness, status: "degraded", retryEligible: true } as const;

  expect(RequestStateSchema.parse({ version: 1, status: "forbidden", error: forbidden }).status).toBe("forbidden");
  expect(RequestStateSchema.parse({
    version: 1,
    status: "degraded_with_data",
    data: collectionFixture(),
    freshness: degradedFreshness,
    error: unavailable,
  }).status).toBe("degraded_with_data");

  for (const invalidState of [
    { version: 1, status: "forbidden", error: unavailable },
    { version: 1, status: "failed", error: forbidden },
    { version: 1, status: "failed", error: unauthenticated },
    { version: 1, status: "degraded_with_data", data: collectionFixture(), freshness: degradedFreshness, error: forbidden },
    { version: 1, status: "degraded_with_data", data: collectionFixture(), freshness: freshness, error: unavailable },
    { version: 1, status: "success", data: collectionFixture(), freshness: degradedFreshness },
  ]) {
    expect(() => RequestStateSchema.parse(invalidState)).toThrow();
  }
});

test("collaboration and export contracts reject contradictory owners, times, states, and permissions", () => {
  expect(() => AdminAssignmentSchema.parse({
    version: 1,
    ownership: "backend",
    id: "assignment-1",
    entity: linkedEntity,
    assignee: owner,
    priority: "high",
    status: "active",
    assignedAt: generatedAt,
    dueAt: "2026-08-31T09:59:59.000Z",
  })).toThrow();
  expect(() => AdminInternalNoteSchema.parse({
    version: 1,
    ownership: "backend",
    id: "note-1",
    entity: linkedEntity,
    author: owner,
    body: "Evidence requires review.",
    visibility: "internal_only",
    createdAt: generatedAt,
    editedAt: "2026-08-31T09:59:59.000Z",
  })).toThrow();
  expect(() => AdminHandoffSchema.parse({
    version: 1,
    ownership: "backend",
    id: "handoff-1",
    entity: linkedEntity,
    from: owner,
    to: owner,
    reason: "No ownership change.",
    handedOffAt: generatedAt,
  })).toThrow();
  expect(() => AdminExportRequestSchema.parse({
    version: 1,
    ownership: "backend",
    requestId: "request-1",
    capabilityId: "sellers",
    scope: { kind: "all_authorized" },
    format: "csv",
    requestedAt: generatedAt,
    permissionState: "forbidden",
  })).toThrow();

  const completed = completedExportJobFixture();
  for (const contradictory of [
    { ...completed, permissionState: "forbidden" },
    { ...completed, completedAt: "2026-08-31T08:59:59.000Z" },
    { ...completed, expiresAt: "2026-08-31T09:45:00.000Z" },
    {
      ...completed,
      state: "expired",
      updatedAt: "2026-08-31T10:00:00.000Z",
      expiresAt: "2026-08-31T11:00:00.000Z",
      downloadUrl: null,
    },
  ]) {
    expect(() => AdminExportJobSchema.parse(contradictory)).toThrow();
  }

  expect(AdminExportJobSchema.parse({
    ...completed,
    state: "expired",
    updatedAt: "2026-08-31T11:00:00.000Z",
    downloadUrl: null,
  }).state).toBe("expired");
});

test("unavailable remains distinct from zero, empty, forbidden, stale, degraded, malformed, and failed", () => {
  const zero = AdminMetricSchema.parse(metricFixture());
  const unavailable = AdminMetricSchema.parse({
    ...metricFixture(),
    current: { availability: "unavailable", reason: "data_source_unavailable" },
    comparison: { availability: "unavailable", reason: "data_source_unavailable" },
  });
  expect(zero.current).toEqual({ availability: "available", value: 0 });
  expect(unavailable.current).toEqual({ availability: "unavailable", reason: "data_source_unavailable" });

  const safeForbidden = toSafeAdminError(new ApiError("raw forbidden", 403));
  const safeFailure = toSafeAdminError(new Error("raw failure"));
  for (const state of [
    { version: 1, status: "empty", freshness },
    { version: 1, status: "forbidden", error: safeForbidden },
    { version: 1, status: "failed", error: safeFailure },
    { version: 1, status: "degraded_with_data", data: collectionFixture(), freshness: { ...freshness, status: "degraded", retryEligible: true }, error: toSafeAdminError(new ApiError("raw", 503)) },
    { version: 1, status: "success", data: collectionFixture(), freshness: { ...freshness, status: "stale", retryEligible: true } },
  ]) {
    expect(RequestStateSchema.parse(state).status).toBe(state.status);
  }
  expect(toSafeAdminError(new SyntaxError("raw malformed")).kind).toBe("malformed");
});

test("the immutable registry covers every documented group and destination exactly once", () => {
  expect(ADMIN_CAPABILITY_GROUPS.map((group) => group.id)).toEqual([
    "home",
    "marketplace",
    "orders_and_service",
    "growth",
    "finance",
    "governance",
  ]);
  expect(ADMIN_CAPABILITY_REGISTRY).toHaveLength(ADMIN_CAPABILITY_IDS.length);
  expect(new Set(ADMIN_CAPABILITY_REGISTRY.map((capability) => capability.id)).size).toBe(ADMIN_CAPABILITY_IDS.length);
  const routes = ADMIN_CAPABILITY_REGISTRY.flatMap((capability) => capability.currentRoute ? [capability.currentRoute] : []);
  expect(new Set(routes).size).toBe(routes.length);
  expect(Object.isFrozen(ADMIN_CAPABILITY_REGISTRY)).toBe(true);
  for (const capability of ADMIN_CAPABILITY_REGISTRY) {
    expect(Object.isFrozen(capability)).toBe(true);
    expect(capability.frontendPackage).toMatch(/^F(?:[1-9]|1[0-2])$/);
    expect(capability.backendDependency.owner).toBe("backend");
    expect(capability.backendDependency.description.length).toBeGreaterThan(0);
    expect(capability.backendPermissionEvidence.note.length).toBeGreaterThan(0);
    expect(capability.evidenceNote.length).toBeGreaterThan(0);
  }
});

test("only operational capabilities can be navigation eligible", () => {
  for (const capability of ADMIN_CAPABILITY_REGISTRY) {
    if (capability.navigationEligible) expect(capability.completionLevel).toBe("operational");
    if (capability.completionLevel !== "operational") expect(capability.navigationEligible).toBe(false);
  }
  const gated = ADMIN_CAPABILITY_REGISTRY.find((capability) => capability.id === "finance_overview");
  expect(gated).toBeDefined();
  expect(() => AdminCapabilityDefinitionSchema.parse({ ...gated, navigationEligible: true })).toThrow();
  expect(() => AdminCapabilityDefinitionSchema.parse({
    ...gated,
    completionLevel: "experience_ready",
    navigationEligible: true,
  })).toThrow();
});

test("gated modules remain hidden for a super-admin-shaped identity and backend authorization stays authoritative", () => {
  const superAdmin = {
    role: "super_admin",
    permissions: [
      "view_dashboard",
      "view_financial_reports",
      "export_reports",
      "view_sellers",
      "approve_sellers",
      "suspend_sellers",
      "edit_commission",
      "view_buyers",
      "ban_buyers",
      "view_products",
      "moderate_products",
      "view_orders",
      "override_orders",
      "manage_disputes",
      "view_treasury",
      "approve_payouts",
      "manage_refunds",
      "view_support_tickets",
      "reply_support_tickets",
      "manage_support_tickets",
      "manage_content",
      "view_system_logs",
      "configure_platform",
      "manage_admins",
    ],
  } as const;
  const visible = getNavigationEligibleCapabilities(superAdmin);
  expect(visible.map((capability) => capability.id)).toEqual([
    "overview",
    "sellers",
    "customers",
    "products_and_moderation",
    "categories_and_attributes",
    "orders_and_fulfillment",
    "support",
    "admins_teams_and_roles",
  ]);
  expect(getCapabilityNavigationDecision("finance_overview", superAdmin)).toMatchObject({
    eligible: false,
    reason: "not_operational",
    backendAuthorizationRequired: true,
  });
  expect(ADMIN_CAPABILITY_REGISTRY.every((capability) => capability.authorizationAuthority === "backend")).toBe(true);
});

test("unknown identities, roles, permissions, and capabilities fail closed", () => {
  expect(getCapabilityNavigationDecision("missing_capability", { role: "super_admin", permissions: ["view_dashboard"] })).toMatchObject({
    eligible: false,
    reason: "unknown_capability",
  });
  expect(getCapabilityNavigationDecision("overview", null)).toMatchObject({ eligible: false, reason: "unknown_identity" });
  expect(getCapabilityNavigationDecision("overview", { role: "root", permissions: ["view_dashboard"] })).toMatchObject({
    eligible: false,
    reason: "unknown_identity",
  });
  expect(getCapabilityNavigationDecision("overview", { role: "super_admin", permissions: ["view_dashboard", "invented_permission"] })).toMatchObject({
    eligible: false,
    reason: "unknown_identity",
  });
  expect(getCapabilityNavigationDecision("overview", { role: "super_admin", permissions: [] })).toMatchObject({
    eligible: false,
    reason: "permission_hint_not_present",
  });
});

test("frontend permission hints never claim backend authority", () => {
  const overview = ADMIN_CAPABILITY_REGISTRY.find((capability) => capability.id === "overview");
  expect(overview).toBeDefined();
  expect(evaluateCapabilityNavigation(overview, { role: "super_admin", permissions: ["view_dashboard"] })).toEqual({
    eligible: true,
    reason: "eligible",
    backendAuthorizationRequired: true,
  });
  expect(overview?.frontendPermissionHints).toEqual(["view_dashboard"]);
  expect(overview?.backendPermissionEvidence.permissions).toEqual(["access_admin_panel"]);
  expect(overview?.authorizationAuthority).toBe("backend");
});

test("operator labels use the canonical vocabulary and contain no developer terminology", () => {
  expect(ADMIN_OPERATOR_TERMS).toMatchObject({ seller: "Seller", customer: "Customer", administrator: "Administrator" });
  expect(ADMIN_PRIMARY_DESTINATION_LABELS).toMatchObject({
    overview: "Overview",
    sellers: "Sellers",
    customers: "Customers",
    products_and_moderation: "Products and Moderation",
    categories_and_attributes: "Categories and Attributes",
    orders_and_fulfillment: "Orders and Fulfillment",
    support: "Support",
    admins_teams_and_roles: "Admins, Teams, and Roles",
  });
  for (const capability of ADMIN_CAPABILITY_REGISTRY) {
    expect(containsProhibitedPrimaryTerm(capability.label)).toBe(false);
  }
});

test("HTTP, generic TypeError, malformed, and unknown failures map to fixed safe operator output", () => {
  const raw = "postgres://private-db.internal token=secret internal-id=usr_9821 stack trace";
  const cases: Array<[unknown, string, boolean]> = [
    [new ApiError(raw, 401, { raw }), "unauthenticated", false],
    [new ApiError(raw, 403, { raw }), "forbidden", false],
    [new ApiError(raw, 404, { raw }), "not_found", false],
    [new ApiError(raw, 409, { raw }), "conflict", false],
    [new ApiError(raw, 422, { raw }), "validation", false],
    [new ApiError(raw, 408, { raw }), "timeout", true],
    [new ApiError(raw, 500, { raw }), "unavailable", true],
    [new ApiError(raw, 503, { raw }), "unavailable", true],
    [new TypeError(raw), "unknown", false],
    [new SyntaxError(raw), "malformed", false],
    [{ message: raw, details: raw }, "unknown", false],
  ];
  for (const [error, expectedKind, retryEligible] of cases) {
    const safe = toSafeAdminError(error);
    expect(safe.kind).toBe(expectedKind);
    expect(safe.retryEligible).toBe(retryEligible);
    expect(JSON.stringify(safe)).not.toContain(raw);
    expect(JSON.stringify(safe)).not.toMatch(/private-db|token=|usr_9821|stack trace/i);
  }
});

test("the explicit fetch boundary distinguishes network, timeout, and abort failures", () => {
  const raw = "private network details";
  const timeoutError = new Error(raw);
  timeoutError.name = "TimeoutError";
  const abortError = new Error(raw);
  abortError.name = "AbortError";

  expect(toSafeAdminFetchError(new TypeError(raw))).toMatchObject({
    kind: "unavailable",
    retryEligible: true,
  });
  expect(toSafeAdminFetchError(timeoutError)).toMatchObject({
    kind: "timeout",
    retryEligible: true,
  });
  expect(toSafeAdminFetchError(abortError)).toMatchObject({
    kind: "unknown",
    retryEligible: false,
  });
  expect(toSafeAdminFetchError(abortError, { timedOut: true })).toMatchObject({
    kind: "timeout",
    retryEligible: true,
  });
  for (const safe of [
    toSafeAdminFetchError(new TypeError(raw)),
    toSafeAdminFetchError(timeoutError),
    toSafeAdminFetchError(abortError),
  ]) {
    expect(JSON.stringify(safe)).not.toContain(raw);
  }
});

test("F0 stays inside its source boundary and does not instantiate future-only contracts as live data", () => {
  const featureRoot = path.join(repoRoot, "src/features/admin-platform");
  const featureFiles = fs
    .readdirSync(featureRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(featureRoot, path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .sort();
  expect(featureFiles).toEqual([
    "config/capability-registry.ts",
    "config/operator-terminology.ts",
    "index.ts",
    "lib/capability-access.ts",
    "lib/safe-admin-error.ts",
    "types/capabilities.ts",
    "types/collaboration.ts",
    "types/collections.ts",
    "types/entities.ts",
    "types/errors.ts",
    "types/exports.ts",
    "types/freshness.ts",
    "types/metrics.ts",
  ]);

  const source = featureFiles
    .map((relativePath) => fs.readFileSync(path.join(featureRoot, relativePath), "utf8"))
    .join("\n");
  expect(source).not.toMatch(/AdminShell|backend-session|ROLE_PERMISSIONS|hasPermission/);
  expect(source).not.toMatch(/from ["']@\/app\/admin|from ["']@\/components\/admin/);

  const registrySource = fs.readFileSync(path.join(featureRoot, "config/capability-registry.ts"), "utf8");
  expect(registrySource).not.toMatch(/AdminAssignmentSchema|AdminInternalNoteSchema|AdminExportJobSchema|AdminMetricSchema|AdminChartSchema/);
});
