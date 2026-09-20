/**
 * @file OrdersMobileCards.tsx
 * @module features/admin-orders/components
 * @description
 * Mobile-first card list for viewport < 1024px in the Orders Control Center.
 * Provides a tactile, tap-friendly card presentation with essential dispatch metadata.
 */

import React from "react";
import { Clock3, ExternalLink, ShieldAlert, Store, User } from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import {
  formatAdminCurrency,
  formatAdminDateTime,
} from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type { AdminOrderRecord } from "../types";
import { ORDER_STATUS_METADATA } from "../types";

interface OrdersMobileCardsProps {
  orders: AdminOrderRecord[];
  loading?: boolean;
  requestError?: string | null;
  onRetry?: () => void;
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  className?: string;
}

export function OrdersMobileCards({
  orders,
  loading = false,
  requestError,
  onRetry,
  selectedOrderId,
  onSelectOrder,
  className,
}: OrdersMobileCardsProps) {
  if (loading) {
    return (
      <div className={cn("grid gap-3 lg:hidden", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`mobile-skeleton-${i}`}
            className="h-44 animate-pulse rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_20%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm"
          />
        ))}
      </div>
    );
  }

  if (requestError) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm lg:hidden",
          className
        )}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-black text-zinc-900">Order queue unavailable</p>
        <p className="mt-1 text-xs font-medium text-zinc-500">{requestError}</p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="mt-4 rounded-xl border-zinc-200 font-black text-xs"
          >
            Retry queue load
          </Button>
        )}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-8 text-center lg:hidden",
          className
        )}
      >
        <p className="text-sm font-black text-[var(--admin-ink,#171a16)]">
          No orders found
        </p>
        <p className="mt-1 text-xs font-medium text-[var(--admin-ink-soft,#5f625a)]">
          Try switching queue tabs or adjusting search filters.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3 lg:hidden", className)}>
      {orders.map((order) => {
        const meta = ORDER_STATUS_METADATA[order.status] ?? {
          label: order.status,
          tone: "zinc" as const,
        };
        const isSelected = order.id === selectedOrderId;

        return (
          <div
            key={order.id}
            onClick={() => onSelectOrder(order.id)}
            className={cn(
              "cursor-pointer rounded-2xl border bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-[0_4px_16px_rgb(6_59_41_/_4%)] transition-all duration-200",
              isSelected
                ? "border-[var(--admin-canopy,#075b36)] ring-2 ring-[var(--admin-canopy,#075b36)]/20"
                : "border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] hover:border-[var(--admin-canopy,#075b36)]/50"
            )}
          >
            {/* Header: Number & Badge */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-black tracking-tight text-[var(--admin-ink,#171a16)]">
                  {order.orderNumber}
                </span>
                <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[var(--admin-ink,#171a16)]">
                  <User className="h-3.5 w-3.5 text-[var(--admin-ink-soft,#5f625a)]" />
                  <span>{order.customer.name}</span>
                </div>
              </div>
              <AdminStatusBadge tone={meta.tone}>{meta.label}</AdminStatusBadge>
            </div>

            {/* Financial and Delivery summary */}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_18%,transparent)] bg-[var(--admin-surface-mist,#f6eedf)] p-2.5 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  Grand Total
                </span>
                <p className="font-black text-[var(--admin-ink,#171a16)]">
                  {formatAdminCurrency(order.totals.grandTotalAmount)}
                </p>
                <p className="text-[10px] font-medium text-[var(--admin-ink-soft,#5f625a)]">
                  COD: {formatAdminCurrency(order.totals.cashDueOnDelivery)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  Delivery Area
                </span>
                <p className="truncate font-bold text-[var(--admin-ink,#171a16)]">
                  {[
                    order.delivery.shippingAddress.district,
                    order.delivery.shippingAddress.city,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Lusaka"}
                </p>
                <p className="text-[10px] font-black text-amber-800">
                  Manual dispatch
                </p>
              </div>
            </div>

            {/* Store & items breakdown */}
            <div className="mt-2.5 flex items-center justify-between text-xs text-[var(--admin-ink-soft,#5f625a)]">
              <div className="flex items-center gap-1 font-medium">
                <Store className="h-3.5 w-3.5" />
                <span>
                  {order.sellerSummaries.length} seller{order.sellerSummaries.length === 1 ? "" : "s"} · {order.items.length} item{order.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <Clock3 className="h-3 w-3" />
                <span>{formatAdminDateTime(order.updatedAt)}</span>
              </div>
            </div>

            {/* Inspect Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelectOrder(order.id);
              }}
              className="mt-3 w-full rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white font-black text-xs text-[var(--admin-canopy-deep,#063b29)] shadow-sm hover:bg-[var(--admin-surface-mist,#f6eedf)]"
            >
              <span>Inspect fulfillment details</span>
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
