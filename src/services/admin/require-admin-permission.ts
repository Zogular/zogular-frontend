import "server-only";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { validateAdminSessionToken } from "@/services/admin/backend-session";
import { adminIdentityHasPermission } from "@/services/admin/session";
import {
  ADMIN_SESSION_COOKIE,
} from "@/services/admin/session-cookie";
import { getAdminLoginPath } from "@/services/admin/verification-recovery";
import type { Permission } from "@/services/rbac";

export async function requireAdminPermission(permission: Permission): Promise<void> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const loginPath = getAdminLoginPath(headerStore.get("x-zogular-admin-next"));
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    redirect(loginPath);
  }

  const identity = await validateAdminSessionToken(token);

  if (!identity) {
    redirect(loginPath);
  }

  if (!adminIdentityHasPermission(identity, permission)) {
    notFound();
  }
}
