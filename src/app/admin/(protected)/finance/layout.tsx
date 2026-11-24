import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_all_payouts");
  return children;
}
