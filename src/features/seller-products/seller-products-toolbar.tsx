"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CollectionFilterSheet } from "@/components/collection/collection-filter-sheet";
import { CollectionResultCount, CollectionToolbar } from "@/components/collection/collection-toolbar";
import { CollectionViewToggle, type CollectionViewMode } from "@/components/shared/CollectionViewToggle";

interface SellerProductsToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: string[];
  view: CollectionViewMode;
  onViewChange: (value: CollectionViewMode) => void;
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
        {categories.map((category) => <option key={category} value={category}>{category}</option>)}
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
  resultCount,
  totalCount,
}: SellerProductsToolbarProps) {
  const activeFilterCount = categoryFilter === "all" ? 0 : 1;
  const categoryControl = <CategorySelect value={categoryFilter} onChange={onCategoryFilterChange} categories={categories} />;

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
      desktopControls={categoryControl}
      mobileFilters={(
        <CollectionFilterSheet
          title="Filter products"
          description="Narrow this collection by category."
          activeCount={activeFilterCount}
        >
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-500">Category</p>
          {categoryControl}
        </CollectionFilterSheet>
      )}
      viewControl={<CollectionViewToggle value={view} onChange={onViewChange} variant="icon" />}
    />
  );
}
