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
}

export interface ForgotPasswordInput {
  email: string;
}

export interface VerifyCodeInput {
  email: string;
  code: string;
}

export interface ResetPasswordInput {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
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
  phoneVerifiedAt?: string | null;
  avatarUrl?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthActionResult {
  success: true;
  message: string;
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
