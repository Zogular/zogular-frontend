import {
  clearStoredAuthSession,
  getAuthSessionSnapshot,
} from "@/services/auth-session";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const REMOTE_BASE_URL =
  process.env.INTERNAL_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api/v1";
const BROWSER_BASE_URL = process.env.NEXT_PUBLIC_API_PROXY_URL || "/api/backend";

const BASE_URL =
  typeof window === "undefined" ? REMOTE_BASE_URL : BROWSER_BASE_URL;

type CsrfMode = "body" | "query" | "header";

interface FetchOptions extends RequestInit {
  timeout?: number;
  query?: Record<string, string | number | boolean | null | undefined>;
  authMode?: "include" | "omit";
  csrf?: boolean | CsrfMode;
  skipAuthRefresh?: boolean;
}

let csrfTokenPromise: Promise<string> | null = null;
let authRefreshPromise: Promise<boolean> | null = null;
let authSessionRevision = 0;

export function resetApiClientSecurityStateForTests(): void {
  csrfTokenPromise = null;
  authRefreshPromise = null;
  authSessionRevision = 0;
}

function buildUrl(endpoint: string, query?: FetchOptions["query"]): string {
  const base =
    typeof window !== "undefined" && BASE_URL.startsWith("/")
      ? window.location.origin
      : undefined;
  const url = new URL(`${BASE_URL}${endpoint}`, base);

  if (!query) return url.toString();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }

  return url.toString();
}

function isJsonResponse(contentType: string | null): boolean {
  return Boolean(contentType?.includes("application/json"));
}

function isJsonString(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return Boolean(parsed) && typeof parsed === "object";
  } catch {
    return false;
  }
}

function getRequestMethod(options: FetchOptions): string {
  return (options.method ?? "GET").toUpperCase();
}

function shouldSendCsrf(options: FetchOptions): boolean {
  if (!options.csrf) return false;
  return ["POST", "PUT", "PATCH", "DELETE"].includes(getRequestMethod(options));
}

function getCsrfMode(csrf: FetchOptions["csrf"]): CsrfMode {
  if (csrf === "body" || csrf === "query" || csrf === "header") return csrf;
  return "header";
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "errors" in payload) {
    const errors = (payload as { errors?: unknown }).errors;
    if (Array.isArray(errors)) {
      const firstError = errors.find((error) => error && typeof error === "object");
      if (firstError && "message" in firstError) {
        const message = (firstError as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message;
      }
    }
  }

  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

function extractCsrfToken(payload: unknown): string {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const data = root?.data && typeof root.data === "object" ? root.data as Record<string, unknown> : null;
  const token = data?.csrfToken ?? root?.csrfToken;

  if (typeof token !== "string" || !token.trim()) {
    throw new ApiError("Failed to prepare a secure request.", 500, payload);
  }

  return token;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();

  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", onAbort);
  }

  try {
    return await fetch(url, {
      ...init,
      credentials: "include",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (init.signal) {
      init.signal.removeEventListener("abort", onAbort);
    }
  }
}

async function requestCsrfToken(timeout: number): Promise<string> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = (async () => {
      try {
        const headers = new Headers();
        headers.set("Accept", "application/json");

        const response = await fetchWithTimeout(
          buildUrl("/auth/csrf-token"),
          { method: "GET", headers },
          timeout,
        );

        const contentType = response.headers.get("content-type");
        const payload = isJsonResponse(contentType)
          ? await response.json()
          : await response.text();

        if (!response.ok) {
          throw new ApiError(
            "Failed to prepare a secure request.",
            response.status,
            payload,
          );
        }

        return extractCsrfToken(payload);
      } catch (error) {
        csrfTokenPromise = null;
        throw error;
      }
    })();
  }

  return csrfTokenPromise;
}

