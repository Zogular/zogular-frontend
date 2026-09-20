/**
 * @file ProductsListTable.tsx
 * @module features/admin-products/sections
 * @description
 * Desktop table and mobile responsive card-list view for the Admin Product Moderation Queue.
 * Displays product image, title, store details, category, submitted date, price, stock,
 * and quick moderation triggers.
 * Integrates container-aware scroll restoration via `rememberListScroll` on review navigation links.
 */

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ImageIcon,
  Package,
  ShieldAlert,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { rememberListScroll } from "@/hooks/use-list-scroll-restoration";
import {
  formatCurrency,
  formatDate,
  STATUS_UI,
} from "../lib/product-moderation.utils";
import type { AdminProductRecord } from "../types/admin-product.types";

export interface ProductsListTableProps {
  products: AdminProductRecord[];
  selectedProductIds: string[];
  onToggleSelect: (id: string) => void;
  onQuickApprove: (product: AdminProductRecord) => void;
  onOpenDialog: (action: "reject" | "request_changes", product: AdminProductRecord) => void;
  canModerate: boolean;
  isSubmitting: boolean;
  isLoading?: boolean;
}

export function ProductsListTable({
  products,
  selectedProductIds,
  onToggleSelect,
  onQuickApprove,
  onOpenDialog,
  canModerate,
  isSubmitting,
  isLoading,
}: ProductsListTableProps) {
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
      aria-label="Product moderation table view"
      className="overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] shadow-[0_16px_34px_rgb(6_59_41_/_7%)]"
    >
      {/* Desktop Table View - 7 Dense Columns */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-canopy-deep)] text-[10px] font-black uppercase text-[var(--admin-surface-mist)]">
              <th className="w-10 px-2 py-2 text-center">
                <span className="sr-only">Select</span>
              </th>
              <th className="w-12 px-2 py-2">Item</th>
              <th className="px-3 py-2">Product & Store</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Price & Stock</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] text-xs text-[var(--admin-ink)]">
            {products.map((product) => {
              const isSelected = selectedProductIds.includes(product.sellerProductId);
              const statusConfig = STATUS_UI[product.status] || STATUS_UI.draft;

              return (
                <tr
                  key={product.sellerProductId}
                  className={`transition-colors hover:bg-[var(--admin-surface-mist)] ${
                    isSelected ? "bg-[color-mix(in_srgb,var(--admin-canopy)_6%,transparent)]" : ""
                  }`}
                >
                  {/* 1. Select Checkbox */}
                  <td className="w-10 px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`Select ${product.name}`}
                      checked={isSelected}
                      onChange={() => onToggleSelect(product.sellerProductId)}
                      className="size-4 rounded border-zinc-300 accent-[var(--admin-canopy)] cursor-pointer"
                    />
                  </td>

                  {/* 2. Item (Thumbnail) */}
                  <td className="w-12 px-2 py-2">
                    <div className="relative size-10 overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-white shadow-xs">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-zinc-300">
                          <ImageIcon className="size-4" />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 3. Product & Store (Name, store, category inline) */}
                  <td className="max-w-72 px-3 py-2">
                    <Link
                      href={`/admin/products/${product.sellerProductId}`}
                      prefetch={false}
                      onClick={() =>
                        rememberListScroll(window.location.pathname + window.location.search)
                      }
                      className="line-clamp-1 text-xs font-black text-[var(--admin-canopy-deep)] hover:underline"
                      title={product.name}
                    >
                      {product.name}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--admin-ink-soft)]">
                      <Store className="size-2.5 shrink-0" />
                      <span className="truncate max-w-[130px]">{product.sellerStore}</span>
                      <span className="size-1 rounded-full bg-zinc-300" />
                      <span className="rounded bg-[var(--admin-surface-mist)] px-1 py-0.2 text-[9px] font-bold text-[var(--admin-ink)] truncate max-w-[110px]">
                        {product.categoryName}
                      </span>
                    </div>
                    {product.flags > 0 && (
                      <div className="mt-0.5 flex items-center gap-1 text-[9px] font-bold text-[var(--admin-ember)]">
                        <ShieldAlert className="size-2.5" />
                        <span>{product.flags} signal{product.flags > 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </td>

                  {/* 4. Status Badge */}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      {statusConfig.label}
                    </span>
                  </td>

                  {/* 5. Price & Stock */}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <p className="font-black text-[11px] text-[var(--admin-ink)]">{formatCurrency(product.price)}</p>
                    <p className="text-[9px] font-semibold text-[var(--admin-ink-soft)]">
                      {product.stock} in stock
                    </p>
                  </td>

                  {/* 6. Submitted Date */}
                  <td className="px-3 py-2 whitespace-nowrap text-[10px] font-bold text-[var(--admin-ink-soft)]">
                    {formatDate(product.submittedAt)}
                  </td>

                  {/* 7. Quick Actions */}
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/products/${product.sellerProductId}`}
                        prefetch={false}
                        onClick={() =>
                          rememberListScroll(window.location.pathname + window.location.search)
                        }
                        className="inline-flex h-7 items-center rounded-md border border-[var(--admin-copper-muted)]/30 bg-[var(--admin-surface-mist)] px-2 text-[10px] font-bold text-[var(--admin-ink)] hover:bg-[var(--admin-surface-cream)]"
                      >
                        {product.status === "pending_review" ? "Review" : "View"}
                      </Link>

                      {product.status === "pending_review" && canModerate && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isSubmitting}
                            onClick={() => onQuickApprove(product)}
                            className="h-7 rounded-md bg-[var(--admin-canopy)] px-2 text-[10px] font-black text-white hover:bg-[var(--admin-canopy-deep)]"
                          >
                            Approve
                          </Button>
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
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Responsive Card List View */}
      <div className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] lg:hidden">
        {products.map((product) => {
          const isSelected = selectedProductIds.includes(product.sellerProductId);
          const statusConfig = STATUS_UI[product.status] || STATUS_UI.draft;

          return (
            <article
              key={product.sellerProductId}
              className={`p-3 transition-colors ${
                isSelected ? "bg-[color-mix(in_srgb,var(--admin-canopy)_6%,transparent)]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Select Checkbox */}
                <input
                  type="checkbox"
                  aria-label={`Select ${product.name}`}
                  checked={isSelected}
                  onChange={() => onToggleSelect(product.sellerProductId)}
                  className="mt-1 size-4 rounded border-zinc-300 accent-[var(--admin-canopy)]"
                />

                {/* Thumbnail */}
                <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-white shadow-xs">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-zinc-300">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/products/${product.sellerProductId}`}
                      prefetch={false}
                      onClick={() =>
                        rememberListScroll(window.location.pathname + window.location.search)
                      }
                      className="line-clamp-2 text-xs font-black text-[var(--admin-canopy-deep)] hover:underline"
                    >
                      {product.name}
                    </Link>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--admin-ink-soft)]">
                    <Store className="size-3 shrink-0" />
                    <span className="truncate">{product.sellerStore}</span>
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-[var(--admin-ink-soft)]">
                    <span className="text-[var(--admin-ink)]">{formatCurrency(product.price)}</span>
                    <span className="size-1 rounded-full bg-zinc-300" />
                    <span>{product.stock} in stock</span>
                    <span className="size-1 rounded-full bg-zinc-300" />
                    <span className="truncate">{product.categoryName}</span>
                  </div>

                  {product.flags > 0 && (
                    <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-[var(--admin-ember)]">
                      <ShieldAlert className="size-3" />
                      <span>{product.flags} moderation signal{product.flags > 1 ? "s" : ""}</span>
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Link
                      href={`/admin/products/${product.sellerProductId}`}
                      prefetch={false}
                      onClick={() =>
                        rememberListScroll(window.location.pathname + window.location.search)
                      }
                      className="inline-flex h-7 items-center rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_45%,transparent)] bg-[var(--admin-surface-mist)] px-2.5 text-[11px] font-bold text-[var(--admin-ink)]"
                    >
                      {product.status === "pending_review" ? "Review" : "View"}
                    </Link>

                    {product.status === "pending_review" && canModerate && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSubmitting}
                          onClick={() => onQuickApprove(product)}
                          className="h-7 rounded-md bg-[var(--admin-canopy)] px-2 text-[11px] font-black text-white hover:bg-[var(--admin-canopy-deep)]"
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isSubmitting}
                          onClick={() => onOpenDialog("request_changes", product)}
                          className="h-7 rounded-md border-[color-mix(in_srgb,var(--admin-copper-muted)_45%,transparent)] bg-[var(--admin-surface-mist)] px-2 text-[11px] font-bold text-amber-800"
                        >
                          Changes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isSubmitting}
                          onClick={() => onOpenDialog("reject", product)}
                          className="h-7 rounded-md bg-[var(--admin-ember)] px-2 text-[11px] font-black text-white hover:bg-rose-800"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
