import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { QUEUE_PRESENTATION } from "../src/features/admin-overview/lib/overview-presentation";
import { CANONICAL_ADMIN_PERMISSIONS } from "../src/services/rbac";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test("QUEUE_PRESENTATION maps to exact canonical backend permissions", () => {
  const permissions = QUEUE_PRESENTATION.map((item) => item.permission);
  expect(permissions).toEqual([
    "review_sellers",
    "view_all_products",
    "view_all_orders",
    "view_support_tickets",
  ]);
  for (const perm of permissions) {
    expect(CANONICAL_ADMIN_PERMISSIONS).toContain(perm);
  }
});

test("all protected layouts use canonical backend permissions", () => {
  const dashboardLayout = readSource("src/app/admin/(protected)/dashboard/layout.tsx");
  const sellersLayout = readSource("src/app/admin/(protected)/sellers/layout.tsx");
  const buyersLayout = readSource("src/app/admin/(protected)/buyers/layout.tsx");
  const productsLayout = readSource("src/app/admin/(protected)/products/layout.tsx");
  const categoriesLayout = readSource("src/app/admin/(protected)/categories/layout.tsx");
  const ordersLayout = readSource("src/app/admin/(protected)/orders/layout.tsx");
  const supportLayout = readSource("src/app/admin/(protected)/support/layout.tsx");
  const accessLayout = readSource("src/app/admin/(protected)/access/layout.tsx");
  const contentLayout = readSource("src/app/admin/(protected)/content/layout.tsx");
  const disputesLayout = readSource("src/app/admin/(protected)/disputes/layout.tsx");
  const financeLayout = readSource("src/app/admin/(protected)/finance/layout.tsx");
  const reportsLayout = readSource("src/app/admin/(protected)/reports/layout.tsx");
  const systemLayout = readSource("src/app/admin/(protected)/system/layout.tsx");

  expect(dashboardLayout).toContain('requireAdminPermission("access_admin_panel")');
  expect(sellersLayout).toContain('requireAdminPermission("review_sellers")');
  expect(buyersLayout).toContain('requireAdminPermission("view_all_users")');
  expect(productsLayout).toContain('requireAdminPermission("view_all_products")');
  expect(categoriesLayout).toContain('requireAdminPermission("manage_categories")');
  expect(ordersLayout).toContain('requireAdminPermission("view_all_orders")');
  expect(supportLayout).toContain('requireAdminPermission("view_support_tickets")');
  expect(accessLayout).toContain('requireAdminPermission("manage_roles")');
  expect(contentLayout).toContain('requireAdminPermission("manage_content")');
  expect(disputesLayout).toContain('requireAdminPermission("view_all_orders")');
  expect(financeLayout).toContain('requireAdminPermission("view_all_payouts")');
  expect(reportsLayout).toContain('requireAdminPermission("view_all_reports")');
  expect(systemLayout).toContain('requireAdminPermission("manage_system_settings")');
});

test("admin pages and hooks enforce direct canonical permissions and remove fake audit logs", () => {
  const ordersWorkspace = readSource("src/features/admin-orders/components/AdminOrdersWorkspace.tsx");
  const productsPage = readSource("src/app/admin/(protected)/products/page.tsx");
  const productDetailPage = readSource("src/app/admin/(protected)/products/[id]/page.tsx");
  const supportWorkspace = readSource("src/features/admin-support/components/AdminSupportWorkspace.tsx");
  const accessSheet = readSource("src/features/admin-access/components/AdminUserDetailSheet.tsx");
  const sellersHook = readSource("src/features/admin-sellers/hooks/use-sellers-list.ts");

  expect(ordersWorkspace).toContain('adminIdentityHasPermission(identity, "view_all_orders")');
  expect(ordersWorkspace).toContain('adminIdentityHasPermission(identity, "manage_order_fulfillment")');
  expect(productsPage).toContain('adminIdentityHasPermission(identity, "approve_products")');
  expect(productDetailPage).toContain('adminIdentityHasPermission(identity, "approve_products")');
  expect(productDetailPage).not.toContain("recordAdminAudit");
  expect(supportWorkspace).toContain('adminIdentityHasPermission(identity, "view_support_tickets")');
  expect(supportWorkspace).toContain('adminIdentityHasPermission(identity, "reply_support_tickets")');
  expect(supportWorkspace).toContain('adminIdentityHasPermission(identity, "manage_support_tickets")');
  expect(accessSheet).toContain('identity?.claims.role === "SUPER_ADMIN"');
  expect(accessSheet).toContain('adminIdentityHasPermission(identity, "manage_roles")');
  expect(sellersHook).toContain('adminIdentityHasPermission(identity, "manage_seller_status")');
  expect(sellersHook).toContain('adminIdentityHasPermission(identity, "export_reports")');
});
