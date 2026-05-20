import { ApiError, apiClient } from "@/services/api";
import {
  clearStoredAuthSession,
  getLastAuthEmail,
  getStoredAuthUser,
  storeAuthSession,
  storeAuthUser,
  storeLastAuthEmail,
} from "@/services/auth-session";
import type {
  AuthActionResult,
  AuthRole,
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  PermissionPreferencesInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateMeInput,
  VerifyCodeInput,
} from "@/types/auth";
import type { SellerApplicationInput, SellerApplicationResult } from "@/types/seller";

const AUTH_ENDPOINTS = {
  register: "/auth/register",
  login: "/auth/login",
  logout: "/auth/logout",
  me: "/user/me",
  refreshToken: "/auth/refresh-token",
  forgotPassword: "/auth/forgot-password",
  verifyCode: "/auth/verify-code",
  resetPassword: "/auth/reset-password",
  updateMe: "/user/update-me",
  changePassword: "/user/change-password",
  sellerApplication: "/vendor/applications",
} as const;

const ROLE_REDIRECTS: Record<AuthRole, string> = {
  buyer: "/account",
  seller: "/seller",
  admin: "/seller",
  support: "/seller",
};

const DEFAULT_BUYER_REDIRECT = "/account";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function collectCandidateRecords(payload: unknown): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const queue: unknown[] = [payload];
  const seen = new Set<Record<string, unknown>>();

  while (queue.length > 0) {
    const current = queue.shift();
    const record = asRecord(current);
    if (!record || seen.has(record)) continue;

    seen.add(record);
    results.push(record);

    for (const key of [
      "data",
      "payload",
      "result",
      "user",
      "account",
      "auth",
      "session",
      "tokens",
      "token",
    ]) {
      if (key in record) {
        queue.push(record[key]);
      }
    }
  }

  return results;
}

function getStringByKeys(
  records: Record<string, unknown>[],
  keys: readonly string[],
): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = asNonEmptyString(record[key]);
      if (value) return value;
    }
  }

  return undefined;
}

function normalizeRole(rawRole: string | undefined): AuthRole | undefined {
  if (!rawRole) return undefined;

  const normalized = rawRole.toLowerCase();
  if (normalized.includes("seller") || normalized.includes("vendor")) return "seller";
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("support")) return "support";
  if (normalized.includes("buyer") || normalized.includes("customer") || normalized.includes("user")) return "buyer";

  return undefined;
}

function splitFullName(name: string): { firstName: string; lastName: string } {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function fallbackNameFromEmail(email: string): string {
  return email.split("@")[0] ?? "";
}

function normalizeUser(payload: unknown, fallbackEmail?: string): AuthUser {
  const records = collectCandidateRecords(payload);
  const email =
    getStringByKeys(records, ["email", "mail"]) ??
    asNonEmptyString(fallbackEmail);

  if (!email) {
    throw new ApiError("Auth response did not include a valid user email.", 500, payload);
  }

  const userId =
    getStringByKeys(records, ["id", "_id", "userId", "uid"]) ??
    email;

  const fullName =
    getStringByKeys(records, ["name", "fullName", "displayName"]) ??
    fallbackNameFromEmail(email);
  const splitName = splitFullName(fullName);

  const firstName =
    getStringByKeys(records, ["firstName", "first_name", "givenName"]) ??
    splitName.firstName;
  const lastName =
    getStringByKeys(records, ["lastName", "last_name", "surname", "familyName"]) ??
    splitName.lastName;

  const role = normalizeRole(
    getStringByKeys(records, ["role", "accountType", "userType"]),
  );

  return {
    id: userId,
    firstName: firstName || "User",
    lastName: lastName || "",
    email,
    role,
    phone: getStringByKeys(records, ["phone", "phoneNumber", "telephone", "mobile"]),
    avatarUrl: getStringByKeys(records, ["avatarUrl", "avatar", "photoUrl"]),
  };
}

function extractAccessToken(payload: unknown): string | undefined {
  const records = collectCandidateRecords(payload);
  const accessToken = getStringByKeys(records, [
    "accessToken",
    "access_token",
    "token",
    "jwt",
  ]);
  return accessToken;
}

function sanitizeInternalPath(path?: string | null): string | undefined {
  if (!path) return undefined;

  const normalized = path.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return undefined;
  if (normalized.startsWith("/auth")) return undefined;

  return normalized;
}

function extractActionMessage(payload: unknown, fallbackMessage: string): string {
  const records = collectCandidateRecords(payload);
  return (
    getStringByKeys(records, ["message", "detail", "statusMessage"]) ??
    fallbackMessage
  );
}

function buildActionResult(
  payload: unknown,
  fallbackMessage: string,
  fallbackPath?: string,
): AuthActionResult {
  const records = collectCandidateRecords(payload);
  const payloadNextPath = sanitizeInternalPath(
    getStringByKeys(records, ["nextPath", "redirectPath", "redirectTo"]),
  );

  return {
    success: true,
    message: extractActionMessage(payload, fallbackMessage),
    nextPath: payloadNextPath ?? sanitizeInternalPath(fallbackPath),
  };
}

function buildRegisterPayload(input: RegisterInput) {
  const normalizedPhone = input.phone.replace(/[\s()-]/g, "");
  const telephone =
    /^(9|7)\d{8}$/.test(normalizedPhone)
      ? `0${normalizedPhone}`
      : normalizedPhone;

  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    telephone,
  };
}

