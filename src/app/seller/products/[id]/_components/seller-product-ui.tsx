"use client";

import Image from "next/image";
import { Box, CheckCircle2, FileText, Info, Layers3, MessageSquareWarning, PackageCheck, ShieldAlert, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSellerProductModerationStatusLabel,
  isSellerProductApprovedStatus,
  isSellerProductBuyerVisibleStatus,
  isSellerProductNeedsChangesStatus,
  isSellerProductPublishedStatus,
} from "@/services/product-moderation";
import type { SellerProductListing, SellerProductStatus } from "@/services/seller-catalog";

export function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

export function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-ZM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function statusTone(status: SellerProductStatus) {
  if (status === "published") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "approved") return "border-teal-200 bg-teal-50 text-teal-700";
  if (status === "paused") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "pending_review") return "border-blue-200 bg-blue-50 text-blue-700";
  if (isSellerProductNeedsChangesStatus(status)) return "border-red-200 bg-red-50 text-red-700";
  if (status === "suspended") return "border-red-200 bg-red-100 text-red-700";
  return "border-zinc-200 bg-zinc-100 text-zinc-700";
}

export function SellerProductStatusBadge({ status }: { status: SellerProductStatus }) {
  return (
    <span className={`inline-flex rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${statusTone(status)}`}>
      {getSellerProductModerationStatusLabel(status)}
    </span>
  );
}

export function GlassPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/80 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-6">
      <h2 className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

export function SellerProductStatusBanner({ product }: { product: SellerProductListing }) {
  if (product.status === "pending_review") {
    return (
      <div className="rounded-3xl border border-blue-200 bg-blue-50/90 p-4 text-blue-900 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-black"><Info className="h-4 w-4" /> Under Review</p>
        <p className="mt-1 text-xs font-semibold leading-6 text-blue-800">This submission is locked while admin reviews the exact version you submitted.</p>
      </div>
    );
  }

  if (isSellerProductNeedsChangesStatus(product.status)) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50/90 p-4 text-red-900 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-black"><MessageSquareWarning className="h-4 w-4" /> Review Feedback Required</p>
        <p className="mt-1 text-xs font-semibold leading-6 text-red-800">{product.moderation?.moderationNotes || "Admin requested changes before review can continue."}</p>
      </div>
    );
  }

  if (isSellerProductPublishedStatus(product.status)) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-900 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-black"><CheckCircle2 className="h-4 w-4" /> Listing Published</p>
        <p className="mt-1 text-xs font-semibold leading-6 text-emerald-800">This product is currently live to buyers while it stays published and your seller account remains eligible.</p>
      </div>
    );
  }

  if (isSellerProductApprovedStatus(product.status)) {
    return (
      <div className="rounded-3xl border border-teal-200 bg-teal-50/90 p-4 text-teal-900 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-black"><CheckCircle2 className="h-4 w-4" /> Approved By Moderation</p>
        <p className="mt-1 text-xs font-semibold leading-6 text-teal-800">Moderation approved this listing, and it is currently buyer-visible while it remains approved and your seller account stays eligible.</p>
      </div>
    );
  }

  if (product.status === "paused") {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-black"><Info className="h-4 w-4" /> Listing Paused</p>
        <p className="mt-1 text-xs font-semibold leading-6 text-amber-800">This listing is hidden from buyers but keeps its approval history.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/80 p-4 text-zinc-700 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-black"><FileText className="h-4 w-4" /> Draft Preview</p>
      <p className="mt-1 text-xs font-semibold leading-6 text-zinc-500">This listing stays private until it is submitted for review and approved by moderation.</p>
    </div>
  );
}

