import {
  FolderTree,
  LayoutDashboard,
  LifeBuoy,
  PackageSearch,
  ShieldCheck,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminCapabilityId } from "@/features/admin-platform";

export const ADMIN_SHELL_ICONS = Object.freeze({
  overview: LayoutDashboard,
  sellers: Store,
  customers: Users,
  products_and_moderation: PackageSearch,
  categories_and_attributes: FolderTree,
  orders_and_fulfillment: Truck,
  support: LifeBuoy,
  admins_teams_and_roles: ShieldCheck,
} satisfies Partial<Record<AdminCapabilityId, LucideIcon>>);

export function getAdminShellIcon(capabilityId: AdminCapabilityId): LucideIcon {
  return ADMIN_SHELL_ICONS[capabilityId as keyof typeof ADMIN_SHELL_ICONS] ?? LayoutDashboard;
}
