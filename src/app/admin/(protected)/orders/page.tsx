"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Clock3, PackageCheck, ShieldAlert, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  AdminDetailSheet,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSearchField,
  AdminStatusBadge,
  AdminToolbar,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { formatAdminCurrency, formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import {
  adminOrdersApi,
  type AdminOrderRecord,
  type AdminOrderStatus,
} from "@/services/admin/orders";

const statusTone: Record<AdminOrderStatus, AdminTone> = {
  PENDING: "amber",
  CONFIRMED: "indigo",
  PROCESSING: "sky",
  SHIPPED: "indigo",
  DELIVERED: "emerald",
  CANCELLED: "rose",
  REFUNDED: "zinc",
};

const PAGE_SIZE = 12;

const NEXT_STATUSES: Partial<Record<AdminOrderStatus, AdminOrderStatus[]>> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
};

function getStatusLabel(status: AdminOrderStatus) {
  return toTitleCase(status.toLowerCase());
}

export default function AdminOrdersPage() {
  const identity = useAdminIdentity();
  const canViewOrders = identity ? adminIdentityHasPermission(identity, "view_orders") : false;
  const canManageFulfillment = identity ? adminIdentityHasPermission(identity, "override_orders") : false;

  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminOrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<AdminOrderStatus | "">("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [operationsNotes, setOperationsNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setRequestError(null);
      const response = await adminOrdersApi.fetchOrders({
        page,
        limit: PAGE_SIZE,
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search.trim() || undefined,
        sortBy: "updatedAt",
        sortOrder: "desc",
      });

      setOrders(response.orders);
      setPagination(response.pagination);
    } catch {
      setOrders([]);
      setSelectedOrderId(null);
      setRequestError("The launch control-room queue could not be loaded from the backend.");
      toast.error("Failed to load the admin order queue.");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (!canViewOrders) {
      setLoading(false);
      return;
    }

    void loadOrders();
  }, [canViewOrders, loadOrders]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  useEffect(() => {
    setNextStatus("");
    setTrackingNumber(selectedOrder?.trackingNumber ?? "");
    setOperationsNotes(selectedOrder?.notes ?? "");
    setMutationError(null);
  }, [selectedOrder]);

  const handleOrderMutation = async () => {
    if (!selectedOrder || !nextStatus || !canManageFulfillment) return;

    try {
      setSubmitting(true);
      setMutationError(null);
      const updated = await adminOrdersApi.updateOrder(selectedOrder.id, {
        status: nextStatus,
        ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
        ...(operationsNotes.trim() ? { notes: operationsNotes.trim() } : {}),
      });
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
      toast.success(`Order moved to ${getStatusLabel(updated.status)}.`);
      await loadOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The order update was rejected by the backend.";
      setMutationError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    return {
      total: pagination.total,
      pending: orders.filter((order) => order.status === "PENDING" || order.status === "CONFIRMED").length,
      inFlight: orders.filter((order) => order.status === "PROCESSING" || order.status === "SHIPPED").length,
      delivered: orders.filter((order) => order.status === "DELIVERED").length,
    };
  }, [orders, pagination.total]);

  if (!canViewOrders) {
    return (
      <AdminEmptyState
        title="Access denied"
        description="Your admin role cannot view the launch control-room order queue."
      />
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Order Queue"
        description="Launch control-room view for manual dispatch operations. Payment and delivery snapshots come from backend order records; rider tracking remains manual during MVP."
      />

      <div className="rounded-3xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-900 shadow-sm shadow-amber-900/5">
        Manual delivery remains the MVP truth. Use this queue to review buyer, seller, COD snapshot, and timing context without implying live courier tracking or automated dispatch.
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminMetricCard title="Orders in View" value={summary.total} note="Current filtered queue size" icon={<ClipboardList className="h-5 w-5" />} tone="zinc" />
        <AdminMetricCard title="Needs Action" value={summary.pending} note="Pending or confirmed orders" icon={<ShieldAlert className="h-5 w-5" />} tone="amber" />
        <AdminMetricCard title="In Motion" value={summary.inFlight} note="Processing or shipped manually" icon={<Truck className="h-5 w-5" />} tone="sky" />
        <AdminMetricCard title="Delivered" value={summary.delivered} note="Completed demo or live records" icon={<PackageCheck className="h-5 w-5" />} tone="emerald" />
      </div>

      <AdminToolbar>
        <AdminSearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search order ID, buyer name, email, or phone..."
          className="flex-1"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as AdminOrderStatus | "all");
            setPage(1);
          }}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm"
        >
          <option value="all">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PROCESSING">Processing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </AdminToolbar>

      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-300">
              <tr>
                <th className="rounded-tl-3xl px-5 py-4 font-black">Order</th>
                <th className="px-5 py-4 font-black">Buyer</th>
                <th className="px-5 py-4 font-black">Payment Snapshot</th>
                <th className="px-5 py-4 font-black">Delivery Snapshot</th>
                <th className="px-5 py-4 font-black">Updated</th>
                <th className="rounded-tr-3xl px-5 py-4 text-right font-black">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm font-bold text-zinc-500">
                    Loading launch order queue...
                  </td>
                </tr>
              ) : requestError ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-zinc-700">Order queue unavailable</p>
                        <p className="text-xs font-medium text-zinc-500">
                          {requestError} Retry after confirming your admin session, network, or backend availability.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => void loadOrders()}
                        className="rounded-xl font-black"
                      >
                        Retry queue load
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <AdminEmptyState
                      title="No orders match this control-room view"
                      description="Try widening the status filter or search query."
                    />
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="bg-white/55 transition-colors hover:bg-sky-50/60">
                    <td className="px-5 py-4 align-top">
                      <p className="font-black text-zinc-950">{order.orderNumber}</p>
                      <div className="mt-2">
                        <AdminStatusBadge tone={statusTone[order.status]}>
                          {getStatusLabel(order.status)}
                        </AdminStatusBadge>
                      </div>
                      <p className="mt-2 text-xs font-medium text-zinc-500">
                        {order.items.length} item{order.items.length === 1 ? "" : "s"} across {order.sellerSummaries.length} seller{order.sellerSummaries.length === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-bold text-zinc-800">{order.customer.name}</p>
                      <p className="text-xs font-medium text-zinc-500">{order.customer.email}</p>
                      <p className="text-xs font-medium text-zinc-400">{order.customer.phone ?? "Phone not recorded"}</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-bold text-zinc-900">{formatAdminCurrency(order.totals.grandTotalAmount)}</p>
                      <p className="text-xs font-medium text-zinc-500">
                        Delivery fee {formatAdminCurrency(order.totals.deliveryFeeAmount)} · Cash on delivery {formatAdminCurrency(order.totals.cashDueOnDelivery)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-zinc-400">
                        {toTitleCase(order.payment.method.toLowerCase().replace(/_/g, " "))} · Commitment {toTitleCase(order.payment.commitmentFeeStatus.toLowerCase())}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-bold text-zinc-800">{toTitleCase(order.delivery.method)}</p>
                      <p className="text-xs font-medium text-zinc-500">
                        {order.delivery.shippingAddress.district ?? "District pending"} · {order.delivery.shippingAddress.city ?? "City pending"}
                      </p>
                      <p className="mt-1 text-xs font-bold text-amber-700">Manual dispatch only</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-bold text-zinc-800">{formatAdminDateTime(order.updatedAt)}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-medium text-zinc-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        Created {formatAdminDateTime(order.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right align-top">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedOrderId(order.id)}
                        className="rounded-xl font-black"
                      >
                        Open order
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 ? (
          <div className="flex items-center justify-between border-t border-zinc-100 bg-white/40 px-5 py-3">
            <span className="text-xs font-bold text-zinc-500">
              Page {pagination.page} of {pagination.pages} <span className="text-zinc-400">· {pagination.total} total</span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg font-bold text-xs"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg font-bold text-xs"
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <AdminDetailSheet
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrderId(null);
          }
        }}
        title={selectedOrder?.orderNumber ?? "Order"}
        description={selectedOrder ? `${selectedOrder.customer.name} · ${getStatusLabel(selectedOrder.status)}` : "Order detail"}
      >
        {selectedOrder ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <AdminMetricCard title="Grand Total" value={formatAdminCurrency(selectedOrder.totals.grandTotalAmount)} note="Backend order snapshot" icon={<ClipboardList className="h-4 w-4" />} tone="zinc" />
              <AdminMetricCard title="Delivery Fee" value={formatAdminCurrency(selectedOrder.totals.deliveryFeeAmount)} note="Collected before dispatch where required" icon={<Truck className="h-4 w-4" />} tone="amber" />
              <AdminMetricCard title="Cash on Delivery" value={formatAdminCurrency(selectedOrder.totals.cashDueOnDelivery)} note="Collected at handoff" icon={<PackageCheck className="h-4 w-4" />} tone="emerald" />
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Buyer</h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-700">
                <p><strong>Name:</strong> {selectedOrder.customer.name}</p>
                <p><strong>Email:</strong> {selectedOrder.customer.email}</p>
                <p><strong>Phone:</strong> {selectedOrder.customer.phone ?? "Not recorded"}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Delivery Snapshot</h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-700">
                <p><strong>Method:</strong> {toTitleCase(selectedOrder.delivery.method)}</p>
                <p><strong>Tracking mode:</strong> {toTitleCase(selectedOrder.delivery.trackingMode.replace(/_/g, " "))}</p>
                <p><strong>Recipient:</strong> {selectedOrder.delivery.shippingAddress.fullName ?? "Not recorded"}</p>
                <p><strong>Phone:</strong> {selectedOrder.delivery.shippingAddress.phone ?? "Not recorded"}</p>
                <p><strong>Address:</strong> {selectedOrder.delivery.shippingAddress.addressLine ?? "Not recorded"}</p>
                <p><strong>Area:</strong> {[selectedOrder.delivery.shippingAddress.district, selectedOrder.delivery.shippingAddress.city].filter(Boolean).join(", ") || "Not recorded"}</p>
                <p><strong>Tracking number:</strong> {selectedOrder.trackingNumber ?? "Manual only"}</p>
                <p><strong>Estimated delivery:</strong> {formatAdminDateTime(selectedOrder.estimatedDelivery)}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-zinc-50 p-4">
              <h3 className="text-sm font-black text-zinc-950">Seller Coverage</h3>
              <div className="mt-3 space-y-3">
                {selectedOrder.sellerSummaries.map((seller) => (
                  <div key={seller.userId} className="rounded-2xl border border-zinc-200 bg-white p-3">
                    <p className="text-sm font-black text-zinc-950">{seller.storeName ?? "Seller store pending"}</p>
                    <p className="text-xs font-bold text-zinc-500">
                      {seller.itemCount} item{seller.itemCount === 1 ? "" : "s"} · Seller status {seller.applicationStatus ?? "Unavailable"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Items</h3>
              <div className="mt-3 space-y-3">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-zinc-950">{item.title}</p>
                        <p className="text-xs font-medium text-zinc-500">
                          {item.seller.storeName ?? item.seller.name} · Vendor item status {toTitleCase(item.vendorStatus.toLowerCase())}
                        </p>
                      </div>
                      <p className="text-sm font-black text-zinc-950">{formatAdminCurrency(item.lineTotal)}</p>
                    </div>
                    <p className="mt-2 text-xs font-medium text-zinc-500">
                      Quantity {item.quantity} · Unit price {formatAdminCurrency(item.price)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-4">
              <h3 className="text-sm font-black text-amber-900">Operations Note</h3>
              <p className="mt-2 text-sm text-amber-900">
                Dispatch and delivery updates remain manual in MVP. This queue reflects backend order snapshots and should not be read as live rider telemetry.
              </p>
              {selectedOrder.notes ? (
                <p className="mt-3 text-sm font-medium text-amber-950">
                  <strong>Order note:</strong> {selectedOrder.notes}
                </p>
              ) : null}
            </div>

            {canManageFulfillment ? (
              <div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-4">
                <h3 className="text-sm font-black text-sky-950">Fulfillment Control</h3>
                <p className="mt-1 text-xs font-medium text-sky-800">
                  Record manual operations only. Delivery means physical handoff and does not change payment, remittance, wallet, payout, or refund state.
                </p>
                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-xs font-bold text-zinc-700">
                    Next status
                    <select
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value as AdminOrderStatus | "")}
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold"
                    >
                      <option value="">Select an allowed transition</option>
                      {(NEXT_STATUSES[selectedOrder.status] ?? []).map((status) => (
                        <option key={status} value={status}>{getStatusLabel(status)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-zinc-700">
                    External courier reference
                    <input
                      value={trackingNumber}
                      onChange={(event) => setTrackingNumber(event.target.value)}
                      maxLength={120}
                      placeholder="Manual courier or dispatch reference"
                      className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-zinc-700">
                    Operations notes
                    <textarea
                      value={operationsNotes}
                      onChange={(event) => setOperationsNotes(event.target.value)}
                      maxLength={1000}
                      rows={3}
                      placeholder="Concise dispatch or handoff context. Do not enter credentials or financial secrets."
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium"
                    />
                  </label>
                  {mutationError ? <p className="text-xs font-bold text-rose-700">{mutationError}</p> : null}
                  {(NEXT_STATUSES[selectedOrder.status] ?? []).length > 0 ? (
                    <Button
                      disabled={!nextStatus || submitting}
                      onClick={() => void handleOrderMutation()}
                      className="rounded-xl bg-zinc-950 font-black text-white"
                    >
                      {submitting ? "Saving backend update..." : "Apply fulfillment update"}
                    </Button>
                  ) : (
                    <p className="text-xs font-bold text-zinc-500">No fulfillment transition is available from this status.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-medium text-zinc-600">
                This account has read-only order access. Fulfillment changes require operations authority.
              </div>
            )}
          </div>
        ) : (
          <AdminEmptyState title="No order selected" description="Open an order from the queue to inspect its launch operations context." />
        )}
      </AdminDetailSheet>
    </div>
  );
}
