import { z } from "zod";
import { ADMIN_CAPABILITY_BY_ID } from "../config/capability-registry";
import {
  AdminCapabilityDefinitionSchema,
  AdminCapabilityIdSchema,
  FRONTEND_PERMISSION_HINT_VALUES,
  FrontendPermissionHintSchema,
  type AdminCapabilityDefinition,
} from "../types/capabilities";

const ADMIN_ROLE_VALUES = [
  "super_admin",
  "executive_admin",
  "ops_manager",
  "finance_admin",
  "support_admin",
  "content_admin",
  "viewer",
] as const;

export const AdminCapabilityIdentitySchema = z.strictObject({
  role: z.enum(ADMIN_ROLE_VALUES),
  permissions: z.array(FrontendPermissionHintSchema).max(FRONTEND_PERMISSION_HINT_VALUES.length),
});

export type AdminCapabilityVisibilityReason =
  | "eligible"
  | "unknown_capability"
  | "not_operational"
  | "navigation_disabled"
  | "unknown_identity"
  | "permission_hint_missing"
  | "permission_hint_not_present";

export interface AdminCapabilityNavigationDecision {
  readonly eligible: boolean;
  readonly reason: AdminCapabilityVisibilityReason;
  readonly backendAuthorizationRequired: true;
}

const hidden = (
  reason: Exclude<AdminCapabilityVisibilityReason, "eligible">,
): AdminCapabilityNavigationDecision => ({
  eligible: false,
  reason,
  backendAuthorizationRequired: true,
});

export function evaluateCapabilityNavigation(
  capabilityInput: unknown,
  identityInput: unknown,
): AdminCapabilityNavigationDecision {
  const capability = AdminCapabilityDefinitionSchema.safeParse(capabilityInput);
  if (!capability.success) return hidden("unknown_capability");
  if (capability.data.completionLevel !== "operational") return hidden("not_operational");
  if (!capability.data.navigationEligible) return hidden("navigation_disabled");

  const identity = AdminCapabilityIdentitySchema.safeParse(identityInput);
  if (!identity.success) return hidden("unknown_identity");
  if (capability.data.frontendPermissionHints.length === 0) return hidden("permission_hint_missing");

  const permissions = new Set(identity.data.permissions);
  if (!capability.data.frontendPermissionHints.some((permission) => permissions.has(permission))) {
    return hidden("permission_hint_not_present");
  }

  return { eligible: true, reason: "eligible", backendAuthorizationRequired: true };
}

export function getCapabilityNavigationDecision(
  capabilityIdInput: unknown,
  identityInput: unknown,
): AdminCapabilityNavigationDecision {
  const capabilityId = AdminCapabilityIdSchema.safeParse(capabilityIdInput);
  if (!capabilityId.success) return hidden("unknown_capability");
  return evaluateCapabilityNavigation(ADMIN_CAPABILITY_BY_ID[capabilityId.data], identityInput);
}

export function getNavigationEligibleCapabilities(
  identityInput: unknown,
): readonly AdminCapabilityDefinition[] {
  const identity = AdminCapabilityIdentitySchema.safeParse(identityInput);
  if (!identity.success) return [];

  return Object.values(ADMIN_CAPABILITY_BY_ID).filter(
    (capability) => evaluateCapabilityNavigation(capability, identity.data).eligible,
  );
}
