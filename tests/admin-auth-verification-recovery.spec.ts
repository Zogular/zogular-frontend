import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as adminChangeTemporaryPasswordPost } from "../src/app/api/admin/auth/change-temporary-password/route";
import { POST as adminLoginPost } from "../src/app/api/admin/auth/login/route";
import { proxy } from "../src/proxy";
import { resetApiClientSecurityStateForTests } from "../src/services/api";
import { resetPassword } from "../src/services/auth";
import {
  createPasswordRecoveryIntent,
  storePasswordRecoveryIntent,
  type PasswordRecoveryIntent,
} from "../src/services/auth-session";
import {
  ADMIN_VERIFICATION_RECOVERY_KEY,
  ADMIN_VERIFICATION_RECOVERY_TTL_MS,
  createAdminVerificationRecoveryContext,
  getAdminLoginPath,
  parseAdminVerificationRecoveryContext,
  sanitizeAdminNextPath,
  storeAdminVerificationRecoveryContext,
} from "../src/services/admin/verification-recovery";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function installFetchMock(handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  const originalFetch = globalThis.fetch;
  const calls: { url: URL; init: RequestInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const requestInit = init ?? {};
    calls.push({ url, init: requestInit });
    return handler(url, requestInit);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

test("admin next intent is internal-admin only and rejects auth loops and encoded bypasses", () => {
  expect(sanitizeAdminNextPath("/admin/orders?status=open")).toBe("/admin/orders?status=open");
  expect(getAdminLoginPath("/admin/sellers/123")).toBe("/admin/login?next=%2Fadmin%2Fsellers%2F123");
  for (const unsafe of [
    "https://evil.test/admin",
    "//evil.test/admin",
    "/%2e%2e/admin",
    "/admin\\orders",
    "/auth/login",
    "/seller/login",
    "/account",
    "/admin/login",
    "/admin/check-email",
  ]) {
    expect(sanitizeAdminNextPath(unsafe)).toBeNull();
    expect(getAdminLoginPath(unsafe)).toBe("/admin/login");
  }
});

test("admin verification recovery context is tab-scoped, bounded, and not localStorage-backed", () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage, sessionStorage },
  });

  try {
    const now = Date.UTC(2026, 7, 28, 12, 0, 0);
    const context = createAdminVerificationRecoveryContext(" Admin@Example.Test ", "/admin/orders", now);
    expect(context).toMatchObject({
      version: 1,
      purpose: "admin-email-verification",
      email: "admin@example.test",
      nextPath: "/admin/orders",
      createdAt: now,
      expiresAt: now + ADMIN_VERIFICATION_RECOVERY_TTL_MS,
    });
    expect(storeAdminVerificationRecoveryContext(context)).toBe(true);
    expect(sessionStorage.getItem(ADMIN_VERIFICATION_RECOVERY_KEY)).toContain("admin@example.test");
    expect(localStorage.getItem(ADMIN_VERIFICATION_RECOVERY_KEY)).toBeNull();
    expect(localStorage.getItem("zogular_auth_last_email")).toBeNull();

    const raw = JSON.stringify(context);
    expect(parseAdminVerificationRecoveryContext(raw, now)?.email).toBe("admin@example.test");
    expect(parseAdminVerificationRecoveryContext(raw, now + ADMIN_VERIFICATION_RECOVERY_TTL_MS)).toBeNull();
    expect(parseAdminVerificationRecoveryContext(JSON.stringify({ ...context, nextPath: "/account" }), now)).toBeNull();
    expect(parseAdminVerificationRecoveryContext(JSON.stringify({ ...context, otp: "123456" }), now)).toBeNull();
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("admin login API preserves stable verification code and safe next without creating a session", async () => {
  const fetchMock = installFetchMock((url, init) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      return jsonResponse(
        { status: "success", data: { csrfToken: "csrf" } },
        200,
        { "Set-Cookie": "_csrf=csrf; Path=/; HttpOnly; SameSite=Lax" },
      );
    }
    if (url.pathname.endsWith("/auth/login")) {
      expect(JSON.parse(String(init.body))).toEqual({
        email: "admin@example.test",
        password: "Password123!",
      });
      return jsonResponse(
        {
          status: "fail",
          code: "EMAIL_VERIFICATION_REQUIRED",
          message: "Please verify your email before logging in.",
        },
        403,
      );
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const response = await adminLoginPost(new Request("http://frontend.test/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "Admin@Example.Test",
        password: "Password123!",
        nextPath: "/admin/orders",
      }),
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMAIL_VERIFICATION_REQUIRED",
      message: "Please verify your email before logging in.",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(fetchMock.calls.map((call) => `${call.init.method ?? "GET"} ${call.url.pathname}`)).toEqual([
      "GET /api/v1/auth/csrf-token",
      "POST /api/v1/auth/login",
    ]);
  } finally {
    fetchMock.restore();
  }
});

test("admin login API returns safe next for verified admin and rejects non-admin roles", async () => {
  let mode: "admin" | "buyer" = "admin";
  const fetchMock = installFetchMock((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    }
    if (url.pathname.endsWith("/auth/login")) {
      return jsonResponse({
        status: "success",
        data: {
          user: {
            id: "admin-1",
            email: "admin@example.test",
            firstName: "Admin",
            lastName: "One",
            role: mode === "admin" ? "ADMIN" : "CUSTOMER",
          },
          accessToken: "fixture-admin-token",
        },
      });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const successResponse = await adminLoginPost(new Request("http://frontend.test/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "Password123!", nextPath: "/admin/products?tab=review" }),
    }));
    expect(successResponse.status).toBe(200);
    await expect(successResponse.json()).resolves.toMatchObject({ nextPath: "/admin/products?tab=review" });
    expect(successResponse.headers.get("set-cookie")).toContain("zogular_admin_session=");

    mode = "buyer";
    const deniedResponse = await adminLoginPost(new Request("http://frontend.test/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "buyer@example.test", password: "Password123!", nextPath: "/admin/products" }),
    }));
    expect(deniedResponse.status).toBe(403);
    await expect(deniedResponse.json()).resolves.toEqual({
      message: "This account is not authorized for the Zogular admin panel.",
    });
  } finally {
    fetchMock.restore();
  }
});

