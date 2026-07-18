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

export type SellerProductsSortOption =
  | "newest"
  | "updated"
  | "title-asc"
  | "price-asc"
  | "price-desc"
  | "stock-low"
  | "stock-high";

export const SELLER_PRODUCTS_SORT_OPTIONS: ReadonlyArray<{
  value: SellerProductsSortOption;
  label: string;
}> = [
  { value: "newest", label: "Newest" },
  { value: "updated", label: "Recently updated" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "stock-low", label: "Stock: low to high" },
  { value: "stock-high", label: "Stock: high to low" },
];

export function isSellerProductsSortOption(value: string | null): value is SellerProductsSortOption {
  return SELLER_PRODUCTS_SORT_OPTIONS.some((option) => option.value === value);
}
