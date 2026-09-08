export type AdminRole =
  | "SUPER_ADMIN"
  | "TECH_ADMIN"
  | "EXECUTIVE"
  | "OPERATIONS"
  | "ADMIN";

export const ADMIN_ROLES: readonly AdminRole[] = [
  "SUPER_ADMIN",
  "TECH_ADMIN",
  "EXECUTIVE",
  "OPERATIONS",
  "ADMIN",
] as const;

export type Permission =
  // Overview / Dashboard
  | "access_admin_panel"
  // Sellers
  | "review_sellers"
  | "manage_seller_status"
  | "view_seller_sensitive_fields"
  // Users / Buyers / Admins
  | "view_all_users"
  | "view_user_sensitive_fields"
  | "create_users"
  | "edit_users"
  | "delete_users"
  | "manage_roles"
  // Products / Catalog
  | "view_all_products"
  | "approve_products"
  | "delete_any_product"
  // Orders
  | "view_all_orders"
  | "view_order_sensitive_fields"
  | "manage_order_fulfillment"
  // Support
  | "view_support_tickets"
  | "view_support_sensitive_fields"
  | "reply_support_tickets"
  | "manage_support_tickets"
  // Categories
  | "manage_categories"
  // Reports
  | "view_all_reports"
  | "export_reports"
  // System / Technical
  | "view_logs"
  | "manage_cloudinary_cleanup"
  | "manage_technical_settings"
  | "manage_api_keys"
  | "manage_content"
  // Finance
  | "view_all_payouts"
  | "process_payouts"
  | "manage_system_settings"
  | "manage_commissions"
  | "process_refunds";

export const CANONICAL_ADMIN_PERMISSIONS: readonly Permission[] = [
  "access_admin_panel",
  "review_sellers",
  "manage_seller_status",
  "view_seller_sensitive_fields",
  "view_all_users",
  "view_user_sensitive_fields",
  "create_users",
  "edit_users",
  "delete_users",
  "manage_roles",
  "view_all_products",
  "approve_products",
  "delete_any_product",
  "view_all_orders",
  "view_order_sensitive_fields",
  "manage_order_fulfillment",
  "view_support_tickets",
  "view_support_sensitive_fields",
  "reply_support_tickets",
  "manage_support_tickets",
  "manage_categories",
  "view_all_reports",
  "export_reports",
  "view_logs",
  "manage_cloudinary_cleanup",
  "manage_technical_settings",
  "manage_api_keys",
  "manage_content",
  "view_all_payouts",
  "process_payouts",
  "manage_system_settings",
  "manage_commissions",
  "process_refunds",
] as const;
