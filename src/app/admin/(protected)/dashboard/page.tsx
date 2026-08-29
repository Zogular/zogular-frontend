import { AdminOverview } from "@/features/admin-overview/components/AdminOverview";

export default function AdminDashboardPage() {
  return <AdminOverview nowIso={new Date().toISOString()} />;
}
