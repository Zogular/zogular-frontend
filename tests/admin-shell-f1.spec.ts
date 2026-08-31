import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_CAPABILITY_REGISTRY,
  FRONTEND_PERMISSION_HINT_VALUES,
} from "../src/features/admin-platform";
import { ApiError } from "../src/services/api";
import { getAdminSignOutFailureMessage } from "../src/features/admin-shell/components/AdminProfilePopover";
import { ADMIN_SHELL_ICONS } from "../src/features/admin-shell/config/admin-shell-icons";
import {
  buildAdminShellNavigation,
  flattenAdminShellNavigation,
  resolveAdminShellRouteContext,
} from "../src/features/admin-shell/lib/admin-shell-model";
import {
  ADMIN_SIDEBAR_PREFERENCE_COOKIE,
  ADMIN_SIDEBAR_PREFERENCE_MAX_AGE_SECONDS,
  parseAdminSidebarMode,
  serializeAdminSidebarMode,
} from "../src/features/admin-shell/lib/admin-shell-preference";
import type { AdminIdentity } from "../src/services/admin/session";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const operationalDestinations = [
  ["home", "Home", "overview", "Overview", "/admin/dashboard"],
  ["marketplace", "Marketplace", "sellers", "Sellers", "/admin/sellers"],
  ["marketplace", "Marketplace", "customers", "Customers", "/admin/buyers"],
  ["marketplace", "Marketplace", "products_and_moderation", "Products and Moderation", "/admin/products"],
  ["marketplace", "Marketplace", "categories_and_attributes", "Categories and Attributes", "/admin/categories"],
  ["orders_and_service", "Orders and Service", "orders_and_fulfillment", "Orders and Fulfillment", "/admin/orders"],
  ["orders_and_service", "Orders and Service", "support", "Support", "/admin/support"],
  ["governance", "Governance", "admins_teams_and_roles", "Admins, Teams, and Roles", "/admin/access"],
] as const;

function identity(permissions: AdminIdentity["claims"]["permissions"]): AdminIdentity {
  return {
    id: "admin-shell-test",
    name: "Admin Shell Test",
    email: "admin@example.test",
    claims: {
      role: "super_admin",
      permissions,
      authStrength: "password",
      issuedAt: "2026-08-31T08:00:00.000Z",
    },
    sessionStatus: "authenticated",
  };
}

test("super admin receives exactly the eight F0 operational destinations in canonical order", () => {
  const groups = buildAdminShellNavigation(identity([...FRONTEND_PERMISSION_HINT_VALUES]));
  const actual = groups.flatMap((group) =>
    group.destinations.map((destination) => [
      group.id,
      group.label,
      destination.id,
      destination.label,
      destination.href,
    ]),
  );

  expect(actual).toEqual(operationalDestinations);
  expect(groups.map((group) => group.label)).toEqual([
    "Home",
    "Marketplace",
    "Orders and Service",
    "Governance",
  ]);
});

test("permission-limited and unknown identities fail closed", () => {
  const limited = buildAdminShellNavigation(identity(["view_dashboard", "view_orders"]));
  expect(flattenAdminShellNavigation(limited).map((item) => item.id)).toEqual([
    "overview",
    "orders_and_fulfillment",
  ]);

  const unknownRole = {
    ...identity([...FRONTEND_PERMISSION_HINT_VALUES]),
    claims: {
      ...identity([...FRONTEND_PERMISSION_HINT_VALUES]).claims,
      role: "invented_admin",
    },
  } as unknown as AdminIdentity;
  expect(buildAdminShellNavigation(unknownRole)).toEqual([]);

  const expired = { ...identity(["view_dashboard"]), sessionStatus: "expired" } as AdminIdentity;
  expect(buildAdminShellNavigation(expired)).toEqual([]);
});

test("contract-gated and experience-ready capabilities remain absent for super admin", () => {
  const visibleIds = new Set(
    flattenAdminShellNavigation(
      buildAdminShellNavigation(identity([...FRONTEND_PERMISSION_HINT_VALUES])),
    ).map((item) => item.id),
  );
  const gatedIds = ADMIN_CAPABILITY_REGISTRY
    .filter((capability) => capability.completionLevel !== "operational" || !capability.navigationEligible)
    .map((capability) => capability.id);

  expect(gatedIds.length).toBeGreaterThan(0);
  expect(gatedIds.every((id) => !visibleIds.has(id))).toBe(true);
  expect(visibleIds).not.toContain("alerts_and_assigned_work");
  expect(visibleIds).not.toContain("analytics_and_reports");
  expect(visibleIds).not.toContain("finance_overview");
});

test("every visible operational destination has an explicit icon", () => {
  const visibleIds = flattenAdminShellNavigation(
    buildAdminShellNavigation(identity([...FRONTEND_PERMISSION_HINT_VALUES])),
  ).map((item) => item.id);

  expect(Object.keys(ADMIN_SHELL_ICONS)).toEqual(visibleIds);
  for (const id of visibleIds) {
    expect(ADMIN_SHELL_ICONS[id as keyof typeof ADMIN_SHELL_ICONS]).toBeTruthy();
  }
});

test("longest route matching gives nested pages canonical parent context", () => {
  const groups = buildAdminShellNavigation(identity([...FRONTEND_PERMISSION_HINT_VALUES]));
  expect(resolveAdminShellRouteContext(groups, "/admin/products/product-123")).toMatchObject({
    groupLabel: "Marketplace",
    capabilityLabel: "Products and Moderation",
    destination: { href: "/admin/products" },
  });
  expect(resolveAdminShellRouteContext(groups, "/admin/sellers/application-7")).toMatchObject({
    groupLabel: "Marketplace",
    capabilityLabel: "Sellers",
  });
  expect(resolveAdminShellRouteContext(groups, "/admin/finance")).toBeNull();
});

