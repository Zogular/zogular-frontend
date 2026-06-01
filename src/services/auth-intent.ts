const AUTH_REDIRECT_INTENT_KEY = "zogular_auth_redirect_intent";

export function sanitizeInternalNextPath(path?: string | null): string | null {
  if (!path) return null;

  const normalized = path.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return null;

  return normalized;
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
