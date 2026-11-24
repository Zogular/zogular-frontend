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
      className="fixed bottom-0 left-0 z-50 w-full border-t border-zinc-200/60 bg-white/95 px-3 pt-2.5 shadow-[0_-8px_24px_rgba(0,0,0,0.07)] backdrop-blur-2xl md:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <span
            data-testid="mobile-sticky-price"
            className="whitespace-nowrap text-base font-extrabold leading-tight tracking-tight text-[#009E49] tabular-nums"
          >
            {formatCurrency(productData.price)}
          </span>
          {productData.originalPrice > productData.price && (
            <span className="whitespace-nowrap text-xs font-medium text-zinc-400 line-through tabular-nums">
              {formatCurrency(productData.originalPrice)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <QuantitySelector
            size="touch"
            value={quantity}
            max={productData.stock}
            disabled={isUnavailable}
            onDecrease={decrementQuantity}
            onIncrease={incrementQuantity}
          />
          <AddToCartButton
            product={wishlistProduct}
            quantity={quantity}
            variant={selectedVariant?.value}
            disabled={isUnavailable}
            className="h-11 min-h-[44px] min-w-[112px] flex-1 rounded-xl bg-[#FF6B00] px-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(255,107,0,0.2)] transition-all hover:bg-[#e66000] active:scale-95"
          />
        </div>
      </div>
    </div>
  );
}
