import { ApiError } from "@/services/api";
import type { AdminIdentity } from "@/services/admin/session";
import { sanitizeAdminNextPath } from "@/services/admin/verification-recovery";

export interface AdminLoginInput {
  email: string;
  password: string;
  nextPath?: string | null;
}

export interface AdminSessionAuthResult {
  success: true;
  message: string;
  nextPath: string;
  identity?: AdminIdentity;
}

export interface AdminTemporaryPasswordRequiredResult {
  success: false;
  status: "pending";
  action: "CHANGE_PASSWORD_REQUIRED";
  message: string;
  userId: string;
}

export type AdminAuthResult = AdminSessionAuthResult | AdminTemporaryPasswordRequiredResult;

export interface AdminChangeTemporaryPasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AdminChangeTemporaryPasswordResult {
  success: true;
  message: string;
}

async function parseAuthResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) return response.json();
  return response.text();
}

function extractAuthMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

async function requestAdminAuth<T>(
  endpoint: "login" | "logout" | "change-temporary-password",
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/admin/auth/${endpoint}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await parseAuthResponse(response);

  if (!response.ok) {
    throw new ApiError(
      extractAuthMessage(payload, "Admin authentication failed."),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export function loginAdmin(input: AdminLoginInput): Promise<AdminAuthResult> {
  const nextPath = sanitizeAdminNextPath(input.nextPath);
  return requestAdminAuth<AdminAuthResult>("login", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      ...(nextPath ? { nextPath } : {}),
    }),
  });
}

export function logoutAdmin(): Promise<AdminSessionAuthResult> {
  return requestAdminAuth<AdminSessionAuthResult>("logout", { method: "POST" });
}

export function changeAdminTemporaryPassword(
  input: AdminChangeTemporaryPasswordInput,
): Promise<AdminChangeTemporaryPasswordResult> {
  return requestAdminAuth<AdminChangeTemporaryPasswordResult>("change-temporary-password", {
    method: "POST",
    body: JSON.stringify({
      userId: input.userId,
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      confirmPassword: input.confirmPassword,
    }),
  });
}
