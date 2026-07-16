import type { VendorApplication } from "@/types/seller";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";

export function getAvailableVendorActions(
  application: VendorApplication,
  canApprove: boolean,
  canSuspend: boolean
): VendorApplicationAdminAction[] {
  const actions: VendorApplicationAdminAction[] = [];
  const s = application.status;

  if (canApprove) {
    if (s === "SUBMITTED") {
      actions.push("approve-approved", "approve-provisional", "needs-info", "reject");
    } else if (s === "PROVISIONAL") {
      actions.push("approve-approved");
    }
  }

  if (canSuspend) {
    if (s === "PROVISIONAL" || s === "APPROVED") {
      actions.push("restrict", "suspend");
    } else if (s === "RESTRICTED") {
      actions.push("suspend");
    }
  }

  return actions;
}
