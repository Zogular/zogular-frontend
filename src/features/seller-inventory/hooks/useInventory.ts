import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { inventoryApi, type InventoryProduct } from "@/services/inventory";
import { getStatusInfo, parseStockInput } from "../utils/inventory-utils";
import type { InventoryStatus, SortOption } from "../types/inventory-types";
import type { CollectionViewMode } from "@/components/shared/CollectionViewToggle";

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [mobileView, setMobileView] = useState<CollectionViewMode>("list");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingStock, setEditingStock] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [bulkStockValue, setBulkStockValue] = useState("");
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await inventoryApi.fetchAll();
      setInventory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const categories = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.category.name))).sort(),
    [inventory],
  );

  const lowStockItems = useMemo(
    () => inventory.filter((item) => item.stock > 0 && item.stock <= item.threshold),
    [inventory],
  );

  const outOfStockItems = useMemo(
    () => inventory.filter((item) => item.stock === 0),
    [inventory],
  );

  const filteredAndSorted = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = inventory.filter((item) => {
      const matchesSearch =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.sku.toLowerCase().includes(normalizedQuery);

      const matchesCategory =
        categoryFilter === "all" || item.category.name === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        getStatusInfo(item.stock, item.threshold).state === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "stock-low") return a.stock - b.stock;
      if (sortBy === "stock-high") return b.stock - a.stock;
      return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    });
  }, [inventory, searchQuery, categoryFilter, statusFilter, sortBy]);

  const allFilteredSelected =
    filteredAndSorted.length > 0 &&
    filteredAndSorted.every((item) => selectedIds.has(item.id));

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    setSelectedIds(() => {
      if (allFilteredSelected) return new Set<string>();
      return new Set(filteredAndSorted.map((item) => item.id));
    });
  };

  const updateEditingStock = (id: string, value: string) => {
    setEditingStock((prev) => ({ ...prev, [id]: value }));
  };

  const clearEditingStock = (id: string) => {
    setEditingStock((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleInlineStockSave = async (id: string, overrideValue?: number) => {
    const rawValue = overrideValue !== undefined ? String(overrideValue) : editingStock[id];
    const parsedValue = parseStockInput(rawValue ?? "");

    if (parsedValue === null) {
      toast.error("Enter a valid stock number.");
      return;
    }

    setIsSaving((prev) => ({ ...prev, [id]: true }));

    try {
      const result = await inventoryApi.updateStock(id, parsedValue);

      setInventory((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, stock: result.stock } : item,
        ),
      );

      clearEditingStock(id);
      toast.success("Stock updated successfully.");
    } catch {
      toast.error("Failed to update stock.");
    } finally {
      setIsSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  const adjustStock = (id: string, currentStock: number, delta: number) => {
    const currentEditValue = editingStock[id];
    const baseValue =
      currentEditValue !== undefined ? parseStockInput(currentEditValue) : currentStock;

    const nextValue = Math.max(0, (baseValue ?? currentStock) + delta);
    updateEditingStock(id, String(nextValue));
  };

  const handleBulkUpdate = async () => {
    const parsedBulkStock = parseStockInput(bulkStockValue);

    if (parsedBulkStock === null) {
      toast.error("Enter a valid stock number.");
      return;
    }

    const ids = Array.from(selectedIds);
    if (ids.length === 0) {
      toast.error("Select at least one item.");
      return;
    }

    setIsBulkSaving(true);

    try {
      const result = await inventoryApi.bulkUpdateStock(ids, parsedBulkStock);

      setInventory((prev) =>
        prev.map((item) =>
          result.ids.includes(item.id) ? { ...item, stock: result.stock } : item,
        ),
      );

      setSelectedIds(new Set());
      setBulkStockValue("");
      toast.success(`Updated ${result.ids.length} item${result.ids.length > 1 ? "s" : ""}.`);
    } catch {
      toast.error("Failed to bulk update items.");
    } finally {
      setIsBulkSaving(false);
    }
  };

  return {
    inventory,
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
  };
}
