/**
 * @file OrdersTable.tsx
 * @module features/admin-orders/components
 * @description
 * Dense, tactile desktop table for the Orders & Fulfillment Control Center.
 * Displays order references, status badges, buyer identities, payment/COD breakdown,
 * delivery locations, seller coverage, and inspection triggers with smooth row highlighting.
 */

import React from "react";
import { Clock3, ExternalLink, ShieldAlert, Store, User } from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import {
  formatAdminCurrency,
  formatAdminDateTime,
  toTitleCase,
} from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type { AdminOrderRecord } from "../types";
import { ORDER_STATUS_METADATA } from "../types";

interface OrdersTableProps {
  orders: AdminOrderRecord[];
  loading?: boolean;
  requestError?: string | null;
  onRetry?: () => void;
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  className?: string;
}

export function OrdersTable({
  orders,
  loading = false,
  requestError,
  onRetry,
  selectedOrderId,
  onSelectOrder,
  className,
}: OrdersTableProps) {
  return (
    <section
      aria-label="Orders queue table"
      className={cn(
        "overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] shadow-[0_12px_32px_rgb(6_59_41_/_6%)]",
        className
      )}
    >
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[1120px] text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-canopy-deep,#063b29)] text-[10px] font-black uppercase tracking-wider text-[var(--admin-surface-cream,#fff8ec)]">
              <th scope="col" className="px-5 py-3.5">Order & Status</th>
              <th scope="col" className="px-5 py-3.5">Buyer</th>
              <th scope="col" className="px-5 py-3.5">Payment Snapshot</th>
              <th scope="col" className="px-5 py-3.5">Delivery & Area</th>
              <th scope="col" className="px-5 py-3.5">Seller Coverage</th>
              <th scope="col" className="px-5 py-3.5">Timeline</th>
              <th scope="col" className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_18%,transparent)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`orders-skeleton-${index}`} className="animate-pulse">
                  <td colSpan={7} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-28 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_16%,transparent)]" />
                      <div className="h-6 w-44 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_12%,transparent)]" />
                      <div className="h-6 w-36 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_12%,transparent)]" />
                      <div className="ml-auto h-8 w-20 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_16%,transparent)]" />
                    </div>
                  </td>
                </tr>
              ))
            ) : requestError ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-900">Order queue unavailable</p>
                      <p className="mt-1 text-xs text-zinc-500 font-medium">
                        {requestError}
                      </p>
                    </div>
                    {onRetry && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onRetry}
                        className="rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_38%,transparent)] bg-white font-black text-xs hover:bg-[var(--admin-surface-mist,#f6eedf)]"
                      >
                        Retry queue load
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center">
                  <div className="mx-auto max-w-sm space-y-1">
                    <p className="text-sm font-black text-[var(--admin-ink,#171a16)]">
                      No orders in this queue
                    </p>
                    <p className="text-xs font-medium text-[var(--admin-ink-soft,#5f625a)]">
                      No orders match the selected queue filter or search keywords.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const meta = ORDER_STATUS_METADATA[order.status] ?? {
                  label: order.status,
                  tone: "zinc" as const,
                };
                const isSelected = order.id === selectedOrderId;

                return (
                  <tr
                    key={order.id}
                    onClick={() => onSelectOrder(order.id)}
                    className={cn(
                      "cursor-pointer transition-colors duration-150",
                      isSelected
                        ? "bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_10%,transparent)] ring-1 ring-inset ring-[var(--admin-canopy,#075b36)]"
                        : "hover:bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_5%,transparent)]"
                    )}
                  >
                    {/* Order Number & Status */}
                    <td className="px-5 py-4 align-top">
                      <div className="font-mono text-xs font-black tracking-tight text-[var(--admin-ink,#171a16)]">
                        {order.orderNumber}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <AdminStatusBadge tone={meta.tone}>
                          {meta.label}
                        </AdminStatusBadge>
                        {order.trackingNumber && (
                          <span
                            title={`Courier Ref: ${order.trackingNumber}`}
                            className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[9px] font-bold text-zinc-600 truncate max-w-[100px]"
                          >
                            {order.trackingNumber}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Buyer Details */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--admin-ink,#171a16)]">
                        <User className="h-3.5 w-3.5 text-[var(--admin-ink-soft,#5f625a)]" />
                        <span>{order.customer.name}</span>
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-[var(--admin-ink-soft,#5f625a)]">
                        {order.customer.email}
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono text-zinc-500">
                        {order.customer.phone || "No phone recorded"}
                      </div>
                    </td>

                    {/* Payment Snapshot */}
                    <td className="px-5 py-4 align-top">
                      <div className="text-xs font-black text-[var(--admin-ink,#171a16)]">
                        {formatAdminCurrency(order.totals.grandTotalAmount)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[var(--admin-ink-soft,#5f625a)]">
                        Delivery: {formatAdminCurrency(order.totals.deliveryFeeAmount)} · COD: {formatAdminCurrency(order.totals.cashDueOnDelivery)}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-black uppercase text-[var(--admin-ember,#d96a1f)]">
                        <span>{toTitleCase(order.payment.method)}</span>
                        <span>·</span>
                        <span>Fee {order.payment.commitmentFeeStatus.toLowerCase()}</span>
                      </div>
                    </td>

                    {/* Delivery & Area */}
                    <td className="px-5 py-4 align-top">
                      <div className="text-xs font-bold text-[var(--admin-ink,#171a16)]">
                        {[
                          order.delivery.shippingAddress.district,
                          order.delivery.shippingAddress.city,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Area not recorded"}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[var(--admin-ink-soft,#5f625a)] truncate max-w-[180px]">
                        {order.delivery.shippingAddress.addressLine || "Address pending"}
                      </div>
                      <div className="mt-1 inline-flex items-center rounded-md border border-amber-200 bg-amber-50/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900">
                        Manual Dispatch
                      </div>
                    </td>

                    {/* Seller Coverage */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-1 text-xs font-bold text-[var(--admin-ink,#171a16)]">
                        <Store className="h-3.5 w-3.5 text-[var(--admin-ink-soft,#5f625a)]" />
                        <span>
                          {order.sellerSummaries.length} seller{order.sellerSummaries.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[var(--admin-ink-soft,#5f625a)]">
                        {order.items.length} total line item{order.items.length === 1 ? "" : "s"}
                      </div>
                    </td>

                    {/* Timeline */}
                    <td className="px-5 py-4 align-top">
                      <div className="text-xs font-bold text-[var(--admin-ink,#171a16)]">
                        {formatAdminDateTime(order.updatedAt)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--admin-ink-soft,#5f625a)]">
                        <Clock3 className="h-3 w-3" />
                        <span>Placed {formatAdminDateTime(order.createdAt)}</span>
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="px-5 py-4 text-right align-top">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOrder(order.id);
                        }}
                        className="rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white font-black text-xs text-[var(--admin-canopy-deep,#063b29)] shadow-sm hover:bg-[var(--admin-surface-mist,#f6eedf)]"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
