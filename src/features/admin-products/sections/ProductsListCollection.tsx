/**
 * @file ProductsListCollection.tsx
 * @module features/admin-products/sections
 * @description
 * Responsive desktop table and mobile/grid card collection for the bounded
 * Admin Products Moderation queue (PM-F1 READ).
 *
 * Key invariants:
 * - Strict content-level containment (`min-w-0`, `[overflow-wrap:anywhere]`) across 320px–1440px.
 * - Detail navigation uses `<Link>` with validated `returnTo` and `rememberListScroll`.
 * - Bulk selection checkboxes appear only when `canModerate` and only for `PENDING_REVIEW` rows on the active page.
 * - Server pagination controls reflect backend `pagination` truth.
 */

"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Package, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rememberListScroll } from "@/hooks/use-list-scroll-restoration";
import { cn } from "@/lib/utils";
import {
  formatAdminProductSellerContact,
  formatAdminProductSellerLabel,
  getAdminProductStatusBadgeMeta,
} from "../lib/product-list-contract";
import { buildProductDetailHref } from "../lib/product-list-state";
import type {
  AdminProductListItem,
  AdminProductListPagination,
  AdminProductViewMode,
} from "../types/admin-product-list.types";

interface ProductsListCollectionProps {
  items: readonly AdminProductListItem[];
  pagination: AdminProductListPagination;
  viewMode: AdminProductViewMode;
  canModerate: boolean;
  selectedIds: readonly string[];
  onToggleSelect: (productId: string) => void;
  onToggleSelectAllVisible: () => void;
  currentUrl: string;
  onPageChange: (page: number) => void;
}

function formatCurrency(price: number, salePrice: number | null): string {
  const effective = salePrice ?? price;
  return `K${effective.toLocaleString("en-ZM")}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZM", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function ProductsListCollection({
  items,
  pagination,
  viewMode,
  canModerate,
  selectedIds,
  onToggleSelect,
  onToggleSelectAllVisible,
  currentUrl,
  onPageChange,
}: ProductsListCollectionProps) {
  const eligiblePendingIds = items
    .filter((item) => item.status === "PENDING_REVIEW")
    .map((item) => item.id);
  const allVisiblePendingSelected =
    eligiblePendingIds.length > 0 &&
    eligiblePendingIds.every((id) => selectedIds.includes(id));

  const startRow =
    pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const endRow = Math.min(
    pagination.total,
    (pagination.page - 1) * pagination.limit + items.length,
  );

  return (
    <div className="min-w-0 space-y-4">
      {viewMode === "grid" ? (
        <div
          data-testid="products-grid-collection"
          className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {items.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              canModerate={canModerate}
              isSelected={selectedIds.includes(item.id)}
              onToggleSelect={onToggleSelect}
              currentUrl={currentUrl}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile & tablet compact card list (< lg) */}
          <div
            data-testid="products-mobile-list"
            className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden"
          >
            {items.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                canModerate={canModerate}
                isSelected={selectedIds.includes(item.id)}
                onToggleSelect={onToggleSelect}
                currentUrl={currentUrl}
              />
            ))}
          </div>

          {/* Desktop dense moderation table (lg+) */}
          <div
            data-testid="products-desktop-table"
            className="hidden min-w-0 overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/85 shadow-md shadow-zinc-900/5 backdrop-blur-xl lg:block"
          >
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200/80 bg-zinc-50/80 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    {canModerate ? (
                      <th className="w-10 p-3 pl-4">
                        <input
                          type="checkbox"
                          aria-label="Select all pending products on this page"
                          checked={allVisiblePendingSelected}
                          disabled={eligiblePendingIds.length === 0}
                          onChange={onToggleSelectAllVisible}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                        />
                      </th>
                    ) : null}
                    <th className="w-[27%] p-3">Product</th>
                    <th className="w-[17%] p-3">Seller</th>
                    <th className="w-[16%] p-3">Status</th>
                    <th className="w-[13%] p-3">Category</th>
                    <th className="w-[11%] p-3">Created</th>
                    <th className="w-[11%] p-3">Price &amp; Stock</th>
                    <th className="w-[92px] p-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/70">
                  {items.map((item) => {
                    const badge = getAdminProductStatusBadgeMeta(item.status);
                    const detailHref = buildProductDetailHref(item.id, currentUrl);
                    const isPending = item.status === "PENDING_REVIEW";
                    const sellerName = formatAdminProductSellerLabel(item.seller);
                    const sellerContact = formatAdminProductSellerContact(item.seller);

                    return (
                      <tr
                        key={item.id}
                        data-testid={`product-row-${item.id}`}
                        className="transition-colors hover:bg-zinc-50/70"
                      >
                        {canModerate ? (
                          <td className="p-3 pl-4 align-top">
                            {isPending ? (
                              <input
                                type="checkbox"
                                aria-label={`Select ${item.title}`}
                                checked={selectedIds.includes(item.id)}
                                onChange={() => onToggleSelect(item.id)}
                                className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                              />
                            ) : (
                              <span className="sr-only">Not pending review</span>
                            )}
                          </td>
                        ) : null}
                        <td className="min-w-0 p-3 align-top">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <ProductThumb url={item.primaryImageUrl} title={item.title} />
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-zinc-900 [overflow-wrap:anywhere]">
                                {item.title}
                              </p>
                              <p className="mt-0.5 text-[11px] font-medium text-zinc-500 [overflow-wrap:anywhere]">
                                {item.sku ? `SKU: ${item.sku}` : `ID: ${item.id}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="min-w-0 p-3 align-top">
                          <p className="font-bold text-zinc-800 [overflow-wrap:anywhere]">
                            {sellerName}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-zinc-500 [overflow-wrap:anywhere]">
                            {sellerContact}
                          </p>
                        </td>
                        <td className="min-w-0 p-3 align-top">
                          <span
                            className={cn(
                              "inline-flex max-w-full whitespace-normal rounded-lg border px-2 py-1 text-center text-[10px] font-black uppercase leading-tight tracking-wider",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                          {item.isSold ? (
                            <p className="mt-1 text-[10px] font-bold text-zinc-500">Sold</p>
                          ) : null}
                        </td>
                        <td className="min-w-0 p-3 align-top">
                          <p className="font-bold text-zinc-900 [overflow-wrap:anywhere]">
                            {item.categoryLabel}
                          </p>
                          {item.subcategoryLabel ? (
                            <p className="mt-0.5 text-[11px] font-medium text-zinc-500 [overflow-wrap:anywhere]">
                              {item.subcategoryLabel}
                            </p>
                          ) : null}
                        </td>
                        <td className="min-w-0 p-3 align-top text-[11px] font-semibold text-zinc-600">
                          <p>{formatDate(item.createdAt)}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-400">
                            Upd: {formatDate(item.updatedAt)}
                          </p>
                        </td>
                        <td className="min-w-0 p-3 align-top">
                          <p className="font-black text-zinc-900 [overflow-wrap:anywhere]">
                            {formatCurrency(item.price, item.salePrice)}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-zinc-500">
                            {item.stock === null ? "Single item" : `${item.stock} units`}
                          </p>
                        </td>
                        <td className="p-3 pr-4 text-right align-top">
                          <Link
                            href={detailHref}
                            onClick={() => rememberListScroll(currentUrl)}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-800 shadow-sm transition-colors hover:bg-zinc-900 hover:text-white"
                          >
                            {isPending ? "Review" : "View"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Server pagination bar */}
      <nav
        aria-label="Product list pagination"
        className="flex min-w-0 flex-col items-start justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 text-xs shadow-sm sm:flex-row sm:items-center"
      >
        <p className="font-semibold text-zinc-600">
          Showing <span className="font-black text-zinc-900">{startRow}</span>–
          <span className="font-black text-zinc-900">{endRow}</span> of{" "}
          <span className="font-black text-zinc-900">{pagination.total}</span> non-draft
          products (Page <span className="font-black text-zinc-900">{pagination.page}</span> of{" "}
          <span className="font-black text-zinc-900">{Math.max(1, pagination.pages)}</span>)
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            className="h-9 rounded-xl border-zinc-200 font-bold"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagination.pages === 0 || pagination.page >= pagination.pages}
            onClick={() => onPageChange(pagination.page + 1)}
            className="h-9 rounded-xl border-zinc-200 font-bold"
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </nav>
    </div>
  );
}

