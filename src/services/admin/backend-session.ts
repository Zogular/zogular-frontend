import type { AdminAuthStrength, AdminIdentity } from "@/services/admin/session";
import { ADMIN_SESSION_COOKIE } from "@/services/admin/session-cookie";
import type { AdminRole, Permission } from "@/services/rbac";

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

const BACKEND_ADMIN_ROLE_TO_UI_ROLE: Record<string, AdminRole> = {
  SUPER_ADMIN: "super_admin",
  TECH_ADMIN: "super_admin",
  EXECUTIVE: "executive_admin",
  OPERATIONS: "ops_manager",
  ADMIN: "ops_manager",
};

const LOCAL_ADMIN_ROLES: readonly AdminRole[] = [
  "super_admin",
  "executive_admin",
  "ops_manager",
  "finance_admin",
  "support_admin",
  "content_admin",
  "viewer",
];

export const ADMIN_BACKEND_ENDPOINTS = {
  login: ADMIN_LOGIN_ENDPOINT,
  logout: ADMIN_LOGOUT_ENDPOINT,
  session: ADMIN_SESSION_ENDPOINT,
} as const;

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

const VALID_PERMISSIONS: ReadonlySet<Permission> = new Set([
  "view_dashboard", "view_financial_reports", "export_reports",
  "view_sellers", "approve_sellers", "suspend_sellers", "edit_commission",
  "view_buyers", "ban_buyers",
  "view_products", "moderate_products",
  "view_orders", "override_orders",
  "manage_disputes",
  "view_treasury", "approve_payouts", "manage_refunds",
  "view_support_tickets", "reply_support_tickets", "manage_support_tickets", "manage_content",
  "view_system_logs", "configure_platform", "manage_admins"
]);

function normalizeBackendPermissions(backendPerms: unknown[]): Permission[] {
  const result = new Set<Permission>();
  for (const raw of backendPerms) {
    if (typeof raw !== "string") continue;
    const norm = raw.trim().toLowerCase();

    if (norm === "access_admin_panel") result.add("view_dashboard");
    else if (norm === "review_sellers") result.add("view_sellers");
    else if (norm === "manage_seller_status") { result.add("approve_sellers"); result.add("suspend_sellers"); }
    else if (norm === "view_all_users") result.add("view_buyers");
    else if (norm === "view_all_products") result.add("view_products");
    else if (norm === "approve_products") result.add("moderate_products");
    else if (norm === "view_all_orders" || norm === "view_orders") result.add("view_orders");
    else if (norm === "manage_order_fulfillment") result.add("override_orders");
    else if (norm === "manage_content") result.add("manage_content");
    else if (norm === "view_all_reports" || norm === "view_sales_reports" || norm === "view_revenue_reports") result.add("view_financial_reports");
    else if (norm === "export_reports") result.add("export_reports");
    else if (norm === "view_all_payouts") result.add("view_treasury");
    else if (norm === "process_payouts") result.add("approve_payouts");
    else if (norm === "process_refunds" || norm === "issue_refunds") result.add("manage_refunds");
    else if (norm === "view_logs") result.add("view_system_logs");
    else if (norm === "manage_system_settings" || norm === "manage_technical_settings") result.add("configure_platform");
    else if (norm === "manage_admins") result.add("manage_admins");
    else if (VALID_PERMISSIONS.has(norm as Permission)) result.add(norm as Permission);
  }
  return Array.from(result);
}

function getPermissions(records: Record<string, unknown>[]): Permission[] | undefined {
  for (const record of records) {
    if (record.permissions === undefined || record.permissions === null) continue;
    if (Array.isArray(record.permissions)) {
      return normalizeBackendPermissions(record.permissions);
    }
  }

  return undefined;
}

function normalizeAdminRole(rawRole: string | undefined): AdminRole | undefined {
  if (!rawRole) return undefined;

  const backendRole = rawRole.trim().toUpperCase().replaceAll("-", "_");
  const mappedRole = BACKEND_ADMIN_ROLE_TO_UI_ROLE[backendRole];
  if (mappedRole) return mappedRole;

  const localRole = rawRole.trim().toLowerCase().replaceAll("-", "_") as AdminRole;
  return LOCAL_ADMIN_ROLES.includes(localRole) ? localRole : undefined;
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
    throw new Error(getBackendMessage(payload, "Could not prepare a secure admin request."));
  }

  const token = extractCsrfToken(payload, response.headers);
  if (!token) {
    throw new Error("Backend did not return a CSRF token.");
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
      permissions: getPermissions(records),
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
