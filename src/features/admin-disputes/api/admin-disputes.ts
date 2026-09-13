/**
 * @file admin-disputes.ts
 * @module features/admin-disputes/api
 * @description
 * HTTP client wrappers for the Zogular Admin Returns, Claims & Disputes API.
 * Interacts with /admin/disputes with full CSRF protection on mutations.
 */

import { apiClient } from "@/services/api";
import type {
  AdminDisputeRecord,
  DisputesPagination,
  DisputesQuery,
  DisputeStatus,
} from "../types";

const ADMIN_DISPUTES_ENDPOINT = "/admin/disputes";

interface BackendDisputesResponse {
  data?: {
    disputes?: AdminDisputeRecord[];
    pagination?: DisputesPagination;
  };
  disputes?: AdminDisputeRecord[];
  pagination?: DisputesPagination;
}

interface BackendSingleDisputeResponse {
  data?: {
    dispute?: AdminDisputeRecord;
  };
  dispute?: AdminDisputeRecord;
}

/**
 * Retrieves paginated, filtered admin disputes with search, status, category, and severity support.
 * Calls GET /admin/disputes.
 */
export async function fetchDisputes(
  query: DisputesQuery = {}
): Promise<{
  disputes: AdminDisputeRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
}> {
  const normalizedQuery: Record<string, string | number | boolean | null | undefined> = {
    page: query.page,
    limit: query.limit,
    status: query.status,
    category: query.category,
    severity: query.severity,
    search: query.search?.trim() || undefined,
  };

  const response = await apiClient<BackendDisputesResponse>(
    ADMIN_DISPUTES_ENDPOINT,
    {
      method: "GET",
      query: normalizedQuery,
    }
  );

  const disputes: AdminDisputeRecord[] =
    response?.data?.disputes ?? response?.disputes ?? [];

  const pagination: DisputesPagination =
    response?.data?.pagination ??
    response?.pagination ?? {
      total: disputes.length,
      page: query.page || 1,
      limit: query.limit || 15,
      pages: Math.max(1, Math.ceil(disputes.length / (query.limit || 15))),
    };

  return { disputes, pagination };
}

/**
 * Retrieves a single dispute record by its identifier.
 * Calls GET /admin/disputes/${id}.
 */
export async function fetchDisputeById(id: string): Promise<AdminDisputeRecord> {
  const response = await apiClient<BackendSingleDisputeResponse | AdminDisputeRecord>(
    `${ADMIN_DISPUTES_ENDPOINT}/${id}`,
    {
      method: "GET",
    }
  );

  if ("data" in response && response.data?.dispute) {
    return response.data.dispute;
  }
  if ("dispute" in response && response.dispute) {
    return response.dispute;
  }

  return response as AdminDisputeRecord;
}

/**
 * Updates a dispute's operational status with mandatory justification and optional assignee.
 * Calls PATCH /admin/disputes/${id}/status with CSRF protection.
 */
export async function updateDisputeStatus(
  id: string,
  payload: { status: DisputeStatus; note: string; assignedTo?: string }
): Promise<void> {
  await apiClient<void>(`${ADMIN_DISPUTES_ENDPOINT}/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    csrf: true,
  });
}

/**
 * Appends an internal operator note to the dispute audit thread.
 * Calls POST /admin/disputes/${id}/notes with CSRF protection.
 */
export async function addDisputeNote(id: string, note: string): Promise<void> {
  await apiClient<void>(`${ADMIN_DISPUTES_ENDPOINT}/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ note }),
    csrf: true,
  });
}
