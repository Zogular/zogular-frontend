const AUTH_REDIRECT_INTENT_KEY = "zogular_auth_redirect_intent";
const INTERNAL_ORIGIN = "https://zogular.internal";
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;
const ENCODED_DOT = /%2e/i;
const DOT_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/;

function isAuthLoopPath(pathname: string): boolean {
  return pathname === "/auth"
    || pathname.startsWith("/auth/")
    || pathname === "/verify-email"
    || pathname === "/seller/login"
    || pathname === "/seller/register"
    || pathname === "/seller/check-email"
    || pathname === "/seller/verify-phone";
}

function isUnsafePathname(pathname: string): boolean {
  return !pathname.startsWith("/")
    || pathname.startsWith("//")
    || pathname.includes("\\")
    || CONTROL_CHARACTERS.test(pathname)
    || DOT_SEGMENT.test(pathname)
    || isAuthLoopPath(pathname);
}

export function sanitizeInternalNextPath(path?: string | null): string | null {
  if (!path) return null;

  const normalized = path.trim();
  if (
    isUnsafePathname(normalized.split(/[?#]/, 1)[0] ?? "")
    || CONTROL_CHARACTERS.test(normalized)
    || ENCODED_PATH_SEPARATOR.test(normalized.split(/[?#]/, 1)[0] ?? "")
    || ENCODED_DOT.test(normalized.split(/[?#]/, 1)[0] ?? "")
  ) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalized, INTERNAL_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== INTERNAL_ORIGIN || isUnsafePathname(parsed.pathname)) return null;

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }
  if (isUnsafePathname(decodedPathname)) return null;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function appendNextPath(path: string, nextPath?: string | null): string {
  const safeNextPath = sanitizeInternalNextPath(nextPath);
  if (!safeNextPath) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(safeNextPath)}`;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function storeAuthRedirectIntent(nextPath?: string | null): void {
  const storage = getStorage();
  const safeNextPath = sanitizeInternalNextPath(nextPath);
  if (!storage) return;

  if (!safeNextPath) {
    storage.removeItem(AUTH_REDIRECT_INTENT_KEY);
    return;
  }

  storage.setItem(AUTH_REDIRECT_INTENT_KEY, safeNextPath);
}

export function getAuthRedirectIntent(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  return sanitizeInternalNextPath(storage.getItem(AUTH_REDIRECT_INTENT_KEY));
}

export function clearAuthRedirectIntent(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(AUTH_REDIRECT_INTENT_KEY);
}
