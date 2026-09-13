/**
 * @file use-admin-orders.ts
 * @module features/admin-orders/hooks
 * @description
 * Primary state management hook for Admin Orders & Fulfillment Center.
 * Handles queue tab filtering, debounced search, pagination, order selection,
 * fulfillment mutations, and scroll position restoration across return navigation.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import {
  fetchAdminOrders,
  updateAdminOrderStatus,
} from "../api/admin-orders";
import type {
  AdminOrderRecord,
  AdminOrdersPagination,
  AdminOrdersQuery,
  AdminOrderStatus,
  OrderCancellationReason,
  OrderQueueTabKey,
} from "../types";
import { ORDER_STATUS_METADATA } from "../types";

const PAGE_SIZE = 12;

interface UseAdminOrdersOptions {
  enabled?: boolean;
}

export function useAdminOrders({ enabled = true }: UseAdminOrdersOptions = {}) {
  // Collection State
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [pagination, setPagination] = useState<AdminOrdersPagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Filter & Queue Tab State
  const [activeTab, setActiveTab] = useState<OrderQueueTabKey>("all");
  const [statusFilter, setStatusFilter] = useState<AdminOrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Inspector & Sheet State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Fulfillment Mutation State
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [search]);

  // Return navigation scroll position preservation
  useListScrollRestoration("/admin/orders", !loading);

  // Determine query parameters based on active tab & filters
  const resolveEffectiveStatus = useCallback((): AdminOrderStatus | undefined => {
    if (statusFilter !== "all") {
      return statusFilter;
    }
    if (activeTab === "delivered") {
      return "DELIVERED";
    }
    return undefined;
  }, [activeTab, statusFilter]);

  // Load orders from API
  const loadOrders = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setRequestError(null);

      const effectiveStatus = resolveEffectiveStatus();

      const query: AdminOrdersQuery = {
        page,
        limit: PAGE_SIZE,
        status: effectiveStatus,
        search: debouncedSearch.trim() || undefined,
        sortBy: "updatedAt",
        sortOrder: "desc",
      };

      const response = await fetchAdminOrders(query);
      setOrders(response.orders);
      setPagination(response.pagination);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load the admin order queue.";
      setOrders([]);
      setRequestError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, enabled, page, resolveEffectiveStatus]);

  // Fetch orders when dependencies update
  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // Filter orders according to active tab if multi-status tab is active
  const filteredOrders = useMemo(() => {
    if (activeTab === "all") return orders;
    if (activeTab === "needs_action") {
      return orders.filter(
        (o) => o.status === "PENDING" || o.status === "CONFIRMED"
      );
    }
    if (activeTab === "in_motion") {
      return orders.filter(
        (o) => o.status === "PROCESSING" || o.status === "SHIPPED"
      );
    }
    if (activeTab === "delivered") {
      return orders.filter((o) => o.status === "DELIVERED");
    }
    if (activeTab === "exceptions") {
      return orders.filter(
        (o) => o.status === "CANCELLED" || o.status === "REFUNDED"
      );
    }
    return orders;
  }, [activeTab, orders]);

  // Selected Order instance
  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  // Tab Badge Counts derived from current operational snapshot
  const tabCounts = useMemo(() => {
    return {
      all: pagination.total,
      needs_action: orders.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED").length,
      in_motion: orders.filter((o) => o.status === "PROCESSING" || o.status === "SHIPPED").length,
      delivered: orders.filter((o) => o.status === "DELIVERED").length,
      exceptions: orders.filter((o) => o.status === "CANCELLED" || o.status === "REFUNDED").length,
    };
  }, [orders, pagination.total]);

  // Queue Summary Metrics
  const summaryMetrics = useMemo(() => {
    return {
      total: pagination.total,
      pending: orders.filter((o) => o.status === "PENDING" || o.status === "CONFIRMED").length,
      inFlight: orders.filter((o) => o.status === "PROCESSING" || o.status === "SHIPPED").length,
      delivered: orders.filter((o) => o.status === "DELIVERED").length,
    };
  }, [orders, pagination.total]);

  // Tab switcher handler
  const handleTabChange = useCallback((newTab: OrderQueueTabKey) => {
    setActiveTab(newTab);
    setStatusFilter("all");
    setPage(1);
  }, []);

  // Fulfillment status mutation handler
  const handleUpdateStatus = useCallback(
    async (
      orderId: string,
      payload: {
        status: AdminOrderStatus;
        trackingNumber?: string;
        notes?: string;
        cancellationReason?: OrderCancellationReason;
      }
    ) => {
      try {
        setIsMutating(true);
        setMutationError(null);

        const updatedOrder = await updateAdminOrderStatus(orderId, payload);

        setOrders((current) =>
          current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
        );

        const newStatusLabel = ORDER_STATUS_METADATA[updatedOrder.status]?.label ?? updatedOrder.status;
        toast.success(`Order ${updatedOrder.orderNumber} updated to ${newStatusLabel}`);

        // Refresh list to keep totals synchronized
        await loadOrders();
        return updatedOrder;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The order update was rejected by the backend.";
        setMutationError(message);
        toast.error(message);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [loadOrders]
  );

  return {
    // Data
    orders: filteredOrders,
    rawOrders: orders,
    pagination,
    loading,
    requestError,
    selectedOrderId,
    selectedOrder,
    setSelectedOrderId,

    // Controls
    activeTab,
    handleTabChange,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    reloadOrders: loadOrders,

    // Aggregates & Metrics
    tabCounts,
    summaryMetrics,

    // Mutations
    handleUpdateStatus,
    isMutating,
    mutationError,
  };
}
