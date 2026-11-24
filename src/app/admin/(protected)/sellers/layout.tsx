import { requireAdminPermission } from "@/services/admin/require-admin-permission";

export default async function SellersLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPermission("review_sellers");
  return children;
}
