/**
 * @file ProductsListFilters.tsx
 * @module features/admin-products/sections
 * @description
 * Complete search, status tabs, category filter, list/grid toggle, and bulk actions toolbar
 * for the Admin Product Moderation interface. Styled with the tactile warm admin palette.
 */

import React from "react";
import {
  CheckSquare,
  Filter,
  Search,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ProductListViewMode,
  ProductModerationStatusFilter,
} from "../types/admin-product.types";

export interface ProductsListFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: ProductModerationStatusFilter;
  setStatusFilter: (value: ProductModerationStatusFilter) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  categories: string[];
  view?: ProductListViewMode;
  setView?: (value: ProductListViewMode) => void;
  selectedCount: number;
  selectedPendingCount: number;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onBulkApprove: () => void;
  onOpenBulkDialog: (action: "reject" | "request_changes") => void;
  canModerate: boolean;
  isSubmitting: boolean;
  totalFilteredCount: number;
}

const STATUS_FILTER_TABS: { key: ProductModerationStatusFilter; label: string }[] = [
  { key: "all", label: "All Products" },
  { key: "pending_review", label: "Pending Review" },
  { key: "needs_changes", label: "Needs Changes" },
  { key: "published", label: "Published" },
  { key: "approved", label: "Approved" },
  { key: "suspended", label: "Suspended" },
  { key: "rejected", label: "Rejected" },
];

export function ProductsListFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  selectedCount,
  selectedPendingCount,
  isAllSelected,
  onSelectAll,
  onBulkApprove,
  onOpenBulkDialog,
  canModerate,
  isSubmitting,
  totalFilteredCount,
}: ProductsListFiltersProps) {
  return (
    <section
      aria-label="Product moderation filters and controls"
      className="overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-cream)] shadow-xs"
    >
      {/* Top row: Search & Guarded Category Selector */}
      <div className="p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Search bar */}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-ink-soft)]" />
            <Input
              id="product-search-input"
              aria-label="Search product catalog"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title, store, SKU, or category..."
              className="h-10 rounded-md border-[color-mix(in_srgb,var(--admin-copper-muted)_42%,transparent)] bg-[var(--admin-surface-mist)] pl-10 pr-10 text-xs font-semibold text-[var(--admin-ink)] placeholder:text-[var(--admin-ink-soft)] focus-visible:ring-[var(--admin-canopy)] sm:text-sm"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear product search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {/* Category Dropdown - Guarded with max-w-[180px] sm:max-w-[200px] truncate */}
          <div className="relative w-full max-w-[180px] sm:max-w-[200px] shrink-0">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 w-full appearance-none rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_42%,transparent)] bg-[var(--admin-surface-mist)] px-3 pr-8 text-xs font-bold text-[var(--admin-ink)] shadow-inner outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-canopy)] truncate"
            >
              <option value="all">All Categories</option>
              {categories
                .filter((cat) => cat !== "all")
                .map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
            </select>
            <Filter className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--admin-ink-soft)]" />
          </div>
        </div>
      </div>

      {/* Middle row: Horizontal Sliding Status Filter Rail */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1.5 px-3 sm:px-4 whitespace-nowrap border-y border-[color-mix(in_srgb,var(--admin-copper-muted)_25%,transparent)] bg-[var(--admin-surface-mist)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(e) => {
          if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
        {STATUS_FILTER_TABS.map(({ key, label }) => {
          const active = statusFilter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(key)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-black transition-colors whitespace-nowrap ${
                active
                  ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] shadow-sm"
                  : "text-[var(--admin-ink-soft)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)] hover:text-[var(--admin-canopy-deep)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Bottom row: Bulk Operations Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onSelectAll}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--admin-ink)] hover:text-[var(--admin-canopy-deep)]"
          >
            {isAllSelected ? (
              <CheckSquare className="size-4 text-[var(--admin-canopy)]" />
            ) : (
              <Square className="size-4 text-[var(--admin-copper-muted)]" />
            )}
            <span>Select Visible ({totalFilteredCount})</span>
          </button>

          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--admin-copper-muted)_35%,transparent)] bg-[var(--admin-surface-mist)] px-2.5 py-0.5 text-[11px] font-black text-[var(--admin-ink)]">
              <span>{selectedCount} selected</span>
              <span className="size-1 rounded-full bg-[var(--admin-copper-muted)]" />
              <span className="text-amber-800">{selectedPendingCount} pending</span>
            </div>
          )}
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!canModerate || isSubmitting || selectedPendingCount === 0}
            onClick={onBulkApprove}
            className="h-8 rounded-md bg-[var(--admin-canopy)] px-3 text-xs font-black text-white hover:bg-[var(--admin-canopy-deep)] disabled:opacity-50"
          >
            Approve ({selectedPendingCount})
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canModerate || isSubmitting || selectedPendingCount === 0}
            onClick={() => onOpenBulkDialog("request_changes")}
            className="h-8 rounded-md border-[color-mix(in_srgb,var(--admin-copper-muted)_45%,transparent)] bg-[var(--admin-surface-mist)] px-3 text-xs font-bold text-[var(--admin-ink)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)] disabled:opacity-50"
          >
            Request Changes
          </Button>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={!canModerate || isSubmitting || selectedPendingCount === 0}
            onClick={() => onOpenBulkDialog("reject")}
            className="h-8 rounded-md bg-[var(--admin-ember)] px-3 text-xs font-black text-white hover:bg-rose-800 disabled:opacity-50"
          >
            Reject
          </Button>
        </div>
      </div>
    </section>
  );
}
