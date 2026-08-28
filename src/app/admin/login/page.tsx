import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLoginContent from "@/app/admin/login/AdminLoginContent";
import { ADMIN_DASHBOARD_PATH, ADMIN_SESSION_COOKIE } from "@/services/admin/session-cookie";
import { validateAdminSessionToken } from "@/services/admin/backend-session";
import { sanitizeAdminNextPath } from "@/services/admin/verification-recovery";

type AdminLoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = sanitizeAdminNextPath(firstSearchValue(resolvedSearchParams?.next));
  const cookieStore = await cookies();
  const identity = await validateAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (identity) {
    redirect(nextPath ?? ADMIN_DASHBOARD_PATH);
  }

  return <AdminLoginContent nextPath={nextPath} />;
}
