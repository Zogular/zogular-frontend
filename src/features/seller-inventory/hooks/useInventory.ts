"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { inventoryApi, type InventoryListQuery } from "@/services/inventory";
import { useCollectionQueryState } from "@/hooks/use-collection-query-state";
import { parseStockInput } from "../utils/inventory-utils";
import type { InventoryStatus, SortOption } from "../types/inventory-types";

const INVENTORY_QUERY_KEY = ["seller", "inventory", "products"] as const;
const SELLER_PRODUCTS_QUERY_KEY = ["seller", "catalog", "products"] as const;

type InventoryFilter = InventoryStatus | "all";

function isInventoryFilter(value: string | null): value is InventoryFilter {
  return value === "all" || value === "in-stock" || value === "low-stock" || value === "out-of-stock";
}

function isInventorySort(value: string | null): value is SortOption {
  return value === "recent" || value === "stock-low" || value === "stock-high" || value === "title-asc";
}

function buildInventoryQuery({
  page,
  limit,
  search,
  status,
  categorySlug,
  sort,
}: {
  page: number;
  limit: number;
  search: string;
  status: InventoryFilter;
  categorySlug: string;
  sort: SortOption;
}): InventoryListQuery {
  const sortContract: Record<SortOption, Pick<InventoryListQuery, "sortBy" | "sortOrder">> = {
    recent: { sortBy: "updatedAt", sortOrder: "desc" },
    "stock-low": { sortBy: "stock", sortOrder: "asc" },
    "stock-high": { sortBy: "stock", sortOrder: "desc" },
    "title-asc": { sortBy: "title", sortOrder: "asc" },
  };

  return {
    page,
    limit,
    search: search || undefined,
    categorySlug: categorySlug === "all" ? undefined : categorySlug,
    stockState: status === "in-stock"
      ? "in_stock"
      : status === "low-stock"
        ? "low_stock"
        : status === "out-of-stock"
          ? "out_of_stock"
          : undefined,
    ...sortContract[sort],
  };
}

