import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/services/admin/session-cookie";

function getBaseUrl(isAdmin: boolean): string {
  const internalUrl = process.env.INTERNAL_BACKEND_URL;
  if (internalUrl) return internalUrl;
  return isAdmin
    ? process.env.ADMIN_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1"
    : process.env.NEXT_PUBLIC_API_URL || process.env.ADMIN_API_URL || "http://localhost:5000/api/v1";
}

const CSRF_ENDPOINT = "/auth/csrf-token";
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_COOKIE_NAME = "_csrf";
const CSRF_HEADER_NAMES = ["x-csrf-token", "csrf-token", "x-xsrf-token"];
const CSRF_PREPARE_ERROR_RESPONSE = {
  status: "fail",
  message: "We could not prepare this secure request. Please try again.",
};

// These routes must NEVER receive auth cookies — forwarding a stale
// accessToken causes the backend jwt.verify() to throw "jwt expired"
// even though the route has no protect() middleware.
const PUBLIC_AUTH_PATHS = new Set([
  "auth/register",
  "auth/login",
  "auth/forgot-password",
  "auth/verify-email",
  "auth/resend-verification",
  "auth/verify-code",
  "auth/reset-password",
  "auth/csrf-token",
]);

const AUTH_COOKIE_NAMES = ["accessToken", "refreshToken"];
const ADMIN_BACKEND_PATH_PREFIX = "admin/";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

function buildBackendUrl(path: string[], search: string, isAdmin: boolean): string {
  const base = getBaseUrl(isAdmin).replace(/\/$/, "");
  const endpoint = path.map(encodeURIComponent).join("/");
  return `${base}/${endpoint}${search}`;
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

async function parseBackendResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  return contentType?.includes("application/json") ? response.json() : response.text();
}

function extractCsrfToken(payload: unknown, headers: Headers): string | undefined {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
  const data = root?.data && typeof root.data === "object" ? root.data as Record<string, unknown> : null;
  const token = headers.get("x-csrf-token") ?? data?.csrfToken ?? root?.csrfToken;
  return typeof token === "string" && token.trim() ? token : undefined;
}

function hasCookie(cookieHeader: string | null, name: string): boolean {
  return Boolean(cookieHeader?.split(";").some((cookie) => cookie.trim().startsWith(`${name}=`)));
}

function getIncomingCsrfHeader(request: Request): string | null {
  for (const name of CSRF_HEADER_NAMES) {
    const value = request.headers.get(name);
    if (value?.trim()) return value;
  }

  return null;
}

function hasUsableIncomingCsrf(request: Request, requestCookie: string | null): boolean {
  return Boolean(getIncomingCsrfHeader(request) && hasCookie(requestCookie, CSRF_COOKIE_NAME));
}

type BackendCsrfHeaders = {
  token: string;
  cookie: string;
};

async function getBackendCsrfHeaders(requestCookie: string | null, isAdmin: boolean): Promise<BackendCsrfHeaders | null> {
  const response = await fetch(`${getBaseUrl(isAdmin).replace(/\/$/, "")}${CSRF_ENDPOINT}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(requestCookie ? { Cookie: requestCookie } : {}),
    },
    cache: "no-store",
  });
  const payload = await parseBackendResponse(response);

  if (!response.ok) return null;

  const token = extractCsrfToken(payload, response.headers);
  const csrfCookie = toCookieHeader(getSetCookieHeaders(response.headers));
  const cookie = [requestCookie, csrfCookie].filter(Boolean).join("; ");

  if (!token || !hasCookie(cookie || null, CSRF_COOKIE_NAME)) return null;

  return { token, cookie };
}

function copyRequestHeaders(request: Request): Headers {
  const headers = new Headers();
  const accept = request.headers.get("accept");
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");

  if (accept) headers.set("Accept", accept);
  if (contentType) headers.set("Content-Type", contentType);
  if (authorization) headers.set("Authorization", authorization);

  return headers;
}

function buildResponseHeaders(backendResponse: Response): Headers {
  const headers = new Headers();
  const contentType = backendResponse.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  for (const cookie of getSetCookieHeaders(backendResponse.headers)) {
    headers.append("Set-Cookie", cookie);
  }

  return headers;
}

function stripAuthCookies(cookieHeader: string): string {
  return cookieHeader
    .split(";")
    .map((c) => c.trim())
    .filter((c) => !AUTH_COOKIE_NAMES.some((name) => c.startsWith(`${name}=`)))
    .join("; ")
    .trim();
}

async function handler(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = params.path ?? [];
  const requestUrl = new URL(request.url);
  const method = request.method.toUpperCase();
  const headers = copyRequestHeaders(request);
  const rawCookie = request.headers.get("cookie");

  // Determine whether this is a public auth endpoint
  const routePath = path.join("/");
  const isPublicAuth = PUBLIC_AUTH_PATHS.has(routePath);
  const isAdminBackendPath = routePath.startsWith(ADMIN_BACKEND_PATH_PREFIX);

  // Strip expired auth cookies for public routes to prevent
  // "jwt expired" errors on routes that don't need authentication.
  const requestCookie = rawCookie && (isPublicAuth || isAdminBackendPath)
    ? stripAuthCookies(rawCookie) || null
    : rawCookie;

  if (requestCookie) headers.set("Cookie", requestCookie);

  // Bridge the admin session cookie to an Authorization header for the backend
  if (rawCookie && !headers.has("Authorization")) {
    const adminTokenMatch = rawCookie.match(new RegExp(`(?:^|;\\s*)${ADMIN_SESSION_COOKIE}=([^;]*)`));
    if (adminTokenMatch && adminTokenMatch[1]) {
      headers.set("Authorization", `Bearer ${adminTokenMatch[1]}`);
    }
  }

  if (STATE_CHANGING_METHODS.has(method)) {
    if (hasUsableIncomingCsrf(request, requestCookie)) {
      const csrfToken = getIncomingCsrfHeader(request);
      if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
    } else {
      let csrfHeaders: BackendCsrfHeaders | null = null;
      try {
        csrfHeaders = await getBackendCsrfHeaders(requestCookie, isAdminBackendPath);
      } catch {
        csrfHeaders = null;
      }

      if (!csrfHeaders) {
        return NextResponse.json(CSRF_PREPARE_ERROR_RESPONSE, { status: 503 });
      }

      headers.set("X-CSRF-Token", csrfHeaders.token);
      headers.set("Cookie", csrfHeaders.cookie);
    }
  }

  const body = method === "GET" || method === "HEAD"
    ? undefined
    : await request.arrayBuffer();

  const backendUrl = buildBackendUrl(path, requestUrl.search, isAdminBackendPath);
  const backendResponse = await fetch(backendUrl, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: buildResponseHeaders(backendResponse),
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
