import { NextResponse } from "next/server";
import {
  ADMIN_BACKEND_ENDPOINTS,
  buildBackendUrl,
  getBackendCsrfHeaders,
  getBackendMessage,
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

function setupResponse(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, private, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

function accountClassFrom(payload: unknown): "STAFF" | "CUSTOMER" | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const accountClass = data?.accountClass;
  return accountClass === "STAFF" || accountClass === "CUSTOMER" ? accountClass : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const record = asRecord(body);
  const token = asNonEmptyString(record?.token);
  const email = asNonEmptyString(record?.email)?.toLowerCase();
  const password = asNonEmptyString(record?.password);
  const confirmPassword = asNonEmptyString(record?.confirmPassword) ?? "";

  if (!token || !email || !password) {
    return setupResponse(
      { message: "Activation token, email, and password are required." },
      400,
    );
  }

  let csrfHeaders: Record<string, string>;
  try {
    csrfHeaders = await getBackendCsrfHeaders();
  } catch {
    return setupResponse(
      { message: "Could not prepare a secure account setup. Please try again." },
      502,
    );
  }

  const backendResponse = await fetch(buildBackendUrl(ADMIN_BACKEND_ENDPOINTS.setupAccount), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...csrfHeaders,
    },
    body: JSON.stringify({
      token,
      email,
      password,
      confirmPassword,
    }),
    cache: "no-store",
  });

  const payload = await parseBackendResponse(backendResponse);

  if (!backendResponse.ok) {
    return setupResponse(
      { message: getBackendMessage(payload, "Account setup failed.") },
      backendResponse.status,
    );
  }

  const accountClass = accountClassFrom(payload);
  if (!accountClass) {
    return setupResponse(
      { message: "Account activation could not be confirmed. Please request a new invitation." },
      502,
    );
  }

  return setupResponse(
    {
      success: true,
      message: getBackendMessage(payload, "Account setup completed successfully."),
      accountClass,
    },
    200,
  );
}
