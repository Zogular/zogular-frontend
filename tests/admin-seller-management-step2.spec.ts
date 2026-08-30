import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { resetApiClientSecurityStateForTests } from "../src/services/api";
import {
  AdminVendorApplicationListContractError,
  buildAdminVendorApplicationListQuery,
  getVendorApplications,
  parseAdminVendorApplicationListResponse,
  SELLER_APPLICATION_STATUSES,
} from "../src/services/admin/vendor-applications";
import {
  applySellerListUrlUpdates,
  INITIAL_SELLER_LIST_REQUEST_STATE,
  parseSellerListQuery,
  reduceSellerListRequestState,
  sellerListQueryKey,
} from "../src/features/admin-sellers/lib/seller-list-state";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiClientSecurityStateForTests();
});

function listPayload(overrides: Record<string, unknown> = {}) {
  const byStatus = Object.fromEntries(SELLER_APPLICATION_STATUSES.map((status) => [status, status === "SUBMITTED" ? 1 : 0]));
  return {
    status: "success",
    results: 1,
    pagination: { total: 1, page: 1, limit: 20, pages: 1 },
    facets: { byStatus },
    data: {
      applications: [{
        id: "11111111-1111-4111-8111-111111111111",
        sellerType: "INDIVIDUAL",
        status: "SUBMITTED",
        ownerFullName: "Ada Seller",
        storeName: "Ada Market",
        createdAt: "2026-08-29T08:00:00.000Z",
        updatedAt: "2026-08-29T09:00:00.000Z",
        submittedAt: "2026-08-29T08:30:00.000Z",
      }],
    },
    ...overrides,
  };
}