async function refreshCookieSession(timeout: number): Promise<boolean> {
  if (!authRefreshPromise) {
    authRefreshPromise = (async () => {
      try {
        const csrfToken = await requestCsrfToken(timeout);
        const headers = new Headers({
          Accept: "application/json",
          "X-CSRF-Token": csrfToken,
        });
        const response = await fetchWithTimeout(
          buildUrl("/auth/refresh-token"),
          { method: "POST", headers },
          timeout,
        );

        if (!response.ok) return false;

        await parseResponse(response);
        authSessionRevision += 1;
        csrfTokenPromise = null;
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      authRefreshPromise = null;
    });
  }

  return authRefreshPromise;
}

function withCsrfBody(body: BodyInit | null | undefined, token: string): BodyInit {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    body.set("_csrf", token);
    return body;
  }

  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    body.set("_csrf", token);
    return body;
  }

  if (typeof body === "string" && isJsonString(body)) {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    return JSON.stringify({ ...parsed, _csrf: token });
  }

  if (!body) return JSON.stringify({ _csrf: token });

  return body;
}

async function prepareRequest(
  endpoint: string,
  options: FetchOptions,
): Promise<{ url: string; init: RequestInit }> {
  const method = getRequestMethod(options);
  const {
    timeout,
    query,
    csrf,
    skipAuthRefresh,
    headers,
    body,
    ...fetchOptions
  } = options;
  void timeout;
  void skipAuthRefresh;

  const resolvedHeaders = new Headers(headers);
  if (!resolvedHeaders.has("Accept")) {
    resolvedHeaders.set("Accept", "application/json");
  }

  let resolvedBody = body as BodyInit | null | undefined;
  const resolvedQuery = { ...(query ?? {}) };

  if (shouldSendCsrf(options)) {
    const token = await requestCsrfToken(options.timeout ?? 10_000);
    const mode = getCsrfMode(csrf);

    if (mode === "header") {
      resolvedHeaders.set("X-CSRF-Token", token);
    } else if (mode === "query") {
      resolvedQuery._csrf = token;
    } else {
      resolvedBody = withCsrfBody(resolvedBody, token);
    }
  }

  const isFormData =
    typeof FormData !== "undefined" && resolvedBody instanceof FormData;
  const isUrlSearchParams =
    typeof URLSearchParams !== "undefined" && resolvedBody instanceof URLSearchParams;
  const hasBody = resolvedBody !== undefined && resolvedBody !== null;

  if (
    hasBody &&
    !isFormData &&
    !isUrlSearchParams &&
    !resolvedHeaders.has("Content-Type")
  ) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  return {
    url: buildUrl(endpoint, resolvedQuery),
    init: {
      ...fetchOptions,
      method,
      body: resolvedBody,
      headers: resolvedHeaders,
    },
  };
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type");
  return isJsonResponse(contentType) ? response.json() : response.text();
}

export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  const timeout = options.timeout ?? 10_000;
  let didRefresh = false;
  let didRefreshCsrf = false;
  let requestSessionRevision = authSessionRevision;
  const requestAuthSnapshot = getAuthSessionSnapshot();

  while (true) {
    try {
      const { url, init } = await prepareRequest(endpoint, options);
      const response = await fetchWithTimeout(url, init, timeout);
      const responseData = await parseResponse(response);

      if (response.ok) return responseData as T;

      const message = extractMessage(
        responseData,
        `Backend returned ${response.status}`,
      );

      if (
        response.status === 401 &&
        options.authMode !== "omit" &&
        !options.skipAuthRefresh &&
        !didRefresh &&
        endpoint !== "/auth/refresh-token"
      ) {
        didRefresh = true;
        if (requestSessionRevision !== authSessionRevision) {
          requestSessionRevision = authSessionRevision;
          continue;
        }

        if (await refreshCookieSession(timeout)) {
          requestSessionRevision = authSessionRevision;
          continue;
        }

        if (
          requestSessionRevision === authSessionRevision &&
          requestAuthSnapshot === getAuthSessionSnapshot()
        ) {
          clearStoredAuthSession();
        }
      }

      if (
        response.status === 403 &&
        shouldSendCsrf(options) &&
        !didRefreshCsrf &&
        message.toLowerCase().includes("csrf")
      ) {
        didRefreshCsrf = true;
        csrfTokenPromise = null;
        continue;
      }

      throw new ApiError(message, response.status, responseData);
    } catch (error) {
      if (error instanceof ApiError) throw error;

      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(
          "Request timed out. Please check your connection.",
          408,
        );
      }

      throw new ApiError("Network connection failed.", 503, error);
    }
  }
}
