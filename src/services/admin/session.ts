import {
  hasPermission,
  CURRENT_ADMIN_FALLBACK,
  type AdminRole,
  type Permission,
} from "@/services/rbac";
import { ADMIN_SESSION_COOKIE } from "@/services/admin/session-cookie";

export { ADMIN_SESSION_COOKIE };

export type AdminAuthStrength = "password" | "mfa_ready" | "passkey_ready";
export type AdminSessionStatus = "authenticated" | "expired" | "unauthorized";

export interface AdminIdentityClaims {
  role: AdminRole;
  permissions?: Permission[];
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

/** @deprecated Do not use global static identity. Use real authenticated context instead. */
export const CURRENT_ADMIN_IDENTITY: AdminIdentity = {
  id: CURRENT_ADMIN_FALLBACK.id,
  name: CURRENT_ADMIN_FALLBACK.name,
  email: "danny@zogular.com",
  claims: {
    role: CURRENT_ADMIN_FALLBACK.role,
    authStrength: "mfa_ready",
    issuedAt: "2026-05-01T08:00:00Z",
  },
  sessionStatus: "authenticated",
};

/** @deprecated Relying on static identity is unsafe for launch. */
export function getCurrentAdminRole() {
  return CURRENT_ADMIN_IDENTITY.claims.role;
}

/** @deprecated Do not use static fallback for permissions. Use useAdminIdentity() hook and adminIdentityHasPermission instead. */
export function adminHasPermission(permission: Permission) {
  return hasPermission(getCurrentAdminRole(), permission);
}

export function adminIdentityHasPermission(identity: AdminIdentity, permission: Permission) {
  return hasPermission(identity.claims.role, permission);
}

export function getAdminInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
