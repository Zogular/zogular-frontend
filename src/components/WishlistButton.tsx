"use client";

import { AlertCircle, Heart, Loader2 } from "lucide-react";
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
  const { toggleItem, hasItem, hasHydrated, getItemMutationState, syncBackend } = useWishlist();

  const mutationState = auth.status === "authenticated" ? getItemMutationState(product.id) : null;
  const isSaved = auth.status === "authenticated" && hasHydrated
    ? mutationState?.confirmedPresent ?? hasItem(product.id)
    : false;
  const heartAriaLabel = mutationState?.status === "pending"
    ? mutationState.desiredPresent ? "Saving to wishlist" : "Removing from wishlist"
    : mutationState?.status === "error"
      ? "Wishlist update failed. Retry"
      : hasHydrated && isSaved ? "Remove from wishlist" : "Add to wishlist";

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
        if (mutationState?.status === "error") {
          void syncBackend();
          return;
        }
        toggleItem(product);
      }}
      disabled={auth.status === "loading" || auth.status === "verifying" || auth.status === "unavailable"}
      className={cn(className)}
      aria-label={heartAriaLabel}
      aria-pressed={isSaved}
    >
      {mutationState?.status === "pending" ? (
        <Loader2 className={cn(iconClassName, "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
      ) : mutationState?.status === "error" ? (
        <AlertCircle className={cn(iconClassName, "text-amber-600")} aria-hidden="true" />
      ) : (
        <Heart
          className={cn(
            iconClassName,
            isSaved ? "fill-red-500 text-red-500" : "",
          )}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
