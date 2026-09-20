/**
 * @file types.ts
 * @module features/admin-access
 * @description
 * Domain contracts, canonical role permission matrix, action categories, and UI metadata
 * for F9 Access Control, Governance & Central Audit Log Explorer.
 */

import type { AdminTone } from "@/components/admin/AdminPrimitives";

// ============================================================================
// DOMAIN CONTRACTS
// ============================================================================

export interface AdminUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
}

export interface AdminAuditActor {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
}

export type AuditLogOutcome = "SUCCEEDED" | "DENIED" | "FAILED";

export interface AdminAuditLogRecord {
  id: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  status: AuditLogOutcome | string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
  actor?: AdminAuditActor | null;
}

export interface AuditLogsQueryParams {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface AuditLogsResponse {
  logs: AdminAuditLogRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// ============================================================================
// NAVIGATION TABS
// ============================================================================

export type AccessTabKey = "admins" | "audit" | "matrix";

export interface AccessTabMeta {
  key: AccessTabKey;
  label: string;
  description: string;
}

export const ACCESS_TABS: readonly AccessTabMeta[] = [
  {
    key: "admins",
    label: "Administrators",
    description: "Operator directory, status control, and role elevation.",
  },
  {
    key: "audit",
    label: "Audit Trail",
    description: "Real-time stream of administrative mutations and governance events.",
  },
  {
    key: "matrix",
    label: "Role & Permission Matrix",
    description: "Granular verification of capability boundaries across operator roles.",
  },
] as const;

// ============================================================================
// AUDIT OUTCOME TONES & ACTION CATEGORIES
// ============================================================================

export const AUDIT_OUTCOME_TONES: Record<AuditLogOutcome | string, AdminTone> = {
  SUCCEEDED: "emerald",
  succeeded: "emerald",
  DENIED: "amber",
  denied: "amber",
  FAILED: "rose",
  failed: "rose",
};

export type AuditActionCategory =
  | "User Lifecycle"
  | "Catalog & Products"
  | "Categories"
  | "Orders & Logistics"
  | "Support"
  | "Security & Cleanups"
  | "Platform Governance";

export interface AuditActionMetadata {
  label: string;
  category: AuditActionCategory;
  categoryColor: string; // Tailwind class
  description: string;
}

export const AUDIT_ACTION_MAP: Record<string, AuditActionMetadata> = {
  ADMIN_USER_CREATED: {
    label: "User Created",
    category: "User Lifecycle",
    categoryColor: "bg-blue-50 text-blue-800 border-blue-200",
    description: "A customer or operator account was provisioned.",
  },
  ADMIN_USER_UPDATED: {
    label: "User Profile Updated",
    category: "User Lifecycle",
    categoryColor: "bg-blue-50 text-blue-800 border-blue-200",
    description: "Administrator updated account details.",
  },
  ADMIN_USER_ROLE_CHANGED: {
    label: "Role Elevated / Reassigned",
    category: "User Lifecycle",
    categoryColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
    description: "Operator access role modified; sessions revoked.",
  },
  ADMIN_USER_DEACTIVATED: {
    label: "Access Revoked",
    category: "User Lifecycle",
    categoryColor: "bg-rose-50 text-rose-800 border-rose-200",
    description: "Operator account suspended or deactivated.",
  },
  ADMIN_USER_REACTIVATED: {
    label: "Access Restored",
    category: "User Lifecycle",
    categoryColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "Account privileges restored.",
  },
  ADMIN_USER_HARD_DELETE_DENIED: {
    label: "Hard Delete Denied",
    category: "User Lifecycle",
    categoryColor: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Hard deletion prevented by governance baseline.",
  },
  ADMIN_BOOTSTRAP_CREATED: {
    label: "Super Admin Bootstrapped",
    category: "Security & Cleanups",
    categoryColor: "bg-purple-50 text-purple-800 border-purple-200",
    description: "Root super admin account bootstrap event.",
  },
  ADMIN_CUSTOMER_EXPORT: {
    label: "Customer Export",
    category: "User Lifecycle",
    categoryColor: "bg-sky-50 text-sky-800 border-sky-200",
    description: "Exported customer records to CSV with field-level masking.",
  },
  PRODUCT_APPROVED: {
    label: "Product Approved",
    category: "Catalog & Products",
    categoryColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "Product moderation approved for public catalog.",
  },
  PRODUCT_REJECTED: {
    label: "Product Rejected",
    category: "Catalog & Products",
    categoryColor: "bg-rose-50 text-rose-800 border-rose-200",
    description: "Product listing rejected with required justification.",
  },
  PRODUCT_PUBLISHED: {
    label: "Product Published",
    category: "Catalog & Products",
    categoryColor: "bg-teal-50 text-teal-800 border-teal-200",
    description: "Listing made active and visible to buyers.",
  },
  PRODUCT_STATUS_UPDATED: {
    label: "Product Status Changed",
    category: "Catalog & Products",
    categoryColor: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Catalog moderation status transition.",
  },
  PRODUCT_UPDATED: {
    label: "Product Updated",
    category: "Catalog & Products",
    categoryColor: "bg-blue-50 text-blue-800 border-blue-200",
    description: "Administrative catalog attributes amended.",
  },
  PRODUCT_HARD_DELETE_DENIED: {
    label: "Catalog Deletion Denied",
    category: "Catalog & Products",
    categoryColor: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Hard catalog deletion denied.",
  },
  CATEGORY_CREATED: {
    label: "Category Created",
    category: "Categories",
    categoryColor: "bg-emerald-50 text-emerald-800 border-emerald-200",
    description: "New catalog taxonomy node created.",
  },
  CATEGORY_UPDATED: {
    label: "Category Updated",
    category: "Categories",
    categoryColor: "bg-blue-50 text-blue-800 border-blue-200",
    description: "Taxonomy attributes or hierarchy updated.",
  },
  CATEGORY_DELETED: {
    label: "Category Removed",
    category: "Categories",
    categoryColor: "bg-rose-50 text-rose-800 border-rose-200",
    description: "Empty category archived or deleted.",
  },
  CATEGORY_ATTRIBUTE_CREATED: {
    label: "Attribute Created",
    category: "Categories",
    categoryColor: "bg-teal-50 text-teal-800 border-teal-200",
    description: "New category dynamic attribute definition added.",
  },
  CATEGORY_ATTRIBUTE_UPDATED: {
    label: "Attribute Updated",
    category: "Categories",
    categoryColor: "bg-blue-50 text-blue-800 border-blue-200",
    description: "Attribute validation rule or options modified.",
  },
  CATEGORY_ATTRIBUTE_DELETED: {
    label: "Attribute Removed",
    category: "Categories",
    categoryColor: "bg-rose-50 text-rose-800 border-rose-200",
    description: "Category attribute definition deleted.",
  },
  CATEGORY_TEMPLATE_APPLIED: {
    label: "Industry Template Applied",
    category: "Categories",
    categoryColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
    description: "Standard industry attribute template loaded.",
  },
  ORDER_STATUS_UPDATED: {
    label: "Order Status Updated",
    category: "Orders & Logistics",
    categoryColor: "bg-orange-50 text-orange-800 border-orange-200",
    description: "Manual order state transition or courier dispatch.",
  },
  SUPPORT_TICKET_REPLIED: {
    label: "Support Ticket Replied",
    category: "Support",
    categoryColor: "bg-sky-50 text-sky-800 border-sky-200",
    description: "Official administrative response sent on customer ticket.",
  },
  SUPPORT_TICKET_STATUS_UPDATED: {
    label: "Ticket Status Changed",
    category: "Support",
    categoryColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
    description: "Support ticket resolved, escalated, or closed.",
  },
  CLOUDINARY_CLEANUP_MANIFEST_APPROVAL: {
    label: "Cleanup Manifest Approved",
    category: "Security & Cleanups",
    categoryColor: "bg-purple-50 text-purple-800 border-purple-200",
    description: "Media storage cleanup manifest verified and signed.",
  },
  CLOUDINARY_CLEANUP_MANIFEST_REVOCATION: {
    label: "Cleanup Manifest Revoked",
    category: "Security & Cleanups",
    categoryColor: "bg-amber-50 text-amber-800 border-amber-200",
    description: "Media storage cleanup manifest approval revoked.",
  },
  CLOUDINARY_CLEANUP_EXECUTION_CONTROL: {
    label: "Execution Control Toggled",
    category: "Security & Cleanups",
    categoryColor: "bg-indigo-50 text-indigo-800 border-indigo-200",
    description: "Automatic storage cleanup scheduler status modified.",
  },
  CLOUDINARY_CLEANUP_EXECUTION: {
    label: "Storage Cleanup Executed",
    category: "Security & Cleanups",
    categoryColor: "bg-red-50 text-red-800 border-red-200",
    description: "Orphaned media asset purge operation executed.",
  },
};

export function getAuditActionMeta(action: string): AuditActionMetadata {
  return (
    AUDIT_ACTION_MAP[action] ?? {
      label: action.replace(/_/g, " "),
      category: "Platform Governance",
      categoryColor: "bg-zinc-100 text-zinc-800 border-zinc-200",
      description: "Administrative governance record.",
    }
  );
}

// ============================================================================
// CANONICAL ROLE PERMISSION MAPPING (25 CANONICAL PERMISSIONS)
// ============================================================================

export interface CanonicalPermissionItem {
  key: string;
  name: string;
  description: string;
  domain:
    | "Overview"
    | "Sellers"
    | "Users & Security"
    | "Catalog"
    | "Orders"
    | "Support"
    | "Reports"
    | "Finance"
    | "Growth"
    | "Platform Settings";
  isReserved?: boolean;
}

export const CANONICAL_PERMISSION_CATALOG: readonly CanonicalPermissionItem[] = [
  // 1. Overview
  {
    key: "access_admin_panel",
    name: "Access Admin Panel",
    description: "Authenticate into administrative shell routes.",
    domain: "Overview",
  },
  // 2-4. Sellers
  {
    key: "review_sellers",
    name: "Review Sellers",
    description: "Inspect seller KYC files, stores, and applications.",
    domain: "Sellers",
  },
  {
    key: "manage_seller_status",
    name: "Manage Seller Status",
    description: "Approve, restrict, or suspend seller business accounts.",
    domain: "Sellers",
  },
  {
    key: "view_seller_sensitive_fields",
    name: "View Seller Sensitive Fields",
    description: "Unmask KYC documents, tax ID, and banking credentials.",
    domain: "Sellers",
  },
  // 5-10. Users & Security
  {
    key: "view_all_users",
    name: "View All Users",
    description: "Search customer and operator directories.",
    domain: "Users & Security",
  },
  {
    key: "view_user_sensitive_fields",
    name: "View User Sensitive Fields",
    description: "Inspect customer unmasked phone numbers and addresses.",
    domain: "Users & Security",
  },
  {
    key: "create_users",
    name: "Create Users",
    description: "Provision customer accounts via administrative console.",
    domain: "Users & Security",
  },
  {
    key: "edit_users",
    name: "Edit Users & Status",
    description: "Modify user names, phone numbers, and toggle active status.",
    domain: "Users & Security",
  },
  {
    key: "delete_users",
    name: "Delete Users (Deactivation Guard)",
    description: "Safely deactivate users (hard deletion permanently disabled).",
    domain: "Users & Security",
  },
  {
    key: "manage_roles",
    name: "Manage Roles & Elevation",
    description: "Assign operator roles (SUPER_ADMIN only, self-mutation forbidden).",
    domain: "Users & Security",
  },
  // 11-14. Catalog
  {
    key: "view_all_products",
    name: "View All Products",
    description: "Access full marketplace catalog queue.",
    domain: "Catalog",
  },
  {
    key: "approve_products",
    name: "Moderate & Approve Products",
    description: "Approve, reject, or request revisions for seller listings.",
    domain: "Catalog",
  },
  {
    key: "delete_any_product",
    name: "Delete Any Product",
    description: "Administrative de-listing of abusive catalog items.",
    domain: "Catalog",
  },
  {
    key: "manage_categories",
    name: "Manage Categories & Attributes",
    description: "Create taxonomies and dynamic attribute templates.",
    domain: "Catalog",
  },
  // 15-17. Orders
  {
    key: "view_all_orders",
    name: "View All Orders",
    description: "Access entire customer order and fulfillment queue.",
    domain: "Orders",
  },
  {
    key: "view_order_sensitive_fields",
    name: "View Order Sensitive Fields",
    description: "Inspect exact recipient contact details and delivery coordinates.",
    domain: "Orders",
  },
  {
    key: "manage_order_fulfillment",
    name: "Manage Fulfillment & Tracking",
    description: "Advance order lifecycle, record courier tracking, and cancel orders.",
    domain: "Orders",
  },
  // 18-21. Support
  {
    key: "view_support_tickets",
    name: "View Support Tickets",
    description: "Read customer and seller dispute tickets.",
    domain: "Support",
  },
  {
    key: "view_support_sensitive_fields",
    name: "View Support Sensitive Fields",
    description: "Read sensitive attachment documents and private dispute context.",
    domain: "Support",
  },
  {
    key: "reply_support_tickets",
    name: "Reply Support Tickets",
    description: "Post official administrative replies.",
    domain: "Support",
  },
  {
    key: "manage_support_tickets",
    name: "Manage Support Tickets",
    description: "Change priority, assign staff, and resolve tickets.",
    domain: "Support",
  },
  // 22-24. Reports
  {
    key: "view_all_reports",
    name: "View All Reports",
    description: "Access analytical reports and marketplace health indicators.",
    domain: "Reports",
  },
  {
    key: "export_reports",
    name: "Export Reports",
    description: "Download CSV datasets with role-governed field masking.",
    domain: "Reports",
  },
  {
    key: "view_logs",
    name: "View Audit Logs",
    description: "Inspect authoritative central audit trail and system events.",
    domain: "Reports",
  },
  // 25-28. Finance (Reserved)
  {
    key: "view_all_payouts",
    name: "View All Payouts",
    description: "Inspect seller settlement balances and payout requests.",
    domain: "Finance",
    isReserved: true,
  },
  {
    key: "process_payouts",
    name: "Process Seller Payouts",
    description: "Authorize and release mobile money batch disbursements.",
    domain: "Finance",
    isReserved: true,
  },
  {
    key: "manage_commissions",
    name: "Manage Commissions",
    description: "Configure category and seller tier fee structures.",
    domain: "Finance",
    isReserved: true,
  },
  {
    key: "process_refunds",
    name: "Process Refunds",
    description: "Authorize buyer refund reversals from order escrow.",
    domain: "Finance",
    isReserved: true,
  },
  // 29. Growth (Reserved)
  {
    key: "manage_content",
    name: "Manage Merchandising & Content",
    description: "Manage featured collections, banners, and merchandising rules.",
    domain: "Growth",
    isReserved: true,
  },
  // 30-33. Platform Settings (1 Operational, 3 Reserved)
  {
    key: "manage_cloudinary_cleanup",
    name: "Manage Media Cleanup",
    description: "Approve, schedule, and execute media storage purge jobs.",
    domain: "Platform Settings",
  },
  {
    key: "manage_technical_settings",
    name: "Manage Technical Settings",
    description: "Configure infrastructure, environment, and technical parameters.",
    domain: "Platform Settings",
    isReserved: true,
  },
  {
    key: "manage_api_keys",
    name: "Manage API Keys",
    description: "Generate and revoke programmatic service integration credentials.",
    domain: "Platform Settings",
    isReserved: true,
  },
  {
    key: "manage_system_settings",
    name: "Manage System Settings",
    description: "Update core marketplace parameters and operating rules.",
    domain: "Platform Settings",
    isReserved: true,
  },
] as const;

export type CanonicalAdminRole =
  | "SUPER_ADMIN"
  | "TECH_ADMIN"
  | "EXECUTIVE"
  | "OPERATIONS";

/**
 * Exact canonical permission assignment matrix as codified in auth-and-rbac.md.
 */
export const CANONICAL_ROLE_PERMISSIONS: Record<
  CanonicalAdminRole,
  readonly string[]
> = {
  SUPER_ADMIN: CANONICAL_PERMISSION_CATALOG.map((p) => p.key),
  TECH_ADMIN: [
    "access_admin_panel",
    "view_all_users",
    "view_all_products",
    "view_all_orders",
    "view_support_tickets",
    "view_all_reports",
    "export_reports",
    "view_logs",
    "manage_cloudinary_cleanup",
    "manage_technical_settings",
    "manage_api_keys",
  ],
  EXECUTIVE: [
    "access_admin_panel",
    "review_sellers",
    "view_all_users",
    "view_all_products",
    "view_all_orders",
    "view_support_tickets",
    "view_all_reports",
    "export_reports",
    "view_logs",
  ],
  OPERATIONS: [
    "access_admin_panel",
    "review_sellers",
    "manage_seller_status",
    "view_seller_sensitive_fields",
    "view_all_users",
    "view_user_sensitive_fields",
    "view_all_products",
    "approve_products",
    "view_all_orders",
    "view_order_sensitive_fields",
    "manage_order_fulfillment",
    "view_support_tickets",
    "view_support_sensitive_fields",
    "reply_support_tickets",
    "manage_support_tickets",
    "manage_categories",
  ],
};

// ============================================================================
// ROLE ELEVATION DIALOG OPTIONS
// ============================================================================

export interface AssignableRoleOption {
  value: string;
  label: string;
  badgeTone: AdminTone;
  description: string;
}

export const ALLOWED_ASSIGNABLE_ROLES: readonly AssignableRoleOption[] = [
  {
    value: "TECH_ADMIN",
    label: "Technical Administrator",
    badgeTone: "sky",
    description: "System diagnostics, media maintenance, audit logs, and developer tooling.",
  },
  {
    value: "EXECUTIVE",
    label: "Executive (Read-Only)",
    badgeTone: "indigo",
    description: "Read-only business analytics, seller applications, orders, and audits.",
  },
  {
    value: "OPERATIONS",
    label: "Operations Staff",
    badgeTone: "orange",
    description: "Seller vetting, catalog moderation, manual order dispatch, and customer support.",
  },
  {
    value: "CUSTOMER",
    label: "Demote to Customer",
    badgeTone: "zinc",
    description: "Revoke administrative privileges completely; return to regular shopper account.",
  },
] as const;

export interface ReasonCodeOption {
  value: string;
  label: string;
}

export const ROLE_ELEVATION_REASON_CODES: readonly ReasonCodeOption[] = [
  { value: "PROMOTION", label: "Promotion / Expanded Scope" },
  { value: "ROLE_REASSIGNMENT", label: "Role Reassignment" },
  { value: "DEPARTMENT_TRANSFER", label: "Department Transfer" },
  { value: "OFFBOARDING", label: "Operator Offboarding" },
] as const;

export const STATUS_TOGGLE_REASON_CODES: readonly ReasonCodeOption[] = [
  { value: "SECURITY_HOLD", label: "Security Hold / Compromise Investigation" },
  { value: "OPERATOR_OFFBOARDING", label: "Staff Offboarding" },
  { value: "TEMPORARY_LEAVE", label: "Temporary Leave of Absence" },
  { value: "SCHEDULED_REACTIVATION", label: "Scheduled Reactivation" },
  { value: "ADMIN_CORRECTION", label: "Administrative Correction" },
] as const;

// ============================================================================
// ADMIN STAFF ONBOARDING
// ============================================================================

/**
 * Roles that can be directly assigned to new admin staff via the onboarding flow.
 * SUPER_ADMIN is excluded — it can only be bootstrapped, never assigned via API.
 */
export const ASSIGNABLE_STAFF_ROLES = [
  "TECH_ADMIN",
  "EXECUTIVE",
  "OPERATIONS",
  "ADMIN",
] as const;

export type AssignableStaffRole = (typeof ASSIGNABLE_STAFF_ROLES)[number];

/** Labels for assignable roles shown in the Add Staff dialog. */
export const ASSIGNABLE_STAFF_ROLE_LABELS: Record<AssignableStaffRole, string> = {
  TECH_ADMIN:  "Tech Admin",
  EXECUTIVE:   "Executive",
  OPERATIONS:  "Operations",
  ADMIN:       "Admin (Legacy)",
};

/** Request payload for creating a new admin staff member. */
export interface CreateAdminStaffPayload {
  firstName: string;
  lastName:  string;
  email:     string;
  telephone: string;
  role:      AssignableStaffRole;
  reason:    string;
}

/** Serialized user record returned by POST /admin/team/staff. */
export interface CreateAdminStaffResult {
  user: {
    id:              string;
    firstName:       string;
    lastName:        string;
    email:           string;
    role:            string;
    isActive:        boolean;
    welcomeEmailSent?: boolean;
  };
  welcomeEmailSent: boolean;
}
