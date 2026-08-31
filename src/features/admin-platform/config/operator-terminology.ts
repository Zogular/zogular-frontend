import { ADMIN_CAPABILITY_REGISTRY } from "./capability-registry";
import type { AdminCapabilityId } from "../types/capabilities";

export const ADMIN_OPERATOR_TERMS = Object.freeze({
  seller: "Seller",
  customer: "Customer",
  product: "Product",
  category: "Category",
  order: "Order",
  supportRequest: "Support request",
  administrator: "Administrator",
  assignedWork: "Assigned work",
  needsAttention: "Needs attention",
  lastUpdated: "Last updated",
} as const);

export const ADMIN_PROHIBITED_PRIMARY_TERMS = Object.freeze([
  "CRM",
  "master catalog",
  "control room",
  "backend contract",
  "payload",
  "enum",
  "slug",
  "sort integer",
  "system truth",
] as const);

export const ADMIN_PRIMARY_DESTINATION_LABELS = Object.freeze(
  Object.fromEntries(
    ADMIN_CAPABILITY_REGISTRY.map((capability) => [capability.id, capability.label]),
  ),
) as Readonly<Record<AdminCapabilityId, string>>;

export function containsProhibitedPrimaryTerm(label: string): boolean {
  const normalizedLabel = label.toLocaleLowerCase("en");
  return ADMIN_PROHIBITED_PRIMARY_TERMS.some((term) =>
    normalizedLabel.includes(term.toLocaleLowerCase("en")),
  );
}
