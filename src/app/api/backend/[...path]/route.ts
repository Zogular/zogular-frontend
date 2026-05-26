import { NextResponse } from "next/server";

const BACKEND_BASE_URL =
  process.env.ADMIN_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:5000/api/v1";

const CSRF_ENDPOINT = "/auth/csrf-token";
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type RouteContext = {
  params: Promise<{ path?: string[] }> | { path?: string[] };
};

function buildBackendUrl(path: string[], search: string): string {
  const base = BACKEND_BASE_URL.replace(/\/$/, "");
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

async function getBackendCsrfHeaders(requestCookie: string | null): Promise<Record<string, string>> {
  const response = await fetch(`${BACKEND_BASE_URL.replace(/\/$/, "")}${CSRF_ENDPOINT}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(requestCookie ? { Cookie: requestCookie } : {}),
    },
    cache: "no-store",
  });
  const payload = await parseBackendResponse(response);

  if (!response.ok) return {};

  const token = extractCsrfToken(payload, response.headers);
  const csrfCookie = toCookieHeader(getSetCookieHeaders(response.headers));
  const cookie = [requestCookie, csrfCookie].filter(Boolean).join("; ");

  return {
    ...(token ? { "X-CSRF-Token": token } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
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

async function handler(request: Request, context: RouteContext) {
  const params = await context.params;
  const path = params.path ?? [];
  const requestUrl = new URL(request.url);
  const method = request.method.toUpperCase();
  const headers = copyRequestHeaders(request);
  const requestCookie = request.headers.get("cookie");

  if (requestCookie) headers.set("Cookie", requestCookie);

  if (STATE_CHANGING_METHODS.has(method)) {
    const csrfHeaders = await getBackendCsrfHeaders(requestCookie);
    for (const [key, value] of Object.entries(csrfHeaders)) {
      headers.set(key, value);
    }
  }

  const body = method === "GET" || method === "HEAD"
    ? undefined
    : await request.arrayBuffer();

  const backendResponse = await fetch(buildBackendUrl(path, requestUrl.search), {
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
