"use client";

import { ShoppingBag, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCartItem } from "@/lib/normalizers/cart";
import { getProductTitle } from "@/lib/normalizers/product";
import { guestIncreaseBlock, useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import type { Product } from "@/types/product";

type AddToCartButtonProps = {
  product: Product;
  quantity?: number;
  variant?: string | null;
  iconOnly?: boolean;
  className?: string;
  size?: "default" | "sm" | "icon";
  disabled?: boolean;
  disabledReason?: string;
};

export function AddToCartButton({
  product,
  quantity = 1,
  variant = null,
  iconOnly = false,
  className,
  size = "default",
  disabled = false,
  disabledReason,
}: AddToCartButtonProps) {
  const item = toCartItem(product, { quantity, variant });
  const addItem = useCart((state) => state.addItem);
  const block = useCart((state) => guestIncreaseBlock(state, item, quantity, item));
  const productTitle = getProductTitle(product);
  const accessibleLabel = disabled && disabledReason
    ? `${disabledReason}: ${productTitle}`
    : `Add ${productTitle} to cart`;

  return (
    <Button
      type="button"
      size={size}
      className={className}
      disabled={disabled}
      aria-label={iconOnly ? accessibleLabel : undefined}
      title={disabledReason ?? block ?? accessibleLabel}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const rejection = addItem(item);
        if (rejection) toast.info(rejection);
      }}
    >
      {iconOnly ? (
        <ShoppingBag aria-hidden="true" className="relative z-10 h-3.5 w-3.5 md:h-4 md:w-4" />
      ) : (
        <>
          <ShoppingCart aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
          Add
        </>
      )}
    </Button>
  );
}
