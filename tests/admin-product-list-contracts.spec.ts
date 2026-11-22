/**
 * @file admin-product-list-contracts.spec.ts
 * @description
 * Contract, wire parameter, strict PR #80 envelope parsing, masking,
 * error mapping, authority key isolation, and returnTo sanitization tests
 * for PM-F1 READ.
 */

import { expect, test } from "@playwright/test";
import { ApiError, resetApiClientSecurityStateForTests } from "../src/services/api";
import { adminProductsApi } from "../src/services/admin/products";
import {
  AdminProductListContractError,
  formatAdminProductSellerContact,
  formatAdminProductSellerLabel,
  getProductListSafeError,
  parseAdminProductListResponse,
} from "../src/features/admin-products/lib/product-list-contract";
import {
  buildProductDetailHref,
  parseProductListQuery,
  validateAdminProductsReturnTarget,
} from "../src/features/admin-products/lib/product-list-state";
import {
  adminProductListTerminalStore,
  adminProductsListQueryKey,
  isObsoleteProductQuery,
  isTerminalProductAuthError,
  shouldPublishTerminalProductAuthError,
} from "../src/features/admin-products/lib/product-list-authority";

const originalFetch = globalThis.fetch;

function makeSampleBackendProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    title: "Solar Inverter 5kVA",
    slug: "solar-inverter-5kva",
    sku: "SOL-5KVA-01",
    status: "PENDING_REVIEW",
    price: 12500,
    salePrice: null,
    stock: 4,
    isSold: false,
    isApproved: false,
    category: "ELECTRONICS",
    categorySlug: "solar-inverters",
    subcategorySlug: "hybrid-inverters",
    categoryRef: {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Solar Inverters",
      slug: "solar-inverters",
      parentId: null,
    },
    images: [{ url: "http://127.0.0.1:5041/img/inv.png", isPrimary: true }],
    user: {
      id: "22222222-2222-4222-8222-222222222222",
      firstName: "Mutale",
      lastName: "Banda",
      email: "mutale@example.zm",
      telephone: "+260971112233",
    },
    rejectionReason: null,
    reviewNotes: null,
    views: 18,
    createdAt: "2026-11-20T08:00:00.000Z",
    updatedAt: "2026-11-20T09:00:00.000Z",
    approvedAt: null,
    ...overrides,
  };
}

