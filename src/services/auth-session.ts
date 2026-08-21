import type { AuthSession, AuthUser } from "@/types/auth";
import { readLocalStorageValue } from "@/lib/persisted-storage";
import { sanitizeInternalNextPath } from "@/services/auth-intent";

const ACCESS_TOKEN_KEY = "zogular_access_token";
const REFRESH_TOKEN_KEY = "zogular_refresh_token";
const AUTH_USER_KEY = "zogular_auth_user";
const LAST_AUTH_EMAIL_KEY = "zogular_auth_last_email";
export const PASSWORD_RECOVERY_INTENT_STORAGE_KEY = "zogular_password_recovery_intent";
export const PASSWORD_RECOVERY_INTENT_TTL_MS = 15 * 60 * 1000;
const LEGACY_SELLER_TOKEN_KEY = "zogular_seller_token";
const LEGACY_ACCESS_TOKEN_KEYS = ["zamoyo_access_token", "zamoyo_seller_token"];
const LEGACY_REFRESH_TOKEN_KEYS = ["zamoyo_refresh_token"];
const LEGACY_AUTH_USER_KEYS = ["zamoyo_auth_user"];
const LEGACY_LAST_AUTH_EMAIL_KEYS = ["zamoyo_auth_last_email"];
export const AUTH_SESSION_CHANGED_EVENT = "zogular:auth-session-changed";
const TOKEN_CLEANUP_FLAG = "zogular:legacy-token-cleanup";

export type PasswordRecoveryStage = "code-requested" | "code-verified";

export interface PasswordRecoveryIntent {
  version: 1;
  purpose: "password-reset";
  intentId: string;
  email: string;
  nextPath: string | null;
  stage: PasswordRecoveryStage;
  createdAt: number;
  expiresAt: number;
}

const PASSWORD_RECOVERY_INTENT_KEYS = new Set<keyof PasswordRecoveryIntent>([
  "version",
  "purpose",
  "intentId",
  "email",
  "nextPath",
  "stage",
  "createdAt",
  "expiresAt",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRecoveryEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function isRecoveryIntentId(value: unknown): value is string {
  return typeof value === "string"
    && (/^[0-9a-f]{32}$/i.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function createIntentId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("Secure browser storage is unavailable.");
}

export function createPasswordRecoveryIntent(
  emailValue: string,
  nextPathValue?: string | null,
  now = Date.now(),
): PasswordRecoveryIntent {
  const email = normalizeRecoveryEmail(emailValue);
  if (!email) throw new TypeError("A valid email is required for password recovery.");
  if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - PASSWORD_RECOVERY_INTENT_TTL_MS) {
    throw new TypeError("A valid recovery timestamp is required.");
  }
  const nextPath = sanitizeInternalNextPath(nextPathValue);

  return {
    version: 1,
    purpose: "password-reset",
    intentId: createIntentId(),
    email,
    nextPath,
    stage: "code-requested",
    createdAt: now,
    expiresAt: now + PASSWORD_RECOVERY_INTENT_TTL_MS,
  };
}

export function parsePasswordRecoveryIntent(
  rawValue: string,
  now = Date.now(),
): PasswordRecoveryIntent | null {
  let value: unknown;
  try {
    value = JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (Object.keys(value).some((key) => !PASSWORD_RECOVERY_INTENT_KEYS.has(key as keyof PasswordRecoveryIntent))) {
    return null;
  }

  const email = normalizeRecoveryEmail(value.email);
  const nextPath = value.nextPath === null
    ? null
    : typeof value.nextPath === "string"
      ? sanitizeInternalNextPath(value.nextPath)
      : null;
  const nextPathIsValid = value.nextPath === null || nextPath === value.nextPath;
  const timestampsAreValid = Number.isSafeInteger(value.createdAt)
    && Number.isSafeInteger(value.expiresAt)
    && Number.isSafeInteger(now)
    && now >= 0
    && (value.createdAt as number) >= 0
    && (value.createdAt as number) <= now
    && (value.expiresAt as number) - (value.createdAt as number) === PASSWORD_RECOVERY_INTENT_TTL_MS
    && now < (value.expiresAt as number);

  if (
    value.version !== 1
    || value.purpose !== "password-reset"
    || !isRecoveryIntentId(value.intentId)
    || !email
    || email !== value.email
    || !nextPathIsValid
    || (value.stage !== "code-requested" && value.stage !== "code-verified")
    || !timestampsAreValid
  ) {
    return null;
  }

  return {
    version: 1,
    purpose: "password-reset",
    intentId: value.intentId,
    email,
    nextPath,
    stage: value.stage,
    createdAt: value.createdAt as number,
    expiresAt: value.expiresAt as number,
  };
}

export function storePasswordRecoveryIntent(intent: PasswordRecoveryIntent): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;
  try {
    storage.setItem(PASSWORD_RECOVERY_INTENT_STORAGE_KEY, JSON.stringify(intent));
    return true;
  } catch {
    return false;
  }
}

export function getPasswordRecoveryIntent(now = Date.now()): PasswordRecoveryIntent | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(PASSWORD_RECOVERY_INTENT_STORAGE_KEY);
    if (!rawValue) return null;
    const intent = parsePasswordRecoveryIntent(rawValue, now);
    if (!intent) storage.removeItem(PASSWORD_RECOVERY_INTENT_STORAGE_KEY);
    return intent;
  } catch {
    return null;
  }
}

