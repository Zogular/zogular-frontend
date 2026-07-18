"use client";

import { Search } from "lucide-react";
import { CollectionFilterSheet } from "@/components/collection/collection-filter-sheet";
import {
  CollectionResultCount,
  CollectionToolbar,
} from "@/components/collection/collection-toolbar";
import {
  CollectionViewToggle,
  type CollectionViewMode,
} from "@/components/shared/CollectionViewToggle";
import { Input } from "@/components/ui/input";
import type { SellerProductCategoryFacet } from "@/services/seller-catalog";
import type { InventoryStatus, SortOption } from "../types/inventory-types";

interface InventoryToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: InventoryStatus | "all";
  onStatusFilterChange: (value: InventoryStatus | "all") => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: SellerProductCategoryFacet[];
  statusCounts: { inStock: number; lowStock: number; outOfStock: number };
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  limit: number;
  onLimitChange: (value: number) => void;
  view: CollectionViewMode;
  onViewChange: (value: CollectionViewMode) => void;
  resultCount: number;
  totalCount: number;
}

const selectClassName =
  "h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-700 outline-none focus:border-[#009E49] focus:ring-2 focus:ring-[#009E49]/20 xl:text-xs";

function StatusSelect({
  value,
  onChange,
  counts,
}: {
  value: InventoryStatus | "all";
  onChange: (value: InventoryStatus | "all") => void;
  counts: { inStock: number; lowStock: number; outOfStock: number };
}) {
  return (
    <label className="block">
      <span className="sr-only">Inventory status</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as InventoryStatus | "all")}
        className={`${selectClassName} xl:w-41`}
      >
        <option value="all">All stock states</option>
        <option value="in-stock">In stock ({counts.inStock})</option>
        <option value="low-stock">Low stock ({counts.lowStock})</option>
        <option value="out-of-stock">Out of stock ({counts.outOfStock})</option>
      </select>
    </label>
  );
}

function CategorySelect({
  value,
  onChange,
  categories,
}: {
  value: string;
  onChange: (value: string) => void;
  categories: SellerProductCategoryFacet[];
}) {
  return (
    <label className="block">
      <span className="sr-only">Inventory category</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${selectClassName} xl:w-45`}
      >
        <option value="all">All categories</option>
        {categories.map((category) => (
          <option key={category.slug} value={category.slug}>
            {category.name} ({category.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Sort inventory</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SortOption)}
        className={`${selectClassName} xl:w-43`}
      >
        <option value="recent">Recently updated</option>
        <option value="stock-low">Stock: low to high</option>
        <option value="stock-high">Stock: high to low</option>
        <option value="title-asc">Title: A to Z</option>
      </select>
    </label>
  );
}

function LimitSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="sr-only">Inventory items per page</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`${selectClassName} xl:w-31`}
      >
        <option value={20}>20 per page</option>
        <option value={40}>40 per page</option>
        <option value={60}>60 per page</option>
      </select>
    </label>
  );
}

export function InventoryToolbar(props: InventoryToolbarProps) {
  const activeFilterCount =
    Number(props.statusFilter !== "all") + Number(props.categoryFilter !== "all");

  const filters = (
    <>
      <StatusSelect
        value={props.statusFilter}
        onChange={props.onStatusFilterChange}
        counts={props.statusCounts}
      />
      <CategorySelect
        value={props.categoryFilter}
        onChange={props.onCategoryFilterChange}
        categories={props.categories}
      />
    </>
  );

  return (
    <CollectionToolbar
      search={
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={props.searchQuery}
            onChange={(event) => props.onSearchQueryChange(event.target.value)}
            placeholder="Search products or SKU"
            aria-label="Search inventory"
            className="h-9 rounded-lg border-zinc-200 bg-zinc-50 pl-9 text-base font-medium shadow-none focus-visible:ring-[#009E49] sm:text-sm"
          />
        </div>
      }
      resultContext={
        <CollectionResultCount
          count={props.resultCount}
          total={props.totalCount}
          label="inventory items"
        />
      }
      desktopControls={<div className="flex items-center gap-2">{filters}</div>}
      sortControl={
        <div className="flex items-center gap-2">
          <SortSelect value={props.sort} onChange={props.onSortChange} />
          <LimitSelect value={props.limit} onChange={props.onLimitChange} />
        </div>
      }
      mobileFilters={
        <CollectionFilterSheet
          title="Filter inventory"
          description="Narrow inventory by stock state, category, and order."
          activeCount={activeFilterCount}
        >
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                Stock state
              </p>
              <StatusSelect
                value={props.statusFilter}
                onChange={props.onStatusFilterChange}
                counts={props.statusCounts}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                Category
              </p>
              <CategorySelect
                value={props.categoryFilter}
                onChange={props.onCategoryFilterChange}
                categories={props.categories}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">Sort</p>
              <SortSelect value={props.sort} onChange={props.onSortChange} />
            </div>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">
                Page size
              </p>
              <LimitSelect value={props.limit} onChange={props.onLimitChange} />
            </div>
          </div>
        </CollectionFilterSheet>
      }
      viewControl={
        <CollectionViewToggle value={props.view} onChange={props.onViewChange} variant="icon" />
      }
    />
  );
}
