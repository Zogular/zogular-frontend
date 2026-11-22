/**
 * @file ProductsListFilters.tsx
 * @module features/admin-products/sections
 * @description
 * Server-driven filter, search, sort, page-size, view-mode, and refresh toolbar
 * for the Admin Products Moderation queue (PM-F1 READ).
 */

"use client";

import { LayoutGrid, RefreshCw, Rows3, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRODUCT_LIST_LIMITS,
  PRODUCT_LIST_SEARCH_MAX_LENGTH,
  PRODUCT_LIST_STATUS_OPTIONS,
} from "../lib/product-list-state";
import type {
  AdminProductQueueStatusFilter,
  AdminProductSortBy,
  AdminProductSortOrder,
  AdminProductViewMode,
} from "../types/admin-product-list.types";

interface ProductsListFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: AdminProductQueueStatusFilter;
  onStatusChange: (status: AdminProductQueueStatusFilter) => void;
  sortBy: AdminProductSortBy;
  sortOrder: AdminProductSortOrder;
  onSortChange: (sortBy: AdminProductSortBy, sortOrder: AdminProductSortOrder) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  viewMode: AdminProductViewMode;
  onViewModeChange: (view: AdminProductViewMode) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  statusText: string;
}

const SORT_OPTIONS: ReadonlyArray<{
  value: `${AdminProductSortBy}:${AdminProductSortOrder}`;
  label: string;
}> = [
  { value: "createdAt:desc", label: "Newest created" },
  { value: "createdAt:asc", label: "Oldest created" },
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "price:asc", label: "Price: low to high" },
  { value: "price:desc", label: "Price: high to low" },
  { value: "title:asc", label: "Title: A to Z" },
  { value: "views:desc", label: "Most viewed" },
];

export function ProductsListFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange,
  limit,
  onLimitChange,
  viewMode,
  onViewModeChange,
  isRefreshing,
  onRefresh,
  statusText,
}: ProductsListFiltersProps) {
  const currentSortValue = `${sortBy}:${sortOrder}`;

  return (
    <section
      aria-label="Product moderation filters"
      className="min-w-0 rounded-[1.5rem] border border-white/70 bg-white/80 p-3 shadow-md shadow-zinc-900/5 backdrop-blur-xl md:p-4"
    >
      <div className="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[175px_minmax(0,1fr)]">
          <label className="min-w-0">
            <span className="sr-only">Filter by moderation status</span>
            <select
              aria-label="Filter by moderation status"
              value={statusFilter}
              onChange={(event) =>
                onStatusChange(event.target.value as AdminProductQueueStatusFilter)
              }
              className="h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-800 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 md:text-sm"
            >
              {PRODUCT_LIST_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              aria-label="Search products"
              type="search"
              maxLength={PRODUCT_LIST_SEARCH_MAX_LENGTH}
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search product title or seller..."
              className="h-10 w-full min-w-0 rounded-xl border-zinc-200 bg-zinc-50 pl-9 pr-9 text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 md:text-sm"
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="basis-full min-w-0 sm:basis-auto">
            <span className="sr-only">Sort products</span>
            <select
              aria-label="Sort products"
              value={currentSortValue}
              onChange={(event) => {
                const [nextBy, nextOrder] = event.target.value.split(":") as [
                  AdminProductSortBy,
                  AdminProductSortOrder,
                ];
                onSortChange(nextBy, nextOrder);
              }}
              className="h-10 w-full min-w-[165px] rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 sm:w-auto"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0">
            <span className="sr-only">Items per page</span>
            <select
              aria-label="Items per page"
              value={String(limit)}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-bold text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
            >
              {PRODUCT_LIST_LIMITS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset} / page
                </option>
              ))}
            </select>
          </label>

          <div
            role="group"
            aria-label="View mode"
            className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-zinc-50 p-1"
          >
            <button
              type="button"
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              onClick={() => onViewModeChange("list")}
              className={cn(
                "flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition-colors",
                viewMode === "list"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900",
              )}
            >
              <Rows3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition-colors",
                viewMode === "grid"
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh product queue"
            className="h-10 rounded-xl border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 sm:mr-1.5", isRefreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <p className="mt-2 text-[11px] font-medium text-zinc-500">{statusText}</p>
    </section>
  );
}
