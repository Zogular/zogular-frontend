import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function OrdersLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_orders");
  return children;
}
