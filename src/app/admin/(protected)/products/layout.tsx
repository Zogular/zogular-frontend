import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function ProductsLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_all_products");
  return children;
}
