import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("view_support_tickets");
  return children;
}
