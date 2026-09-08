import { expect, test } from "@playwright/test";
import {
  buildAdminIdentity,
  validateAdminSessionToken,
} from "../src/services/admin/backend-session";
import {
  adminIdentityHasPermission,
  type AdminIdentity,
} from "../src/services/admin/session";
import {
  type AdminRole,
  type Permission,
} from "../src/services/rbac";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchMock(handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return handler(url, init ?? {});
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

test("buildAdminIdentity requires explicit canonical permissions array and fails closed on role-only identity", () => {
  const roleOnlyPayload = {
    user: {
      id: "admin-1",
      email: "admin@zogular.com",
      role: "ADMIN",
    },
  };
  expect(buildAdminIdentity(roleOnlyPayload)).toBeUndefined();

  const nonArrayPermissions = {
    user: {
      id: "admin-1",
      email: "admin@zogular.com",
      role: "SUPER_ADMIN",
      permissions: "access_admin_panel",
    },
  };
  expect(buildAdminIdentity(nonArrayPermissions)).toBeUndefined();

  const validPayload = {
    user: {
      id: "admin-1",
      email: "admin@zogular.com",
      role: "SUPER_ADMIN",
      permissions: ["access_admin_panel", "review_sellers"],
    },
  };
  const identity = buildAdminIdentity(validPayload);
  expect(identity).toBeDefined();
  expect(identity?.claims.role).toBe("SUPER_ADMIN");
  expect(identity?.claims.permissions).toEqual(["access_admin_panel", "review_sellers"]);
});

test("buildAdminIdentity fails closed on unknown or malformed permissions and rejects invalid roles", () => {
  const malformedPayload = {
    user: {
      id: "admin-2",
      email: "tech@zogular.com",
      role: "TECH_ADMIN",
      permissions: ["access_admin_panel", "fake_permission", 123, null],
    },
  };
  // Malformed/unknown permissions must fail closed, returning undefined
  expect(buildAdminIdentity(malformedPayload)).toBeUndefined();

  const unknownRole = {
    user: {
      id: "admin-3",
      email: "unknown@zogular.com",
      role: "ROOT_ADMIN",
      permissions: ["access_admin_panel"],
    },
  };
  expect(buildAdminIdentity(unknownRole)).toBeUndefined();
});

test("adminIdentityHasPermission fails closed on null, undefined, unauthenticated or missing permissions", () => {
  expect(adminIdentityHasPermission(null, "access_admin_panel")).toBe(false);
  expect(adminIdentityHasPermission(undefined, "access_admin_panel")).toBe(false);

  const unauthenticated: AdminIdentity = {
    id: "admin-1",
    name: "Admin One",
    email: "admin@zogular.com",
    claims: {
      role: "SUPER_ADMIN",
      permissions: ["access_admin_panel"],
      authStrength: "password",
      issuedAt: new Date().toISOString(),
    },
    sessionStatus: "unauthorized",
  };
  expect(adminIdentityHasPermission(unauthenticated, "access_admin_panel")).toBe(false);

  const missingPermissionsClaims = {
    ...unauthenticated,
    sessionStatus: "authenticated" as const,
    claims: {
      role: "SUPER_ADMIN" as AdminRole,
      permissions: undefined as unknown as Permission[],
      authStrength: "password" as const,
      issuedAt: new Date().toISOString(),
    },
  };
  expect(adminIdentityHasPermission(missingPermissionsClaims, "access_admin_panel")).toBe(false);

  const validIdentity: AdminIdentity = {
    id: "admin-1",
    name: "Admin One",
    email: "admin@zogular.com",
    claims: {
      role: "SUPER_ADMIN",
      permissions: ["access_admin_panel"],
      authStrength: "password",
      issuedAt: new Date().toISOString(),
    },
    sessionStatus: "authenticated",
  };
  expect(adminIdentityHasPermission(validIdentity, "access_admin_panel")).toBe(true);
  expect(adminIdentityHasPermission(validIdentity, "manage_roles")).toBe(false);
});

test("validateAdminSessionToken verifies session against backend and yields authoritative identity", async () => {
  const fetchMock = installFetchMock((url, init) => {
    if (url.pathname.endsWith("/user/me")) {
      expect(init.headers).toMatchObject({ Authorization: "Bearer test-admin-token" });
      return jsonResponse({
        status: "success",
        data: {
          user: {
            id: "admin-verified",
            email: "verified@zogular.com",
            role: "OPERATIONS",
            permissions: ["access_admin_panel", "view_all_orders"],
          },
        },
      });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const identity = await validateAdminSessionToken("test-admin-token");
    expect(identity).not.toBeNull();
    expect(identity?.id).toBe("admin-verified");
    expect(identity?.claims.role).toBe("OPERATIONS");
    expect(identity?.claims.permissions).toEqual(["access_admin_panel", "view_all_orders"]);
  } finally {
    fetchMock.restore();
  }
});

test("validateAdminSessionToken fails closed on backend error, rejection, or malformed permissions", async () => {
  // Case 1: Backend rejects with 401
  let fetchMock = installFetchMock(() => jsonResponse({ message: "Unauthorized" }, 401));
  try {
    const res = await validateAdminSessionToken("invalid-token");
    expect(res).toBeNull();
  } finally {
    fetchMock.restore();
  }

  // Case 2: Backend returns 200 but user has missing permissions (role only)
  fetchMock = installFetchMock(() =>
    jsonResponse({
      status: "success",
      data: {
        user: {
          id: "admin-role-only",
          email: "roleonly@zogular.com",
          role: "SUPER_ADMIN",
          // missing permissions
        },
      },
    }),
  );
  try {
    const res = await validateAdminSessionToken("role-only-token");
    expect(res).toBeNull();
  } finally {
    fetchMock.restore();
  }

  // Case 3: Backend returns unknown permission in list
  fetchMock = installFetchMock(() =>
    jsonResponse({
      status: "success",
      data: {
        user: {
          id: "admin-unknown-perm",
          email: "unknownperm@zogular.com",
          role: "SUPER_ADMIN",
          permissions: ["access_admin_panel", "unknown_bogus_perm"],
        },
      },
    }),
  );
  try {
    const res = await validateAdminSessionToken("unknown-perm-token");
    expect(res).toBeNull();
  } finally {
    fetchMock.restore();
  }

  // Case 4: Backend unavailable / throws network error
  fetchMock = installFetchMock(() => {
    throw new Error("Network connection refused");
  });
  try {
    const res = await validateAdminSessionToken("net-error-token");
    expect(res).toBeNull();
  } finally {
    fetchMock.restore();
  }
});

