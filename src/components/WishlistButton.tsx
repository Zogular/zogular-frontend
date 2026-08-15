"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuthSession } from "@/hooks/use-auth-session";
import { appendNextPath } from "@/services/auth-intent";
import type { Product } from "@/types/product";

type WishlistButtonProps = {
  product: Product;
  className?: string;
  iconClassName?: string;
};

export function WishlistButton({
  product,
  className,
  iconClassName,
}: WishlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname() || `/product/${product.slug}`;
  const auth = useAuthSession();
  const { toggleItem, hasItem, hasHydrated } = useWishlist();

  const isSaved = auth.status === "authenticated" && hasHydrated ? hasItem(product.id) : false;
  const heartAriaLabel = hasHydrated && isSaved ? "Remove from wishlist" : "Add to wishlist";

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (auth.status !== "authenticated") {
          if (auth.status === "guest") {
            router.push(appendNextPath("/auth/login", pathname));
          }
          return;
        }
        toggleItem(product);
      }}
      disabled={auth.status === "loading"}
      className={cn(className)}
      aria-label={heartAriaLabel}
    >
      <Heart
        className={cn(
          iconClassName,
          isSaved ? "fill-red-500 text-red-500" : "",
        )}
      />
    </button>
  );
}
