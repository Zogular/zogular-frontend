/**
 * @file admin-buyer.types.ts
 * @module features/admin-buyers/types
 * @description
 * Contract definitions, view models, and domain interfaces for the Admin Buyers CRM module.
 * Centralizes UI filtering, pagination state, error categories, and re-exports core service entity types.
 */

import type {
  AdminBuyerRecord,
  CustomerLinkedContext,
  CustomerSupportTicket,
  CustomerProductReview,
  CustomerReviewSummary,
} from "@/services/admin/buyers";

export type {
  AdminBuyerRecord,
  CustomerLinkedContext,
  CustomerSupportTicket,
  CustomerProductReview,
  CustomerReviewSummary,
};

export type BuyerSegment = "VIP" | "ACTIVE_SHOPPER" | "NEW_CUSTOMER";
export type BuyerDetailTab = "overview" | "orders" | "reviews" | "tickets";

export type BuyerStatusFilter = "all" | "active" | "inactive";
export type BuyerListViewMode = "list" | "grid";

export interface BuyerListQueryState {
  search: string;
  status: BuyerStatusFilter;
  page: number;
  view: BuyerListViewMode;
}

export interface BuyerListSafeError {
  kind: "unauthenticated" | "forbidden" | "not-found" | "conflict" | "timeout" | "unavailable";
  message: string;
}

export interface BuyerStatusDialogState {
  isOpen: boolean;
  buyer: AdminBuyerRecord | null;
  nextStatus: boolean;
}
