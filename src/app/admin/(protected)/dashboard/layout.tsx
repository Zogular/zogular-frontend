import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("access_admin_panel");
  return children;
}
