import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function AccessLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("manage_admins");
  return children;
}
