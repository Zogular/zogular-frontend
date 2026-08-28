import { NextResponse } from "next/server";
import {
  ADMIN_DASHBOARD_PATH,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
} from "@/services/admin/session-cookie";
import {
  ADMIN_BACKEND_ENDPOINTS,
  buildAdminIdentity,
  buildBackendUrl,
  extractAdminSessionToken,
  extractSessionTokenFromSetCookie,
  getBackendCode,
  getBackendCsrfHeaders,
  getBackendMessage,
  parseBackendResponse,
} from "@/services/admin/backend-session";
import { sanitizeAdminNextPath } from "@/services/admin/verification-recovery";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isSafeTemporaryPasswordUserId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

function extractChangePasswordUserId(payload: unknown): string | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const userId = data?.userId ?? root?.userId;
  return isSafeTemporaryPasswordUserId(userId) ? userId : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = asNonEmptyString(asRecord(body)?.email)?.toLowerCase();
  const password = asNonEmptyString(asRecord(body)?.password);
  const nextPath = sanitizeAdminNextPath(asNonEmptyString(asRecord(body)?.nextPath));

  if (!email || !password) {
    return NextResponse.json(
      { message: "Enter your admin credentials." },
      { status: 400 },
    );
  }

  let csrfHeaders: Record<string, string>;
  try {
    csrfHeaders = await getBackendCsrfHeaders();
  } catch {
    return NextResponse.json(
      {
        message: "Could not prepare a secure admin sign in. Please try again.",
      },
      { status: 502 },
    );
  }

  const backendResponse = await fetch(buildBackendUrl(ADMIN_BACKEND_ENDPOINTS.login), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...csrfHeaders,
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const payload = await parseBackendResponse(backendResponse);

  if (
    backendResponse.ok &&
    asRecord(payload)?.status === "pending" &&
    getBackendCode(payload) === "CHANGE_PASSWORD_REQUIRED"
  ) {
    const userId = extractChangePasswordUserId(payload);
    if (!userId) {
      return NextResponse.json(
        { message: "Admin sign-in needs a password update. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: false,
      status: "pending",
      action: "CHANGE_PASSWORD_REQUIRED",
      message: "Set a private password to continue.",
      userId,
    });
  }

  if (!backendResponse.ok) {
    return NextResponse.json(
      {
        code: getBackendCode(payload),
        message: getBackendMessage(
          payload,
          "Admin authentication failed. Check your credentials and try again.",
        ),
      },
      { status: backendResponse.status },
    );
  }

  const identity = buildAdminIdentity(payload, email);
  if (!identity) {
    return NextResponse.json(
      { message: "This account is not authorized for the Zogular admin panel." },
      { status: 403 },
    );
  }

  const token =
    extractAdminSessionToken(payload) ??
    extractSessionTokenFromSetCookie(backendResponse.headers);

  if (!token) {
    return NextResponse.json(
      { message: "Admin backend did not return a session token." },
      { status: 502 },
    );
  }

  const response = NextResponse.json({
    success: true,
    message: "Admin session established.",
    nextPath: nextPath ?? ADMIN_DASHBOARD_PATH,
    identity,
  });

  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
