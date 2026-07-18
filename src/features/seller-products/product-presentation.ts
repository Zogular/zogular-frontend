import type { SellerProductListing, SellerProductStatus } from "@/services/seller-catalog";

export type SellerProductStockState = "in-stock" | "low-stock" | "out-of-stock";

export function getSellerProductStockState(product: SellerProductListing): SellerProductStockState {
  if (product.stock === 0) return "out-of-stock";
  if (product.stock <= product.lowStockThreshold) return "low-stock";
  return "in-stock";
}

export function getSellerProductStockLabel(product: SellerProductListing) {
  const stockState = getSellerProductStockState(product);
  if (stockState === "out-of-stock") return "Out of stock";
  if (stockState === "low-stock") return `${product.stock} low`;
  return `${product.stock} in stock`;
}

export function formatSellerProductPrice(product: SellerProductListing) {
  return `K${(product.salePrice ?? product.price).toLocaleString()}`;
}

export const SELLER_PRODUCT_STATUS_STYLES: Record<SellerProductStatus, string> = {
  published: "border-[#009E49]/20 bg-[#009E49]/10 text-[#007d3a]",
  draft: "border-zinc-200 bg-zinc-100 text-zinc-700",
  pending_review: "border-blue-200 bg-blue-50 text-blue-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  needs_changes: "border-orange-200 bg-orange-50 text-orange-700",
  rejected: "border-orange-200 bg-orange-50 text-orange-700",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  suspended: "border-red-200 bg-red-50 text-red-700",
};
