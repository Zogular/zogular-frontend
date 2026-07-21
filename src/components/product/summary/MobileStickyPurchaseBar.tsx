import * as React from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/AddToCartButton";
import { QuantitySelector } from "./QuantitySelector";
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
  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t border-zinc-200/50 bg-white/85 p-4 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl md:hidden">
      <div className="flex items-center gap-3">
        <Link href={productData.seller.href}>
          <Button variant="outline" title="Visit store" aria-label="Visit store" className="h-12 w-12 shrink-0 rounded-2xl border-zinc-300 bg-white/50 shadow-sm backdrop-blur-md">
            <Store className="h-5 w-5 text-zinc-600" />
          </Button>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <QuantitySelector value={quantity} onDecrease={decrementQuantity} onIncrease={incrementQuantity} />
          <AddToCartButton
            product={wishlistProduct}
            quantity={quantity}
            variant={selectedVariant?.value}
            className="h-12 flex-1 rounded-2xl bg-[#FF6B00] text-base font-bold text-white shadow-xl shadow-[#FF6B00]/30 transition-all hover:bg-[#e66000] active:scale-95"
          />
        </div>
      </div>
    </div>
  );
}
