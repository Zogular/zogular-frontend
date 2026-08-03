import * as React from "react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { QuantitySelector } from "./QuantitySelector";
import { formatCurrency } from "./ProductPurchaseSummary";
import type { Product, ProductDetail } from "@/types/product";

export function MobileStickyPurchaseBar({
  productData,
  selectedVariant,
  quantity,
  incrementQuantity,
  decrementQuantity,
  wishlistProduct,
}: {
  productData: ProductDetail;
  selectedVariant?: { id: string; label: string; value: string; swatchClass: string };
  quantity: number;
  incrementQuantity: () => void;
  decrementQuantity: () => void;
  wishlistProduct: Product;
}) {
  const isUnavailable = productData.stock <= 0;

  return (
    <div
      data-testid="mobile-sticky-purchase-bar"
      className="fixed bottom-0 left-0 z-50 w-full border-t border-zinc-200/60 bg-white/90 px-3 pt-2 shadow-[0_-8px_24px_rgba(0,0,0,0.07)] backdrop-blur-2xl md:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex max-w-[72px] shrink-0 flex-col sm:max-w-none">
          <span className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-[#009E49] sm:text-base">
            {formatCurrency(productData.price)}
          </span>
          {productData.originalPrice > productData.price && (
            <span className="text-[10px] font-medium text-zinc-400 line-through">
              {formatCurrency(productData.originalPrice)}
            </span>
          )}
        </div>
        <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2 min-w-0">
          <div className="h-10 w-[78px] shrink-0 sm:w-[88px]">
            <QuantitySelector
              value={quantity}
              max={productData.stock}
              disabled={isUnavailable}
              onDecrease={decrementQuantity}
              onIncrease={incrementQuantity}
            />
          </div>
          <AddToCartButton
            product={wishlistProduct}
            quantity={quantity}
            variant={selectedVariant?.value}
            disabled={isUnavailable}
            className="h-10 min-w-[84px] flex-1 rounded-lg bg-[#FF6B00] px-2 text-sm font-bold text-white shadow-[0_4px_12px_rgba(255,107,0,0.2)] transition-all hover:bg-[#e66000] active:scale-95 sm:min-w-[112px]"
          />
        </div>
      </div>
    </div>
  );
}
