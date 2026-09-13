/**
 * @file admin-access.ts
 * @module features/admin-access/api
 * @description
 * Typed API clients for Zogular Admin Access Control, Role Governance, and Central Audit Log Explorer.
 * Integrates with /admin/users and /admin/audit-logs with CSRF tokens and audit reason payloads.
 */

import { apiClient, ApiError } from "@/services/api";
import type {
  AdminAuditLogRecord,
  AdminUserRecord,
  AuditLogsQueryParams,
  AuditLogsResponse,
  CreateAdminStaffPayload,
  CreateAdminStaffResult,
} from "../types";

export type { AuditLogsQueryParams, AuditLogsResponse };

const ADMIN_USERS_ENDPOINT = "/admin/users";
const ADMIN_AUDIT_LOGS_ENDPOINT = "/admin/audit-logs";

export const ADMIN_ROLES_FILTER = [
  "SUPER_ADMIN",
  "TECH_ADMIN",
  "EXECUTIVE",
  "OPERATIONS",
  "ADMIN",
];

interface BackendUsersResponse {
  status: string;
  data: {
    users: AdminUserRecord[];
  };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface BackendSingleUserResponse {
  status: string;
  data: {
    user: AdminUserRecord;
  };
}

interface BackendAuditLogsResponse {
  status: string;
  data?: {
    logs: AdminAuditLogRecord[];
  };
  logs?: AdminAuditLogRecord[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface BackendSingleAuditLogResponse {
  status: string;
  data?: {
    log: AdminAuditLogRecord;
  };
  log?: AdminAuditLogRecord;
}


// ============================================================================
// API CLIENT FUNCTIONS
// ============================================================================

/**
 * Retrieves all staff members with administrative roles.
 * Calls GET /admin/users?limit=100 and filters for admin roles.
 */
export async function fetchAdminUsers(): Promise<AdminUserRecord[]> {
  const response = await apiClient<BackendUsersResponse>(ADMIN_USERS_ENDPOINT, {
    method: "GET",
    query: { limit: 100 },
  });

  const allUsers = response.data?.users ?? [];
  return allUsers.filter((user) => ADMIN_ROLES_FILTER.includes(user.role));
}

/**
 * Updates an administrator's assigned role with governance reason and code.
 * Calls PATCH /admin/users/${id}/role with csrf: true.
 */
export async function updateAdminUserRole(
  id: string,
  role: string,
  reason: string,
  reasonCode: string,
): Promise<AdminUserRecord> {
  const response = await apiClient<BackendSingleUserResponse>(
    `${ADMIN_USERS_ENDPOINT}/${id}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role, reason, reasonCode }),
      csrf: true,
    },
  );

  return response.data.user;
}

/**
 * Activates or deactivates an administrator's status with governance reason.
 * Calls PATCH /admin/users/${id}/toggle-status with csrf: true.
 */
export async function toggleAdminUserStatus(
  id: string,
  isActive: boolean,
  reason: string,
  reasonCode: string,
): Promise<AdminUserRecord> {
  const response = await apiClient<BackendSingleUserResponse>(
    `${ADMIN_USERS_ENDPOINT}/${id}/toggle-status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive, reason, reasonCode }),
      csrf: true,
    },
  );

  return response.data.user;
}

/**
 * Retrieves paginated audit logs with search, action, and date range filters.
 * Calls GET /admin/audit-logs with query params.
 */
export async function fetchAdminAuditLogs(
  params: AuditLogsQueryParams = {},
): Promise<AuditLogsResponse> {
  const query: Record<string, string | number | boolean | null | undefined> = {
    page: params.page ?? 1,
    limit: params.limit ?? 15,
    action: params.action || undefined,
    entityType: params.entityType || undefined,
    status: params.status || undefined,
    search: params.search?.trim() || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };

  const response = await apiClient<BackendAuditLogsResponse>(
    ADMIN_AUDIT_LOGS_ENDPOINT,
    {
      method: "GET",
      query,
    },
  );

  const logs = response.data?.logs || response.logs || [];
  const pagination = response.pagination || {
    total: logs.length,
    page: params.page ?? 1,
    limit: params.limit ?? 15,
    pages: Math.max(1, Math.ceil(logs.length / (params.limit ?? 15))),
  };

  return { logs, pagination };
}

/**
 * Retrieves a single audit log event by ID.
 * Calls GET /admin/audit-logs/${id}.
 */
export async function fetchAdminAuditLogById(
  id: string,
): Promise<AdminAuditLogRecord | null> {
  try {
    const response = await apiClient<BackendSingleAuditLogResponse>(
      `${ADMIN_AUDIT_LOGS_ENDPOINT}/${id}`,
      { method: "GET" },
    );

    return response.data?.log || response.log || null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// ADMIN STAFF ONBOARDING
// ============================================================================

/**
 * POST /admin/team/staff
 * SUPER_ADMIN only. Atomically creates a new admin staff account with the specified
 * assignable role, sets mustChangePassword: true, and dispatches a welcome email.
 */
export async function createAdminStaff(
  payload: CreateAdminStaffPayload,
): Promise<CreateAdminStaffResult> {
  const response = await apiClient<{ status: string; data: CreateAdminStaffResult }>(
    "/admin/team/staff",
    {
      method: "POST",
      body: JSON.stringify(payload),
      csrf: true,
    },
  );
  return response.data;
}