function ProductCard({
  item,
  canModerate,
  isSelected,
  onToggleSelect,
  currentUrl,
}: {
  item: AdminProductListItem;
  canModerate: boolean;
  isSelected: boolean;
  onToggleSelect: (productId: string) => void;
  currentUrl: string;
}) {
  const badge = getAdminProductStatusBadgeMeta(item.status);
  const detailHref = buildProductDetailHref(item.id, currentUrl);
  const isPending = item.status === "PENDING_REVIEW";
  const sellerName = formatAdminProductSellerLabel(item.seller);

  return (
    <article
      data-testid={`product-card-${item.id}`}
      className="flex min-w-0 flex-col justify-between gap-3 rounded-[1.35rem] border border-zinc-200/80 bg-white/90 p-3.5 shadow-sm"
    >
      <div className="min-w-0 space-y-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            {canModerate && isPending ? (
              <input
                type="checkbox"
                aria-label={`Select ${item.title}`}
                checked={isSelected}
                onChange={() => onToggleSelect(item.id)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
            ) : null}
            <ProductThumb url={item.primaryImageUrl} title={item.title} />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black leading-snug text-zinc-900 [overflow-wrap:anywhere]">
                {item.title}
              </h3>
              <p className="mt-0.5 text-[11px] font-medium text-zinc-500 [overflow-wrap:anywhere]">
                {item.sku ? `SKU: ${item.sku}` : `ID: ${item.id}`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
              badge.className,
            )}
          >
            {badge.label}
          </span>
          {item.isSold ? (
            <span className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-700">
              Sold
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-zinc-100 pt-2 text-[11px]">
          <div className="min-w-0">
            <dt className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
              Price
            </dt>
            <dd className="font-black text-zinc-900 [overflow-wrap:anywhere]">
              {formatCurrency(item.price, item.salePrice)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
              Stock
            </dt>
            <dd className="font-bold text-zinc-700">
              {item.stock === null ? "Single item" : `${item.stock} units`}
            </dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
              Category
            </dt>
            <dd className="font-bold text-zinc-800 [overflow-wrap:anywhere]">
              {item.categoryLabel}
            </dd>
          </div>
          <div className="col-span-2 min-w-0">
            <dt className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-zinc-400">
              <Store className="h-3 w-3" /> Seller
            </dt>
            <dd className="font-semibold text-zinc-700 [overflow-wrap:anywhere]">
              {sellerName}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
        <span className="text-[11px] font-medium text-zinc-500">
          {formatDate(item.createdAt)}
        </span>
        <Link
          href={detailHref}
          onClick={() => rememberListScroll(currentUrl)}
          className="inline-flex h-9 min-w-[84px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-900 px-3.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-zinc-800"
        >
          {isPending ? "Review" : "View"}
        </Link>
      </div>
    </article>
  );
}

function ProductThumb({ url, title }: { url: string | null; title: string }) {
  if (!url) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-400">
        <Package className="h-5 w-5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={title}
      className="h-11 w-11 shrink-0 rounded-xl border border-zinc-200 object-cover bg-zinc-100"
    />
  );
}