test("serializes every allowlisted server query field", async () => {
  expect(buildAdminVendorApplicationListQuery({
    page: 3,
    limit: 40,
    search: "  Ada  ",
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  })).toEqual({
    page: 3,
    limit: 40,
    search: "Ada",
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  });

  let requestedUrl: URL | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = new URL(input instanceof Request ? input.url : String(input));
    return new Response(JSON.stringify(listPayload()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  await getVendorApplications({
    page: 3,
    limit: 40,
    search: "Ada",
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  });

  expect(Object.fromEntries(requestedUrl!.searchParams)).toEqual({
    page: "3",
    limit: "40",
    search: "Ada",
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  });
});

test("strictly parses pagination, all status facets, and application identity fields", () => {
  const parsed = parseAdminVendorApplicationListResponse(listPayload());
  expect(parsed.pagination).toEqual({ total: 1, page: 1, limit: 20, pages: 1 });
  expect(parsed.applications).toHaveLength(1);
  expect(parsed.applications[0]).toMatchObject({
    id: "11111111-1111-4111-8111-111111111111",
    sellerType: "INDIVIDUAL",
    status: "SUBMITTED",
  });
  expect(Object.keys(parsed.facets.byStatus)).toEqual(SELLER_APPLICATION_STATUSES);
  expect(parsed.facets.byStatus.REJECTED).toBe(0);
});

test("rejects malformed pagination, missing facets, unexpected statuses, and invalid rows atomically", () => {
  const base = listPayload();
  const cases: unknown[] = [
    { ...base, status: "ok" },
    { ...base, pagination: { total: 21, page: 1, limit: 20, pages: 1 } },
    { ...base, facets: undefined },
    {
      ...base,
      facets: {
        byStatus: {
          ...((base.facets as { byStatus: Record<string, number> }).byStatus),
          REJECTED: undefined,
        },
      },
    },
    {
      ...base,
      data: {
        ...(base.data as Record<string, unknown>),
        applications: [{ id: "", sellerType: "INDIVIDUAL", status: "SUBMITTED" }],
      },
    },
  ];
  for (const payload of cases) {
    expect(() => parseAdminVendorApplicationListResponse(payload)).toThrow(AdminVendorApplicationListContractError);
  }
});

test("rejects facets nested under data instead of the approved root envelope", () => {
  const payload = listPayload();
  const nestedPayload = {
    ...payload,
    facets: undefined,
    data: {
      ...(payload.data as Record<string, unknown>),
      facets: payload.facets,
    },
  };

  expect(() => parseAdminVendorApplicationListResponse(nestedPayload)).toThrow(
    AdminVendorApplicationListContractError,
  );
});

test("restores normalized URL state and resets page for filter changes", () => {
  const restored = parseSellerListQuery(new URLSearchParams("search=Ada&page=4&limit=40&status=SUBMITTED&sellerType=INDIVIDUAL&sort=storeName&direction=asc"));
  expect(restored).toEqual({
    search: "Ada",
    page: 4,
    limit: 40,
    status: "SUBMITTED",
    sellerType: "INDIVIDUAL",
    sort: "storeName",
    direction: "asc",
  });

  const reset = applySellerListUrlUpdates(new URLSearchParams("page=4&status=SUBMITTED"), {
    status: "APPROVED",
    page: "",
  });
  expect(reset.toString()).toBe("status=APPROVED");
});

test("stale responses and stale failures cannot replace the latest request", () => {
  const firstQuery = parseSellerListQuery(new URLSearchParams("search=first"));
  const secondQuery = parseSellerListQuery(new URLSearchParams("search=second"));
  const firstKey = sellerListQueryKey(firstQuery);
  const secondKey = sellerListQueryKey(secondQuery);
  const data = parseAdminVendorApplicationListResponse(listPayload());

  let state = reduceSellerListRequestState(INITIAL_SELLER_LIST_REQUEST_STATE, {
    type: "request-started",
    requestId: 1,
    queryKey: firstKey,
  });
  state = reduceSellerListRequestState(state, {
    type: "request-started",
    requestId: 2,
    queryKey: secondKey,
  });
  const staleSuccess = reduceSellerListRequestState(state, {
    type: "request-succeeded",
    requestId: 1,
    queryKey: firstKey,
    data,
  });
  expect(staleSuccess).toBe(state);

  const currentSuccess = reduceSellerListRequestState(state, {
    type: "request-succeeded",
    requestId: 2,
    queryKey: secondKey,
    data,
  });
  expect(currentSuccess.data).toBe(data);
  expect(currentSuccess.dataQueryKey).toBe(secondKey);

  const refreshing = reduceSellerListRequestState(currentSuccess, {
    type: "request-started",
    requestId: 3,
    queryKey: secondKey,
  });
  expect(refreshing.isRefreshing).toBe(true);
  const failedRefresh = reduceSellerListRequestState(refreshing, {
    type: "request-failed",
    requestId: 3,
    queryKey: secondKey,
    error: { kind: "unavailable", message: "The seller queue is temporarily unavailable. Try again." },
  });
  expect(failedRefresh.data).toBe(data);
  expect(failedRefresh.error?.kind).toBe("unavailable");
  expect(failedRefresh.isRefreshing).toBe(false);
});

test("seller list source preserves permission actions and contains honest operational states", () => {
  const page = readSource("src/app/admin/(protected)/sellers/page.tsx");
  const hook = readSource("src/features/admin-sellers/hooks/use-sellers-list.ts");
  const filters = readSource("src/features/admin-sellers/sections/SellersListFilters.tsx");
  const table = readSource("src/features/admin-sellers/sections/SellersListTable.tsx");

  expect(hook).toContain("new AbortController()");
  expect(hook).toContain("requestIdRef");
  expect(hook).toContain("300");
  expect(hook).not.toContain("matchesApplicationSearch");
  expect(hook).not.toContain("visibleCount");
  expect(hook).not.toContain("limit: 100");
  expect(hook).toContain('adminIdentityHasPermission(identity, "approve_sellers")');
  expect(hook).toContain('adminIdentityHasPermission(identity, "suspend_sellers")');
  expect(page).toContain("Export current page ({currentPageRows})");
  expect(page).toContain("The seller queue is empty");
  expect(page).toContain("No seller applications match this view");
  expect(page).toContain("Could not verify the seller queue");
  expect(page).not.toContain("AdminMetricCard");
  expect(page).not.toContain("animate-pulse");
  expect(filters).toContain('placeholder="Search seller records"');
  expect(filters).toContain('aria-describedby="seller-queue-search-scope"');
  expect(filters).toContain("Store, owner, email, phone, or application ID.");
  expect(filters).toContain("facets?.[status]");
  expect(table).toContain("getAvailableVendorActions");
  expect(table).toContain("/admin/sellers/${application.id}");
});