export function useInventory() {
  const queryClient = useQueryClient();
  const {
    activeTab: statusFilter,
    categoryFilter,
    limit,
    page,
    searchQuery,
    serverSearch,
    setActiveTab,
    setCategoryFilter: setCollectionCategory,
    setLimit,
    setPage,
    setSearchQuery,
    setSort,
    setView,
    sort: sortBy,
    view: mobileView,
  } = useCollectionQueryState({
    defaultTab: "all" as InventoryFilter,
    isTab: isInventoryFilter,
    defaultSort: "recent" as SortOption,
    isSort: isInventorySort,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [bulkStockValue, setBulkStockValue] = useState("");
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const inventoryQuery = useMemo(() => buildInventoryQuery({
    page,
    limit,
    search: serverSearch,
    status: statusFilter,
    categorySlug: categoryFilter,
    sort: sortBy,
  }), [categoryFilter, limit, page, serverSearch, sortBy, statusFilter]);
  const query = useQuery({
    queryKey: [...INVENTORY_QUERY_KEY, inventoryQuery],
    queryFn: () => inventoryApi.fetchPage(inventoryQuery),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const inventory = useMemo(() => query.data?.products ?? [], [query.data?.products]);

  useEffect(() => {
    const visibleIds = new Set(inventory.map((item) => item.id));
    queueMicrotask(() => {
      setSelectedIds((current) => {
        const next = new Set([...current].filter((id) => visibleIds.has(id)));
        if (next.size === current.size && [...next].every((id) => current.has(id))) return current;
        return next;
      });
    });
  }, [inventory]);

  const resetSelection = useCallback(() => setSelectedIds(new Set()), []);
  const setStatusFilter = useCallback((status: InventoryFilter) => {
    resetSelection();
    setActiveTab(status);
  }, [resetSelection, setActiveTab]);
  const setCategoryFilter = useCallback((category: string) => {
    resetSelection();
    setCollectionCategory(category);
  }, [resetSelection, setCollectionCategory]);
  const setInventorySort = useCallback((sort: SortOption) => {
    resetSelection();
    setSort(sort);
  }, [resetSelection, setSort]);
  const setInventoryPage = useCallback((nextPage: number) => {
    resetSelection();
    setPage(nextPage);
  }, [resetSelection, setPage]);
  const setInventoryLimit = useCallback((nextLimit: number) => {
    resetSelection();
    setLimit(nextLimit);
  }, [resetSelection, setLimit]);

  const allFilteredSelected = inventory.length > 0 && inventory.every((item) => selectedIds.has(item.id));

  const handleToggleSelect = (id: string) => {
    if (!inventory.some((item) => item.id === id)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    setSelectedIds(allFilteredSelected ? new Set() : new Set(inventory.map((item) => item.id)));
  };

  const updateEditingStock = (id: string, value: string) => {
    setEditingStock((current) => ({ ...current, [id]: value }));
  };

  const clearEditingStock = (id: string) => {
    setEditingStock((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const invalidateInventoryTruth = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: INVENTORY_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SELLER_PRODUCTS_QUERY_KEY }),
    ]);
  }, [queryClient]);

  const handleInlineStockSave = async (id: string, overrideValue?: number) => {
    const rawValue = overrideValue !== undefined ? String(overrideValue) : editingStock[id];
    const parsedValue = parseStockInput(rawValue ?? "");
    if (parsedValue === null) {
      toast.error("Enter a valid whole stock number.");
      return;
    }

    setIsSaving((current) => ({ ...current, [id]: true }));
    try {
      await inventoryApi.updateStock(id, parsedValue);
      clearEditingStock(id);
      await invalidateInventoryTruth();
      toast.success("Stock updated successfully.");
    } catch (error) {
      clearEditingStock(id);
      toast.error(error instanceof Error ? error.message : "Stock could not be updated.");
    } finally {
      setIsSaving((current) => ({ ...current, [id]: false }));
    }
  };

  const adjustStock = (id: string, currentStock: number, delta: number) => {
    const currentEditValue = editingStock[id];
    const baseValue = currentEditValue !== undefined ? parseStockInput(currentEditValue) : currentStock;
    updateEditingStock(id, String(Math.max(0, (baseValue ?? currentStock) + delta)));
  };

  const handleBulkUpdate = async () => {
    const parsedBulkStock = parseStockInput(bulkStockValue);
    if (parsedBulkStock === null) {
      toast.error("Enter a valid whole stock number.");
      return;
    }

    const visibleIds = new Set(inventory.map((item) => item.id));
    const ids = [...selectedIds].filter((id) => visibleIds.has(id));
    if (ids.length === 0) {
      toast.error("Select at least one visible item.");
      return;
    }

    setIsBulkSaving(true);
    try {
      const updated = await inventoryApi.bulkUpdateStock(ids, parsedBulkStock);
      setSelectedIds(new Set());
      setBulkStockValue("");
      await invalidateInventoryTruth();
      toast.success(`Updated ${updated.length} item${updated.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Selected stock could not be updated.");
    } finally {
      setIsBulkSaving(false);
    }
  };

  return {
    inventory,
    loading: query.isPending,
    fetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : query.error ? "Inventory could not be loaded." : null,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    sortBy,
    setSortBy: setInventorySort,
    mobileView,
    setMobileView: setView,
    page,
    limit,
    setPage: setInventoryPage,
    setLimit: setInventoryLimit,
    pagination: query.data?.pagination,
    summary: query.data?.summary,
    facets: query.data?.facets,
    selectedIds,
    setSelectedIds,
    editingStock,
    isSaving,
    bulkStockValue,
    setBulkStockValue,
    isBulkSaving,
    allFilteredSelected,
    loadInventory: query.refetch,
    handleToggleSelect,
    handleToggleAll,
    updateEditingStock,
    handleInlineStockSave,
    adjustStock,
    handleBulkUpdate,
  };
}