test("admin login API exposes only exact temporary-password action without creating a session", async () => {
  let mode: "valid" | "malformed" | "different-action" = "valid";
  const fetchMock = installFetchMock((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    }
    if (url.pathname.endsWith("/auth/login")) {
      if (mode === "malformed") {
        return jsonResponse({ status: "pending", action: "CHANGE_PASSWORD_REQUIRED", data: { userId: "../admin" } });
      }
      if (mode === "different-action") {
        return jsonResponse({ status: "pending", action: "VERIFY_PHONE_REQUIRED", data: { userId: "adminUser123" } });
      }
      return jsonResponse({ status: "pending", action: "CHANGE_PASSWORD_REQUIRED", data: { userId: "adminUser123" } });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  try {
    const validResponse = await adminLoginPost(new Request("http://frontend.test/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "Temporary123!", nextPath: "/admin/orders" }),
    }));
    expect(validResponse.status).toBe(200);
    await expect(validResponse.json()).resolves.toEqual({
      success: false,
      status: "pending",
      action: "CHANGE_PASSWORD_REQUIRED",
      message: "Set a private password to continue.",
      userId: "adminUser123",
    });
    expect(validResponse.headers.get("set-cookie")).toBeNull();

    mode = "malformed";
    const malformedResponse = await adminLoginPost(new Request("http://frontend.test/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "Temporary123!" }),
    }));
    expect(malformedResponse.status).toBe(502);
    await expect(malformedResponse.json()).resolves.toEqual({
      message: "Admin sign-in needs a password update. Please try again.",
    });
    expect(malformedResponse.headers.get("set-cookie")).toBeNull();

    mode = "different-action";
    const differentActionResponse = await adminLoginPost(new Request("http://frontend.test/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.test", password: "Temporary123!" }),
    }));
    expect(differentActionResponse.status).toBe(403);
    expect(differentActionResponse.headers.get("set-cookie")).toBeNull();
  } finally {
    fetchMock.restore();
  }
});

