import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { validateAdminSessionToken } from "@/services/admin/backend-session";
import { adminIdentityHasPermission } from "@/services/admin/session";
import {
  ADMIN_LOGIN_PATH,
  ADMIN_SESSION_COOKIE,
} from "@/services/admin/session-cookie";
import type { Permission } from "@/services/rbac";

export async function requireAdminPermission(permission: Permission): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!token) {
    redirect(ADMIN_LOGIN_PATH);
  }

  const identity = await validateAdminSessionToken(token);

  if (!identity) {
    redirect(ADMIN_LOGIN_PATH);
  }

  if (!adminIdentityHasPermission(identity, permission)) {
    notFound();
  }
}
