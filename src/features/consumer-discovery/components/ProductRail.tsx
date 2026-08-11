"use client";

import type { KeyboardEvent } from "react";
import { ProductCard } from "@/components/productCard";
import type { Product } from "@/types/product";
import { getUniqueDiscoveryProducts } from "@/features/consumer-discovery/lib/discovery-outcomes";
import { cn } from "@/lib/utils";

type ProductRailProps = {
  products: readonly Product[];
  label: string;
  className?: string;
};

export function ProductRail({ products, label, className }: ProductRailProps) {
  const visibleProducts = getUniqueDiscoveryProducts(products);

  if (visibleProducts.length === 0) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const rail = event.currentTarget;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

    if (event.key === "Home" || event.key === "End") {
      rail.scrollTo({ left: event.key === "Home" ? 0 : rail.scrollWidth, behavior: "auto" });
      return;
    }

    const firstItem = rail.firstElementChild;
    const itemWidth = firstItem instanceof HTMLElement ? firstItem.getBoundingClientRect().width : 0;
    const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap) || 0;
    rail.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * (itemWidth + gap), behavior });
  }

  return (
    <ul
      aria-label={label}
      data-testid="discovery-product-rail"
      data-product-count={visibleProducts.length}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 [&::-webkit-scrollbar]:hidden",
        "md:gap-4 md:px-1 lg:[justify-content:safe_center]",
        className,
      )}
    >
      {visibleProducts.map((product) => (
        <li
          key={`${typeof product.id}:${String(product.id)}`}
          className="w-[148px] min-w-[148px] snap-start md:w-[216px] md:min-w-[216px]"
        >
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
