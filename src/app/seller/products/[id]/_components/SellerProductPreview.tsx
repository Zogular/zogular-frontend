"use client";

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
  onBack,
}: {
  product: SellerProductListing;
  onDuplicate: () => void;
  onEdit: () => void;
  onSubmit: () => void;
  onUnpublish: () => void;
  onWithdraw: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto min-w-0 max-w-[1400px] space-y-6 pb-28 md:pb-24">
      {/* 1. Header Area */}
      <div className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-[#f4fbf6]/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-2xl md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <Button onClick={onBack} aria-label="Back to products" type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-2xl border border-white/70 bg-white/80 shadow-sm transition-all hover:bg-white hover:shadow-md md:h-10 md:w-10">
            <ArrowLeft className="h-4 w-4 md:h-4 md:w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#009E49] md:text-[10px]">Product Preview</p>
              <SellerProductStatusBadge status={product.status} />
            </div>
            <h1 className="wrap-break-word pr-2 text-xl font-black tracking-tight text-zinc-950 md:text-3xl">{product.title}</h1>
          </div>
        </div>
        
        {/* Desktop Actions */}
        <div className="hidden shrink-0 lg:block">
          <SellerProductActionBar
            product={product}
            onDuplicate={onDuplicate}
            onEdit={onEdit}
            onSubmit={onSubmit}
            onUnpublish={onUnpublish}
            onWithdraw={onWithdraw}
            horizontal
          />
        </div>
      </div>

      <div className="hidden md:block">
        <SellerProductStatusBanner product={product} />
      </div>

      {/* 2. Main Content Grid */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[400px_minmax(0,1fr)_340px] xl:grid-cols-[440px_minmax(0,1fr)_340px]">
        
        {/* Left Column: Media */}
        <div className="min-w-0 space-y-6 lg:sticky lg:top-32 lg:self-start">
          <div className="-mx-4 md:mx-0">
            <SellerProductGallery product={product} />
          </div>
          <div className="md:hidden">
            <SellerProductStatusBanner product={product} />
          </div>
        </div>

        {/* Center Column: Description & Specs */}
        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-8">
            <h2 className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Description</h2>
            <div className="prose prose-sm prose-zinc max-w-none font-medium leading-relaxed text-zinc-700">
              {product.description ? (
                <p>{product.description}</p>
              ) : (
                <p className="italic text-zinc-400">No description provided.</p>
              )}
            </div>
          </section>
          
          <SellerProductSpecs product={product} />
        </div>

        {/* Right Column: Meta & Snapshot */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-32 lg:self-start">
          {/* Tablet Actions (Between Mobile and Desktop) */}
          <div className="hidden md:block lg:hidden">
            <SellerProductActionBar
              product={product}
              onDuplicate={onDuplicate}
              onEdit={onEdit}
              onSubmit={onSubmit}
              onUnpublish={onUnpublish}
              onWithdraw={onWithdraw}
              horizontal
            />
          </div>
          <SellerProductInfoGrid product={product} />
        </aside>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/50 bg-white/95 p-4 pb-safe shadow-[0_-15px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl md:hidden">
        <SellerProductActionBar
          product={product}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
          onSubmit={onSubmit}
          onUnpublish={onUnpublish}
          onWithdraw={onWithdraw}
          horizontal
        />
      </div>
    </div>
  );
}
