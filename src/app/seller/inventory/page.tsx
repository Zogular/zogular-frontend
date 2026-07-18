"use client";

import Link from "next/link";
import { AlertTriangle, Box, Plus } from "lucide-react";
import { CollectionPagination } from "@/components/collection/collection-pagination";
import { CollectionSkeleton } from "@/components/collection/collection-skeleton";
import { DENSE_COLLECTION_GRID_CLASS } from "@/components/collection/collection-grid-density";
import { CollectionErrorState, CollectionState } from "@/components/collection/collection-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InventoryGridCard } from "@/features/seller-inventory/components/InventoryGridCard";
import { InventoryListRow } from "@/features/seller-inventory/components/InventoryListRow";
import { InventoryToolbar } from "@/features/seller-inventory/components/InventoryToolbar";
import { useInventory } from "@/features/seller-inventory/hooks/useInventory";
import { cn } from "@/lib/utils";

export default function SellerInventoryPage() {
  const {
    inventory,
    loading,
    fetching,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    sortBy,
    setSortBy,
    mobileView,
    setMobileView,
    page,
    limit,
    setPage,
    setLimit,
    pagination,
    summary,
    facets,
    selectedIds,
    setSelectedIds,
    editingStock,
    isSaving,
    bulkStockValue,
    setBulkStockValue,
    isBulkSaving,
    allFilteredSelected,
    loadInventory,
    handleToggleSelect,
    handleToggleAll,
    updateEditingStock,
    handleInlineStockSave,
    adjustStock,
    handleBulkUpdate,
  } = useInventory();

  const total = summary?.total ?? pagination?.total ?? inventory.length;
  const stockCounts = facets?.stock ?? { inStock: 0, lowStock: 0, outOfStock: 0 };
  const hasFilters =
    Boolean(searchQuery.trim()) || statusFilter !== "all" || categoryFilter !== "all";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleInlineStockSave(id);
    }
  };

  const renderCard = (item: (typeof inventory)[number]) => (
    <InventoryGridCard
      key={item.id}
      item={item}
      isSelected={selectedIds.has(item.id)}
      onToggleSelect={handleToggleSelect}
      isEditing={editingStock[item.id] !== undefined}
      isItemSaving={Boolean(isSaving[item.id])}
      editingStockValue={editingStock[item.id]}
      onUpdateEditingStock={updateEditingStock}
      onKeyDown={handleKeyDown}
      onAdjustStock={adjustStock}
      onSaveStock={(id, value) => void handleInlineStockSave(id, value)}
      viewMode={mobileView}
    />
  );

  return (
    <div className="mx-auto min-w-0 max-w-350 space-y-5 pb-24 md:pb-12">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-zinc-950 md:text-3xl">
            Inventory
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Manage stock availability across your catalog.
          </p>
        </div>
        <Button
          asChild
          className="h-10 shrink-0 rounded-xl bg-[#009E49] px-4 font-bold text-white hover:bg-[#00853d] md:hidden"
        >
          <Link href="/seller/products/new">
            <Plus className="mr-1.5 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </header>

      {stockCounts.lowStock > 0 || stockCounts.outOfStock > 0 ? (
        <section
          className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5"
          aria-label="Inventory attention summary"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-amber-950">Attention required</h2>
            <p className="mt-0.5 text-xs font-medium leading-5 text-amber-800">
              Across your full catalog, {stockCounts.outOfStock} item
              {stockCounts.outOfStock === 1 ? " is" : "s are"} out of stock and{" "}
              {stockCounts.lowStock} {stockCounts.lowStock === 1 ? "is" : "are"} low in stock.
            </p>
          </div>
        </section>
      ) : null}

      <InventoryToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categories={facets?.categories ?? []}
        statusCounts={stockCounts}
        sort={sortBy}
        onSortChange={setSortBy}
        limit={limit}
        onLimitChange={setLimit}
        view={mobileView}
        onViewChange={setMobileView}
        resultCount={inventory.length}
        totalCount={total}
      />

      {selectedIds.size > 0 ? (
        <section
          className="sticky top-20 z-40 flex flex-col gap-3 rounded-2xl border border-[#009E49]/30 bg-[#eaf8f0]/95 p-3 shadow-md backdrop-blur md:top-22 md:flex-row md:items-center md:justify-between"
          aria-label="Bulk stock update"
        >
          <span className="text-sm font-black text-[#007f3a]">
            {selectedIds.size} visible item{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <Input
              type="number"
              min={0}
              max={2_147_483_647}
              step={1}
              placeholder="New stock"
              aria-label="New stock for selected items"
              value={bulkStockValue}
              onChange={(event) => setBulkStockValue(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-lg bg-white text-base font-bold sm:w-32 sm:flex-none sm:text-sm"
            />
            <Button
              size="sm"
              onClick={() => void handleBulkUpdate()}
              disabled={isBulkSaving}
              className="h-9 rounded-lg bg-[#009E49] text-xs font-bold text-white hover:bg-[#00853d]"
            >
              {isBulkSaving ? "Updating…" : "Apply"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-9 rounded-lg text-xs font-bold text-[#007f3a]"
            >
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <CollectionSkeleton
          view={mobileView}
          variant="inventory"
          label="Loading seller inventory"
        />
      ) : error ? (
        <CollectionErrorState
          title="Inventory could not be loaded"
          description={error}
          action={{ label: "Try again", onClick: () => void loadInventory() }}
        />
      ) : inventory.length === 0 ? (
        <CollectionState
          icon={Box}
          title={hasFilters ? "No matching inventory" : "No inventory yet"}
          description={
            hasFilters
              ? "Try changing your search or filters."
              : "Add a product to begin managing stock."
          }
        />
      ) : mobileView === "grid" ? (
        <div
          aria-label="Seller inventory grid"
          className={cn(
            DENSE_COLLECTION_GRID_CLASS,
            fetching && "opacity-70",
          )}
        >
          {inventory.map(renderCard)}
        </div>
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm",
            fetching && "opacity-70",
          )}
        >
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/70">
                <tr>
                  <th className="w-12 p-4 pl-6">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={handleToggleAll}
                      aria-label="Select all inventory items on this page"
                      className="h-4 w-4 rounded border-zinc-300 text-[#009E49] focus:ring-[#009E49]"
                    />
                  </th>
                  {["Product", "SKU", "Price", "Status", "Quick stock", "Actions"].map(
                    (label) => (
                      <th
                        key={label}
                        className={cn(
                          "p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400",
                          label === "Actions" && "pr-6 text-right",
                        )}
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {inventory.map((item) => (
                  <InventoryListRow
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    onToggleSelect={handleToggleSelect}
                    isEditing={editingStock[item.id] !== undefined}
                    isItemSaving={Boolean(isSaving[item.id])}
                    editingStockValue={editingStock[item.id]}
                    onUpdateEditingStock={updateEditingStock}
                    onKeyDown={handleKeyDown}
                    onAdjustStock={adjustStock}
                    onSaveStock={(id, value) => void handleInlineStockSave(id, value)}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-zinc-100 xl:hidden">{inventory.map(renderCard)}</div>
        </div>
      )}

      <CollectionPagination
        page={pagination?.page ?? page}
        totalPages={pagination?.pages ?? 1}
        onPageChange={setPage}
        disabled={fetching}
      />
    </div>
  );
}
