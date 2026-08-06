import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("configure_platform");
  return children;
}
