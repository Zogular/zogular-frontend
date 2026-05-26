export type AdminRole = 
  | "super_admin"     // CTO (God Mode)
  | "executive_admin" // CEO
  | "ops_manager"     // Founding Members
  | "finance_admin"   // Treasury
  | "support_admin"   // Customer Service
  | "content_admin"   // Marketing
  | "viewer";         // Investor (Strictly Read-Only)

// Granular Permissions
export type Permission =
  // Data & Reporting
  | "view_dashboard" | "view_financial_reports" | "export_reports"
  // Sellers
  | "view_sellers" | "approve_sellers" | "suspend_sellers" | "edit_commission"
  // Buyers
  | "view_buyers" | "ban_buyers"
  // Platform
  | "view_products" | "moderate_products"
  | "view_orders" | "override_orders"
  | "manage_disputes"
  // Finance
  | "view_treasury" | "approve_payouts" | "manage_refunds"
  // Platform
  | "manage_support" | "manage_content"
  // System
  | "view_system_logs" | "configure_platform" | "manage_admins";

// The Access Matrix
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    "view_dashboard", "view_financial_reports", "export_reports",
    "view_sellers", "approve_sellers", "suspend_sellers", "edit_commission",
    "view_buyers", "ban_buyers",
    "view_products", "moderate_products",
    "view_orders", "override_orders",
    "manage_disputes",
    "view_treasury", "approve_payouts", "manage_refunds",
    "manage_support", "manage_content",
    "view_system_logs", "configure_platform", "manage_admins"
  ],
  executive_admin: [
    "view_dashboard", "view_financial_reports", "export_reports",
    "view_sellers", "approve_sellers", "suspend_sellers",
    "view_buyers",
    "view_products",
    "view_orders", "override_orders",
    "manage_disputes",
    "view_treasury", "approve_payouts",
    "manage_support", "manage_content"
  ],
  ops_manager: [
    "view_dashboard",
    "view_sellers", "approve_sellers",
    "view_buyers",
    "view_products", "moderate_products",
    "view_orders", "override_orders",
    "manage_disputes",
    "manage_support", "manage_content"
  ],
  finance_admin: [
    "view_dashboard", "view_financial_reports", "export_reports",
    "view_sellers", "edit_commission",
    "view_orders",
    "view_treasury", "approve_payouts", "manage_refunds"
  ],
  support_admin: [
    "view_dashboard",
    "view_sellers",
    "view_buyers",
    "view_orders",
    "manage_disputes",
    "manage_support"
  ],
  content_admin: [
    "view_dashboard",
    "view_products",
    "manage_content"
  ],
  viewer: [ // The Investor
    "view_dashboard", "view_financial_reports"
  ]
};

// Helper function to check permissions safely
export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
}

export const CURRENT_ADMIN_FALLBACK = {
  id: "ADM-001",
  name: "Danny Diara",
  role: "super_admin" as AdminRole, 
};