export function clearPasswordRecoveryIntent(): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(PASSWORD_RECOVERY_INTENT_STORAGE_KEY);
  } catch {
    // Storage denial already leaves recovery unavailable and therefore fail-closed.
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

function removeLegacyTokenKeys(storage: Storage): void {
  [
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    LEGACY_SELLER_TOKEN_KEY,
    ...LEGACY_ACCESS_TOKEN_KEYS,
    ...LEGACY_REFRESH_TOKEN_KEYS,
  ].forEach((key) => {
    storage.removeItem(key);
  });
}

function cleanupLegacyTokenStorageOnce(): void {
  const storage = getStorage();
  const sessionStorage = getSessionStorage();
  if (!storage || !sessionStorage) return;
  if (sessionStorage.getItem(TOKEN_CLEANUP_FLAG) === "1") return;

  removeLegacyTokenKeys(storage);
  sessionStorage.setItem(TOKEN_CLEANUP_FLAG, "1");
}

function readString(key: string): string | null {
  cleanupLegacyTokenStorageOnce();

  const value = readLocalStorageValue(
    key,
    key === AUTH_USER_KEY
      ? LEGACY_AUTH_USER_KEYS
      : [],
  );
  return value && value.trim().length > 0 ? value : null;
}

function notifyAuthSessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

export function storeLastAuthEmail(email: string): void {
  const storage = getStorage();
  if (!storage || !email.trim()) return;
  storage.setItem(LAST_AUTH_EMAIL_KEY, email.trim());
}

export function getStoredLastAuthEmail(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const value = storage.getItem(LAST_AUTH_EMAIL_KEY);
  return value && value.trim().length > 0 ? value.trim() : null;
}

export function storeAuthUser(user: AuthUser): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function getStoredAuthUser(): AuthUser | null {
  const storage = getStorage();
  if (!storage) return null;
  cleanupLegacyTokenStorageOnce();

  const value = storage.getItem(AUTH_USER_KEY);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as AuthUser;
  } catch {
    return null;
  }
}

export function getAuthSessionSnapshot(): string {
  const user = readString(AUTH_USER_KEY);
  return user ?? "";
}

export function subscribeToAuthSession(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === AUTH_USER_KEY || LEGACY_AUTH_USER_KEYS.includes(event.key)) {
      onStoreChange();
    }
  };

  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function storeAuthSession(session: AuthSession): void {
  cleanupLegacyTokenStorageOnce();
  const storage = getStorage();
  const previousUser = storage?.getItem(AUTH_USER_KEY) ?? null;
  const nextUser = JSON.stringify(session.user);
  if (storage) {
    removeLegacyTokenKeys(storage);
    storage.setItem(AUTH_USER_KEY, nextUser);
  }
  storeLastAuthEmail(session.user.email);
  if (previousUser !== nextUser) {
    clearPasswordRecoveryIntent();
    notifyAuthSessionChanged();
  }
}

export function clearStoredAuthSession(): void {
  const storage = getStorage();
  if (storage) {
    removeLegacyTokenKeys(storage);
    storage.removeItem(AUTH_USER_KEY);
    storage.removeItem(LAST_AUTH_EMAIL_KEY);
    [...LEGACY_AUTH_USER_KEYS, ...LEGACY_LAST_AUTH_EMAIL_KEYS].forEach((key) => {
      storage.removeItem(key);
    });
  }

  // Also wipe HttpOnly cookies (accessToken, refreshToken) which JS cannot
  // directly touch. The server route sets Max-Age=0 to expire them immediately.
  if (typeof window !== "undefined") {
    fetch("/api/auth/clear-session", { method: "GET" }).catch(() => {
      // Best-effort — ignore network errors
    });
  }

  notifyAuthSessionChanged();
}
