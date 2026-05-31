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

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readString(key: string): string | null {
  const value = readLocalStorageValue(
    key,
    key === ACCESS_TOKEN_KEY
      ? LEGACY_ACCESS_TOKEN_KEYS
      : key === REFRESH_TOKEN_KEY
        ? LEGACY_REFRESH_TOKEN_KEYS
        : key === AUTH_USER_KEY
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

export function getStoredAccessToken(): string | null {
  return readString(ACCESS_TOKEN_KEY) ?? readString(LEGACY_SELLER_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return readString(REFRESH_TOKEN_KEY);
}

export function storeAccessToken(token: string): void {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(ACCESS_TOKEN_KEY, token);
  storage.setItem(LEGACY_SELLER_TOKEN_KEY, token);
}

export function removeStoredAccessToken(): void {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(LEGACY_SELLER_TOKEN_KEY);
}

export function storeRefreshToken(token: string): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeStoredRefreshToken(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(REFRESH_TOKEN_KEY);
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
  removeStoredAccessToken();
  removeStoredRefreshToken();
  if (session.accessToken) storeAccessToken(session.accessToken);
  if (session.refreshToken) storeRefreshToken(session.refreshToken);
  storeAuthUser(session.user);
  storeLastAuthEmail(session.user.email);
  notifyAuthSessionChanged();
}

export function clearStoredAuthSession(): void {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(AUTH_USER_KEY);
  storage.removeItem(LEGACY_SELLER_TOKEN_KEY);
  [...LEGACY_ACCESS_TOKEN_KEYS, ...LEGACY_REFRESH_TOKEN_KEYS, ...LEGACY_AUTH_USER_KEYS, ...LEGACY_LAST_AUTH_EMAIL_KEYS].forEach((key) => {
    storage.removeItem(key);
  });

  // Also wipe HttpOnly cookies (accessToken, refreshToken) which JS cannot
  // directly touch. The server route sets Max-Age=0 to expire them immediately.
  fetch("/api/auth/clear-session", { method: "GET" }).catch(() => {
    // Best-effort — ignore network errors
  });

  notifyAuthSessionChanged();
}
