export const ADMIN_SESSION_COOKIE = "zogular_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_DASHBOARD_PATH = "/admin/dashboard";

export function isUsableAdminSessionToken(value: string | undefined): boolean {
  const token = value?.trim();
  return Boolean(token);
}
