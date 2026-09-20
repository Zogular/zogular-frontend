/**
 * @file ProductsListGrid.tsx
 * @module features/admin-products/sections
 * @description
 * High visual clarity grid presentation for the Admin Product Moderation Queue.
 * Renders product image banners, seller badges, pricing, category metrics, and quick moderation actions.
 * Integrates container-aware scroll restoration via `rememberListScroll` on review navigation links.
 */

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ImageIcon, Package, ShieldAlert, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rememberListScroll } from "@/hooks/use-list-scroll-restoration";
import {
  formatCurrency,
  formatDate,
  STATUS_UI,
} from "../lib/product-moderation.utils";
import type { AdminProductRecord } from "../types/admin-product.types";

export interface ProductsListGridProps {
  products: AdminProductRecord[];
  selectedProductIds: string[];
  onToggleSelect: (id: string) => void;
  onQuickApprove: (product: AdminProductRecord) => void;
  onOpenDialog: (action: "reject" | "request_changes", product: AdminProductRecord) => void;
  canModerate: boolean;
  isSubmitting: boolean;
  isLoading?: boolean;
}

export function ProductsListGrid({
  products,
  selectedProductIds,
  onToggleSelect,
  onQuickApprove,
  onOpenDialog,
  canModerate,
  isSubmitting,
  isLoading,
}: ProductsListGridProps) {
  if (products.length === 0 && !isLoading) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border border-dashed border-[color-mix(in_srgb,var(--admin-copper-muted)_40%,transparent)] bg-[var(--admin-surface-cream)] p-6 text-center shadow-[inset_0_2px_12px_rgb(6_59_41_/_2%)]">
        <Package className="mb-3 size-10 text-[var(--admin-copper-muted)]" />
        <h3 className="text-sm font-black text-[var(--admin-ink)]">No products found</h3>
        <p className="mt-1 max-w-sm text-xs font-semibold text-[var(--admin-ink-soft)]">
          No products match your active search query, category, or status filter.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Product moderation grid view"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
    >
      {products.map((product) => {
        const isSelected = selectedProductIds.includes(product.sellerProductId);
        const statusConfig = STATUS_UI[product.status] || STATUS_UI.draft;

        return (
          <article
            key={product.sellerProductId}
            className={`flex flex-col overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_25%,transparent)] bg-[var(--admin-surface-cream)] shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md ${
              isSelected ? "ring-2 ring-[var(--admin-canopy)]" : ""
            }`}
          >
            {/* Top Bar: Image & Checkbox overlay */}
            <div className="relative aspect-square w-full overflow-hidden bg-[var(--admin-surface-mist)]">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                  className="object-cover transition-transform duration-300 hover:scale-105"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-zinc-300">
                  <ImageIcon className="size-8" />
                </div>
              )}

              {/* Selection Checkbox Overlay */}
              <div className="absolute left-2 top-2 z-10">
                <input
                  type="checkbox"
                  aria-label={`Select ${product.name}`}
                  checked={isSelected}
                  onChange={() => onToggleSelect(product.sellerProductId)}
                  className="size-4 rounded border-white/80 bg-white/90 accent-[var(--admin-canopy)] shadow-sm cursor-pointer"
                />
              </div>

              {/* Status Badge Overlay */}
              <div className="absolute right-2 top-2 z-10">
                <span
                  className={`inline-flex rounded-md border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-xs ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>

            {/* Card Content Body */}
            <div className="flex flex-1 flex-col p-2.5">
              {/* Product Title - 11px font-black line-clamp-1 */}
              <Link
                href={`/admin/products/${product.sellerProductId}`}
                prefetch={false}
                onClick={() =>
                  rememberListScroll(window.location.pathname + window.location.search)
                }
                title={product.name}
                className="line-clamp-1 text-[11px] font-black text-[var(--admin-canopy-deep)] hover:underline"
              >
                {product.name}
              </Link>

              {/* Store & Category */}
              <div className="mt-1 flex items-center justify-between gap-1 text-[10px] font-semibold text-[var(--admin-ink-soft)]">
                <span className="flex items-center gap-1 truncate">
                  <Store className="size-2.5 shrink-0" />
                  <span className="truncate">{product.sellerStore}</span>
                </span>
                <span className="shrink-0 rounded bg-[var(--admin-surface-mist)] px-1 py-0.2 text-[9px] font-bold text-[var(--admin-ink)]">
                  {product.categoryName}
                </span>
              </div>

              {/* Price & Stock info */}
              <div className="mt-2 flex items-baseline justify-between border-t border-[var(--admin-copper-muted)]/15 pt-1.5">
                <div>
                  <p className="text-[12px] font-black text-[var(--admin-ink)]">
                    {formatCurrency(product.price)}
                  </p>
                  <p className="text-[9px] font-semibold text-[var(--admin-ink-soft)]">
                    {product.stock} in stock
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold text-[var(--admin-ink-soft)]">Submitted</p>
                  <p className="text-[9px] font-bold text-[var(--admin-ink)]">
                    {formatDate(product.submittedAt)}
                  </p>
                </div>
              </div>

              {/* Moderation Signals */}
              {product.flags > 0 && (
                <div className="mt-1.5 flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-[var(--admin-ember)]">
                  <ShieldAlert className="size-2.5 shrink-0" />
                  <span>{product.flags} flag{product.flags > 1 ? "s" : ""}</span>
                </div>
              )}

              {/* Footer Action Buttons - Compact low-height h-7 */}
              <div className="mt-auto pt-2">
                <div className="grid grid-cols-2 gap-1">
                  <Link
                    href={`/admin/products/${product.sellerProductId}`}
                    prefetch={false}
                    onClick={() =>
                      rememberListScroll(window.location.pathname + window.location.search)
                    }
                    className="flex h-7 items-center justify-center rounded-md border border-[var(--admin-copper-muted)]/30 bg-[var(--admin-surface-mist)] px-2 text-[10px] font-bold text-[var(--admin-ink)] hover:bg-[var(--admin-surface-cream)]"
                  >
                    {product.status === "pending_review" ? "Review" : "View"}
                  </Link>

                  {product.status === "pending_review" && canModerate ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSubmitting}
                      onClick={() => onQuickApprove(product)}
                      className="h-7 rounded-md bg-[var(--admin-canopy)] px-2 text-[10px] font-black text-white hover:bg-[var(--admin-canopy-deep)]"
                    >
                      Approve
                    </Button>
                  ) : (
                    <div className="flex h-7 items-center justify-center rounded-md bg-[var(--admin-surface-mist)] px-1 text-[9px] font-bold text-[var(--admin-ink-soft)]">
                      {statusConfig.label}
                    </div>
                  )}
                </div>

                {product.status === "pending_review" && canModerate && (
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSubmitting}
                      onClick={() => onOpenDialog("request_changes", product)}
                      className="h-7 rounded-md border-[var(--admin-copper-muted)]/30 bg-[var(--admin-surface-mist)] px-1.5 text-[10px] font-bold text-amber-800 hover:bg-amber-50"
                    >
                      Changes
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isSubmitting}
                      onClick={() => onOpenDialog("reject", product)}
                      className="h-7 rounded-md bg-[var(--admin-ember)] px-1.5 text-[10px] font-black text-white hover:bg-rose-800"
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