test("sidebar preference defaults safely and serializes one scoped cookie", () => {
  expect(parseAdminSidebarMode(undefined)).toBe("expanded");
  expect(parseAdminSidebarMode("invalid")).toBe("expanded");
  expect(parseAdminSidebarMode("expanded")).toBe("expanded");
  expect(parseAdminSidebarMode("collapsed")).toBe("collapsed");
  expect(serializeAdminSidebarMode("collapsed")).toBe(
    `${ADMIN_SIDEBAR_PREFERENCE_COOKIE}=collapsed; Path=/admin; Max-Age=${ADMIN_SIDEBAR_PREFERENCE_MAX_AGE_SECONDS}; SameSite=Lax`,
  );
});

test("server and client share the cookie mode without local storage", () => {
  const layoutSource = readSource("src/app/admin/(protected)/layout.tsx");
  const shellSource = readSource("src/components/admin/AdminShell.tsx");
  const preferenceSource = readSource("src/features/admin-shell/lib/admin-shell-preference.ts");

  expect(layoutSource).toContain("parseAdminSidebarMode(");
  expect(layoutSource).toContain("initialSidebarMode={initialSidebarMode}");
  expect(shellSource).toContain("parseAdminSidebarMode(initialSidebarMode)");
  expect(shellSource).toContain("document.cookie = serializeAdminSidebarMode(nextMode)");
  expect(`${layoutSource}\n${shellSource}\n${preferenceSource}`).not.toMatch(/localStorage|sessionStorage/);
});

test("navigation and shell controls expose semantic accessible state", () => {
  const navigationSource = readSource("src/features/admin-shell/components/AdminNavigation.tsx");
  const sidebarSource = readSource("src/features/admin-shell/components/AdminSidebar.tsx");
  const headerSource = readSource("src/features/admin-shell/components/AdminHeader.tsx");
  const commandSource = readSource("src/features/admin-shell/components/AdminCommandMenu.tsx");
  const profileSource = readSource("src/features/admin-shell/components/AdminProfilePopover.tsx");

  expect(navigationSource).toContain('<nav');
  expect(navigationSource).toContain('<ul');
  expect(navigationSource).toContain('aria-current={active ? "page" : undefined}');
  expect(sidebarSource).toContain('aria-expanded={!collapsed}');
  expect(sidebarSource).toContain('aria-controls="admin-desktop-navigation"');
  expect(headerSource).toContain('aria-expanded={mobileMenuOpen}');
  expect(headerSource).toContain('aria-haspopup="dialog"');
  expect(commandSource).toContain('title="Navigate admin"');
  expect(commandSource).toContain('placeholder="Search admin pages"');
  expect(profileSource).toContain('data-testid="admin-profile-trigger"');
  expect(profileSource).toContain('aria-live="polite"');
});

test("command navigation is route-only and mirrors the same grouped model", () => {
  const shellSource = readSource("src/components/admin/AdminShell.tsx");
  const commandSource = readSource("src/features/admin-shell/components/AdminCommandMenu.tsx");

  expect(shellSource).toContain("groups={navigationGroups}");
  expect(commandSource).toContain("group.destinations.map");
  expect(commandSource).toContain("router.push(href)");
  expect(commandSource).not.toMatch(/fetch\(|axios|seller query|customer query|recent entit|global search/i);
});

test("gated shell concepts and fabricated operational data are absent", () => {
  const shellSources = [
    "src/components/admin/AdminShell.tsx",
    "src/features/admin-shell/components/AdminNavigation.tsx",
    "src/features/admin-shell/components/AdminSidebar.tsx",
    "src/features/admin-shell/components/AdminCommandMenu.tsx",
    "src/features/admin-shell/components/AdminHeader.tsx",
    "src/features/admin-shell/components/AdminProfilePopover.tsx",
  ].map(readSource).join("\n");

  expect(shellSources).not.toMatch(/alert bell|notification badge|assigned work|recent entities|recent activity|unread count|queue count|disabled destination/i);
  expect(shellSources).not.toMatch(/\bbadge\b/i);
});

test("sign out stays service-backed, pending-safe, and never renders raw failures", () => {
  const authSource = readSource("src/services/admin/auth.ts");
  const profileSource = readSource("src/features/admin-shell/components/AdminProfilePopover.tsx");
  const shellSource = readSource("src/components/admin/AdminShell.tsx");

  expect(authSource).toContain('requestAdminAuth<AdminSessionAuthResult>("logout", { method: "POST" })');
  expect(profileSource).toContain("await logoutAdmin()");
  expect(profileSource).toContain("if (isSigningOut) return");
  expect(profileSource).toContain("disabled={isSigningOut}");
  expect(profileSource).toContain("getAdminSignOutFailureMessage(error)");
  expect(profileSource).not.toContain("error.message");
  expect(profileSource).not.toContain("session.message");
  const raw = "private backend stack and internal.example";
  for (const error of [new ApiError(raw, 503, { raw }), new Error(raw), raw]) {
    const message = getAdminSignOutFailureMessage(error);
    expect(message).not.toContain(raw);
    expect(message).not.toMatch(/stack|internal\.example/i);
  }
  expect(shellSource).toContain("export const AdminIdentityContext");
  expect(shellSource).toContain("export function useAdminIdentity()");
});
