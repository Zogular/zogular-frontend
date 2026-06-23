import type { AuthSession, AuthUser } from "@/types/auth";
import { readLocalStorageValue } from "@/lib/persisted-storage";

const ACCESS_TOKEN_KEY = "zogular_access_token";
const REFRESH_TOKEN_KEY = "zogular_refresh_token";
const AUTH_USER_KEY = "zogular_auth_user";
const LAST_AUTH_EMAIL_KEY = "zogular_auth_last_email";
const LEGACY_SELLER_TOKEN_KEY = "zogular_seller_token";
const LEGACY_ACCESS_TOKEN_KEYS = ["zamoyo_access_token", "zamoyo_seller_token"];
const LEGACY_REFRESH_TOKEN_KEYS = ["zamoyo_refresh_token"];
const LEGACY_AUTH_USER_KEYS = ["zamoyo_auth_user"];
const LEGACY_LAST_AUTH_EMAIL_KEYS = ["zamoyo_auth_last_email"];
export const AUTH_SESSION_CHANGED_EVENT = "zogular:auth-session-changed";
const TOKEN_CLEANUP_FLAG = "zogular:legacy-token-cleanup";

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
      : key === LAST_AUTH_EMAIL_KEY
        ? LEGACY_LAST_AUTH_EMAIL_KEYS
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

export function getLastAuthEmail(): string {
  return readString(LAST_AUTH_EMAIL_KEY) ?? "";
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

export function storeAuthSession(session: AuthSession): void {
  cleanupLegacyTokenStorageOnce();
  const storage = getStorage();
  if (storage) {
    removeLegacyTokenKeys(storage);
  }
  storeAuthUser(session.user);
  storeLastAuthEmail(session.user.email);
  notifyAuthSessionChanged();
}

export function clearStoredAuthSession(): void {
  const storage = getStorage();
  if (storage) {
    removeLegacyTokenKeys(storage);
    storage.removeItem(AUTH_USER_KEY);
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
