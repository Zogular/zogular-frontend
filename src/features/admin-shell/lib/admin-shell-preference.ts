export const ADMIN_SIDEBAR_PREFERENCE_COOKIE = "zogular_admin_sidebar";
export const ADMIN_SIDEBAR_PREFERENCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const ADMIN_SIDEBAR_MODES = ["expanded", "collapsed"] as const;
export type AdminSidebarMode = (typeof ADMIN_SIDEBAR_MODES)[number];

export function parseAdminSidebarMode(value: unknown): AdminSidebarMode {
  return value === "collapsed" ? "collapsed" : "expanded";
}

export function serializeAdminSidebarMode(mode: AdminSidebarMode): string {
  return `${ADMIN_SIDEBAR_PREFERENCE_COOKIE}=${mode}; Path=/admin; Max-Age=${ADMIN_SIDEBAR_PREFERENCE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
