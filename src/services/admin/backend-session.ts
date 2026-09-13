import type { AdminAuthStrength, AdminIdentity } from "@/services/admin/session";
import { ADMIN_SESSION_COOKIE } from "@/services/admin/session-cookie";
import {
  ADMIN_ROLES,
  CANONICAL_ADMIN_PERMISSIONS,
  type AdminRole,
  type Permission,
} from "@/services/rbac";

const BACKEND_BASE_URL =
  process.env.ADMIN_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000/api/v1";

const ADMIN_LOGIN_ENDPOINT =
  process.env.ADMIN_AUTH_LOGIN_ENDPOINT ?? "/auth/login";
const ADMIN_LOGOUT_ENDPOINT =
  process.env.ADMIN_AUTH_LOGOUT_ENDPOINT ?? "/auth/logout";
const ADMIN_SESSION_ENDPOINT =
  process.env.ADMIN_AUTH_SESSION_ENDPOINT ?? "/user/me";
const CSRF_ENDPOINT = "/auth/csrf-token";
const CHANGE_TEMPORARY_PASSWORD_ENDPOINT = "/user/change-temporary-password";

export const ADMIN_BACKEND_ENDPOINTS = {
  login: ADMIN_LOGIN_ENDPOINT,
  logout: ADMIN_LOGOUT_ENDPOINT,
  session: ADMIN_SESSION_ENDPOINT,
  changeTemporaryPassword: CHANGE_TEMPORARY_PASSWORD_ENDPOINT,
  setupAccount: "/auth/setup-account",
} as const;

const CANONICAL_PERMISSIONS_SET: ReadonlySet<string> = new Set(CANONICAL_ADMIN_PERMISSIONS);
const CANONICAL_ROLES_SET: ReadonlySet<string> = new Set(ADMIN_ROLES);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function collectCandidateRecords(payload: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const queue: unknown[] = [payload];
  const seen = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const record = asRecord(queue.shift());
    if (!record || seen.has(record)) continue;

    seen.add(record);
    records.push(record);

    for (const key of ["data", "payload", "result", "admin", "user", "identity", "session", "tokens"]) {
      if (key in record) queue.push(record[key]);
    }
  }

  return records;
}

function getStringByKeys(
  records: Record<string, unknown>[],
  keys: readonly string[],
): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = asNonEmptyString(record[key]);
      if (value) return value;
    }
  }

  return undefined;
}

function normalizeBackendPermissions(backendPerms: unknown[]): Permission[] | undefined {
  const result: Permission[] = [];
  for (const raw of backendPerms) {
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    if (!trimmed || !CANONICAL_PERMISSIONS_SET.has(trimmed)) {
      return undefined;
    }
    if (!result.includes(trimmed as Permission)) {
      result.push(trimmed as Permission);
    }
  }
  return result;
}

function getPermissions(records: Record<string, unknown>[]): Permission[] | undefined {
  for (const record of records) {
    if (record.permissions === undefined || record.permissions === null) continue;
    if (Array.isArray(record.permissions)) {
      return normalizeBackendPermissions(record.permissions);
    }
    return undefined;
  }

  return undefined;
}

function normalizeAdminRole(rawRole: string | undefined): AdminRole | undefined {
  if (!rawRole) return undefined;
  const trimmed = rawRole.trim().toUpperCase().replaceAll("-", "_");
  return CANONICAL_ROLES_SET.has(trimmed) ? (trimmed as AdminRole) : undefined;
}

function normalizeAuthStrength(value: string | undefined): AdminAuthStrength {
  if (value === "passkey_ready" || value === "mfa_ready" || value === "password") {
    return value;
  }

  return "password";
}

function getDisplayName(records: Record<string, unknown>[], email: string): string {
  const fullName = getStringByKeys(records, ["name", "fullName", "displayName"]);
  if (fullName) return fullName;

  const firstName = getStringByKeys(records, ["firstName", "first_name", "givenName"]);
  const lastName = getStringByKeys(records, ["lastName", "last_name", "surname", "familyName"]);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return combinedName || email.split("@")[0] || "Admin";
}


