import {
  ADMIN_CAPABILITY_GROUPS,
  FRONTEND_PERMISSION_HINT_VALUES,
  getNavigationEligibleCapabilities,
  type AdminCapabilityGroupId,
  type AdminCapabilityId,
} from "@/features/admin-platform";
import {
  adminIdentityHasPermission,
  type AdminIdentity,
} from "@/services/admin/session";

export interface AdminShellDestination {
  readonly id: AdminCapabilityId;
  readonly label: string;
  readonly href: string;
  readonly groupId: AdminCapabilityGroupId;
}

export interface AdminShellNavigationGroup {
  readonly id: AdminCapabilityGroupId;
  readonly label: string;
  readonly destinations: readonly AdminShellDestination[];
}

export interface AdminShellRouteContext {
  readonly groupLabel: string;
  readonly capabilityLabel: string;
  readonly destination: AdminShellDestination;
}

export function buildAdminShellNavigation(
  identity: AdminIdentity,
): readonly AdminShellNavigationGroup[] {
  if (identity.sessionStatus !== "authenticated") return [];

  const effectivePermissionHints = FRONTEND_PERMISSION_HINT_VALUES.filter((permission) =>
    adminIdentityHasPermission(identity, permission),
  );
  const eligibleCapabilities = getNavigationEligibleCapabilities({
    role: identity.claims.role,
    permissions: effectivePermissionHints,
  });

  return ADMIN_CAPABILITY_GROUPS.map((group) => {
    const destinations = eligibleCapabilities.flatMap((capability) => {
      if (capability.groupId !== group.id || capability.currentRoute === null) return [];
      return [{
        id: capability.id,
        label: capability.label,
        href: capability.currentRoute,
        groupId: capability.groupId,
      } satisfies AdminShellDestination];
    });

    return {
      id: group.id,
      label: group.label,
      destinations,
    } satisfies AdminShellNavigationGroup;
  }).filter((group) => group.destinations.length > 0);
}

export function flattenAdminShellNavigation(
  groups: readonly AdminShellNavigationGroup[],
): readonly AdminShellDestination[] {
  return groups.flatMap((group) => group.destinations);
}

export function isAdminDestinationActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function resolveAdminShellRouteContext(
  groups: readonly AdminShellNavigationGroup[],
  pathname: string,
): AdminShellRouteContext | null {
  const destination = flattenAdminShellNavigation(groups)
    .filter((item) => isAdminDestinationActive(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];
  if (!destination) return null;

  const group = groups.find((item) => item.id === destination.groupId);
  if (!group) return null;

  return {
    groupLabel: group.label,
    capabilityLabel: destination.label,
    destination,
  };
}

export function formatAdminRole(role: string): string {
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
