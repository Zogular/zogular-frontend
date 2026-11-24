import { apiClient } from "@/services/api";
import {
  parseAdminDashboardOverviewResponse,
  serializeAdminDashboardOverviewQuery,
} from "@/features/admin-overview/lib/dashboard-overview-contract";
import {
  toSafeAdminFetchError,
  type SafeAdminError,
} from "@/features/admin-platform";
import type {
  AdminDashboardOverview,
  AdminDashboardOverviewQueryInput,
} from "@/features/admin-overview/types/dashboard-overview";

const ADMIN_DASHBOARD_OVERVIEW_ENDPOINT = "/admin/dashboard/overview";

export type AdminOverviewErrorKind = SafeAdminError["kind"];
export type AdminOverviewSafeError = SafeAdminError;

export interface FetchAdminDashboardOverviewOptions
  extends AdminDashboardOverviewQueryInput {
  readonly signal?: AbortSignal;
}

export async function fetchAdminDashboardOverview(
  options: FetchAdminDashboardOverviewOptions = {},
): Promise<AdminDashboardOverview> {
  const { signal, ...queryInput } = options;
  const payload = await apiClient<unknown>(ADMIN_DASHBOARD_OVERVIEW_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    query: serializeAdminDashboardOverviewQuery(queryInput),
    signal,
  });

  return parseAdminDashboardOverviewResponse(payload);
}

export function getAdminOverviewSafeError(error: unknown): AdminOverviewSafeError {
  return toSafeAdminFetchError(error);
}
