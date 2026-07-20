"use client";

import { ShoppingBag, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCartItem } from "@/lib/normalizers/cart";
import { useCart } from "@/hooks/use-cart";
import type { Product } from "@/types/product";

type AddToCartButtonProps = {
  product: Product;
  quantity?: number;
  variant?: string | null;
  iconOnly?: boolean;
  className?: string;
  size?: "default" | "sm" | "icon";
  disabled?: boolean;
};

export function AddToCartButton({
  product,
  quantity = 1,
  variant = null,
  iconOnly = false,
  className,
  size = "default",
  disabled = false,
}: AddToCartButtonProps) {
  const { addItem } = useCart();

  return (
    <Button
      type="button"
      size={size}
      className={className}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        addItem(toCartItem(product, { quantity, variant }));
      }}
    >
      {iconOnly ? (
        <ShoppingBag className="h-3.5 w-3.5 md:h-4 md:w-4" />
      ) : (
        <>
          <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
          Add
        </>
      )}
    </Button>
  );
}
