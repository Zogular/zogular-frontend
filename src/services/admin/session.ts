import {
  type AdminRole,
  type Permission,
} from "@/services/rbac";
import { ADMIN_SESSION_COOKIE } from "@/services/admin/session-cookie";

export { ADMIN_SESSION_COOKIE };

export type AdminAuthStrength = "password" | "mfa_ready" | "passkey_ready";
export type AdminSessionStatus = "authenticated" | "expired" | "unauthorized";

export interface AdminIdentityClaims {
  role: AdminRole;
  permissions: Permission[];
  authStrength: AdminAuthStrength;
  issuedAt: string;
}

export interface AdminIdentity {
  id: string;
  name: string;
  email: string;
  claims: AdminIdentityClaims;
  sessionStatus: AdminSessionStatus;
}

export function adminIdentityHasPermission(
  identity: AdminIdentity | null | undefined,
  permission: Permission,
): boolean {
  if (!identity || identity.sessionStatus !== "authenticated") {
    return false;
  }
  const permissions = identity.claims?.permissions;
  if (!Array.isArray(permissions)) {
    return false;
  }
  return permissions.includes(permission);
}

export function getAdminInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
