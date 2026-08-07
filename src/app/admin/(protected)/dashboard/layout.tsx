import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_dashboard");
  return children;
}
