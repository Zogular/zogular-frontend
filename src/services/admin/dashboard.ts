import { apiClient, ApiError } from "@/services/api";
import {
  AdminDashboardSummaryContractError,
  parseAdminDashboardSummaryResponse,
} from "@/features/admin-overview/lib/dashboard-summary";
import type { AdminDashboardSummary } from "@/features/admin-overview/types/dashboard-summary";

const ADMIN_DASHBOARD_SUMMARY_ENDPOINT = "/admin/dashboard/summary";

export type AdminOverviewErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "timeout"
  | "unavailable"
  | "malformed";

export interface AdminOverviewSafeError {
  kind: AdminOverviewErrorKind;
  message: string;
}

export async function fetchAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const payload = await apiClient<unknown>(ADMIN_DASHBOARD_SUMMARY_ENDPOINT, {
    method: "GET",
    cache: "no-store",
  });
  return parseAdminDashboardSummaryResponse(payload);
}

export function getAdminOverviewSafeError(error: unknown): AdminOverviewSafeError {
  if (error instanceof AdminDashboardSummaryContractError) {
    return {
      kind: "malformed",
      message: "The overview could not be verified. Try again.",
    };
  }

  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        kind: "unauthenticated",
        message: "Your admin access could not be confirmed. Sign in again.",
      };
    }
    if (error.status === 403) {
      return {
        kind: "forbidden",
        message: "You do not have access to this overview.",
      };
    }
    if (error.status === 408) {
      return {
        kind: "timeout",
        message: "The overview is taking too long to load. Try again.",
      };
    }
  }

  return {
    kind: "unavailable",
    message: "The overview is temporarily unavailable. Try again.",
  };
}
