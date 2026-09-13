/**
 * @file index.ts
 * @module features/admin-access
 * @description
 * Public barrel exports for F9 Access Control, Governance & Central Audit Log Explorer.
 */

// Components
export { AdminAccessWorkspace } from "./components/AdminAccessWorkspace";
export { AccessTabNavigation } from "./components/AccessTabNavigation";
export { AdminUsersTable, AdminRoleBadge, getRoleTone } from "./components/AdminUsersTable";
export { AdminRoleElevationDialog } from "./components/AdminRoleElevationDialog";
export { AdminUserDetailSheet } from "./components/AdminUserDetailSheet";
export { RolePermissionMatrixView } from "./components/RolePermissionMatrixView";
export { AuditLogTable } from "./components/AuditLogTable";
export { AuditLogDetailSheet } from "./components/AuditLogDetailSheet";
export { AddStaffMemberDialog } from "./components/AddStaffMemberDialog";

// Hooks
export { useAdminAccess } from "./hooks/use-admin-access";
export { useAdminAudit } from "./hooks/use-admin-audit";

// API
export {
  fetchAdminUsers,
  updateAdminUserRole,
  toggleAdminUserStatus,
  fetchAdminAuditLogs,
  fetchAdminAuditLogById,
  createAdminStaff,
  ADMIN_ROLES_FILTER,
} from "./api/admin-access";

// Types & Metadata
export type {
  AdminUserRecord,
  AdminAuditLogRecord,
  AdminAuditActor,
  AuditLogOutcome,
  AccessTabKey,
  AuditActionCategory,
  AuditActionMetadata,
  CanonicalPermissionItem,
  CanonicalAdminRole,
  AssignableRoleOption,
  ReasonCodeOption,
  AuditLogsQueryParams,
  AuditLogsResponse,
  // Staff onboarding
  AssignableStaffRole,
  CreateAdminStaffPayload,
  CreateAdminStaffResult,
} from "./types";

export {
  ACCESS_TABS,
  AUDIT_OUTCOME_TONES,
  AUDIT_ACTION_MAP,
  getAuditActionMeta,
  CANONICAL_PERMISSION_CATALOG,
  CANONICAL_ROLE_PERMISSIONS,
  ALLOWED_ASSIGNABLE_ROLES,
  ROLE_ELEVATION_REASON_CODES,
  STATUS_TOGGLE_REASON_CODES,
  // Staff onboarding
  ASSIGNABLE_STAFF_ROLES,
  ASSIGNABLE_STAFF_ROLE_LABELS,
} from "./types";