export function buildBackendUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const normalizedBase = BACKEND_BASE_URL.replace(/\/$/, "");
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedEndpoint}`;
}

export async function parseBackendResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  return contentType?.includes("application/json") ? response.json() : response.text();
}

export function getBackendMessage(payload: unknown, fallback: string): string {
  const records = collectCandidateRecords(payload);
  return getStringByKeys(records, ["message", "detail", "error"]) ?? fallback;
}

export function getBackendCode(payload: unknown): string | undefined {
  const records = collectCandidateRecords(payload);
  return getStringByKeys(records, ["code", "errorCode", "reason", "action"])?.trim().toUpperCase();
}

function extractCsrfToken(payload: unknown, headers: Headers): string | undefined {
  const records = collectCandidateRecords(payload);
  return (
    headers.get("x-csrf-token") ??
    getStringByKeys(records, ["csrfToken", "csrf", "_csrf"])
  );
}

export function extractAdminSessionToken(payload: unknown): string | undefined {
  const records = collectCandidateRecords(payload);
  return getStringByKeys(records, [
    "adminSessionToken",
    "sessionToken",
    "accessToken",
    "access_token",
    "token",
    "jwt",
  ]);
}

function getSetCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = withGetSetCookie.getSetCookie?.();
  if (setCookies?.length) return setCookies;

  const setCookie = headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

function toCookieHeader(setCookieHeaders: string[]): string | undefined {
  const cookiePairs = setCookieHeaders
    .map((cookieHeader) => cookieHeader.split(";")[0]?.trim())
    .filter(Boolean);

  return cookiePairs.length > 0 ? cookiePairs.join("; ") : undefined;
}

export async function getBackendCsrfHeaders(): Promise<Record<string, string>> {
  const response = await fetch(buildBackendUrl(CSRF_ENDPOINT), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const payload = await parseBackendResponse(response);

  if (!response.ok) {
    throw new Error("Could not prepare a secure admin request.");
  }

  const token = extractCsrfToken(payload, response.headers);
  if (!token) {
    throw new Error("Could not prepare a secure admin request.");
  }

  const cookieHeader = toCookieHeader(getSetCookieHeaders(response.headers));
  return {
    "X-CSRF-Token": token,
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };
}

export function extractSessionTokenFromSetCookie(headers: Headers): string | undefined {
  const cookieHeaders = getSetCookieHeaders(headers);
  const sessionNames = [
    ADMIN_SESSION_COOKIE,
    "admin_session",
    "adminSession",
    "session",
    "accessToken",
    "access_token",
  ];

  for (const cookieHeader of cookieHeaders) {
    const [nameValue] = cookieHeader.split(";");
    const separatorIndex = nameValue.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = nameValue.slice(0, separatorIndex).trim();
    const value = decodeURIComponent(nameValue.slice(separatorIndex + 1).trim());
    if (sessionNames.includes(name) && value) return value;
  }

  return undefined;
}

export function buildAdminIdentity(payload: unknown, fallbackEmail?: string): AdminIdentity | undefined {
  const records = collectCandidateRecords(payload);
  const role = normalizeAdminRole(getStringByKeys(records, ["role", "adminRole"]));
  if (!role) return undefined;

  const permissions = getPermissions(records);
  if (!permissions) return undefined;

  const email =
    getStringByKeys(records, ["email", "mail"]) ??
    asNonEmptyString(fallbackEmail);
  if (!email) return undefined;

  return {
    id: getStringByKeys(records, ["id", "_id", "adminId", "userId"]) ?? email,
    name: getDisplayName(records, email),
    email,
    claims: {
      role,
      permissions,
      authStrength: normalizeAuthStrength(
        getStringByKeys(records, ["authStrength", "assuranceLevel"]),
      ),
      issuedAt: new Date().toISOString(),
    },
    sessionStatus: "authenticated",
  };
}


export async function validateAdminSessionToken(token: string | undefined): Promise<AdminIdentity | null> {
  if (!token?.trim()) return null;

  try {
    const response = await fetch(buildBackendUrl(ADMIN_SESSION_ENDPOINT), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    const payload = await parseBackendResponse(response);
    return buildAdminIdentity(payload) ?? null;
  } catch {
    return null;
  }
}