export function SellerProductGallery({ product }: { product: SellerProductListing }) {
  const primary = product.images.find((image) => image.isPrimary) ?? product.images[0];

  return (
    <section className="min-w-0 overflow-hidden border-y border-white/70 bg-white/80 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:rounded-3xl md:border-x">
      <div className="relative aspect-[3/4] max-h-[600px] w-full bg-zinc-100">
        {primary ? <Image src={primary.url} alt={product.title} fill sizes="(max-width: 768px) 100vw, 760px" unoptimized className="object-contain" /> : null}
      </div>
      {product.images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto p-3">
          {product.images.map((image) => (
            <div key={image.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
              <Image src={image.url} alt={image.name} fill sizes="64px" unoptimized className="object-cover" />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function SellerProductInfoGrid({ product }: { product: SellerProductListing }) {
  const rows = [
    { label: "Category", value: `${product.categoryName} > ${product.subcategoryName}`, icon: Layers3 },
    { label: "Price", value: formatCurrency(product.price), icon: PackageCheck },
    { label: "Sale Price", value: product.salePrice ? formatCurrency(product.salePrice) : "None", icon: PackageCheck },
    { label: "Stock", value: String(product.stock), icon: Box },
    { label: "SKU", value: product.sku, icon: FileText },
    { label: "Updated", value: formatDate(product.updatedAt), icon: CheckCircle2 },
    { label: "Submitted for Review", value: formatDate(product.moderation?.submittedAt), icon: ShieldAlert },
    { label: "Weight", value: `${product.logistics.weightKG} kg`, icon: Truck },
  ];

  return (
    <GlassPanel title="Listing Snapshot">
      <div className="grid gap-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white/70 p-3 text-sm">
              <span className="flex shrink-0 items-center gap-2 font-semibold text-zinc-500"><Icon className="h-4 w-4 shrink-0" /> {row.label}</span>
              <strong className="min-w-0 wrap-break-word text-right font-black text-zinc-950 max-w-[60%]">{row.value}</strong>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

export function SellerProductSpecs({ product }: { product: SellerProductListing }) {
  const attributes = product.attributes ?? [];

  return (
    <div className="space-y-5">
      <GlassPanel title="Highlights">
        <SpecGrid items={product.specifications} empty="No highlights or manual specifications added." />
      </GlassPanel>

      <GlassPanel title="Dynamic Category Attributes">
        <SpecGrid items={attributes.map((attribute) => ({ name: attribute.name, value: attribute.value }))} empty="No category details were added for this product." />
      </GlassPanel>

      <GlassPanel title="Variants">
        <div className="grid gap-2">
          {product.variants.length ? product.variants.map((variant) => (
            <div key={variant.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white/70 p-3">
              <div className="min-w-0 shrink-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{variant.label}</p>
                <p className="mt-0.5 text-sm font-bold text-zinc-950">{variant.value}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-[11px] font-semibold text-zinc-500">SKU {variant.sku}</p>
                <p className="mt-0.5 text-xs font-black text-zinc-900">Stock {variant.stock}</p>
              </div>
            </div>
          )) : <p className="text-sm font-semibold text-zinc-500">No variants configured.</p>}
        </div>
      </GlassPanel>

      <GlassPanel title="Logistics">
        <div className="grid gap-2">
          <SpecTile label="Delivery" value={product.deliveryType} />
          <SpecTile label="Weight" value={`${product.logistics.weightKG} kg`} />
          <SpecTile label="Dimensions" value={product.logistics.dimensions} />
        </div>
      </GlassPanel>
    </div>
  );
}

function SpecGrid({ items, empty }: { items: Array<{ name: string; value: string }>; empty: string }) {
  if (!items.length) return <p className="text-sm font-semibold text-zinc-500">{empty}</p>;
  return (
    <div className="grid gap-2">
      {items.map((item, index) => <SpecTile key={`${item.name}-${item.value}-${index}`} label={item.name} value={item.value} />)}
    </div>
  );
}

function SpecTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white/70 p-3">
      <p className="shrink-0 text-xs font-black uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="min-w-0 wrap-break-word text-right text-sm font-bold capitalize text-zinc-950">{value}</p>
    </div>
  );
}

export function SellerProductActionBar({
  product,
  onEdit,
  onSubmit,
  onWithdraw,
  onUnpublish,
  onDuplicate,
  horizontal,
}: {
  product: SellerProductListing;
  onEdit: () => void;
  onSubmit: () => void;
  onWithdraw: () => void;
  onUnpublish: () => void;
  onDuplicate: () => void;
  horizontal?: boolean;
}) {
  const actions: Array<{
    key: string;
    label: string;
    onClick: () => void;
    variant?: "default" | "outline";
    tone?: "default" | "warning" | "success";
  }> = [];

  if (product.status !== "pending_review" && product.status !== "suspended" && !isSellerProductNeedsChangesStatus(product.status)) {
    actions.push({ key: "edit", label: "Edit Product", onClick: onEdit, variant: "outline" });
  }

  if (product.status === "pending_review") {
    actions.push({ key: "withdraw", label: "Withdraw Review", onClick: onWithdraw, variant: "outline", tone: "warning" });
  }

  if (product.status === "draft") {
    actions.push({ key: "submit", label: "Submit for Review", onClick: onSubmit, tone: "success" });
  }

  if (isSellerProductNeedsChangesStatus(product.status)) {
    actions.push({ key: "edit_feedback", label: "Edit After Feedback", onClick: onEdit, tone: "success" });
  }

  if (isSellerProductBuyerVisibleStatus(product.status)) {
    actions.push({
      key: "unpublish",
      label: "Pause Listing",
      onClick: onUnpublish,
      variant: "outline",
      tone: "warning",
    });
    actions.push({ key: "duplicate", label: "Duplicate", onClick: onDuplicate, variant: "outline" });
  }

  if (product.status === "paused") {
    actions.push({ key: "duplicate", label: "Duplicate", onClick: onDuplicate, variant: "outline" });
  }

  if (!actions.length) return null;

  const content = (
    <div className={`flex ${horizontal ? "flex-row flex-wrap items-center gap-3" : "flex-col gap-2"}`}>
      {actions.map((action) => (
        <Button
          key={action.key}
          type="button"
          variant={action.variant ?? "default"}
          onClick={action.onClick}
          className={`h-11 rounded-xl font-bold transition-all ${
            horizontal ? "px-6 flex-1 md:flex-none" : "w-full justify-center px-3"
          } ${
            action.variant === "outline"
              ? action.tone === "warning"
                ? "text-amber-700 hover:bg-amber-50"
                : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              : action.tone === "success"
                ? "bg-[#009E49] text-white hover:bg-[#00853d] shadow-[0_4px_15px_rgba(0,158,73,0.2)] hover:scale-105"
                : ""
          }`}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );

  if (horizontal) return content;
  return <GlassPanel title="Seller Actions">{content}</GlassPanel>;
}
