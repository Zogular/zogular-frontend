import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("F2 overview remains aligned with the approved F1 shell and palette", () => {
  const pageSource = readSource("src/app/admin/(protected)/dashboard/page.tsx");
  const shellSource = readSource("src/components/admin/AdminShell.tsx");
  const paletteSource = readSource("src/components/admin/admin-theme.module.css");
  const capabilitySource = readSource(
    "src/features/admin-platform/config/capability-registry.ts",
  );
  const shellNavigationSource = [
    "src/features/admin-shell/components/AdminNavigation.tsx",
    "src/features/admin-shell/components/AdminSidebar.tsx",
    "src/features/admin-shell/components/AdminHeader.tsx",
  ].map(readSource).join("\n");
  const overviewSource = [
    "src/features/admin-overview/components/AdminOverview.tsx",
    "src/features/admin-overview/components/OverviewHeader.tsx",
    "src/features/admin-overview/components/OverviewControls.tsx",
    "src/features/admin-overview/components/OverviewStates.tsx",
    "src/features/admin-overview/components/NeedsAttention.tsx",
    "src/features/admin-overview/components/MarketplaceSnapshot.tsx",
    "src/features/admin-overview/components/MarketplacePulse.tsx",
    "src/features/admin-overview/components/OperationalActivity.tsx",
  ].map(readSource).join("\n");

  expect(pageSource).toContain("<AdminOverview");
  expect(pageSource).not.toMatch(
    /getVendorApplications|adminOrdersApi|adminProductsApi|adminSupportApi/,
  );
  for (const [label, href] of [
    ["Overview", "/admin/dashboard"],
    ["Sellers", "/admin/sellers"],
    ["Customers", "/admin/buyers"],
    ["Products and Moderation", "/admin/products"],
    ["Categories and Attributes", "/admin/categories"],
    ["Orders and Fulfillment", "/admin/orders"],
    ["Support", "/admin/support"],
    ["Admins, Teams, and Roles", "/admin/access"],
  ]) {
    expect(capabilitySource).toContain(`label: "${label}"`);
    expect(capabilitySource).toContain(`currentRoute: "${href}"`);
  }

  expect(shellSource).toContain("<Sheet");
  expect(shellSource).toContain("buildAdminShellNavigation(identity)");
  expect(shellSource).not.toContain("ADMIN_NAV_ITEMS");
  expect(shellNavigationSource).toContain("prefetch={false}");
  expect(shellNavigationSource).toContain('aria-current={active ? "page" : undefined}');
  expect(shellNavigationSource).toContain('aria-label="Open admin menu"');
  expect(shellNavigationSource).toContain("size-11");
  expect(shellSource).toContain(
    'const ADMIN_DESKTOP_MEDIA_QUERY = "(min-width: 64rem)"',
  );
  expect(shellSource).toContain(
    'desktopViewport.addEventListener("change", closeMobileMenuAtDesktop)',
  );
  expect(shellSource).toContain(
    'desktopViewport.removeEventListener("change", closeMobileMenuAtDesktop)',
  );
  expect(shellSource).toContain('data-testid="admin-shell-root"');
  expect(shellSource).toContain('data-testid="admin-desktop-sidebar"');
  expect(shellSource).toContain('data-testid="admin-main-scroll"');
  expect(shellSource).toContain("theme.mobileDrawer");
  expect(paletteSource).toContain('data-slot="sheet-overlay"');
  expect(paletteSource).toContain(":global(body):has(.mobileDrawer)");
  expect(paletteSource).toContain("backdrop-filter: none");

  expect(overviewSource).toContain('from "motion/react"');
  expect(overviewSource).toContain("useReducedMotion()");
  expect(overviewSource).toContain('aria-live="polite"');
  expect(overviewSource).toContain('role="tooltip"');
  expect(overviewSource).toContain("prefetch={false}");
  expect(overviewSource).toContain("Marketplace activity board");
  expect(overviewSource).toContain("Loading current marketplace activity");
  expect(overviewSource).toContain("Operational activity");
  expect(overviewSource).toContain("Marketplace pulse");
  expect(overviewSource).toContain('aria-busy="true"');
  expect(overviewSource).toContain("theme.activityRail");
  expect(overviewSource).not.toContain("animate-pulse");
  expect(paletteSource).toContain("@media (prefers-reduced-motion: reduce)");

  for (const [token, value] of [
    ["canvas-warm", "#efe5d6"],
    ["canvas-depth", "#e4d4bf"],
    ["surface-cream", "#fff8ec"],
    ["surface-mist", "#f6eedf"],
    ["ink", "#171a16"],
    ["ink-soft", "#5f625a"],
    ["canopy", "#075b36"],
    ["canopy-deep", "#063b29"],
    ["ember", "#d96a1f"],
    ["escalation", "#b83b32"],
    ["copper-muted", "#b88746"],
  ]) {
    expect(paletteSource).toContain(`--admin-${token}: ${value}`);
  }

  expect(shellSource).toContain("theme.adminScope");
  expect(shellSource).toContain("bg-[var(--admin-canopy-deep)]");
  expect(shellSource).toContain("bg-[var(--admin-canvas-warm)]");
  expect(shellNavigationSource).toContain("bg-[var(--admin-surface-cream)]");
  expect(`${shellSource}\n${overviewSource}`).not.toMatch(
    /\bbg-(?:white|zinc-(?:50|100|950))\b/,
  );
  expect(overviewSource).not.toMatch(
    /\b(?:backend|frontend|MVP|launch-control|demo|contract|environment)\b/i,
  );
  expect(shellSource).not.toMatch(
    /Backend session active|Privileged Session|radial-gradient|linear-gradient/,
  );
  expect(`${shellSource}\n${shellNavigationSource}`).not.toMatch(
    /Sellers CRM|Master Catalog|Order Queue|Support Hub|Access Control/,
  );
  expect(readSource("src/services/admin/dashboard.ts")).not.toContain(
    "skipAuthRefresh",
  );
});
