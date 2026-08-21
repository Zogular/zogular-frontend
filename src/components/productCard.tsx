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
import { ProductBadge } from "@/components/product/ProductBadge";

export type { Product } from "@/types/product";

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

type ProductCardProps = {
  product: Product;
  prioritizeImage?: boolean;
};

export function ProductCard({ product, prioritizeImage = false }: ProductCardProps) {
  const displayTitle = getProductTitle(product);
  const displayCategory = getProductCategoryLabel(product);
  const displayOldPrice = getProductOldPrice(product);
  const displayBadge = product.badge ?? (product.isNew ? "New" : null);
  const productHref = `/product/${product.slug}`;
  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const isPending = product.moderationStatus === "pending";
  const isRejected = product.moderationStatus === "rejected";
  const isHidden = product.sellerVisibility === "hidden";
  const disabledReason = isOutOfStock
    ? "Out of stock"
    : isPending || isRejected || isHidden
      ? "Product unavailable"
      : undefined;

  return (
    <article
      className="group relative flex w-full min-w-0 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)] [contain:inline-size] transition-shadow duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
      data-testid="product-card"
    >
      <div
        className={`relative flex aspect-[3/4] w-full items-center justify-center bg-zinc-100 ${isHidden ? "opacity-50" : ""}`}
        data-testid="product-card-media"
      >
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {displayBadge && !isOutOfStock ? (
            <ProductBadge label={displayBadge} />
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
          className="absolute right-0.5 top-0.5 z-10 isolate flex h-11 w-11 items-center justify-center rounded-full bg-transparent text-zinc-700 outline-none before:absolute before:inset-1.5 before:rounded-full before:border before:border-white before:bg-white/95 before:shadow-sm before:transition-colors hover:before:bg-white focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-1"
          iconClassName="relative z-10 h-4 w-4"
        />

        <Link
          href={productHref}
          prefetch={false}
          aria-label={`View ${displayTitle}`}
          className="absolute inset-0 block rounded-t-[20px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#009E49]"
        >
          {!product.image || product.image === "/file.svg" ? (
            <ProductImageUnavailable className="h-full w-full" />
          ) : (
            <Image
              src={product.image}
              alt={product.imageAlt?.trim() || displayTitle}
              fill
              loading={prioritizeImage ? "eager" : "lazy"}
              fetchPriority={prioritizeImage ? "high" : "auto"}
              sizes="(max-width: 639px) calc(50vw - 24px), (max-width: 1023px) 31vw, (max-width: 1279px) 23vw, 220px"
              className="object-contain p-3 sm:p-4"
            />
          )}
        </Link>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
        <div className="mb-1 flex min-h-4 items-center justify-between gap-2">
          {displayCategory ? (
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#009E49] md:text-[10px]">
                {displayCategory}
              </span>
          ) : null}
          {product.storeName ? (
              <span className="max-w-[50%] truncate text-[9px] font-medium text-zinc-500 md:text-[10px]">
                {product.storeName}
              </span>
          ) : null}
        </div>

        <Link
          href={productHref}
          prefetch={false}
          className="line-clamp-2 min-h-8 rounded-sm text-xs font-bold leading-4 text-zinc-900 outline-none transition-colors hover:text-[#009E49] focus-visible:ring-2 focus-visible:ring-[#009E49] md:text-[13px]"
        >
          {displayTitle}
        </Link>

        <div className="mb-2 mt-1 flex min-h-4 items-center gap-1">
          {Number.isInteger(product.reviews) && product.reviews > 0 && Number.isFinite(product.rating) && product.rating > 0 && product.rating <= 5 ? (
            <>
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-zinc-900 md:text-xs">{product.rating}</span>
              <span className="text-[10px] font-medium text-zinc-400">({product.reviews})</span>
            </>
          ) : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
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
            disabled={Boolean(disabledReason)}
            disabledReason={disabledReason}
            className="relative isolate flex h-11 w-11 items-center justify-center rounded-full bg-transparent p-0 text-zinc-900 outline-none before:absolute before:inset-1.5 before:rounded-full before:bg-zinc-100 before:transition-colors hover:text-white hover:before:bg-[#009E49] focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-1 disabled:text-zinc-500 disabled:before:bg-zinc-100 disabled:hover:text-zinc-500"
          />
        </div>
      </div>
    </article>
  );
}
