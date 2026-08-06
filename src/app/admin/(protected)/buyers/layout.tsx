import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function BuyersLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_buyers");
  return children;
}
