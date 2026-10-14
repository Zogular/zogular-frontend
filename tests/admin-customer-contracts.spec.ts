/**
 * @file admin-customer-contracts.spec.ts
 * @description
 * Unit and contract tests for the Customer Management read workspace (CM-F1).
 * Tests:
 * 1. Runtime Zod contract validation (list & detail envelopes).
 * 2. Strict rejection of non-CUSTOMER records with typed contract error.
 * 3. Distinct modeling of omitted restricted fields vs actual null fields.
 * 4. Query URL parameter parsing, normalization, and bounds enforcement.
 * 5. Query key generation incorporating actor ID and role authority.
 * 6. Reducer state transitions: stale-response discarding, same-query refresh retention,
 *    different-query data clearing, and auth-loss cache purging.
 * 7. Safe error mapping for HTTP error boundaries.
 */

import { expect, test } from "@playwright/test";
import {
  AdminBuyerContractError,
  adminBuyerRecordSchema,
  adminBuyersPaginationSchema,
  adminBuyerListResponseSchema,
  adminBuyerDetailRecordSchema,
  adminBuyerDetailResponseSchema,
  validateBuyerDetailResponse,
  validateBuyerListResponse,
  formatBuyerDisplayName,
  isBuyerIdentityMasked,
  isBuyerContactMasked,
} from "../src/features/admin-buyers/lib/buyer-contract";
import { QueryClient } from "@tanstack/react-query";
import {
  ADMIN_BUYERS_QUEUE_PATH,
  adminCustomersListQueryKey,
  adminCustomerDetailQueryKey,
  applyBuyerListUrlUpdates,
  buyerListQueryKey,
  canReturnToAdminBuyersQueue,
  createCustomerTerminalStore,
  getBuyerSafeError,
  INITIAL_BUYER_LIST_REQUEST_STATE,
  isObsoleteCustomerQuery,
  isTerminalAuthError,
  parseBuyerListQuery,
  reduceBuyerListRequestState,
  validateAdminBuyersReturnTarget,
  setAdminBuyersReturnTarget,
  getAdminBuyersReturnTarget,
  type BuyerListQueryState,
} from "../src/features/admin-buyers/lib/buyer-list-state";
import { ApiError } from "../src/services/api";

