"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerProductListing } from "@/services/seller-catalog";
import {
  SellerProductActionBar,
  SellerProductGallery,
  SellerProductInfoGrid,
  SellerProductSpecs,
  SellerProductStatusBadge,
  SellerProductStatusBanner,
} from "./seller-product-ui";

export function SellerProductPreview({
  product,
  onDuplicate,
  onEdit,
  onSubmit,
  onUnpublish,
  onWithdraw,
}: {
  product: SellerProductListing;
  onDuplicate: () => void;
  onEdit: () => void;
  onSubmit: () => void;
  onUnpublish: () => void;
  onWithdraw: () => void;
}) {
  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-5 overflow-x-hidden pb-24">
      <div className="-mx-4 flex items-center justify-between border-b border-white/60 bg-[#f4fbf6]/90 px-4 py-4 backdrop-blur-2xl md:sticky md:top-24 md:z-20 md:mx-0 md:border-none md:bg-transparent md:px-0">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/seller/products">
            <Button aria-label="Back to products" type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-white/70 bg-white/80 shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#009E49]">Seller Product Preview</p>
            <h1 className="wrap-break-word pr-2 text-xl font-black leading-tight text-zinc-950 md:text-2xl">{product.title}</h1>
          </div>
        </div>
        <span className="hidden md:inline-flex"><SellerProductStatusBadge status={product.status} /></span>
      </div>

      <SellerProductStatusBanner product={product} />

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <SellerProductGallery product={product} />
          <section className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SellerProductStatusBadge status={product.status} />
              <span className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500">{product.id}</span>
            </div>
            <h2 className="wrap-break-word text-2xl font-black tracking-tight text-zinc-950">{product.title}</h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-zinc-600">{product.description || "No description added yet."}</p>
          </section>
          <SellerProductSpecs product={product} />
        </div>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <SellerProductActionBar
            product={product}
            onDuplicate={onDuplicate}
            onEdit={onEdit}
            onSubmit={onSubmit}
            onUnpublish={onUnpublish}
            onWithdraw={onWithdraw}
          />
          <SellerProductInfoGrid product={product} />
        </aside>
      </div>
    </div>
  );
}
