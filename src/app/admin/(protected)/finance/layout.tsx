import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_treasury");
  return children;
}