test.describe("PM-F1 Admin Product List Contracts", () => {
  test.afterEach(() => {
    globalThis.fetch = originalFetch;
    resetApiClientSecurityStateForTests();
  });

  test("fetchProductsPage sends exact PR #80 bounded query params and never limit=500", async () => {
    const capturedUrls: URL[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      capturedUrls.push(url);
      return new Response(
        JSON.stringify({
          status: "success",
          results: 1,
          pagination: { total: 21, page: 2, limit: 20, pages: 2 },
          data: { products: [makeSampleBackendProduct()] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await adminProductsApi.fetchProductsPage({
      page: 2,
      limit: 20,
      status: "PENDING_REVIEW",
      search: "  Inverter  ",
      sortBy: "price",
      sortOrder: "asc",
    });

    expect(capturedUrls).toHaveLength(1);
    const params = capturedUrls[0].searchParams;
    expect(params.get("page")).toBe("2");
    expect(params.get("limit")).toBe("20");
    expect(params.get("excludeDrafts")).toBe("true");
    expect(params.get("status")).toBe("PENDING_REVIEW");
    expect(params.get("statusMode")).toBe("exact");
    expect(params.get("search")).toBe("Inverter");
    expect(params.get("sortBy")).toBe("price");
    expect(params.get("sortOrder")).toBe("asc");
    expect(result.pagination).toEqual({ total: 21, page: 2, limit: 20, pages: 2 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].status).toBe("PENDING_REVIEW");
  });

  test("fetchProductsPage omits status and statusMode when status is 'all' and caps limit at 100", async () => {
    const capturedUrls: URL[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      capturedUrls.push(new URL(typeof input === "string" ? input : input.toString()));
      return new Response(
        JSON.stringify({
          status: "success",
          results: 0,
          pagination: { total: 0, page: 1, limit: 100, pages: 0 },
          data: { products: [] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const res = await adminProductsApi.fetchProductsPage({
      page: 1,
      limit: 500,
      status: "all",
    });

    const params = capturedUrls[0].searchParams;
    expect(params.get("limit")).toBe("100");
    expect(params.get("excludeDrafts")).toBe("true");
    expect(params.has("status")).toBe(false);
    expect(params.has("statusMode")).toBe(false);
    expect(res.pagination.pages).toBe(0);
    expect(res.items).toEqual([]);
  });

  test("preserves masked seller identity/contact without fabricating Zogular Store", () => {
    const parsed = parseAdminProductListResponse(
      {
        status: "success",
        results: 1,
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        data: {
          products: [
            makeSampleBackendProduct({
              user: { id: "seller-masked-01" },
            }),
          ],
        },
      },
      { excludeDrafts: true },
    );

    const seller = parsed.items[0].seller;
    expect(seller.identityMasked).toBe(true);
    expect(seller.contactMasked).toBe(true);
    expect(formatAdminProductSellerLabel(seller)).toBe("Masked (permission required)");
    expect(formatAdminProductSellerContact(seller)).toBe("Contact masked");
  });

  test("rejects DRAFT rows when excludeDrafts=true, unknown status, mismatched results, and limit > 100", () => {
    expect(() =>
      parseAdminProductListResponse(
        {
          status: "success",
          results: 1,
          pagination: { total: 1, page: 1, limit: 20, pages: 1 },
          data: { products: [makeSampleBackendProduct({ status: "DRAFT" })] },
        },
        { excludeDrafts: true },
      ),
    ).toThrow(AdminProductListContractError);

    expect(() =>
      parseAdminProductListResponse({
        status: "success",
        results: 1,
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        data: { products: [makeSampleBackendProduct({ status: "REJECTED" })] },
      }),
    ).toThrow(AdminProductListContractError);

    expect(() =>
      parseAdminProductListResponse({
        status: "success",
        results: 2,
        pagination: { total: 2, page: 1, limit: 20, pages: 1 },
        data: { products: [makeSampleBackendProduct()] },
      }),
    ).toThrow(AdminProductListContractError);

    expect(() =>
      parseAdminProductListResponse({
        status: "success",
        results: 0,
        pagination: { total: 0, page: 1, limit: 101, pages: 0 },
        data: { products: [] },
      }),
    ).toThrow(AdminProductListContractError);
  });

  test("maps 401, 403, 409, 429, 500, and contract errors honestly", () => {
    expect(getProductListSafeError(new ApiError("Unauthorized", 401)).kind).toBe("unauthenticated");
    expect(getProductListSafeError(new ApiError("Forbidden", 403)).kind).toBe("forbidden");
    expect(getProductListSafeError(new ApiError("Conflict", 409)).kind).toBe("conflict");
    expect(getProductListSafeError(new ApiError("Too many", 429)).kind).toBe("rate_limited");
    expect(getProductListSafeError(new ApiError("Down", 503)).kind).toBe("unavailable");
    expect(
      getProductListSafeError(new AdminProductListContractError("Bad shape")).kind,
    ).toBe("malformed");
    expect(isTerminalProductAuthError(getProductListSafeError(new ApiError("Unauthorized", 401)))).toBe(true);
    expect(isTerminalProductAuthError(getProductListSafeError(new ApiError("Forbidden", 403)))).toBe(true);
    expect(isTerminalProductAuthError(getProductListSafeError(new ApiError("Down", 500)))).toBe(false);
  });

  test("validates returnTo targets and rejects open redirects or nested paths", () => {
    expect(
      validateAdminProductsReturnTarget("/admin/products?page=2&status=PENDING_REVIEW&view=grid"),
    ).toBe("/admin/products?page=2&status=PENDING_REVIEW&view=grid");

    expect(validateAdminProductsReturnTarget("https://evil.test/admin/products")).toBe(
      "/admin/products",
    );
    expect(validateAdminProductsReturnTarget("//evil.test/admin/products")).toBe(
      "/admin/products",
    );
    expect(validateAdminProductsReturnTarget("/admin/products/123")).toBe("/admin/products");
    expect(validateAdminProductsReturnTarget("javascript:alert(1)")).toBe("/admin/products");

    expect(
      buildProductDetailHref("prod-1", "/admin/products?page=2&status=PUBLISHED"),
    ).toBe("/admin/products/prod-1?returnTo=%2Fadmin%2Fproducts%3Fpage%3D2%26status%3DPUBLISHED");
  });

  test("parses bounded URL query state and rejects legacy/invalid values", () => {
    const parsed = parseProductListQuery(
      new URLSearchParams("page=3&limit=500&status=REJECTED&sortBy=price&sortOrder=asc&view=grid"),
    );
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(20);
    expect(parsed.status).toBe("all");
    expect(parsed.sortBy).toBe("price");
    expect(parsed.sortOrder).toBe("asc");
    expect(parsed.view).toBe("grid");
  });

  test("isolates query keys by actor, role, and sorted permissions", () => {
    const q = parseProductListQuery(new URLSearchParams("page=1&limit=20"));
    const keyA = adminProductsListQueryKey(q, "actor-a", "OPERATIONS", [
      "approve_products",
      "view_all_products",
    ]);
    expect(
      isObsoleteProductQuery(keyA, "actor-a", "OPERATIONS", [
        "view_all_products",
        "approve_products",
      ]),
    ).toBe(false);
    expect(
      isObsoleteProductQuery(keyA, "actor-b", "OPERATIONS", [
        "approve_products",
        "view_all_products",
      ]),
    ).toBe(true);
    expect(
      isObsoleteProductQuery(keyA, "actor-a", "TECH_ADMIN", ["view_all_products"]),
    ).toBe(true);
  });

  test("forwards AbortSignal to fetch and rejects aborted delayed requests cleanly", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    let markReady!: () => void;
    const fetchReady = new Promise<void>((resolve) => {
      markReady = resolve;
    });

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        const onAbort = () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        };
        if (receivedSignal?.aborted) {
          markReady();
          onAbort();
          return;
        }
        receivedSignal?.addEventListener("abort", onAbort, { once: true });
        markReady();
      });
    }) as typeof fetch;

    const pending = adminProductsApi.fetchProductsPage(
      { page: 1, limit: 20 },
      { signal: controller.signal },
    );

    await fetchReady;
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: "ApiError", status: 408 });
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(true);
  });

  test("adminProductListTerminalStore isolates and clears terminal auth state", () => {
    adminProductListTerminalStore.clear();
    expect(adminProductListTerminalStore.getSnapshot()).toBeNull();

    adminProductListTerminalStore.setError({
      kind: "forbidden",
      status: 403,
      message: "Access restricted",
    });
    expect(adminProductListTerminalStore.getSnapshot()?.status).toBe(403);

    adminProductListTerminalStore.clear();
    expect(adminProductListTerminalStore.getSnapshot()).toBeNull();
  });

  test("shouldPublishTerminalProductAuthError blocks stale-authority and aborted 401/403 side effects (helper/contract check)", () => {
    const err401 = getProductListSafeError(new ApiError("Unauthorized", 401));
    const err403 = getProductListSafeError(new ApiError("Forbidden", 403));

    // Late 401/403 from Actor A after switching to Actor B must NOT publish or purge
    expect(
      shouldPublishTerminalProductAuthError({
        error: err401,
        capturedAuthorityKey: "actor-a:OPERATIONS:approve_products,view_all_products:0",
        latestAuthorityKey: "actor-b:TECH_ADMIN:view_all_products:0",
        signalAborted: false,
      }),
    ).toBe(false);

    // Aborted signal must NOT publish or purge
    expect(
      shouldPublishTerminalProductAuthError({
        error: err403,
        capturedAuthorityKey: "actor-b:TECH_ADMIN:view_all_products:0",
        latestAuthorityKey: "actor-b:TECH_ADMIN:view_all_products:0",
        signalAborted: true,
      }),
    ).toBe(false);

    // Active matching authority and non-aborted signal MUST publish and purge
    expect(
      shouldPublishTerminalProductAuthError({
        error: err401,
        capturedAuthorityKey: "actor-b:TECH_ADMIN:view_all_products:0",
        latestAuthorityKey: "actor-b:TECH_ADMIN:view_all_products:0",
        signalAborted: false,
      }),
    ).toBe(true);
  });
});
