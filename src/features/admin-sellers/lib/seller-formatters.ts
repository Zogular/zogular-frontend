/**
 * @file seller-formatters.ts
 * @module features/admin-sellers/lib
 * @description
 * Pure presentation helper functions for formatting seller identity, store names,
 * seller types, and location summaries across admin review workspaces.
 *
 * NOTE: For date and time formatting, reuse the centralized `@/lib/admin-format`
 * utility (`formatAdminDate`, `formatAdminDateTime`) to maintain single-source-of-truth consistency.
 */

import type { SellerType, VendorApplication } from "@/types/seller";
import type { SellerReviewApplication } from "../types/seller-review.types";

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  INDIVIDUAL: "Individual seller",
  REGISTERED_BUSINESS: "Registered business",
};

export function getSellerTypeLabel(type: SellerType): string {
  return SELLER_TYPE_LABELS[type] || type;
}

export type ReviewDialogApplication = Pick<
  SellerReviewApplication,
  "id" | "status" | "sellerType" | "ownerFullName" | "storeName" | "legalBusinessName"
> & { businessName?: string };

export function getApplicationPrimaryName(
  application:
    | Pick<VendorApplication, "storeName" | "legalBusinessName" | "businessName">
    | ReviewDialogApplication,
): string {
  return (
    application.storeName ||
    application.legalBusinessName ||
    application.businessName ||
    "Untitled seller"
  );
}

export function getApplicationLocation(application: VendorApplication): string {
  return [application.district, application.businessAddress].filter(Boolean).join(", ");
}

export function matchesApplicationSearch(application: VendorApplication, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [
    application.storeName,
    application.ownerFullName,
    application.businessPhone,
    application.businessEmail,
    application.user?.telephone,
    application.user?.email,
    application.legalBusinessName,
    application.businessName,
  ]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(normalizedQuery));
}
