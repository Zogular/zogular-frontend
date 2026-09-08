import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_all_reports");
  return children;
}
