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

interface SellerProductListRowProps {
  product: SellerProductListing;
  actions: SellerProductActions;
}

export function SellerProductListRow({ product, actions }: SellerProductListRowProps) {
  const stockState = getSellerProductStockState(product);
  const moderationNote = product.moderation?.moderationNotes;

  return (
    <article className="flex min-h-24 min-w-0 items-center border-b border-zinc-100 bg-white p-2 last:border-b-0 hover:bg-zinc-50/70 xl:min-h-18 xl:px-4 xl:py-2">
      <button
        type="button"
        onClick={() => actions.view(product)}
        className="grid min-w-0 flex-1 grid-cols-[60px_minmax(0,1fr)] items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 xl:grid-cols-[64px_minmax(0,1fr)_112px_96px_128px] xl:gap-4"
        aria-label={`View ${product.title}`}
      >
        <div className="relative h-20 w-15 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 xl:h-16 xl:w-12">
          {product.images[0]?.url ? (
            <Image src={product.images[0].url} alt={product.title} fill sizes="60px" unoptimized className="object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center"><ImageIcon className="h-5 w-5 text-zinc-300" aria-hidden="true" /></div>
          )}
        </div>

        <div className="min-w-0 self-stretch py-0.5 xl:self-auto xl:py-0">
          <h2 className="line-clamp-2 text-[13px] font-bold leading-4.5 text-zinc-950 xl:line-clamp-1 xl:text-sm">{product.title}</h2>
          <p className="mt-1 text-sm font-black text-zinc-950 xl:hidden">{formatSellerProductPrice(product)}</p>
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 xl:hidden">
            <span className={cn("truncate text-[10px] font-bold", stockState === "out-of-stock" ? "text-red-600" : stockState === "low-stock" ? "text-amber-700" : "text-zinc-500")}>
              {getSellerProductStockLabel(product)}
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-300" />
            <SellerProductStatusBadge status={product.status} compact />
          </div>
          <p className="mt-1 hidden truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-400 xl:block">
            {product.brand || "Unbranded"} · {product.categoryName}
          </p>
          {moderationNote && (product.status === "needs_changes" || product.status === "rejected") ? (
            <p className="mt-1 hidden truncate text-[10px] font-semibold text-orange-700 xl:block" title={moderationNote}>{moderationNote}</p>
          ) : null}
        </div>

        <p className="hidden text-sm font-black text-zinc-950 xl:block">{formatSellerProductPrice(product)}</p>
        <p className={cn("hidden text-xs font-bold xl:block", stockState === "out-of-stock" ? "text-red-600" : stockState === "low-stock" ? "text-amber-700" : "text-zinc-600")}>
          {getSellerProductStockLabel(product)}
        </p>
        <div className="hidden xl:block"><SellerProductStatusBadge status={product.status} /></div>
      </button>
      <div className="ml-1 shrink-0">
        <SellerProductActionMenu product={product} actions={actions} />
      </div>
    </article>
  );
}
