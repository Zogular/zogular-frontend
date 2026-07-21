"use client";

import Link from "next/link";
import Image from "next/image";
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
  if (lower.includes("discount") || lower.includes("sale") || lower.includes("off")) {
    return "bg-zinc-900/60 border border-white/20 backdrop-blur-md text-white";
  }
  if (lower.includes("new") || lower.includes("arrival")) {
    return "bg-emerald-700/60 border border-white/20 backdrop-blur-md text-white";
  }
  if (lower.includes("best deal") || lower.includes("value")) {
    return "bg-amber-600/60 border border-white/20 backdrop-blur-md text-white";
  }
  if (lower.includes("trending") || lower.includes("popular")) {
    return "bg-violet-600/60 border border-white/20 backdrop-blur-md text-white";
  }
  if (lower.includes("limited")) {
    return "bg-red-600/60 border border-white/20 backdrop-blur-md text-white";
  }
  return "bg-zinc-900/60 border border-white/20 backdrop-blur-md text-white";
}

export function ProductCard({ product }: { product: Product }) {
  const displayTitle = getProductTitle(product);
  const displayCategory = getProductCategoryLabel(product);
  const displayOldPrice = getProductOldPrice(product);
  const displayBadge = product.badge ?? (product.isNew ? "New" : null);
  const productHref = `/product/${product.slug}`;
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const isPending = product.moderationStatus === "pending";
  const isRejected = product.moderationStatus === "rejected";
  const isHidden = product.sellerVisibility === "hidden";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)] transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
        <div className={`relative flex aspect-[3/4] w-full items-center justify-center bg-zinc-50 ${isHidden ? "opacity-50" : ""}`}>
          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
            {displayBadge && !isOutOfStock ? (
              <Badge className={`px-2.5 py-0.5 text-[10px] font-bold shadow-sm ${getBadgeColor(displayBadge)}`}>
                {displayBadge}
              </Badge>
            ) : null}
            {isOutOfStock ? (
              <Badge className="border-none bg-red-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                Out of Stock
              </Badge>
            ) : null}
            {isPending ? (
              <Badge className="border-none bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                Pending
              </Badge>
            ) : null}
            {isRejected ? (
              <Badge className="border-none bg-red-800 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                Rejected
              </Badge>
            ) : null}
            {isHidden ? (
              <Badge className="border-none bg-zinc-700 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                Hidden
              </Badge>
            ) : null}
          </div>

          <WishlistButton
            product={product}
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-sm transition-colors hover:bg-white/30"
            iconClassName="h-3.5 w-3.5"
          />

          <Link href={productHref} className="absolute inset-0 block">
            {product.image === "/file.svg" || !product.image ? (
              <ProductImageUnavailable className="h-full w-full object-cover" />
            ) : (
              <Image
                src={product.image}
                alt={displayTitle}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            )}
          </Link>
        </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
        {displayCategory || product.storeName ? (
          <div className="mb-1 flex items-center justify-between">
            {displayCategory && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#009E49] md:text-[10px]">
                {displayCategory}
              </span>
            )}
            {product.storeName && (
              <span className="text-[9px] font-medium text-zinc-500 md:text-[10px] truncate max-w-[50%]">
                {product.storeName}
              </span>
            )}
          </div>
        ) : null}

        <Link
          href={productHref}
          className="line-clamp-2 text-xs font-bold leading-tight text-zinc-900 transition-colors hover:text-[#009E49] md:text-[13px]"
        >
          {displayTitle}
        </Link>

        <div className="mb-2 mt-1 flex items-center gap-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-[11px] font-bold text-zinc-900 md:text-xs">{product.rating}</span>
          <span className="text-[10px] font-medium text-zinc-400">({product.reviews})</span>
        </div>

        <div className="flex items-end justify-between">
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
            disabled={isOutOfStock || isPending || isRejected}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 transition-colors hover:bg-[#009E49] hover:text-white md:h-9 md:w-9 disabled:opacity-50 disabled:hover:bg-zinc-100 disabled:hover:text-zinc-900"
          />
        </div>
      </div>
    </div>
  );
}
