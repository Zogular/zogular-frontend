export type { SellerApplicationStatus, SellerType, VendorApplication } from "@/types/seller";

export type VendorApplicationAdminAction =
  | "approve-approved"
  | "approve-provisional"
  | "needs-info"
  | "reject"
  | "restrict"
  | "suspend";
