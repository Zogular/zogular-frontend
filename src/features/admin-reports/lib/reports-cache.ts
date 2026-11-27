import type { QueryClient } from "@tanstack/react-query";
import { ADMIN_ROLES, CANONICAL_ADMIN_PERMISSIONS } from "@/services/rbac";
import type { AdminIdentity } from "@/services/admin/session";

/** Never derive permissions from role; only verified shell claims authorize this report. */
export function sellerReviewAgingAuthority(
  identity: AdminIdentity | null,
): string | null {
  const claims = identity?.claims;
  if (
    identity?.sessionStatus !== "authenticated" ||
    !identity.id?.trim() ||
    !claims ||
    !ADMIN_ROLES.includes(claims.role) ||
    !Array.isArray(claims.permissions) ||
    !claims.permissions.every((permission) =>
      CANONICAL_ADMIN_PERMISSIONS.includes(permission),
    ) ||
    !claims.permissions.includes("access_admin_panel") ||
    !claims.permissions.includes("view_all_reports") ||
    !claims.permissions.includes("review_sellers")
  ) {
    return null;
  }

  return JSON.stringify([
    identity.id,
    claims.role,
    [...new Set(claims.permissions)].sort(),
  ]);
}

export const sellerReviewAgingKey = (authority: string) =>
  ["admin-reports-seller-review-aging", authority] as const;

export function purgeSellerReviewAging(
  client: QueryClient,
  authority: string,
): void {
  const filter = { queryKey: ["admin-reports-seller-review-aging", authority] };
  void client.cancelQueries(filter, { silent: true });
  client.removeQueries(filter);
}