test("admin temporary-password BFF posts with CSRF, creates no session, and fails closed", async () => {
  let mode: "success" | "csrf-fail" | "backend-fail" | "malformed-success" = "success";
  const fetchMock = installFetchMock((url, init) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      if (mode === "csrf-fail") return jsonResponse({ status: "fail" }, 503);
      return jsonResponse(
        { status: "success", data: { csrfToken: "csrf" } },
        200,
        { "Set-Cookie": "_csrf=csrf; Path=/; HttpOnly; SameSite=Lax" },
      );
    }
    if (url.pathname.endsWith("/user/change-temporary-password")) {
      expect(init.headers).toMatchObject({ "X-CSRF-Token": "csrf" });
      expect(JSON.parse(String(init.body))).toEqual({
        userId: "adminUser123",
        currentPassword: "Temporary123!",
        newPassword: "Private123!",
        confirmPassword: "Private123!",
      });
      if (mode === "backend-fail") return jsonResponse({ status: "fail", message: "Current password is incorrect", secret: "raw" }, 401);
      if (mode === "malformed-success") return jsonResponse({ status: "ok" });
      return jsonResponse({ status: "success", message: "Password changed successfully. Please login with your new password." });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  const request = () => adminChangeTemporaryPasswordPost(new Request("http://frontend.test/api/admin/auth/change-temporary-password", {
    method: "POST",
    body: JSON.stringify({
      userId: "adminUser123",
      currentPassword: "Temporary123!",
      newPassword: "Private123!",
      confirmPassword: "Private123!",
    }),
  }));

  try {
    const successResponse = await request();
    expect(successResponse.status).toBe(200);
    await expect(successResponse.json()).resolves.toEqual({
      success: true,
      message: "Password updated. Sign in with your new password.",
    });
    expect(successResponse.headers.get("set-cookie")).toBeNull();

    mode = "backend-fail";
    const backendFailure = await request();
    expect(backendFailure.status).toBe(401);
    await expect(backendFailure.json()).resolves.toEqual({
      message: "The temporary sign-in details could not be confirmed. Sign in again.",
    });

    mode = "malformed-success";
    const malformedSuccess = await request();
    expect(malformedSuccess.status).toBe(502);
    await expect(malformedSuccess.json()).resolves.toEqual({
      message: "Password setup could not be confirmed. Try again.",
    });

    mode = "csrf-fail";
    const csrfFailure = await request();
    expect(csrfFailure.status).toBe(502);
    await expect(csrfFailure.json()).resolves.toEqual({
      message: "Could not prepare a secure password setup. Please try again.",
    });
    expect(fetchMock.calls.filter((call) => call.url.pathname.endsWith("/user/change-temporary-password"))).toHaveLength(3);
  } finally {
    fetchMock.restore();
  }
});

test("admin proxy preserves safe return intent and leaves check-email public", async () => {
  const protectedResponse = await proxy(new NextRequest("http://frontend.test/admin/orders?status=open"));
  expect(protectedResponse.status).toBe(307);
  expect(protectedResponse.headers.get("location")).toBe("http://frontend.test/admin/login?next=%2Fadmin%2Forders%3Fstatus%3Dopen");

  const recoveryResponse = await proxy(new NextRequest("http://frontend.test/admin/check-email"));
  expect(recoveryResponse.status).toBe(200);
});

test("admin login and recovery source use exact verification classification and safe copy", () => {
  const loginSource = readSource("src/app/admin/login/AdminLoginContent.tsx");
  const checkEmailSource = readSource("src/app/admin/check-email/page.tsx");
  const verifyEmailSource = readSource("src/app/(consumer)/verify-email/page.tsx");
  const authSource = readSource("src/services/auth.ts");

  expect(loginSource).toContain("isEmailVerificationRequiredError(error)");
  expect(loginSource).toContain("createAdminVerificationRecoveryContext(email, nextPath)");
  expect(loginSource).toContain("getAdminVerificationRecoveryPath(context.nextPath)");
  expect(loginSource).toContain("clearAdminVerificationRecoveryContext()");
  expect(loginSource).toContain("changeAdminTemporaryPassword");
  expect(loginSource).toContain("temporaryPasswordContext");
  expect(loginSource).toContain("error.status === 401 || error.status === 403 || error.status === 404");
  expect(loginSource).not.toContain("mfa_ready");
  expect(loginSource).not.toMatch(/sessionStorage.*userId|localStorage.*userId|sessionStorage.*currentPassword|localStorage.*currentPassword/);
  expect(loginSource).not.toMatch(/gateway|backend auth boundary|Privileged session/i);
  expect(checkEmailSource).toContain("resendVerificationEmail(context.email, context.nextPath, { rememberEmail: false })");
  expect(checkEmailSource).toContain("RESEND_COOLDOWN_SECONDS = 60");
  expect(checkEmailSource).toContain("isResending || resendSecondsLeft > 0");
  expect(checkEmailSource).not.toMatch(/CSRF|backend|stack|token/i);
  expect(verifyEmailSource).toContain("sanitizeAdminNextPath(rawNextPath)");
  expect(verifyEmailSource).toContain("getAdminLoginPath(adminNextPath)");
  expect(verifyEmailSource).toContain("getAdminVerificationRecoveryPath(adminNextPath)");
  expect(verifyEmailSource).toContain("if (isAdminFlow) clearAdminVerificationRecoveryContext();");
  expect(authSource).toContain("options: { rememberEmail?: boolean } = {}");
});

test("admin password recovery uses shared reset flow with admin-safe return", () => {
  const loginSource = readSource("src/app/admin/login/AdminLoginContent.tsx");
  const forgotSource = readSource("src/app/(consumer)/auth/forgot-password/page.tsx");
  const resetSource = readSource("src/app/(consumer)/auth/reset-password/page.tsx");
  const authSource = readSource("src/services/auth.ts");

  expect(loginSource).toContain('appendNextPath("/auth/forgot-password", nextPath ?? "/admin/dashboard")');
  expect(forgotSource).toContain('nextPath?.startsWith("/admin") ? "/admin/login"');
  expect(resetSource).toContain('intent.nextPath?.startsWith("/admin") ? "/admin/login"');
  expect(authSource).toContain('nextPath?.startsWith("/admin")');
  expect(`${loginSource}\n${forgotSource}\n${resetSource}`).not.toMatch(/email=\$\{|userId=|Temporary123!/);
});

test("password reset service returns admin, seller, and buyer login destinations from sanitized intent", async () => {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage, sessionStorage, location: { origin: "http://frontend.test" } },
  });
  const fetchMock = installFetchMock((url) => {
    if (url.pathname.endsWith("/auth/csrf-token")) {
      return jsonResponse({ status: "success", data: { csrfToken: "csrf" } });
    }
    if (url.pathname.endsWith("/auth/reset-password")) {
      return jsonResponse({ status: "success", message: "Password updated." });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });

  async function resetFor(nextPath: string | null) {
    resetApiClientSecurityStateForTests();
    const intent: PasswordRecoveryIntent = {
      ...createPasswordRecoveryIntent("person@example.test", nextPath),
      stage: "code-verified",
    };
    expect(storePasswordRecoveryIntent(intent)).toBe(true);
    return resetPassword({
      email: "person@example.test",
      code: "123456",
      password: "Private123!",
      confirmPassword: "Private123!",
    });
  }

  try {
    await expect(resetFor("/admin/orders")).resolves.toMatchObject({
      nextPath: "/admin/login?next=%2Fadmin%2Forders",
    });
    await expect(resetFor("/seller/orders")).resolves.toMatchObject({
      nextPath: "/seller/login?next=%2Fseller%2Forders",
    });
    await expect(resetFor("/account/orders")).resolves.toMatchObject({
      nextPath: "/auth/login?next=%2Faccount%2Forders",
    });
  } finally {
    fetchMock.restore();
    resetApiClientSecurityStateForTests();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
