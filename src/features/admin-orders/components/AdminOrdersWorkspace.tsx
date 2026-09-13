/**
 * @file AdminOrdersWorkspace.tsx
 * @module features/admin-orders/components
 * @description
 * Primary workspace coordinator for F6 Orders & Fulfillment Control Center.
 * Combines header telemetry, metric indicators, lifecycle queue tabs, search toolbar,
 * responsive desktop/mobile presentations, pagination, and inspection drawer.
 */

"use client";

import React from "react";
import {
  ClipboardList,
  PackageCheck,
  RotateCw,
  ShieldAlert,
  Truck,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSearchField,
  AdminToolbar,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { cn } from "@/lib/utils";
import { useAdminOrders } from "../hooks/use-admin-orders";
import { OrderQueueTabs } from "./OrderQueueTabs";
import { OrdersTable } from "./OrdersTable";
import { OrdersMobileCards } from "./OrdersMobileCards";
import { OrderDetailSheet } from "./OrderDetailSheet";
import type { AdminOrderStatus } from "../types";
import { ORDER_STATUS_METADATA } from "../types";

export function AdminOrdersWorkspace() {
  const identity = useAdminIdentity();
  const canViewOrders = identity
    ? adminIdentityHasPermission(identity, "view_all_orders")
    : false;
  const canManageFulfillment = identity
    ? adminIdentityHasPermission(identity, "manage_order_fulfillment")
    : false;

  const {
    orders,
    pagination,
    loading,
    requestError,
    selectedOrderId,
    selectedOrder,
    setSelectedOrderId,
    activeTab,
    handleTabChange,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    setPage,
    reloadOrders,
    tabCounts,
    summaryMetrics,
    handleUpdateStatus,
    isMutating,
    mutationError,
  } = useAdminOrders({ enabled: canViewOrders });

  if (!canViewOrders) {
    return (
      <AdminEmptyState
        title="Access denied"
        description="Your admin role lacks the view_all_orders permission required to inspect the fulfillment queue."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Operational Context */}
      <AdminPageHeader
        title="Orders & Fulfillment Control Center"
        description="Launch control-room view for manual dispatch operations. Real-time COD calculation, seller splits, and courier tracking updates."
      />

      {/* 2. Tactical Advisory Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-xs font-medium text-amber-950 shadow-sm">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" />
        <span>
          <strong>Manual Dispatch Operations:</strong> Courier dispatch is coordinated manually during the launch phase. Tracking updates record external rider references without automated rider telemetry.
        </span>
      </div>

      {/* 3. Metric Indicator Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminMetricCard
          title="Orders in View"
          value={summaryMetrics.total}
          note="Total orders matching filter"
          icon={<ClipboardList className="h-5 w-5" />}
          tone="zinc"
        />
        <AdminMetricCard
          title="Needs Action"
          value={summaryMetrics.pending}
          note="Pending or confirmed orders"
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="amber"
        />
        <AdminMetricCard
          title="In Motion"
          value={summaryMetrics.inFlight}
          note="Preparing or out with rider"
          icon={<Truck className="h-5 w-5" />}
          tone="sky"
        />
        <AdminMetricCard
          title="Delivered"
          value={summaryMetrics.delivered}
          note="Handed over & settled"
          icon={<PackageCheck className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      {/* 4. Queue Lifecycle Tabs */}
      <OrderQueueTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={tabCounts}
      />

      {/* 5. Search & Filter Toolbar */}
      <AdminToolbar>
        <AdminSearchField
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search by order number, buyer name, email, or telephone..."
          className="flex-1"
        />

        <div className="flex items-center gap-2">
          {/* Specific status filter selector */}
          <select
            aria-label="Filter by order status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as AdminOrderStatus | "all");
              setPage(1);
            }}
            className="h-11 rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white px-3 text-xs font-black text-[var(--admin-ink,#171a16)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy,#075b36)]"
          >
            <option value="all">All statuses in tab</option>
            {Object.entries(ORDER_STATUS_METADATA).map(([statusKey, meta]) => (
              <option key={statusKey} value={statusKey}>
                {meta.label}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void reloadOrders()}
            disabled={loading}
            aria-label="Refresh orders queue"
            title="Refresh queue"
            className="h-11 w-11 shrink-0 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white shadow-sm hover:bg-[var(--admin-surface-mist,#f6eedf)]"
          >
            <RotateCw className={cn("h-4 w-4 text-[var(--admin-canopy-deep,#063b29)]", loading && "animate-spin")} />
          </Button>
        </div>
      </AdminToolbar>

      {/* 6. Desktop Table Presentation */}
      <div className="hidden lg:block">
        <OrdersTable
          orders={orders}
          loading={loading}
          requestError={requestError}
          onRetry={reloadOrders}
          selectedOrderId={selectedOrderId}
          onSelectOrder={(id) => setSelectedOrderId(id)}
        />
      </div>

      {/* 7. Mobile Card List Presentation */}
      <OrdersMobileCards
        orders={orders}
        loading={loading}
        requestError={requestError}
        onRetry={reloadOrders}
        selectedOrderId={selectedOrderId}
        onSelectOrder={(id) => setSelectedOrderId(id)}
      />

      {/* 8. Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] px-4 py-3 shadow-sm">
          <span className="text-xs font-bold text-[var(--admin-ink-soft,#5f625a)]">
            Page {pagination.page} of {pagination.pages}
            <span className="ml-1 text-zinc-400">· {pagination.total} total orders</span>
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage((curr) => Math.max(1, curr - 1))}
              className="h-8 rounded-lg border-zinc-200 bg-white text-xs font-black text-[var(--admin-ink,#171a16)] hover:bg-[var(--admin-surface-mist,#f6eedf)]"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() => setPage((curr) => Math.min(pagination.pages, curr + 1))}
              className="h-8 rounded-lg border-zinc-200 bg-white text-xs font-black text-[var(--admin-ink,#171a16)] hover:bg-[var(--admin-surface-mist,#f6eedf)]"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* 9. Slide-out Inspection & Fulfillment Sheet */}
      <OrderDetailSheet
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrderId(null);
          }
        }}
        canManageFulfillment={canManageFulfillment}
        onUpdateStatus={handleUpdateStatus}
        isMutating={isMutating}
        mutationError={mutationError}
      />
    </div>
  );
}
