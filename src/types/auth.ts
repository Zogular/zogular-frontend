export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  next?: string | null;
}

export interface ForgotPasswordInput {
  email: string;
  next?: string | null;
}

export interface VerifyCodeInput {
  email: string;
  code: string;
  next?: string | null;
}

export interface ResetPasswordInput {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
  next?: string | null;
}

export interface PermissionPreferencesInput {
  locationEnabled: boolean;
  notificationsEnabled: boolean;
}

export type AuthRole = "buyer" | "seller" | "admin" | "support";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: AuthRole;
  phone?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  avatarUrl?: string;
}

export interface AuthSession {
  user: AuthUser;
}

export interface AuthActionResult {
  success: true;
  message: string;
  emailSent?: boolean;
  nextPath?: string;
}

export interface UpdateMeInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}
