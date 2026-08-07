import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_financial_reports");
  return children;
}
