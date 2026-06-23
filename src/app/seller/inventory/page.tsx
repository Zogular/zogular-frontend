"use client";

import Link from "next/link";
import { AlertCircle, AlertTriangle, Box, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import { CollectionViewToggle } from "@/components/shared/CollectionViewToggle";

import { useInventory } from "@/features/seller-inventory/hooks/useInventory";
import { InventoryListRow } from "@/features/seller-inventory/components/InventoryListRow";
import { InventoryGridCard } from "@/features/seller-inventory/components/InventoryGridCard";
import type { InventoryStatus, SortOption } from "@/features/seller-inventory/types/inventory-types";

export default function SellerInventoryPage() {
  const {
    loading,
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
    selectedIds,
    setSelectedIds,
    editingStock,
    isSaving,
    bulkStockValue,
    setBulkStockValue,
    isBulkSaving,
    categories,
    lowStockItems,
    outOfStockItems,
    filteredAndSorted,
    allFilteredSelected,
    loadInventory,
    handleToggleSelect,
    handleToggleAll,
    updateEditingStock,
    handleInlineStockSave,
    adjustStock,
    handleBulkUpdate,
  } = useInventory();

  if (loading) return <SellerPageLoading variant="table" />;

  if (error) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-base font-bold text-red-900">System Error</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <Button
          onClick={loadInventory}
          variant="outline"
          className="mt-4 border-red-200 text-red-700 hover:bg-red-100"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, id: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleInlineStockSave(id);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 pb-24 md:pb-12">
      <div className="shrink-0 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
            Inventory
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Manage stock levels and track product availability.
          </p>
        </div>

        <Link href="/seller/products/new">
          <Button className="h-11 w-full rounded-xl bg-[#009E49] px-6 font-bold text-white shadow-[0_4px_15px_rgba(0,158,73,0.2)] transition-all hover:bg-[#00853d] active:scale-95 md:w-auto">
            <Plus className="mr-2 h-5 w-5" />
            Add Product
          </Button>
        </Link>
      </div>

      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-sm font-black text-amber-900">Attention Required</h2>
              <p className="text-xs font-medium text-amber-700">
                You have {outOfStockItems.length} out of stock and {lowStockItems.length} low stock items.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[...outOfStockItems, ...lowStockItems].slice(0, 4).map((item) => (
              <span
                key={item.id}
                className={cn(
                  "inline-flex items-center rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider",
                  item.stock === 0
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-white text-amber-700",
                )}
              >
                {item.sku} • {item.stock} Left
              </span>
            ))}

            {outOfStockItems.length + lowStockItems.length > 4 && (
              <span className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                +{outOfStockItems.length + lowStockItems.length - 4} More
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by product name or SKU..."
            className="h-11 w-full rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row">
          <select
            aria-label="Filter inventory by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as InventoryStatus | "all")}
            className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] sm:w-40"
          >
            <option value="all">All Status</option>
            <option value="in-stock">In Stock</option>
            <option value="low-stock">Low Stock</option>
            <option value="out-of-stock">Out of Stock</option>
          </select>

          <select
            aria-label="Filter inventory by category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] sm:w-40"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort inventory"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="col-span-2 h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] sm:w-44"
          >
            <option value="recent">Recently Updated</option>
            <option value="stock-low">Stock: Low to High</option>
            <option value="stock-high">Stock: High to Low</option>
          </select>
        </div>
      </div>

      <CollectionViewToggle
        value={mobileView}
        onChange={setMobileView}
        className="md:hidden"
      />

      {selectedIds.size > 0 && (
        <div className="animate-in slide-in-from-top-2 sticky top-20 z-40 flex flex-col gap-3 rounded-2xl border border-[#009E49]/30 bg-[#009E49]/10 p-3 px-5 shadow-md backdrop-blur-md md:top-22 md:flex-row md:items-center md:justify-between">
          <span className="text-sm font-black text-[#009E49]">
            {selectedIds.size} item{selectedIds.size > 1 ? "s" : ""} selected
          </span>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="New stock..."
              value={bulkStockValue}
              onChange={(event) => setBulkStockValue(event.target.value)}
              className="h-9 w-32 rounded-lg bg-white px-3 text-xs font-bold text-zinc-900 shadow-sm"
            />

            <Button
              size="sm"
              onClick={handleBulkUpdate}
              disabled={isBulkSaving}
              className="h-9 rounded-lg bg-[#009E49] text-xs font-bold text-white hover:bg-[#00853d]"
            >
              {isBulkSaving ? "Updating..." : "Apply Bulk"}
            </Button>

            <div className="mx-1 h-6 w-px bg-[#009E49]/20" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="h-9 rounded-lg text-xs font-bold text-[#009E49] hover:bg-[#009E49]/20"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/50">
              <tr>
                <th className="w-12 p-4 pl-6">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleAll}
                    className="h-4 w-4 cursor-pointer rounded border-zinc-300 text-[#009E49] focus:ring-[#009E49]"
                  />
                </th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Product
                </th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  SKU
                </th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Price
                </th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Status
                </th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Quick Stock
                </th>
                <th className="p-4 pr-6 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-sm font-medium text-zinc-500">
                    <Box className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                    No inventory matches found.
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map((item) => (
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
                    onSaveStock={(id, overrideValue) => void handleInlineStockSave(id, overrideValue)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={cn("md:hidden", mobileView === "grid" ? "grid grid-cols-1 gap-3 p-3" : "flex flex-col divide-y divide-zinc-100")}>
          {filteredAndSorted.length === 0 ? (
            <div className="p-12 text-center text-sm font-medium text-zinc-500">
              <Box className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
              No inventory matches found.
            </div>
          ) : (
            filteredAndSorted.map((item) => (
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
                onSaveStock={(id, overrideValue) => void handleInlineStockSave(id, overrideValue)}
                viewMode={mobileView}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
