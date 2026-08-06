import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function DisputesLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("manage_disputes");
  return children;
}
