"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CollectionFilterSheet } from "@/components/collection/collection-filter-sheet";
import { CollectionResultCount, CollectionToolbar } from "@/components/collection/collection-toolbar";
import { CollectionViewToggle, type CollectionViewMode } from "@/components/shared/CollectionViewToggle";
import type { SellerProductCategoryFacet } from "@/services/seller-catalog";
import {
  SELLER_PRODUCTS_SORT_OPTIONS,
  type SellerProductsSortOption,
} from "@/features/seller-products/types";

interface SellerProductsToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: SellerProductCategoryFacet[];
  view: CollectionViewMode;
  onViewChange: (value: CollectionViewMode) => void;
  sort: SellerProductsSortOption;
  onSortChange: (value: SellerProductsSortOption) => void;
  limit: number;
  onLimitChange: (value: number) => void;
  resultCount: number;
  totalCount: number;
}

function CategorySelect({ value, onChange, categories }: Pick<SellerProductsToolbarProps, "categories"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Product category</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-700 outline-none focus:border-[#009E49] focus:ring-2 focus:ring-[#009E49]/20 md:w-52 md:text-xs"
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

function SortSelect({ value, onChange }: {
  value: SellerProductsSortOption;
  onChange: (value: SellerProductsSortOption) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Sort products</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as SellerProductsSortOption)}
        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-700 outline-none focus:border-[#009E49] focus:ring-2 focus:ring-[#009E49]/20 md:w-45 md:text-xs"
      >
        {SELLER_PRODUCTS_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function LimitSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="sr-only">Products per page</span>
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-700 outline-none focus:border-[#009E49] focus:ring-2 focus:ring-[#009E49]/20 md:w-31 md:text-xs"
      >
        <option value={20}>20 per page</option>
        <option value={40}>40 per page</option>
        <option value={60}>60 per page</option>
      </select>
    </label>
  );
}

export function SellerProductsToolbar({
  searchQuery,
  onSearchQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  categories,
  view,
  onViewChange,
  sort,
  onSortChange,
  limit,
  onLimitChange,
  resultCount,
  totalCount,
}: SellerProductsToolbarProps) {
  const activeFilterCount = categoryFilter === "all" ? 0 : 1;

  return (
    <CollectionToolbar
      search={(
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search products, ID, or brand"
            aria-label="Search seller products"
            className="h-9 rounded-lg border-zinc-200 bg-zinc-50 pl-9 text-base font-medium shadow-none focus-visible:ring-[#009E49] sm:text-sm"
          />
        </div>
      )}
      resultContext={<CollectionResultCount count={resultCount} total={totalCount} />}
      desktopControls={<CategorySelect value={categoryFilter} onChange={onCategoryFilterChange} categories={categories} />}
      sortControl={(
        <div className="flex items-center gap-2">
          <SortSelect value={sort} onChange={onSortChange} />
          <LimitSelect value={limit} onChange={onLimitChange} />
        </div>
      )}
      mobileFilters={(
        <CollectionFilterSheet
          title="Filter products"
          description="Narrow this collection by category."
          activeCount={activeFilterCount}
        >
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">Category</p>
              <CategorySelect value={categoryFilter} onChange={onCategoryFilterChange} categories={categories} />
            </div>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">Sort</p>
              <SortSelect value={sort} onChange={onSortChange} />
            </div>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">Page size</p>
              <LimitSelect value={limit} onChange={onLimitChange} />
            </div>
          </div>
        </CollectionFilterSheet>
      )}
      viewControl={<CollectionViewToggle value={view} onChange={onViewChange} variant="icon" />}
    />
  );
}
