import { appendNextPath, sanitizeInternalNextPath } from "@/services/auth-intent";

export const ADMIN_VERIFICATION_RECOVERY_KEY = "zogular_admin_email_verification_recovery";
export const ADMIN_VERIFICATION_RECOVERY_TTL_MS = 15 * 60 * 1000;

export type AdminVerificationRecoveryContext = {
  version: 1;
  purpose: "admin-email-verification";
  email: string;
  nextPath: string | null;
  createdAt: number;
  expiresAt: number;
};

const ADMIN_RECOVERY_KEYS = new Set<keyof AdminVerificationRecoveryContext>([
  "version",
  "purpose",
  "email",
  "nextPath",
  "createdAt",
  "expiresAt",
]);

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeAdminNextPath(path?: string | null): string | null {
  const safePath = sanitizeInternalNextPath(path);
  if (!safePath) return null;

  let parsed: URL;
  try {
    parsed = new URL(safePath, "https://zogular.internal");
  } catch {
    return null;
  }

  if (parsed.pathname !== "/admin" && !parsed.pathname.startsWith("/admin/")) return null;
  if (
    parsed.pathname === "/admin/login" ||
    parsed.pathname.startsWith("/admin/login/") ||
    parsed.pathname === "/admin/check-email" ||
    parsed.pathname.startsWith("/admin/check-email/")
  ) return null;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function appendAdminNextPath(path: string, nextPath?: string | null): string {
  return appendNextPath(path, sanitizeAdminNextPath(nextPath));
}

export function getAdminLoginPath(nextPath?: string | null): string {
  return appendAdminNextPath("/admin/login", nextPath);
}

export function getAdminVerificationRecoveryPath(nextPath?: string | null): string {
  return appendAdminNextPath("/admin/check-email", nextPath);
}

export function createAdminVerificationRecoveryContext(
  emailValue: string,
  nextPathValue?: string | null,
  now = Date.now(),
): AdminVerificationRecoveryContext {
  const email = normalizeEmail(emailValue);
  if (!email) throw new TypeError("A valid email is required.");
  if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - ADMIN_VERIFICATION_RECOVERY_TTL_MS) {
    throw new TypeError("A valid timestamp is required.");
  }

  return {
    version: 1,
    purpose: "admin-email-verification",
    email,
    nextPath: sanitizeAdminNextPath(nextPathValue),
    createdAt: now,
    expiresAt: now + ADMIN_VERIFICATION_RECOVERY_TTL_MS,
  };
}

export function parseAdminVerificationRecoveryContext(
  rawValue: string,
  now = Date.now(),
): AdminVerificationRecoveryContext | null {
  let value: unknown;
  try {
    value = JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  if (Object.keys(value).some((key) => !ADMIN_RECOVERY_KEYS.has(key as keyof AdminVerificationRecoveryContext))) {
    return null;
  }

  const email = normalizeEmail(value.email);
  const nextPath = value.nextPath === null
    ? null
    : typeof value.nextPath === "string"
      ? sanitizeAdminNextPath(value.nextPath)
      : null;
  const nextPathIsValid = value.nextPath === null || nextPath === value.nextPath;
  const timestampsAreValid = Number.isSafeInteger(value.createdAt)
    && Number.isSafeInteger(value.expiresAt)
    && Number.isSafeInteger(now)
    && now >= 0
    && (value.createdAt as number) >= 0
    && (value.createdAt as number) <= now
    && (value.expiresAt as number) - (value.createdAt as number) === ADMIN_VERIFICATION_RECOVERY_TTL_MS
    && now < (value.expiresAt as number);

  if (
    value.version !== 1 ||
    value.purpose !== "admin-email-verification" ||
    !email ||
    email !== value.email ||
    !nextPathIsValid ||
    !timestampsAreValid
  ) {
    return null;
  }

  return {
    version: 1,
    purpose: "admin-email-verification",
    email,
    nextPath,
    createdAt: value.createdAt as number,
    expiresAt: value.expiresAt as number,
  };
}

export function storeAdminVerificationRecoveryContext(context: AdminVerificationRecoveryContext): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;
  try {
    storage.setItem(ADMIN_VERIFICATION_RECOVERY_KEY, JSON.stringify(context));
    return true;
  } catch {
    return false;
  }
}

export function getAdminVerificationRecoveryContext(now = Date.now()): AdminVerificationRecoveryContext | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const rawValue = storage.getItem(ADMIN_VERIFICATION_RECOVERY_KEY);
    if (!rawValue) return null;
    const context = parseAdminVerificationRecoveryContext(rawValue, now);
    if (!context) storage.removeItem(ADMIN_VERIFICATION_RECOVERY_KEY);
    return context;
  } catch {
    return null;
  }
}

export function clearAdminVerificationRecoveryContext(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(ADMIN_VERIFICATION_RECOVERY_KEY);
  } catch {
    // Denied storage leaves recovery unavailable and therefore fail-closed.
  }
}
