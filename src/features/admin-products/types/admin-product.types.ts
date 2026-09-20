/**
 * @file admin-product.types.ts
 * @module features/admin-products/types
 * @description
 * Complete type definitions for the Zogular Admin Product Moderation and Inventory Oversight module.
 * Covers product record shapes, moderation lifecycle states, action payloads, reason templates,
 * filter parameters, and dialog states.
 */

import type { AdminProductRecord, AdminProductReviewInput } from "@/services/admin/products";
import type {
  ProductModerationAction,
  ProductModerationStatus,
} from "@/services/product-moderation";

export type { AdminProductRecord, AdminProductReviewInput };
export type { ProductModerationAction, ProductModerationStatus };

/**
 * Filter options for the moderation queue status tab.
 */
export type ProductModerationStatusFilter = "all" | ProductModerationStatus;

/**
 * View modes supported for administrative product catalog display.
 */
export type ProductListViewMode = "list" | "grid";

/**
 * Standard summary metrics calculated from the loaded queue.
 */
export interface ProductSummaryCounts {
  published: number;
  pending: number;
  changesRequested: number;
  flagged: number;
  total: number;
}

/**
 * Structured reason template for product rejections or changes requests.
 */
export interface ModerationReasonTemplate {
  code: string;
  label: string;
  description: string;
  defaultNote: string;
}

/**
 * Dialog state for single or bulk moderation actions.
 */
export interface ProductModerationDialogState {
  isOpen: boolean;
  action: "reject" | "request_changes";
  productIds: string[];
  targetTitle?: string;
  isBulk: boolean;
  reasonCode: string;
  note: string;
}
