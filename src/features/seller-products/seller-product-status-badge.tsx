import type { SellerProductStatus } from "@/services/seller-catalog";
import { getSellerProductModerationStatusLabel } from "@/services/product-moderation";
import { cn } from "@/lib/utils";
import { SELLER_PRODUCT_STATUS_STYLES } from "@/features/seller-products/product-presentation";

interface SellerProductStatusBadgeProps {
  status: SellerProductStatus;
  compact?: boolean;
}

export function SellerProductStatusBadge({ status, compact = false }: SellerProductStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md border font-black uppercase tracking-wide",
        compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[9px]",
        SELLER_PRODUCT_STATUS_STYLES[status],
      )}
      title={getSellerProductModerationStatusLabel(status)}
    >
      {getSellerProductModerationStatusLabel(status)}
    </span>
  );
}
