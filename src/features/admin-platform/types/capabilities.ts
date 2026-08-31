import { z } from "zod";
import type { Permission } from "@/services/rbac";

export const ADMIN_CAPABILITY_CONTRACT_VERSION = 1 as const;

export const ADMIN_CAPABILITY_GROUP_IDS = [
  "home",
  "marketplace",
  "orders_and_service",
  "growth",
  "finance",
  "governance",
] as const;

export const ADMIN_CAPABILITY_IDS = [
  "overview",
  "alerts_and_assigned_work",
  "analytics_and_reports",
  "sellers",
  "customers",
  "products_and_moderation",
  "categories_and_attributes",
  "inventory_oversight",
  "reviews_and_ratings",
  "orders_and_fulfillment",
  "delivery_operations",
  "returns_refunds_and_exchanges",
  "disputes_and_claims",
  "support",
  "risk_and_trust",
  "content_and_merchandising",
  "collections_and_placement",
  "promotions_and_campaigns",
  "customer_segments_and_price_lists",
  "search_and_discovery_operations",
  "finance_overview",
  "transactions_and_ledger",
  "reconciliation",
  "seller_payouts",
  "commissions",
  "admins_teams_and_roles",
  "audit_log",
  "integrations_and_jobs",
  "platform_settings",
] as const;

export const FRONTEND_PERMISSION_HINT_VALUES = [
  "view_dashboard",
  "view_financial_reports",
  "export_reports",
  "view_sellers",
  "approve_sellers",
  "suspend_sellers",
  "edit_commission",
  "view_buyers",
  "ban_buyers",
  "view_products",
  "moderate_products",
  "view_orders",
  "override_orders",
  "manage_disputes",
  "view_treasury",
  "approve_payouts",
  "manage_refunds",
  "view_support_tickets",
  "reply_support_tickets",
  "manage_support_tickets",
  "manage_content",
  "view_system_logs",
  "configure_platform",
  "manage_admins",
] as const satisfies readonly Permission[];

export const AdminCapabilityGroupIdSchema = z.enum(ADMIN_CAPABILITY_GROUP_IDS);
export const AdminCapabilityIdSchema = z.enum(ADMIN_CAPABILITY_IDS);
export const FrontendPermissionHintSchema = z.enum(FRONTEND_PERMISSION_HINT_VALUES);
export const AdminCapabilityCompletionSchema = z.enum([
  "operational",
  "experience_ready",
  "contract_gated",
]);
export const AdminCapabilitySensitivitySchema = z.enum([
  "standard",
  "sensitive",
  "restricted",
]);
export const AdminCapabilityIntentSchema = z.enum(["read", "write", "read_write"]);
export const AdminFrontendPackageSchema = z.enum([
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
]);

const BackendPermissionKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/);

export const AdminBackendPermissionEvidenceSchema = z
  .strictObject({
    state: z.enum(["verified", "partial", "missing"]),
    permissions: z.array(BackendPermissionKeySchema).max(20),
    note: z.string().min(1).max(500),
  })
  .superRefine((value, context) => {
    if (new Set(value.permissions).size !== value.permissions.length) {
      context.addIssue({
        code: "custom",
        path: ["permissions"],
        message: "Backend permission evidence cannot contain duplicates.",
      });
    }
    if (value.state === "missing" && value.permissions.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["permissions"],
        message: "Missing backend evidence cannot claim permission keys.",
      });
    }
  });

export const AdminBackendDependencySchema = z.strictObject({
  state: z.enum(["available", "partial", "missing"]),
  owner: z.literal("backend"),
  description: z.string().min(1).max(500),
});

export const AdminCapabilityDefinitionSchema = z
  .strictObject({
    version: z.literal(ADMIN_CAPABILITY_CONTRACT_VERSION),
    id: AdminCapabilityIdSchema,
    groupId: AdminCapabilityGroupIdSchema,
    label: z.string().min(1).max(80),
    purpose: z.string().min(1).max(300),
    currentRoute: z
      .string()
      .min(1)
      .max(160)
      .regex(/^\/admin(?:\/[a-z0-9-]+)*$/)
      .nullable(),
    routeEvidence: z.string().min(1).max(500),
    frontendPermissionHints: z.array(FrontendPermissionHintSchema).max(12),
    backendPermissionEvidence: AdminBackendPermissionEvidenceSchema,
    completionLevel: AdminCapabilityCompletionSchema,
    navigationEligible: z.boolean(),
    frontendPackage: AdminFrontendPackageSchema,
    backendDependency: AdminBackendDependencySchema,
    evidenceNote: z.string().min(1).max(700),
    blockers: z.array(z.string().min(1).max(300)).max(12),
    sensitivity: AdminCapabilitySensitivitySchema,
    intent: AdminCapabilityIntentSchema,
    authorizationAuthority: z.literal("backend"),
  })
  .superRefine((value, context) => {
    if (new Set(value.frontendPermissionHints).size !== value.frontendPermissionHints.length) {
      context.addIssue({
        code: "custom",
        path: ["frontendPermissionHints"],
        message: "Frontend permission hints cannot contain duplicates.",
      });
    }
    if (new Set(value.blockers).size !== value.blockers.length) {
      context.addIssue({
        code: "custom",
        path: ["blockers"],
        message: "Capability blockers cannot contain duplicates.",
      });
    }
    if (value.completionLevel !== "operational" && value.navigationEligible) {
      context.addIssue({
        code: "custom",
        path: ["navigationEligible"],
        message: "Only operational capabilities can be navigation eligible.",
      });
    }
    if (value.completionLevel === "operational" && value.blockers.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["blockers"],
        message: "Operational capabilities cannot retain contract blockers.",
      });
    }
    if (value.completionLevel !== "operational" && value.blockers.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["blockers"],
        message: "Non-operational capabilities must state their blockers.",
      });
    }
  });

export type AdminCapabilityGroupId = z.infer<typeof AdminCapabilityGroupIdSchema>;
export type AdminCapabilityId = z.infer<typeof AdminCapabilityIdSchema>;
export type FrontendPermissionHint = z.infer<typeof FrontendPermissionHintSchema>;
export type AdminCapabilityCompletion = z.infer<typeof AdminCapabilityCompletionSchema>;
export type AdminCapabilityDefinition = z.infer<typeof AdminCapabilityDefinitionSchema>;
