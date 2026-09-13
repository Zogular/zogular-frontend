/**
 * @file product-moderation.utils.ts
 * @module features/admin-products/lib
 * @description
 * Architectural utilities, formatting functions, badge configurations, and predefined reason templates
 * for product moderation workflows in Zogular. Implements the Zogular tactile admin styling rules.
 */

import type { ProductModerationStatus } from "@/services/product-moderation";
import type { ModerationReasonTemplate } from "../types/admin-product.types";

/**
 * Formats monetary amounts in Zambian Kwacha with localized group separators.
 */
export function formatCurrency(value: number): string {
  return `K${value.toLocaleString()}`;
}

/**
 * Formats timestamp strings into human-readable Zambian localized dates.
 */
export function formatDate(value: string | null): string {
  if (!value) return "Awaiting submission";
  return new Intl.DateTimeFormat("en-ZM", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/**
 * Visual styling tokens and labels for each product lifecycle status,
 * aligned with the tactile warm admin color palette.
 */
export const STATUS_UI: Record<
  ProductModerationStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  draft: {
    bg: "bg-[var(--admin-surface-mist)]",
    text: "text-[var(--admin-ink-soft)]",
    border: "border-[color-mix(in_srgb,var(--admin-copper-muted)_35%,transparent)]",
    label: "Draft",
  },
  pending_review: {
    bg: "bg-amber-950",
    text: "text-amber-100",
    border: "border-amber-400/50",
    label: "Pending Review",
  },
  approved: {
    bg: "bg-emerald-950",
    text: "text-emerald-100",
    border: "border-emerald-400/50",
    label: "Approved",
  },
  rejected: {
    bg: "bg-rose-950",
    text: "text-rose-100",
    border: "border-rose-400/50",
    label: "Rejected",
  },
  needs_changes: {
    bg: "bg-orange-950",
    text: "text-orange-100",
    border: "border-orange-400/50",
    label: "Needs Changes",
  },
  published: {
    bg: "bg-[#014d2b]",
    text: "text-emerald-100",
    border: "border-[#00b358]/40",
    label: "Published",
  },
  paused: {
    bg: "bg-amber-950",
    text: "text-amber-100",
    border: "border-amber-400/50",
    label: "Paused",
  },
  suspended: {
    bg: "bg-red-950",
    text: "text-red-100",
    border: "border-red-400/50",
    label: "Suspended",
  },
};

/**
 * Standard, predefined reason templates for product rejections or change requests.
 * Operators can select a template to automatically populate a structured rejection reason.
 */
export const MODERATION_REASON_TEMPLATES: readonly ModerationReasonTemplate[] = [
  {
    code: "IMAGE_QUALITY",
    label: "Image Quality",
    description: "Photos are blurry, watermarked, contain phone numbers, or do not show the actual item clearly.",
    defaultNote: "Product images do not meet quality standards. Please provide clear, well-lit photos without external watermarks or contact numbers.",
  },
  {
    code: "MISLEADING_TITLE",
    label: "Misleading Title",
    description: "Title is clickbait, contains brand spam, or misrepresents the actual product.",
    defaultNote: "Product title is misleading or inaccurate. Please update the title to accurately describe the brand, model, and item.",
  },
  {
    code: "INACCURATE_SPECS",
    label: "Inaccurate Specifications",
    description: "Category attributes, technical specs, or condition contradict the photos or description.",
    defaultNote: "The selected attributes, specifications, or condition contradict the product description and photos. Please review and correct them.",
  },
  {
    code: "POLICY_VIOLATION",
    label: "Policy Violation",
    description: "Listing violates Zogular seller terms, copyright, or acceptable listing guidelines.",
    defaultNote: "This listing violates Zogular marketplace content policies. Please review seller guidelines before resubmitting.",
  },
  {
    code: "PROHIBITED_ITEM",
    label: "Prohibited Item",
    description: "Item belongs to a restricted category that is not permitted for sale on Zogular.",
    defaultNote: "This item falls into a restricted or prohibited category and cannot be sold on the marketplace.",
  },
  {
    code: "PRICING_ANOMALY",
    label: "Pricing Anomaly",
    description: "Price is unrealistically high or low, suggesting typo or fraudulent listing.",
    defaultNote: "The listing price appears irregular or entered in error. Please verify and update the pricing.",
  },
  {
    code: "OTHER",
    label: "Custom Rationale",
    description: "Provide specific instructions or feedback not covered by predefined templates.",
    defaultNote: "",
  },
] as const;

/**
 * Retrieves a reason template by its unique code.
 */
export function getReasonTemplateByCode(code: string): ModerationReasonTemplate | undefined {
  return MODERATION_REASON_TEMPLATES.find((t) => t.code === code);
}