export function getDemoVerificationEmail(): string {
  return getLastAuthEmail();
}

export function getPostLoginRedirectPath(
  user: Pick<AuthUser, "role">,
  preferredPath?: string | null,
): string {
  const safePreferredPath = sanitizeInternalPath(preferredPath);
  if (safePreferredPath) return safePreferredPath;

  if (!user.role) return DEFAULT_BUYER_REDIRECT;
  return ROLE_REDIRECTS[user.role] ?? DEFAULT_BUYER_REDIRECT;
}

export function getStoredAuthSession(): AuthSession | null {
  const user = getStoredAuthUser();

  if (!user) return null;
  return { user };
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredAuthUser());
}

export async function login(input: LoginInput): Promise<AuthSession> {
  storeLastAuthEmail(input.email);

  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.login, {
    method: "POST",
    authMode: "omit",
    body: JSON.stringify(input),
  });

  const records = collectCandidateRecords(payload);
  const action = getStringByKeys(records, ["action"]);
  if (action === "CHANGE_PASSWORD_REQUIRED") {
    throw new ApiError(
      extractActionMessage(payload, "Please change your temporary password before continuing."),
      403,
      payload,
    );
  }

  let user: AuthUser;
  try {
    user = await getCurrentUser();
  } catch (error) {
    clearStoredAuthSession();
    throw error;
  }

  const session: AuthSession = {
    user,
    accessToken: extractAccessToken(payload),
  };

  storeAuthSession(session);
  return session;
}

export async function register(input: RegisterInput): Promise<AuthActionResult> {
  storeLastAuthEmail(input.email);

  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.register, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify(buildRegisterPayload(input)),
  });

  return buildActionResult(payload, "Account created successfully.", "/auth/permissions");
}

export async function logout(): Promise<AuthActionResult> {
  let backendLogoutCompleted = true;

  try {
    await apiClient<unknown>(AUTH_ENDPOINTS.logout, {
      method: "POST",
      csrf: true,
    });
  } catch {
    backendLogoutCompleted = false;
  } finally {
    clearStoredAuthSession();
  }

  return {
    success: true,
    message: backendLogoutCompleted
      ? "Signed out successfully."
      : "Signed out on this device. Backend session could not be reached.",
    nextPath: "/auth/login",
  };
}

export async function getCurrentUser(): Promise<AuthUser> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.me, {
    method: "GET",
  });

  const fallbackEmail = getStoredAuthUser()?.email;
  const user = normalizeUser(payload, fallbackEmail);
  storeAuthUser(user);
  storeLastAuthEmail(user.email);
  return user;
}

export async function refreshAccessToken(): Promise<string> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.refreshToken, {
    method: "POST",
    authMode: "omit",
    skipAuthRefresh: true,
    csrf: true,
  });

  const accessToken = extractAccessToken(payload);
  if (!accessToken) {
    throw new ApiError("Backend did not return a refreshed access token.", 500, payload);
  }

  return accessToken;
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<AuthActionResult> {
  storeLastAuthEmail(input.email);

  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.forgotPassword, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify(input),
  });

  return buildActionResult(
    payload,
    "Verification code sent.",
    `/auth/verify-code?email=${encodeURIComponent(input.email)}`,
  );
}

export async function verifyResetCode(
  input: VerifyCodeInput,
): Promise<AuthActionResult> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.verifyCode, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify(input),
  });

  return buildActionResult(
    payload,
    "Code verified.",
    `/auth/reset-password?email=${encodeURIComponent(input.email)}&code=${encodeURIComponent(input.code)}`,
  );
}

export async function resetPassword(
  input: ResetPasswordInput,
): Promise<AuthActionResult> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.resetPassword, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify(input),
  });

  return buildActionResult(payload, "Password updated successfully.", "/auth/login");
}

export async function updateMe(input: UpdateMeInput): Promise<AuthUser> {
  const { phone, ...rest } = input;
  const body = {
    ...rest,
    ...(phone !== undefined ? { telephone: phone } : {}),
  };

  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.updateMe, {
    method: "PATCH",
    csrf: true,
    body: JSON.stringify(body),
  });

  const fallbackEmail = getStoredAuthUser()?.email;
  const user = normalizeUser(payload, fallbackEmail);
  storeAuthUser(user);
  return user;
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<AuthActionResult> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.changePassword, {
    method: "POST",
    csrf: true,
    body: JSON.stringify({
      ...input,
      confirmPassword: input.confirmPassword ?? input.newPassword,
    }),
  });

  clearStoredAuthSession();
  return buildActionResult(payload, "Password changed successfully.");
}

export async function savePermissionPreferences(
  input: PermissionPreferencesInput,
): Promise<AuthActionResult> {
  void input;

  return {
    success: true,
    message: "Preferences saved.",
    nextPath: "/",
  };
}

export async function submitSellerApplication(
  input: SellerApplicationInput,
): Promise<SellerApplicationResult> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.sellerApplication, {
    method: "POST",
    csrf: true,
    body: JSON.stringify(input),
  });
  const records = collectCandidateRecords(payload);
  const applicationId =
    getStringByKeys(records, ["applicationId", "id", "_id"]) ?? input.email;

  return {
    success: true,
    applicationId,
    nextPath: "/seller",
  };
}
