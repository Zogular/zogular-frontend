import { ApiError, apiClient } from "@/services/api";
import {
  clearPasswordRecoveryIntent,
  clearStoredAuthSession,
  createPasswordRecoveryIntent,
  getPasswordRecoveryIntent as getStoredPasswordRecoveryIntent,
  getStoredAuthUser,
  storePasswordRecoveryIntent,
  storeAuthSession,
  storeAuthUser,
  storeLastAuthEmail,
  type PasswordRecoveryIntent,
} from "@/services/auth-session";
import {
  appendNextPath,
  sanitizeInternalNextPath,
} from "@/services/auth-intent";
import type {
  AuthActionResult,
  AuthRole,
  AuthSession,
  AuthUser,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateMeInput,
  VerifyCodeInput,
} from "@/types/auth";

const AUTH_ENDPOINTS = {
  register: "/auth/register",
  login: "/auth/login",
  logout: "/auth/logout",
  me: "/user/me",
  forgotPassword: "/auth/forgot-password",
  verifyEmail: "/auth/verify-email",
  resendVerification: "/auth/resend-verification",
  verifyCode: "/auth/verify-code",
  resetPassword: "/auth/reset-password",
  updateMe: "/user/update-me",
  changePassword: "/user/change-password",
  sendPhoneOtp: "/auth/phone/send-otp",
  verifyPhoneOtp: "/auth/phone/verify-otp",
} as const;

const ROLE_REDIRECTS: Record<AuthRole, string> = {
  buyer: "/account",
  seller: "/seller",
  admin: "/seller",
  support: "/seller",
};

const DEFAULT_BUYER_REDIRECT = "/account";

let localLogoutPending = false;

export function isLocalLogoutPending(): boolean {
  return localLogoutPending;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function asNullableIsoString(value: unknown): string | null | undefined {
  if (value == null) return null;
  const normalized = asNonEmptyString(String(value));
  return normalized ?? null;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
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
    preferredMoMoNumber: getStringByKeys(records, ["preferredMoMoNumber"]),
    emailVerified: asBoolean(
      records.find((record) => "emailVerified" in record)?.emailVerified,
    ),
    emailVerifiedAt: asNullableIsoString(
      records.find((record) => "emailVerifiedAt" in record)?.emailVerifiedAt,
    ),
    phoneVerifiedAt: asNullableIsoString(
      records.find((record) => "phoneVerifiedAt" in record)?.phoneVerifiedAt,
    ),
    avatarUrl: getStringByKeys(records, ["avatarUrl", "avatar", "photoUrl"]),
  };
}

export function isEmailVerificationRequiredError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 403) return false;

  const records = collectCandidateRecords(error.details);
  const contractCode = getStringByKeys(records, ["code", "errorCode", "reason", "action"])
    ?.trim()
    .toUpperCase();

  if (contractCode) {
    return contractCode === "EMAIL_VERIFICATION_REQUIRED" || contractCode === "VERIFY_EMAIL";
  }

  // The current backend has no machine-readable code for this 403. Keep the
  // fallback deliberately exact so unrelated authorization failures never
  // receive a verification-recovery action.
  return error.message.trim().toLowerCase() === "please verify your email before logging in.";
}

let pendingPasswordReset: { intentId: string; email: string; code: string } | null = null;

export function getPasswordRecoveryIntent(): PasswordRecoveryIntent | null {
  return getStoredPasswordRecoveryIntent();
}

export function clearPasswordRecoveryState(): void {
  pendingPasswordReset = null;
  clearPasswordRecoveryIntent();
}

