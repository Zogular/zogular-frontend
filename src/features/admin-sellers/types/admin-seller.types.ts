export type { SellerApplicationStatus, SellerType, VendorApplication } from "@/types/seller";
import type { SellerReviewAction } from "./seller-review.types";

export type VendorApplicationAdminAction =
  | "approve-approved"
  | "approve-provisional"
  | "needs-info"
  | "reject"
  | "restrict"
  | "suspend";

const REVIEW_ACTION_MAP: Record<SellerReviewAction, VendorApplicationAdminAction> = {
  APPROVE: "approve-approved",
  GRANT_PROVISIONAL: "approve-provisional",
  REQUEST_INFO: "needs-info",
  REJECT: "reject",
  RESTRICT: "restrict",
  SUSPEND: "suspend",
};

export function toVendorApplicationAdminActions(
  actions: readonly SellerReviewAction[],
): VendorApplicationAdminAction[] {
  return actions.map((action) => REVIEW_ACTION_MAP[action]);
}