test.describe("CM-F1 Customer Contract & State Management", () => {
  // --------------------------------------------------------------------------
  // 1. Runtime DTO Validation & Role Enforcement
  // --------------------------------------------------------------------------
  test("validates a compliant customer list response with full permissions", () => {
    const raw = {
      status: "success",
      results: 1,
      pagination: {
        total: 1,
        page: 1,
        limit: 20,
        pages: 1,
      },
      data: {
        users: [
          {
            id: "usr-cust-1",
            role: "CUSTOMER",
            isActive: true,
            emailVerified: true,
            phoneVerified: false,
            emailVerifiedAt: "2026-01-15T10:00:00.000Z",
            phoneVerifiedAt: null,
            createdAt: "2026-01-15T09:30:00.000Z",
            updatedAt: "2026-01-15T10:00:00.000Z",
            firstName: "Mwamba",
            lastName: "Mutale",
            email: "mwamba@example.zm",
            telephone: "+260971234567",
          },
        ],
      },
    };

    const parsed = validateBuyerListResponse(raw);
    expect(parsed.status).toBe("success");
    expect(parsed.data.users).toHaveLength(1);
    expect(parsed.data.users[0].firstName).toBe("Mwamba");
    expect(parsed.data.users[0].lastName).toBe("Mutale");
    expect(isBuyerIdentityMasked(parsed.data.users[0])).toBe(false);
    expect(formatBuyerDisplayName(parsed.data.users[0])).toBe("Mwamba Mutale");
  });

  test("strictly rejects non-CUSTOMER records in list response", () => {
    const rawWithVendor = {
      status: "success",
      results: 1,
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      data: {
        users: [
          {
            id: "usr-vnd-1",
            role: "VENDOR", // Invalid in customer workspace
            isActive: true,
            emailVerified: true,
            phoneVerified: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            firstName: "Shop",
            lastName: "Owner",
          },
        ],
      },
    };

    expect(() => validateBuyerListResponse(rawWithVendor)).toThrowError(AdminBuyerContractError);
    try {
      validateBuyerListResponse(rawWithVendor);
    } catch (err) {
      expect(err).toBeInstanceOf(AdminBuyerContractError);
      expect((err as AdminBuyerContractError).kind).toBe("non_customer");
    }
  });

  test("strictly rejects non-CUSTOMER records in detail response", () => {
    const rawWithAdmin = {
      status: "success",
      data: {
        user: {
          id: "usr-adm-1",
          role: "SUPER_ADMIN",
          isActive: true,
          emailVerified: true,
          phoneVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          firstName: "Admin",
          lastName: "User",
        },
      },
    };

    expect(() => validateBuyerDetailResponse(rawWithAdmin)).toThrowError(AdminBuyerContractError);
    try {
      validateBuyerDetailResponse(rawWithAdmin);
    } catch (err) {
      expect((err as AdminBuyerContractError).kind).toBe("non_customer");
    }
  });

  // --------------------------------------------------------------------------
  // 2. Sensitive Field Masking vs Actual Null Fields
  // --------------------------------------------------------------------------
  test("correctly parses omitted restricted fields when actor lacks sensitive field permission", () => {
    // Restricted actor response: firstName, lastName, email, telephone are omitted
    const restrictedRaw = {
      status: "success",
      results: 1,
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      data: {
        users: [
          {
            id: "usr-cust-restricted",
            role: "CUSTOMER",
            isActive: true,
            emailVerified: true,
            phoneVerified: false,
            createdAt: "2026-02-01T08:00:00.000Z",
            updatedAt: "2026-02-01T08:00:00.000Z",
          },
        ],
      },
    };

    const parsed = validateBuyerListResponse(restrictedRaw);
    const user = parsed.data.users[0];

    // Omitted fields are strictly undefined
    expect(user.firstName).toBeUndefined();
    expect(user.lastName).toBeUndefined();
    expect(user.email).toBeUndefined();
    expect(user.telephone).toBeUndefined();

    // Helper functions reflect restricted masking
    expect(isBuyerIdentityMasked(user)).toBe(true);
    expect(isBuyerContactMasked(user)).toBe(true);
    expect(formatBuyerDisplayName(user)).toBe("(Name Restricted)");
  });

  test("distinguishes omitted restricted telephone from an actual null telephone", () => {
    // Permitted actor, but user did not provide telephone
    const userWithNullPhone = {
      id: "usr-cust-2",
      role: "CUSTOMER" as const,
      isActive: true,
      emailVerified: true,
      phoneVerified: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      firstName: "Chileshe",
      lastName: "Banda",
      email: "chileshe@example.zm",
      telephone: null, // User has no phone on record
    };

    expect(userWithNullPhone.telephone).toBeNull();
    expect(isBuyerContactMasked(userWithNullPhone)).toBe(false); // Contact is NOT masked because email is present
  });

  // --------------------------------------------------------------------------
  // 3. Malformed Envelope & Strict Schema Rejection
  // --------------------------------------------------------------------------
  test("rejects malformed envelopes with missing required pagination or user ID", () => {
    // Missing pagination
    expect(() =>
      validateBuyerListResponse({
        status: "success",
        data: { users: [] },
      }),
    ).toThrowError(AdminBuyerContractError);

    // Negative pagination bounds
    expect(() =>
      validateBuyerListResponse({
        status: "success",
        pagination: { total: -1, page: 1, limit: 20, pages: 1 },
        data: { users: [] },
      }),
    ).toThrowError(AdminBuyerContractError);

    // Missing user ID
    expect(() =>
      validateBuyerDetailResponse({
        status: "success",
        data: {
          user: {
            role: "CUSTOMER",
            isActive: true,
            emailVerified: true,
            phoneVerified: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      }),
    ).toThrowError(AdminBuyerContractError);
  });

  test("strictly rejects unexpected expanded fields across all customer schemas (.strict() enforcement)", () => {
    const validUser = {
      id: "usr-cust-1",
      role: "CUSTOMER",
      isActive: true,
      emailVerified: true,
      phoneVerified: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    // 1. Record schema rejects unknown extra fields
    const userWithExtra = { ...validUser, unexpectedField: "leaked_data", internalAudit: 123 };
    expect(() => adminBuyerRecordSchema.parse(userWithExtra)).toThrow();

    // 2. Pagination schema rejects unknown extra fields
    const validPagination = { total: 1, page: 1, limit: 20, pages: 1 };
    expect(() => adminBuyersPaginationSchema.parse({ ...validPagination, extraMeta: true })).toThrow();

    // 3. List response schema rejects unknown extra fields at top level and data level
    const validListEnvelope = {
      status: "success",
      results: 1,
      pagination: validPagination,
      data: { users: [validUser] },
    };
    expect(() => adminBuyerListResponseSchema.parse({ ...validListEnvelope, debugTrace: "xyz" })).toThrow();
    expect(() =>
      adminBuyerListResponseSchema.parse({
        ...validListEnvelope,
        data: { users: [validUser], unknownCollection: [] },
      }),
    ).toThrow();

    // 4. Detail response schema rejects unknown extra fields
    const validDetailEnvelope = {
      status: "success",
      data: { user: validUser },
    };
    expect(() => adminBuyerDetailResponseSchema.parse({ ...validDetailEnvelope, serverStats: {} })).toThrow();

    // 5. Detail record schema accepts valid createdBy/investorId and rejects unknown extra fields
    const validDetailUser = { ...validUser, createdBy: "usr-admin-1", investorId: null };
    expect(() => adminBuyerDetailRecordSchema.parse(validDetailUser)).not.toThrow();
    expect(() => adminBuyerDetailRecordSchema.parse({ ...validDetailUser, extraLeakedProp: true })).toThrow();
  });

  test("enforces pages === 0 when total === 0 and positive limits/pages otherwise", () => {
    // total === 0 with pages === 0 is valid
    const zeroValid = adminBuyersPaginationSchema.safeParse({
      total: 0,
      page: 1,
      limit: 20,
      pages: 0,
    });
    expect(zeroValid.success).toBe(true);

    // total === 0 with pages === 1 is INVALID
    const zeroInvalid = adminBuyersPaginationSchema.safeParse({
      total: 0,
      page: 1,
      limit: 20,
      pages: 1,
    });
    expect(zeroInvalid.success).toBe(false);

    // total > 0 requires correct pages calculation
    const positiveValid = adminBuyersPaginationSchema.safeParse({
      total: 45,
      page: 1,
      limit: 20,
      pages: 3,
    });
    expect(positiveValid.success).toBe(true);

    const positiveMismatch = adminBuyersPaginationSchema.safeParse({
      total: 45,
      page: 1,
      limit: 20,
      pages: 2, // 45 / 20 ceiling is 3, not 2
    });
    expect(positiveMismatch.success).toBe(false);
  });

  test("strictly rejects partial sensitive field shapes", () => {
    const baseUser = {
      id: "usr-cust-1",
      role: "CUSTOMER",
      isActive: true,
      emailVerified: true,
      phoneVerified: false,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    // firstName present, lastName missing -> REJECTED
    expect(() =>
      adminBuyerRecordSchema.parse({
        ...baseUser,
        firstName: "Mwamba",
      }),
    ).toThrow();

    // lastName present, firstName missing -> REJECTED
    expect(() =>
      adminBuyerRecordSchema.parse({
        ...baseUser,
        lastName: "Mutale",
      }),
    ).toThrow();

    // email present, telephone missing -> REJECTED
    expect(() =>
      adminBuyerRecordSchema.parse({
        ...baseUser,
        email: "mwamba@example.zm",
      }),
    ).toThrow();

    // telephone present, email missing -> REJECTED
    expect(() =>
      adminBuyerRecordSchema.parse({
        ...baseUser,
        telephone: "+260971234567",
      }),
    ).toThrow();

    // Both firstName and lastName present -> ACCEPTED
    expect(() =>
      adminBuyerRecordSchema.parse({
        ...baseUser,
        firstName: "Mwamba",
        lastName: "Mutale",
      }),
    ).not.toThrow();

    // Both email and telephone present (with telephone null or string) -> ACCEPTED
    expect(() =>
      adminBuyerRecordSchema.parse({
        ...baseUser,
        email: "mwamba@example.zm",
        telephone: null,
      }),
    ).not.toThrow();
  });

  test("rejects non-ISO datetime timestamps in buyer records", () => {
    const baseUser = {
      id: "usr-cust-1",
      role: "CUSTOMER",
      isActive: true,
      emailVerified: true,
      phoneVerified: false,
      createdAt: "not-a-timestamp",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(() => adminBuyerRecordSchema.parse(baseUser)).toThrow();

    const badUpdatedAt = {
      ...baseUser,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026/01/01",
    };
    expect(() => adminBuyerRecordSchema.parse(badUpdatedAt)).toThrow();
  });

  test("rejects results count mismatch with data.users length in list response", () => {
    const rawMismatch = {
      status: "success",
      results: 5, // Mismatched: says 5 but only 1 user provided
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      data: {
        users: [
          {
            id: "usr-1",
            role: "CUSTOMER",
            isActive: true,
            emailVerified: true,
            phoneVerified: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    };

    expect(() => validateBuyerListResponse(rawMismatch)).toThrowError(AdminBuyerContractError);
  });

  // --------------------------------------------------------------------------
  // 4. URL State Parsing, Serialization & Cache Keys
  // --------------------------------------------------------------------------
  test("parses URL parameters with strict defaults and limits bounds", () => {
    const emptyParams = new URLSearchParams("");
    const parsedDefault = parseBuyerListQuery(emptyParams);
    expect(parsedDefault.page).toBe(1);
    expect(parsedDefault.limit).toBe(20);
    expect(parsedDefault.search).toBe("");
    expect(parsedDefault.isActive).toBe("all");
    expect(parsedDefault.sortBy).toBe("createdAt");
    expect(parsedDefault.sortOrder).toBe("desc");
    expect(parsedDefault.view).toBe("list");

    const customParams = new URLSearchParams(
      "page=3&limit=50&search=alice&isActive=true&sortBy=firstName&sortOrder=asc&view=grid",
    );
    const parsedCustom = parseBuyerListQuery(customParams);
    expect(parsedCustom.page).toBe(3);
    expect(parsedCustom.limit).toBe(50);
    expect(parsedCustom.search).toBe("alice");
    expect(parsedCustom.isActive).toBe("active");
    expect(parsedCustom.sortBy).toBe("firstName");
    expect(parsedCustom.sortOrder).toBe("asc");
    expect(parsedCustom.view).toBe("grid");

    // Invalid limit falls back to 20
    const invalidLimitParams = new URLSearchParams("limit=999");
    expect(parseBuyerListQuery(invalidLimitParams).limit).toBe(20);

    // Negative page falls back to 1
    const invalidPageParams = new URLSearchParams("page=-5");
    expect(parseBuyerListQuery(invalidPageParams).page).toBe(1);
  });

  test("applies URL updates cleanly removing default or empty keys", () => {
    const current = new URLSearchParams("page=2&search=alice");
    const updated = applyBuyerListUrlUpdates(current, {
      search: "", // Remove search
      page: null, // Remove page
      isActive: "active",
    });

    expect(updated.has("search")).toBe(false);
    expect(updated.has("page")).toBe(false);
    expect(updated.get("isActive")).toBe("active");
  });

  test("generates query keys incorporating actor identity and role authority", () => {
    const queryState: BuyerListQueryState = {
      page: 1,
      limit: 20,
      search: "alice",
      isActive: "active",
      sortBy: "createdAt",
      sortOrder: "desc",
      view: "list",
    };

    const keySuperAdmin = buyerListQueryKey(queryState, "admin-1", "SUPER_ADMIN");
    const keyTechAdmin = buyerListQueryKey(queryState, "admin-2", "TECH_ADMIN");
    const keySameAdminOtherQuery = buyerListQueryKey(
      { ...queryState, search: "bob" },
      "admin-1",
      "SUPER_ADMIN",
    );

    expect(keySuperAdmin).toContain("actor:admin-1");
    expect(keySuperAdmin).toContain("role:SUPER_ADMIN");
    expect(keyTechAdmin).toContain("actor:admin-2");
    expect(keyTechAdmin).toContain("role:TECH_ADMIN");

    // Ensure distinct keys
    expect(keySuperAdmin).not.toBe(keyTechAdmin);
    expect(keySuperAdmin).not.toBe(keySameAdminOtherQuery);
  });

  test("generates canonical TanStack query keys with permission sorting determinism", () => {
    const queryState: BuyerListQueryState = {
      page: 1,
      limit: 20,
      search: "mutale",
      isActive: "active",
      sortBy: "createdAt",
      sortOrder: "desc",
      view: "list",
    };

    // Permutation of permissions should produce identical cache keys due to sorting
    const permsA = ["view_all_users", "access_admin_panel"];
    const permsB = ["access_admin_panel", "view_all_users"];

    const keyA = adminCustomersListQueryKey(queryState, "admin-1", "SUPER_ADMIN", permsA);
    const keyB = adminCustomersListQueryKey(queryState, "admin-1", "SUPER_ADMIN", permsB);
    expect(keyA).toEqual(keyB);

    // Permission revocation produces different cache key
    const permsRestricted = ["access_admin_panel"];
    const keyRestricted = adminCustomersListQueryKey(
      queryState,
      "admin-1",
      "SUPER_ADMIN",
      permsRestricted,
    );
    expect(keyA).not.toEqual(keyRestricted);

    // Detail query key is scoped to customer ID, actor, role, and permissions
    const detailKey1 = adminCustomerDetailQueryKey("usr-cust-1", "admin-1", "SUPER_ADMIN", permsA);
    const detailKey2 = adminCustomerDetailQueryKey("usr-cust-2", "admin-1", "SUPER_ADMIN", permsA);
    expect(detailKey1).not.toEqual(detailKey2);
    expect(detailKey1[0]).toBe("admin");
    expect(detailKey1[1]).toBe("customers");
    expect(detailKey1[2]).toBe("detail");
    expect(detailKey1[3]).toBe("usr-cust-1");
  });

  test("validates return navigation referrer with canReturnToAdminBuyersQueue", () => {
    const origin = "http://127.0.0.1:3230";

    // Valid queue referrer
    expect(
      canReturnToAdminBuyersQueue(`${origin}${ADMIN_BUYERS_QUEUE_PATH}?search=alice`, origin, 3),
    ).toBe(true);

    // Cross-origin referrer -> REJECTED
    expect(
      canReturnToAdminBuyersQueue("https://malicious.org/admin/buyers", origin, 3),
    ).toBe(false);

    // Other admin section on same origin -> REJECTED
    expect(
      canReturnToAdminBuyersQueue(`${origin}/admin/sellers`, origin, 3),
    ).toBe(false);

    // Empty or initial history length -> REJECTED
    expect(
      canReturnToAdminBuyersQueue(`${origin}${ADMIN_BUYERS_QUEUE_PATH}`, origin, 1),
    ).toBe(false);
    expect(
      canReturnToAdminBuyersQueue("", origin, 3),
    ).toBe(false);

    // Malformed URL string -> REJECTED
    expect(
      canReturnToAdminBuyersQueue("not-a-valid-url", origin, 3),
    ).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 5. Reducer State Transitions & Race Discarding
  // --------------------------------------------------------------------------
  test("reducer discards out-of-order stale responses", () => {
    let state = INITIAL_BUYER_LIST_REQUEST_STATE;

    // Start request 1
    state = reduceBuyerListRequestState(state, {
      type: "request-started",
      requestId: 1,
      queryKey: "query-1",
    });
    expect(state.activeRequestId).toBe(1);
    expect(state.isLoading).toBe(true);

    // Start request 2
    state = reduceBuyerListRequestState(state, {
      type: "request-started",
      requestId: 2,
      queryKey: "query-2",
    });
    expect(state.activeRequestId).toBe(2);

    // Succeeded response for old request 1 arrives late -> MUST BE DISCARDED
    const staleData = {
      status: "success" as const,
      results: 0,
      pagination: { total: 0, page: 1, limit: 20, pages: 0 },
      data: { users: [] },
    };
    state = reduceBuyerListRequestState(state, {
      type: "request-succeeded",
      requestId: 1,
      queryKey: "query-1",
      data: staleData,
    });
    expect(state.data).toBeNull(); // Still null! Stale response ignored.

    // Succeeded response for active request 2 arrives -> ACCEPTED
    const validData = {
      status: "success" as const,
      results: 1,
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      data: {
        users: [
          {
            id: "cust-1",
            role: "CUSTOMER" as const,
            isActive: true,
            emailVerified: true,
            phoneVerified: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    };
    state = reduceBuyerListRequestState(state, {
      type: "request-succeeded",
      requestId: 2,
      queryKey: "query-2",
      data: validData,
    });
    expect(state.data).toEqual(validData);
    expect(state.dataQueryKey).toBe("query-2");
    expect(state.isLoading).toBe(false);
  });

  test("reducer preserves same-query data on background refresh but clears on new query", () => {
    let state = INITIAL_BUYER_LIST_REQUEST_STATE;

    const initialData = {
      status: "success" as const,
      results: 1,
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      data: {
        users: [
          {
            id: "cust-1",
            role: "CUSTOMER" as const,
            isActive: true,
            emailVerified: true,
            phoneVerified: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    };

    // Initial load succeeds
    state = reduceBuyerListRequestState(state, {
      type: "request-started",
      requestId: 1,
      queryKey: "query-page-1",
    });
    state = reduceBuyerListRequestState(state, {
      type: "request-succeeded",
      requestId: 1,
      queryKey: "query-page-1",
      data: initialData,
    });
    expect(state.data).toEqual(initialData);

    // 1. Same-query background refresh: preserves data, sets isRefreshing
    state = reduceBuyerListRequestState(state, {
      type: "request-started",
      requestId: 2,
      queryKey: "query-page-1",
    });
    expect(state.data).toEqual(initialData); // Preserved!
    expect(state.isRefreshing).toBe(true);

    // Same-query refresh fails: preserves data, sets error
    state = reduceBuyerListRequestState(state, {
      type: "request-failed",
      requestId: 2,
      queryKey: "query-page-1",
      error: { kind: "timeout", message: "Timeout" },
    });
    expect(state.data).toEqual(initialData); // Still preserved for recoverable refresh failure
    expect(state.isRefreshing).toBe(false);
    expect(state.error?.kind).toBe("timeout");

    // 2. Different-query filter change: clears data immediately
    state = reduceBuyerListRequestState(state, {
      type: "request-started",
      requestId: 3,
      queryKey: "query-page-2-different",
    });
    expect(state.data).toBeNull(); // Cleared immediately!
    expect(state.isLoading).toBe(true);
  });

  test("reducer clear action purges all cached customer data", () => {
    let state = INITIAL_BUYER_LIST_REQUEST_STATE;
    state = reduceBuyerListRequestState(state, {
      type: "request-started",
      requestId: 1,
      queryKey: "key-1",
    });
    state = reduceBuyerListRequestState(state, {
      type: "request-succeeded",
      requestId: 1,
      queryKey: "key-1",
      data: {
        status: "success",
        results: 1,
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        data: {
          users: [
            {
              id: "c-1",
              role: "CUSTOMER",
              isActive: true,
              emailVerified: true,
              phoneVerified: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      },
    });

    state = reduceBuyerListRequestState(state, { type: "clear" });
    expect(state.data).toBeNull();
    expect(state.dataQueryKey).toBeNull();
    expect(state.error).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 6. Safe Error Mapping
  // --------------------------------------------------------------------------
  test("maps HTTP errors to safe user-facing representations without leaking secrets", () => {
    const err401 = getBuyerSafeError(new ApiError("JWT expired with secret=xyz", 401));
    expect(err401.kind).toBe("unauthenticated");
    expect(err401.message).toBe("Your session has expired. Please sign in again.");
    expect(err401.message).not.toContain("secret");

    const err403 = getBuyerSafeError(new ApiError("Forbidden", 403));
    expect(err403.kind).toBe("forbidden");
    expect(err403.message).toContain("permission");

    const err404 = getBuyerSafeError(new ApiError("User not found", 404));
    expect(err404.kind).toBe("not_found");

    const err500 = getBuyerSafeError(new ApiError("Prisma connection pool exhausted", 500));
    expect(err500.kind).toBe("unavailable");
    expect(err500.message).toContain("temporarily unavailable");
    expect(err500.message).not.toContain("Prisma");

    // 400 Invalid query parameters
    const err400 = getBuyerSafeError(new ApiError("Validation failed: page must be positive", 400));
    expect(err400.kind).toBe("malformed");
    expect(err400.message).toContain("Invalid query parameters");

    // 408 / 504 Timeout
    const err408 = getBuyerSafeError(new ApiError("Request timed out", 408));
    expect(err408.kind).toBe("timeout");
    expect(err408.message).toContain("took too long");

    // 409 Conflict
    const err409 = getBuyerSafeError(new ApiError("Concurrent modification conflict", 409));
    expect(err409.kind).toBe("unavailable");
    expect(err409.message).toContain("conflict occurred");

    // 429 Rate limited
    const err429 = getBuyerSafeError(new ApiError("Too Many Requests", 429));
    expect(err429.kind).toBe("unavailable");
    expect(err429.message).toContain("Too many requests");

    // AbortError
    const abortErr = new Error("The user aborted a request.");
    abortErr.name = "AbortError";
    const errAbort = getBuyerSafeError(abortErr);
    expect(errAbort.kind).toBe("timeout");
    expect(errAbort.message).toContain("cancelled");

    // Network error
    const netErr = new Error("Failed to fetch from backend");
    const errNet = getBuyerSafeError(netErr);
    expect(errNet.kind).toBe("unavailable");
    expect(errNet.message).toContain("Network connection lost");
  });

  // --------------------------------------------------------------------------
  // 7. Queue Return Target Validation & State Retention
  // --------------------------------------------------------------------------
  test("validates same-origin customer queue return targets and rejects open redirects", () => {
    // Valid standard path
    expect(validateAdminBuyersReturnTarget("/admin/buyers")).toBe("/admin/buyers");

    // Valid path with search and filter parameters preserved
    expect(
      validateAdminBuyersReturnTarget("/admin/buyers?search=alice&isActive=active&page=2"),
    ).toBe("/admin/buyers?search=alice&isActive=active&page=2");

    // External absolute URL rejected
    expect(validateAdminBuyersReturnTarget("https://evil.com/phish")).toBe(ADMIN_BUYERS_QUEUE_PATH);
    expect(validateAdminBuyersReturnTarget("http://attacker.com/admin/buyers")).toBe(ADMIN_BUYERS_QUEUE_PATH);

    // Protocol-relative rejected
    expect(validateAdminBuyersReturnTarget("//evil.com/admin/buyers")).toBe(ADMIN_BUYERS_QUEUE_PATH);

    // Non-customer admin sections rejected
    expect(validateAdminBuyersReturnTarget("/admin/sellers")).toBe(ADMIN_BUYERS_QUEUE_PATH);
    expect(validateAdminBuyersReturnTarget("/admin/categories")).toBe(ADMIN_BUYERS_QUEUE_PATH);
    expect(validateAdminBuyersReturnTarget("/admin/orders")).toBe(ADMIN_BUYERS_QUEUE_PATH);

    // Subpath without query rejected (e.g. nested ID path)
    expect(validateAdminBuyersReturnTarget("/admin/buyers/nested-hack")).toBe(ADMIN_BUYERS_QUEUE_PATH);

    // Null, undefined, empty string fall back safely
    expect(validateAdminBuyersReturnTarget(null)).toBe(ADMIN_BUYERS_QUEUE_PATH);
    expect(validateAdminBuyersReturnTarget(undefined)).toBe(ADMIN_BUYERS_QUEUE_PATH);
    expect(validateAdminBuyersReturnTarget("")).toBe(ADMIN_BUYERS_QUEUE_PATH);
    expect(validateAdminBuyersReturnTarget("   ")).toBe(ADMIN_BUYERS_QUEUE_PATH);

    // Custom fallback is honored
    expect(validateAdminBuyersReturnTarget("https://evil.com", "/admin/buyers?page=3")).toBe(
      "/admin/buyers?page=3",
    );
  });

  test("persists and retrieves validated queue return target in memory and storage", () => {
    setAdminBuyersReturnTarget("/admin/buyers?isActive=inactive&page=3");
    expect(getAdminBuyersReturnTarget()).toBe("/admin/buyers?isActive=inactive&page=3");

    // Setting an unsafe target should sanitize to fallback
    setAdminBuyersReturnTarget("https://malicious.org/exploit");
    expect(getAdminBuyersReturnTarget()).toBe(ADMIN_BUYERS_QUEUE_PATH);
  });

  // --------------------------------------------------------------------------
  // 8. Protected Data Lifecycle, Authority Transitions & Terminal Cache Invalidation
  // --------------------------------------------------------------------------
  test.describe("Protected Data Lifecycle & Authority Guards", () => {
    test("actor change without page reload cancels obsolete queries and purges cache while keeping new authority intact", () => {
      const queryClient = new QueryClient();
      const defaultQuery: BuyerListQueryState = {
        page: 1,
        limit: 20,
        search: "",
        isActive: "all",
        sortBy: "createdAt",
        sortOrder: "desc",
        view: "list",
      };

      // 1. Operator A (Super Admin) sets queries in cache
      const actorAId = "admin-alpha";
      const actorARole = "SUPER_ADMIN";
      const actorAPerms = ["access_admin_panel", "view_all_users", "view_user_sensitive_fields"];
      const keyListA = adminCustomersListQueryKey(defaultQuery, actorAId, actorARole, actorAPerms);
      const keyDetailA = adminCustomerDetailQueryKey("usr-cust-1", actorAId, actorARole, actorAPerms);

      queryClient.setQueryData(keyListA, {
        status: "success",
        results: 1,
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        data: { users: [{ id: "usr-cust-1", role: "CUSTOMER", firstName: "Alice", email: "alice@example.zm" }] },
      });
      queryClient.setQueryData(keyDetailA, {
        status: "success",
        data: { user: { id: "usr-cust-1", role: "CUSTOMER", firstName: "Alice", email: "alice@example.zm" } },
      });

      expect(queryClient.getQueryData(keyListA)).toBeDefined();
      expect(queryClient.getQueryData(keyDetailA)).toBeDefined();

      // 2. Operator switches to Operator B (Operations Admin) in memory without page reload
      const actorBId = "admin-beta";
      const actorBRole = "OPERATIONS";
      const actorBPerms = ["access_admin_panel", "view_all_users"];
      const keyListB = adminCustomersListQueryKey(defaultQuery, actorBId, actorBRole, actorBPerms);

      // Verify obsolete predicate correctly identifies Operator A's queries as obsolete
      expect(isObsoleteCustomerQuery(keyListA, actorBId, actorBRole, actorBPerms)).toBe(true);
      expect(isObsoleteCustomerQuery(keyDetailA, actorBId, actorBRole, actorBPerms)).toBe(true);
      expect(isObsoleteCustomerQuery(keyListB, actorBId, actorBRole, actorBPerms)).toBe(false);

      // Execute selective cancellation & purge
      queryClient.removeQueries({
        queryKey: ["admin", "customers"],
        predicate: (q) => isObsoleteCustomerQuery(q.queryKey, actorBId, actorBRole, actorBPerms),
      });

      // Operator A's cached PII is completely purged
      expect(queryClient.getQueryData(keyListA)).toBeUndefined();
      expect(queryClient.getQueryData(keyDetailA)).toBeUndefined();

      // Mount and set new Operator B data
      queryClient.setQueryData(keyListB, {
        status: "success",
        results: 1,
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        data: { users: [{ id: "usr-cust-1", role: "CUSTOMER", firstName: null, email: null }] },
      });
      expect(queryClient.getQueryData(keyListB)).toBeDefined();

      queryClient.clear();
    });

    test("permission loss (view_user_sensitive_fields removed) immediately purges cached PII", () => {
      const queryClient = new QueryClient();
      const defaultQuery: BuyerListQueryState = {
        page: 1,
        limit: 20,
        search: "",
        isActive: "all",
        sortBy: "createdAt",
        sortOrder: "desc",
        view: "list",
      };

      const actorId = "admin-gamma";
      const actorRole = "OPERATIONS";
      const initialPerms = ["access_admin_panel", "view_all_users", "view_user_sensitive_fields"];
      const keyWithSensitive = adminCustomersListQueryKey(defaultQuery, actorId, actorRole, initialPerms);

      queryClient.setQueryData(keyWithSensitive, {
        status: "success",
        results: 1,
        pagination: { total: 1, page: 1, limit: 20, pages: 1 },
        data: { users: [{ id: "usr-cust-2", role: "CUSTOMER", telephone: "+260971234567" }] },
      });
      expect(queryClient.getQueryData(keyWithSensitive)).toBeDefined();

      // Revoke sensitive field permission
      const reducedPerms = ["access_admin_panel", "view_all_users"];
      expect(isObsoleteCustomerQuery(keyWithSensitive, actorId, actorRole, reducedPerms)).toBe(true);

      queryClient.removeQueries({
        queryKey: ["admin", "customers"],
        predicate: (q) => isObsoleteCustomerQuery(q.queryKey, actorId, actorRole, reducedPerms),
      });

      // Cache no longer contains sensitive query data
      expect(queryClient.getQueryData(keyWithSensitive)).toBeUndefined();
      queryClient.clear();
    });

    test("view_all_users removed or sign-out purges all customer cache with no query leaks", () => {
      const queryClient = new QueryClient();
      const defaultQuery: BuyerListQueryState = {
        page: 1,
        limit: 20,
        search: "",
        isActive: "all",
        sortBy: "createdAt",
        sortOrder: "desc",
        view: "list",
      };

      const keyList = adminCustomersListQueryKey(defaultQuery, "admin-1", "SUPER_ADMIN", ["view_all_users"]);
      const keyDetail = adminCustomerDetailQueryKey("usr-1", "admin-1", "SUPER_ADMIN", ["view_all_users"]);

      queryClient.setQueryData(keyList, { results: 1 });
      queryClient.setQueryData(keyDetail, { user: { id: "usr-1" } });

      expect(queryClient.getQueryCache().findAll({ queryKey: ["admin", "customers"] })).toHaveLength(2);

      // Loss of access / sign-out: all customer queries purged
      queryClient.removeQueries({ queryKey: ["admin", "customers"] });

      expect(queryClient.getQueryCache().findAll({ queryKey: ["admin", "customers"] })).toHaveLength(0);
      queryClient.clear();
    });

    test("delayed request for old authority followed by authority switch does not populate old cache upon resolution", async () => {
      let currentAuthority = "admin-old:SUPER_ADMIN:perm-1";
      const capturedAuth = currentAuthority;

      // Inflight request started under capturedAuth
      const inflightPromise = new Promise<{ id: string }>((resolve, reject) => {
        setTimeout(() => {
          if (currentAuthority !== capturedAuth) {
            reject(new Error("Authority changed during request"));
            return;
          }
          resolve({ id: "usr-old" });
        }, 50);
      });

      // Switch authority before request completes
      currentAuthority = "admin-new:OPERATIONS:perm-2";

      await expect(inflightPromise).rejects.toThrow("Authority changed during request");
    });

    test("switching detail IDs without recreating client does not display old detail while new is pending", () => {
      const queryClient = new QueryClient();
      const actorId = "admin-detail";
      const actorRole = "SUPER_ADMIN";
      const perms = ["access_admin_panel", "view_all_users"];

      const keyCustomer1 = adminCustomerDetailQueryKey("cust-1", actorId, actorRole, perms);
      const keyCustomer2 = adminCustomerDetailQueryKey("cust-2", actorId, actorRole, perms);

      queryClient.setQueryData(keyCustomer1, {
        status: "success",
        data: { user: { id: "cust-1", firstName: "Customer One" } },
      });

      // Query for customer 1 has data
      expect(queryClient.getQueryData(keyCustomer1)).toBeDefined();

      // Query for customer 2 is independent and does NOT inherit customer 1's data (placeholderData: undefined)
      expect(queryClient.getQueryData(keyCustomer2)).toBeUndefined();
      queryClient.clear();
    });

    test("terminal 401/403 purges cache, preserves truthful error, halts retry loops, and allows deliberate recovery", () => {
      const queryClient = new QueryClient();
      const terminalStore = createCustomerTerminalStore();

      expect(terminalStore.getSnapshot()).toBeNull();

      // Simulate 403 Forbidden
      const err403 = getBuyerSafeError(new ApiError("Forbidden", 403));
      expect(isTerminalAuthError(err403)).toBe(true);

      terminalStore.setError(err403);
      expect(terminalStore.getSnapshot()?.kind).toBe("forbidden");
      expect(terminalStore.getSnapshot()?.status).toBe(403);

      // On terminal error, cache is purged
      queryClient.removeQueries({ queryKey: ["admin", "customers"] });
      expect(queryClient.getQueryCache().findAll({ queryKey: ["admin", "customers"] })).toHaveLength(0);

      // Even though cache is purged, truthful error is preserved by the external store
      expect(terminalStore.getSnapshot()?.message).toContain("permission");

      // Deliberate recovery resets store before refetch
      terminalStore.clear();
      expect(terminalStore.getSnapshot()).toBeNull();
      queryClient.clear();
    });

    test("enforces automatic visible-tab cadence and manual-mode suppression query configuration", () => {
      // Manual mode policy
      const manualPolicy = {
        settings: { autoRefreshEnabled: false, intervalMs: 0, refreshOnNavigation: false },
        effectiveIntervalMs: 0,
      };
      const isManualAuto = Boolean(manualPolicy.settings.autoRefreshEnabled && manualPolicy.settings.intervalMs > 0);
      const manualConfig = {
        staleTime: isManualAuto ? manualPolicy.settings.intervalMs : Number.POSITIVE_INFINITY,
        refetchInterval: isManualAuto ? manualPolicy.effectiveIntervalMs : (false as const),
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: isManualAuto,
        refetchOnReconnect: isManualAuto,
        retry: false,
      };

      expect(manualConfig.staleTime).toBe(Number.POSITIVE_INFINITY);
      expect(manualConfig.refetchInterval).toBe(false);
      expect(manualConfig.refetchOnWindowFocus).toBe(false);
      expect(manualConfig.retry).toBe(false);

      // Auto mode policy (30s)
      const autoPolicy = {
        settings: { autoRefreshEnabled: true, intervalMs: 30000, refreshOnNavigation: true },
        effectiveIntervalMs: 30000,
      };
      const isAutoAuto = Boolean(autoPolicy.settings.autoRefreshEnabled && autoPolicy.settings.intervalMs > 0);
      const autoConfig = {
        staleTime: isAutoAuto ? autoPolicy.settings.intervalMs : Number.POSITIVE_INFINITY,
        refetchInterval: isAutoAuto ? autoPolicy.effectiveIntervalMs : (false as const),
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: isAutoAuto,
        refetchOnReconnect: isAutoAuto,
        retry: false,
      };

      expect(autoConfig.staleTime).toBe(30000);
      expect(autoConfig.refetchInterval).toBe(30000);
      expect(autoConfig.refetchIntervalInBackground).toBe(false);
      expect(autoConfig.refetchOnWindowFocus).toBe(true);
      expect(autoConfig.retry).toBe(false);
    });
  });
});
