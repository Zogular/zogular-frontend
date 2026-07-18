"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { SellerProductListing } from "@/services/seller-catalog";
import { cn } from "@/lib/utils";
import { SellerProductActionMenu } from "@/features/seller-products/seller-product-action-menu";
import { SellerProductStatusBadge } from "@/features/seller-products/seller-product-status-badge";
import {
  formatSellerProductPrice,
  getSellerProductStockLabel,
  getSellerProductStockState,
} from "@/features/seller-products/product-presentation";
import type { SellerProductActions } from "@/features/seller-products/types";

interface SellerProductGridCardProps {
  product: SellerProductListing;
  actions: SellerProductActions;
}

export function SellerProductGridCard({ product, actions }: SellerProductGridCardProps) {
  const stockState = getSellerProductStockState(product);

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => actions.view(product)}
        className="relative block aspect-[3/4] w-full overflow-hidden bg-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#009E49]"
        aria-label={`View ${product.title}`}
      >
        {product.images[0]?.url ? (
          <Image
            src={product.images[0].url}
            alt={product.title}
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 1279px) 33vw, 25vw"
            unoptimized
            className="object-contain transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center"><ImageIcon className="h-7 w-7 text-zinc-300" aria-hidden="true" /></div>
        )}
      </button>

      <div className="absolute left-1.5 top-1.5 max-w-[calc(100%-3rem)]"><SellerProductStatusBadge status={product.status} compact /></div>
      <div className="absolute right-1 top-1 rounded-lg bg-white/95 shadow-sm backdrop-blur-sm">
        <SellerProductActionMenu product={product} actions={actions} className="h-8 w-8 rounded-lg text-zinc-700 hover:bg-white" />
      </div>

      <button
        type="button"
        onClick={() => actions.view(product)}
        className="block w-full min-w-0 p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#009E49]"
      >
        <h2 className="line-clamp-2 min-h-9 text-xs font-bold leading-4.5 text-zinc-950 sm:text-[13px]">{product.title}</h2>
        <p className="mt-1.5 text-sm font-black text-zinc-950">{formatSellerProductPrice(product)}</p>
        <p className={cn("mt-1 truncate text-[10px] font-bold", stockState === "out-of-stock" ? "text-red-600" : stockState === "low-stock" ? "text-amber-700" : "text-zinc-500")}>
          {getSellerProductStockLabel(product)}
        </p>
      </button>
    </article>
  );
}
