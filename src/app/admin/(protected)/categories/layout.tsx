import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function CategoriesLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("manage_content");
  return children;
}
