"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/WishlistButton";
import type { Product } from "@/types/product";
import { getProductCategoryLabel, getProductOldPrice, getProductTitle } from "@/lib/normalizers/product";
import { ProductImageUnavailable } from "@/components/product/ProductImageUnavailable";

export type { Product } from "@/types/product";

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function getBadgeColor(text: string) {
  const lower = text.toLowerCase();
  if (lower === "trending") return "bg-[#009E49] text-white";
  if (lower === "best seller") return "bg-[#FF6B00] text-white";
  if (lower === "hot") return "bg-zinc-900 text-white";
  return "bg-zinc-900 text-white";
}

export function ProductCard({ product }: { product: Product }) {
  const displayTitle = getProductTitle(product);
  const displayCategory = getProductCategoryLabel(product);
  const displayOldPrice = getProductOldPrice(product);
  const displayBadge = product.badge ?? (product.isNew ? "New" : null);
  const productHref = `/product/${product.slug}`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      <div className="p-2 pb-0">
        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-zinc-50">
          {displayBadge ? (
            <Badge className={`absolute left-2 top-2 z-10 border-none px-2.5 py-0.5 text-[10px] font-bold shadow-sm ${getBadgeColor(displayBadge)}`}>
              {displayBadge}
            </Badge>
          ) : null}

          <WishlistButton
            product={product}
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 shadow-sm transition-colors hover:border-red-200 hover:text-red-500"
            iconClassName="h-3.5 w-3.5"
          />

          <Link href={productHref} className="absolute inset-2 block">
            {product.image === "/file.svg" ? (
              <ProductImageUnavailable className="rounded-xl" />
            ) : (
              <div className="h-full w-full bg-cover bg-center bg-no-repeat transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url('${product.image}')` }} />
            )}
          </Link>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4 pt-3">
        {displayCategory ? (
          <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#009E49] md:text-[10px]">
            {displayCategory}
          </span>
        ) : null}

        <Link
          href={productHref}
          className="line-clamp-2 min-h-9.5 text-xs font-bold leading-tight text-zinc-900 transition-colors hover:text-[#009E49] md:text-[13px]"
        >
          {displayTitle}
        </Link>

        <div className="mb-3 mt-1.5 flex items-center gap-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-[11px] font-bold text-zinc-900 md:text-xs">{product.rating}</span>
          <span className="text-[10px] font-medium text-zinc-400">({product.reviews})</span>
        </div>

        <div className="mt-auto flex items-end justify-between pt-1">
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-tight text-zinc-900 md:text-xl">
              {formatCurrency(product.price)}
            </span>
            {displayOldPrice ? (
              <span className="text-[10px] font-bold text-zinc-400 line-through">
                {formatCurrency(displayOldPrice)}
              </span>
            ) : null}
          </div>

          <AddToCartButton
            product={product}
            iconOnly
            size="icon"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-[#009E49] hover:text-white md:h-9 md:w-9"
          />
        </div>
      </div>
    </div>
  );
}
