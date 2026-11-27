import type { QueryClient } from "@tanstack/react-query";
import { ADMIN_ROLES, CANONICAL_ADMIN_PERMISSIONS } from "@/services/rbac";
import type { AdminIdentity } from "@/services/admin/session";
import type { AdminDashboardOverviewQuery } from "../types/dashboard-overview";

/** Never derive permissions from role; only the verified shell claims describe this projection. */
export function overviewAuthority(identity: AdminIdentity | null): string | null {
  const claims = identity?.claims;
  if (identity?.sessionStatus !== "authenticated" || !identity.id?.trim() || !claims ||
      !ADMIN_ROLES.includes(claims.role) || !Array.isArray(claims.permissions) ||
      !claims.permissions.includes("access_admin_panel") ||
      !claims.permissions.every(permission => CANONICAL_ADMIN_PERMISSIONS.includes(permission))) return null;
  return JSON.stringify([identity.id, claims.role, [...new Set(claims.permissions)].sort()]);
}

export const overviewKey = (authority: string, query: AdminDashboardOverviewQuery) =>
  ["admin-dashboard-overview", authority, query.period, query.comparison, query.groupBy] as const;

export function overviewPlaceholder<T>(authority: string, previous: T, key?: readonly unknown[]) {
  return key?.[0] === "admin-dashboard-overview" && key[1] === authority ? previous : undefined;
}

export function purgeOverview(client: QueryClient, authority: string) {
  const filter = { queryKey: ["admin-dashboard-overview", authority] };
  void client.cancelQueries(filter, { silent: true });
  client.removeQueries(filter);
}
