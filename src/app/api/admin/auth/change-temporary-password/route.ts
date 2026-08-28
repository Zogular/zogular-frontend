import { NextResponse } from "next/server";
import {
  ADMIN_BACKEND_ENDPOINTS,
  buildBackendUrl,
  getBackendCsrfHeaders,
  parseBackendResponse,
} from "@/services/admin/backend-session";

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

function getSafePasswordChangeError(status: number): string {
  if (status === 400 || status === 422) return "Check the new password details and try again.";
  if (status === 401 || status === 403) return "The temporary sign-in details could not be confirmed. Sign in again.";
  if (status === 404) return "This password setup link is no longer available. Sign in again.";
  if (status === 429) return "Too many attempts. Wait a moment, then try again.";
  return "Password setup is unavailable right now. Try again.";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const record = asRecord(body);
  const userId = record?.userId;
  const currentPassword = asNonEmptyString(record?.currentPassword);
  const newPassword = asNonEmptyString(record?.newPassword);
  const confirmPassword = asNonEmptyString(record?.confirmPassword);

  if (!isSafeTemporaryPasswordUserId(userId) || !currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json(
      { message: "Enter the temporary password and your new password." },
      { status: 400 },
    );
  }

  let csrfHeaders: Record<string, string>;
  try {
    csrfHeaders = await getBackendCsrfHeaders();
  } catch {
    return NextResponse.json(
      { message: "Could not prepare a secure password setup. Please try again." },
      { status: 502 },
    );
  }

  const backendResponse = await fetch(buildBackendUrl(ADMIN_BACKEND_ENDPOINTS.changeTemporaryPassword), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...csrfHeaders,
    },
    body: JSON.stringify({
      userId,
      currentPassword,
      newPassword,
      confirmPassword,
    }),
    cache: "no-store",
  });
  const payload = await parseBackendResponse(backendResponse);

  if (!backendResponse.ok) {
    return NextResponse.json(
      { message: getSafePasswordChangeError(backendResponse.status) },
      { status: backendResponse.status },
    );
  }

  if (asRecord(payload)?.status !== "success") {
    return NextResponse.json(
      { message: "Password setup could not be confirmed. Try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Password updated. Sign in with your new password.",
  });
}