export function maskPasswordRecoveryEmail(email: string): string {
  const [localPart = "", domain = ""] = email.split("@");
  if (!localPart || !domain) return "your email address";
  const visiblePrefix = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePrefix}${"*".repeat(Math.max(3, localPart.length - visiblePrefix.length))}@${domain}`;
}

function requirePasswordRecoverySuccess(payload: unknown): void {
  const root = asRecord(payload);
  if (root?.status !== "success" || !asNonEmptyString(root.message)) {
    throw new ApiError("Password recovery returned an invalid response.", 502, payload);
  }
}

export function getPasswordRecoveryErrorMessage(
  error: unknown,
  step: "request" | "verify" | "reset",
): string {
  if (!(error instanceof ApiError)) {
    return "Password recovery is temporarily unavailable. Please try again.";
  }
  if (error.status === 409) {
    return "For your security, restart password recovery before continuing.";
  }
  if (error.status === 429) {
    return "Too many attempts. Wait a moment before trying again.";
  }
  if (error.status === 408) {
    return "The request took too long. Check your connection and try again.";
  }
  if (error.status >= 500) {
    return "Password recovery is temporarily unavailable. Please try again.";
  }
  if (error.status === 400) {
    if (step === "request") return "Enter a valid email address and try again.";
    if (step === "verify") return "That code is invalid or has expired. Request a new code and try again.";
    return "The reset code is invalid or has expired. Restart password recovery and try again.";
  }
  return "Password recovery could not continue. Please try again.";
}

export function getPendingPasswordReset(): { email: string; code: string } | null {
  const intent = getStoredPasswordRecoveryIntent();
  if (
    !intent
    || intent.stage !== "code-verified"
    || pendingPasswordReset?.intentId !== intent.intentId
    || pendingPasswordReset.email !== intent.email
  ) {
    return null;
  }
  return { email: pendingPasswordReset.email, code: pendingPasswordReset.code };
}

function appendSafeNext(path: string, nextPath?: string | null): string {
  return appendNextPath(path, nextPath);
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
  const payloadNextPath = sanitizeInternalNextPath(
    getStringByKeys(records, ["nextPath", "redirectPath", "redirectTo"]),
  );
  const rawEmailSent = records.find((record) => "emailSent" in record)?.emailSent;
  const emailSent = asBoolean(rawEmailSent);

  return {
    success: true,
    message: extractActionMessage(payload, fallbackMessage),
    ...(emailSent !== undefined ? { emailSent } : {}),
    nextPath: payloadNextPath ?? sanitizeInternalNextPath(fallbackPath) ?? undefined,
  };
}

function buildRegisterPayload(input: RegisterInput) {
  const normalizedPhone = input.phone.replace(/[\s()-]/g, "");
  const telephone =
    /^(9|7)\d{8}$/.test(normalizedPhone)
      ? `0${normalizedPhone}`
      : normalizedPhone;
  const nextPath = sanitizeInternalNextPath(input.next);

  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    telephone,
    ...(nextPath ? { next: nextPath } : {}),
  };
}

export function getPostLoginRedirectPath(
  user: Pick<AuthUser, "role">,
  preferredPath?: string | null,
): string {
  const safePreferredPath = sanitizeInternalNextPath(preferredPath);
  if (safePreferredPath) return safePreferredPath;

  if (!user.role) return DEFAULT_BUYER_REDIRECT;
  return ROLE_REDIRECTS[user.role] ?? DEFAULT_BUYER_REDIRECT;
}

export function getStoredAuthSession(): AuthSession | null {
  const user = getStoredAuthUser();

  if (!user) return null;
  return { user };
}

export async function login(input: LoginInput): Promise<AuthSession> {
  clearPasswordRecoveryState();
  storeLastAuthEmail(input.email);

  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.login, {
    method: "POST",
    authMode: "omit",
    csrf: true,
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
    user = normalizeUser(payload, input.email);
  } catch (error) {
    try {
      user = await getCurrentUser();
    } catch {
      clearStoredAuthSession();
      throw error;
    }
  }
  const session: AuthSession = { user };

  storeAuthSession(session);
  return session;
}

export async function register(input: RegisterInput): Promise<AuthActionResult> {
  clearPasswordRecoveryState();
  storeLastAuthEmail(input.email);

  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.register, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify(buildRegisterPayload(input)),
  });

  const result = buildActionResult(
    payload,
    "Account created successfully. Please check your email to verify your account.",
    appendSafeNext(
      "/auth/check-email",
      input.next,
    ),
  );

  if (result.emailSent === false && result.nextPath) {
    const hasQuery = result.nextPath.includes("?");
    const deliveryFailedPath = `${result.nextPath}${hasQuery ? "&" : "?"}delivery=failed`;
    return {
      ...result,
      nextPath: deliveryFailedPath,
    };
  }

  return result;
}

export async function logout(): Promise<AuthActionResult> {
  let backendLogoutCompleted = true;

  // Remove client-visible identity before any network wait. The backend
  // request remains a best-effort cookie/session revocation operation.
  localLogoutPending = true;
  clearPasswordRecoveryState();
  clearStoredAuthSession();

  try {
    await apiClient<unknown>(AUTH_ENDPOINTS.logout, {
      method: "POST",
      csrf: true,
    });
  } catch {
    backendLogoutCompleted = false;
  } finally {
    localLogoutPending = false;
    // A final clear prevents any stale listener from restoring private state
    // while the best-effort backend revocation was in flight.
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

export async function getCurrentUser(options: { persist?: boolean; skipAuthRefresh?: boolean; timeout?: number } = {}): Promise<AuthUser> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.me, {
    method: "GET",
    skipAuthRefresh: options.skipAuthRefresh,
    timeout: options.timeout,
  });

  const fallbackEmail = getStoredAuthUser()?.email;
  const user = normalizeUser(payload, fallbackEmail);
  if (options.persist !== false) storeAuthSession({ user });
  return user;
}

function normalizePhoneOtpPayload(phone: string, code?: string) {
  const normalizedPhone = phone.replace(/[\s()-]/g, "").trim();

  return {
    phone: normalizedPhone,
    ...(code ? { code: code.trim() } : {}),
  };
}

export async function sendPhoneOtp(
  phone: string,
  purpose: string = "PHONE_VERIFY",
): Promise<AuthActionResult> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.sendPhoneOtp, {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ ...normalizePhoneOtpPayload(phone), purpose }),
  });

  return buildActionResult(
    payload,
    "If the request is valid, a verification code has been sent to your phone.",
  );
}

export async function verifyPhoneOtp(
  phone: string,
  code: string,
  purpose: string = "PHONE_VERIFY",
): Promise<AuthActionResult> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.verifyPhoneOtp, {
    method: "POST",
    csrf: true,
    body: JSON.stringify({ ...normalizePhoneOtpPayload(phone, code), purpose }),
  });

  return buildActionResult(payload, "Phone number verified successfully.");
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<AuthActionResult> {
  clearPasswordRecoveryState();
  const email = input.email.trim().toLowerCase();
  const safeNextPath = sanitizeInternalNextPath(input.next);

  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.forgotPassword, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify({ email }),
  });
  requirePasswordRecoverySuccess(payload);

  let intent: PasswordRecoveryIntent;
  try {
    intent = createPasswordRecoveryIntent(email, safeNextPath);
  } catch {
    throw new ApiError("Password recovery could not be secured in this browser.", 503);
  }
  if (!storePasswordRecoveryIntent(intent)) {
    throw new ApiError("Password recovery could not be secured in this browser.", 503);
  }

  return {
    success: true,
    message: extractActionMessage(payload, "Verification code sent."),
    nextPath: "/auth/verify-code",
  };
}

export async function verifyEmailToken(token: string): Promise<AuthActionResult> {
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.verifyEmail, {
    method: "GET",
    authMode: "omit",
    query: { token },
  });

  return buildActionResult(payload, "Email verified successfully.", "/auth/login");
}

export async function resendVerificationEmail(
  email: string,
  nextPath?: string | null,
): Promise<AuthActionResult> {
  storeLastAuthEmail(email);
  const safeNextPath = sanitizeInternalNextPath(nextPath);

  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.resendVerification, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      ...(safeNextPath ? { next: safeNextPath } : {}),
    }),
  });

  return buildActionResult(payload, "Verification email sent.");
}

export async function verifyResetCode(
  input: VerifyCodeInput,
): Promise<AuthActionResult> {
  const intent = getStoredPasswordRecoveryIntent();
  const email = input.email.trim().toLowerCase();
  if (!intent || intent.stage !== "code-requested" || intent.email !== email) {
    clearPasswordRecoveryState();
    throw new ApiError("Password recovery must be restarted.", 409);
  }
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.verifyCode, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify({ email: intent.email, code: input.code }),
  });
  requirePasswordRecoverySuccess(payload);

  const verifiedIntent: PasswordRecoveryIntent = { ...intent, stage: "code-verified" };
  if (!storePasswordRecoveryIntent(verifiedIntent)) {
    clearPasswordRecoveryState();
    throw new ApiError("Password recovery could not be secured in this browser.", 503);
  }
  pendingPasswordReset = {
    intentId: verifiedIntent.intentId,
    email: verifiedIntent.email,
    code: input.code,
  };

  return {
    success: true,
    message: extractActionMessage(payload, "Code verified."),
    nextPath: "/auth/reset-password",
  };
}

export async function resetPassword(
  input: ResetPasswordInput,
): Promise<AuthActionResult> {
  const intent = getStoredPasswordRecoveryIntent();
  const email = input.email.trim().toLowerCase();
  if (
    !intent
    || intent.stage !== "code-verified"
    || intent.email !== email
    || !/^\d{6}$/.test(input.code)
  ) {
    clearPasswordRecoveryState();
    throw new ApiError("Password recovery must be restarted.", 409);
  }
  const payload = await apiClient<unknown>(AUTH_ENDPOINTS.resetPassword, {
    method: "POST",
    authMode: "omit",
    csrf: true,
    body: JSON.stringify({
      email: intent.email,
      code: input.code,
      password: input.password,
      confirmPassword: input.confirmPassword,
    }),
  });
  requirePasswordRecoverySuccess(payload);

  const nextPath = intent.nextPath;
  clearPasswordRecoveryState();
  const loginPath = nextPath?.startsWith("/seller") ? "/seller/login" : "/auth/login";

  return {
    success: true,
    message: extractActionMessage(payload, "Password updated successfully."),
    nextPath: appendSafeNext(loginPath, nextPath),
  };
}

export async function updateMe(
  input: UpdateMeInput,
  options: { expectedUserId?: string } = {},
): Promise<AuthUser> {
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
  const currentUser = getStoredAuthUser();
  if (
    options.expectedUserId
    && (user.id !== options.expectedUserId || currentUser?.id !== options.expectedUserId)
  ) {
    throw new ApiError("Account changed before profile update completed.", 409);
  }
  // The PATCH response is authoritative, but broadcasting here would remount the
  // protected account tree while its initiating form is presenting the result.
  // A later session event or navigation still re-verifies this stored snapshot.
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
