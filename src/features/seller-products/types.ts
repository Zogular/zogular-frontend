import type { SellerProductListing } from "@/services/seller-catalog";

export interface SellerProductActions {
  edit: (product: SellerProductListing) => void;
  view: (product: SellerProductListing) => void;
  duplicate: (product: SellerProductListing) => void;
  submitForReview: (productId: string) => void;
  withdrawReview: (productId: string) => void;
  pause: (productId: string) => void;
  remove: (productId: string) => void;
}

export interface SellerProductsSummary {
  total: number;
  buyerVisible: number;
  draft: number;
  pendingReview: number;
  lowStock: number;
  outOfStock: number;
}
