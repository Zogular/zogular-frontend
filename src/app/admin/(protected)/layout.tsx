import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { ADMIN_SESSION_COOKIE } from "@/services/admin/session-cookie";
import { validateAdminSessionToken } from "@/services/admin/backend-session";
import { getAdminLoginPath } from "@/services/admin/verification-recovery";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  const identity = await validateAdminSessionToken(token);

  if (!identity) {
    redirect(getAdminLoginPath(headerStore.get("x-zogular-admin-next")));
  }

  return <AdminShell identity={identity}>{children}</AdminShell>;
}
