/**
 * @file OrderDetailSheet.tsx
 * @module features/admin-orders/components
 * @description
 * Tactical slide-out detail sheet for inspection and manual fulfillment management.
 * Features financial metric strips, delivery snapshots, visual order lifecycle stepper,
 * buyer quick-actions (Call, WhatsApp, Email), multi-seller line item breakdown,
 * printable dispatch packing slips, and cancellation confirmation workflows.
 */

"use client";

import React, { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Printer,
  ShieldCheck,
  Store,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import {
  AdminDetailSheet,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import {
  formatAdminCurrency,
  formatAdminDateTime,
  toTitleCase,
} from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type {
  AdminOrderRecord,
  AdminOrderStatus,
  OrderCancellationReason,
} from "../types";
import {
  getOrderTimelineSteps,
  NEXT_STATUSES,
  ORDER_STATUS_METADATA,
} from "../types";
import { OrderPackingSlipModal } from "./OrderPackingSlipModal";
import { OrderCancellationDialog } from "./OrderCancellationDialog";

interface OrderDetailSheetProps {
  order: AdminOrderRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManageFulfillment?: boolean;
  onUpdateStatus: (
    orderId: string,
    payload: {
      status: AdminOrderStatus;
      trackingNumber?: string;
      notes?: string;
      cancellationReason?: OrderCancellationReason;
    }
  ) => Promise<unknown>;
  isMutating?: boolean;
  mutationError?: string | null;
}

interface OrderDetailContentProps {
  order: AdminOrderRecord;
  canManageFulfillment: boolean;
  onUpdateStatus: (
    orderId: string,
    payload: {
      status: AdminOrderStatus;
      trackingNumber?: string;
      notes?: string;
      cancellationReason?: OrderCancellationReason;
    }
  ) => Promise<unknown>;
  isMutating: boolean;
  mutationError?: string | null;
  onOpenPackingSlip: () => void;
  onOpenCancellationDialog: () => void;
  nextStatus: AdminOrderStatus | "";
  setNextStatus: React.Dispatch<React.SetStateAction<AdminOrderStatus | "">>;
  notes: string;
  setNotes: React.Dispatch<React.SetStateAction<string>>;
  trackingNumber: string;
  setTrackingNumber: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Normalizes phone numbers for WhatsApp Zambian standard format (260XXXXXXXXX).
 */
function getWhatsAppCleanPhone(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  const cleaned = rawPhone.replace(/\D/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "260" + cleaned.slice(1);
  }
  if (cleaned.startsWith("260")) {
    return cleaned;
  }
  return cleaned;
}

function OrderDetailContent({
  order,
  canManageFulfillment,
  onUpdateStatus,
  isMutating,
  mutationError,
  onOpenPackingSlip,
  onOpenCancellationDialog,
  nextStatus,
  setNextStatus,
  notes,
  setNotes,
  trackingNumber,
  setTrackingNumber,
}: OrderDetailContentProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const currentMeta = ORDER_STATUS_METADATA[order.status] ?? {
    label: order.status,
    tone: "zinc" as const,
  };

  const allowedTransitions = NEXT_STATUSES[order.status] ?? [];
  const timelineSteps = getOrderTimelineSteps(order);

  // Phone numbers and contact details
  const buyerPhone = order.customer.phone || order.delivery.shippingAddress.phone;
  const cleanPhone = getWhatsAppCleanPhone(buyerPhone);
  const customerName = order.customer.name;
  const orderNumber = order.orderNumber;
  const whatsappPreFilledText = `Hello ${customerName}, this is Zogular Logistics regarding your order #${orderNumber}...`;

  const handleSubmitFulfillment = async () => {
    if (!nextStatus) {
      setLocalError("Please select a target status transition.");
      return;
    }

    // Intercept cancellation to prompt for operational reason
    if (nextStatus === "CANCELLED") {
      onOpenCancellationDialog();
      return;
    }

    setLocalError(null);

    try {
      await onUpdateStatus(order.id, {
        status: nextStatus,
        ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setNextStatus("");
    } catch {
      // Error handled by parent hook & toast
    }
  };

  return (
    <div className="space-y-6">
      {/* 0. DISPATCH ACTION BAR */}
      <div className="flex items-center justify-between rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--admin-surface-mist,#f6eedf)] text-[var(--admin-canopy-deep,#063b29)]">
            <Printer className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-black text-[var(--admin-ink,#171a16)]">
              Courier Packing Slip & Dispatch Manifest
            </p>
            <p className="text-[10px] font-medium text-[var(--admin-ink-soft,#5f625a)]">
              Standard printable manifest for Lusaka dispatchers & riders
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onOpenPackingSlip}
          className="h-8 gap-1.5 rounded-xl bg-[var(--admin-canopy-deep,#063b29)] px-3 text-xs font-black text-[var(--admin-surface-cream,#fff8ec)] shadow-xs hover:bg-[var(--admin-canopy,#075b36)]"
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print Manifest</span>
        </Button>
      </div>

      {/* 1. FINANCIAL METRIC STRIP */}
      <section aria-label="Financial Summary" className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)]">
            <Banknote className="h-3.5 w-3.5 text-[var(--admin-canopy,#075b36)]" />
            <span>Grand Total</span>
          </div>
          <p className="mt-1 text-sm font-black text-[var(--admin-ink,#171a16)]">
            {formatAdminCurrency(order.totals.grandTotalAmount)}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-[var(--admin-ink-soft,#5f625a)] truncate">
            Items: {formatAdminCurrency(order.totals.itemSubtotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)]">
            <Truck className="h-3.5 w-3.5 text-amber-600" />
            <span>Delivery Fee</span>
          </div>
          <p className="mt-1 text-sm font-black text-[var(--admin-ink,#171a16)]">
            {formatAdminCurrency(order.totals.deliveryFeeAmount)}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-[var(--admin-ink-soft,#5f625a)]">
            Pre-dispatch rule
          </p>
        </div>

        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
            <span>Cash Due (COD)</span>
          </div>
          <p className="mt-1 text-sm font-black text-[var(--admin-ink,#171a16)]">
            {formatAdminCurrency(order.totals.cashDueOnDelivery)}
          </p>
          <p className="mt-0.5 text-[10px] font-medium text-[var(--admin-ink-soft,#5f625a)]">
            Due at handoff
          </p>
        </div>
      </section>

      {/* 2. ORDER TIMELINE & STEPPER */}
      <section
        aria-label="Order Lifecycle Timeline"
        className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ink,#171a16)]">
            Order Lifecycle Stepper
          </h3>
          <AdminStatusBadge tone={currentMeta.tone}>
            {currentMeta.label}
          </AdminStatusBadge>
        </div>

        <div className="mt-4 space-y-3">
          {timelineSteps.map((step, idx) => {
            const isCompleted = step.status === "completed";
            const isCurrent = step.status === "current";
            const isCancelled = step.status === "cancelled";

            return (
              <div key={step.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                      isCompleted
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : isCurrent
                        ? "bg-[var(--admin-canopy-deep,#063b29)] text-[var(--admin-surface-cream,#fff8ec)] ring-4 ring-[var(--admin-canopy,#075b36)]/20"
                        : isCancelled
                        ? "bg-rose-100 text-rose-700 border border-rose-300"
                        : "bg-zinc-100 text-zinc-400 border border-zinc-200"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isCancelled ? (
                      <XCircle className="h-4 w-4" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>
                  {idx < timelineSteps.length - 1 && (
                    <div
                      className={cn(
                        "mt-1 h-6 w-0.5",
                        isCompleted ? "bg-emerald-300" : "bg-zinc-200"
                      )}
                    />
                  )}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center justify-between">
                    <p
                      className={cn(
                        "text-xs font-black",
                        isCurrent
                          ? "text-[var(--admin-canopy-deep,#063b29)]"
                          : isCompleted
                          ? "text-zinc-900"
                          : "text-zinc-400"
                      )}
                    >
                      {step.label}
                    </p>
                    {step.timestamp && (
                      <span className="text-[10px] font-medium text-zinc-500">
                        {formatAdminDateTime(step.timestamp)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-zinc-500">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. BUYER & DELIVERY SNAPSHOT */}
      <section
        aria-label="Buyer and Delivery Details"
        className="grid gap-3 sm:grid-cols-2"
      >
        {/* Buyer Identity + Quick Actions */}
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--admin-ink,#171a16)]">
              <User className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
              <span>Buyer Identity</span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Name</span>
                <p className="font-bold text-zinc-900">{order.customer.name}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Email</span>
                <p className="font-medium text-zinc-700">{order.customer.email}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Phone</span>
                <p className="font-mono text-zinc-800">{buyerPhone || "Not recorded"}</p>
              </div>
            </div>
          </div>

          {/* Buyer Quick Contact Actions */}
          <div className="mt-4 pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-1.5">
            {buyerPhone && (
              <a
                href={`tel:${buyerPhone}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
                title={`Call ${customerName}`}
              >
                <Phone className="h-3.5 w-3.5 text-[var(--admin-canopy,#075b36)]" />
                <span>Call</span>
              </a>
            )}
            {cleanPhone && (
              <a
                href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappPreFilledText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                title={`WhatsApp ${customerName}`}
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />
                <span>WhatsApp</span>
              </a>
            )}
            {order.customer.email && (
              <a
                href={`mailto:${order.customer.email}?subject=${encodeURIComponent(`Zogular Order #${orderNumber}`)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[11px] font-bold text-zinc-800 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
                title={`Email ${customerName}`}
              >
                <Mail className="h-3.5 w-3.5 text-zinc-600" />
                <span>Email</span>
              </a>
            )}
          </div>
        </div>

        {/* Delivery Logistics */}
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--admin-ink,#171a16)]">
            <MapPin className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
            <span>Delivery Destination</span>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Recipient</span>
              <p className="font-bold text-zinc-900">
                {order.delivery.shippingAddress.fullName || order.customer.name}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Street & District</span>
              <p className="font-medium text-zinc-800">
                {order.delivery.shippingAddress.addressLine || "Address pending"}
                {order.delivery.shippingAddress.district ? `, ${order.delivery.shippingAddress.district}` : ""}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase">City & Tracking</span>
              <p className="text-zinc-700 font-medium">
                {order.delivery.shippingAddress.city || "Lusaka"} · Ref: {order.trackingNumber || "Manual dispatch"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SELLER SPLITS & LINE ITEMS BREAKDOWN */}
      <section
        aria-label="Multi-Seller Breakdown"
        className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-4 shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ink,#171a16)]">
              Seller Splits ({order.sellerSummaries.length})
            </h3>
          </div>
          <span className="text-[11px] font-bold text-zinc-500">
            {order.items.length} total items
          </span>
        </div>

        <div className="mt-3 space-y-3">
          {order.sellerSummaries.map((seller) => {
            const sellerItems = order.items.filter(
              (item) => item.seller.userId === seller.userId
            );

            return (
              <div
                key={seller.userId}
                className="rounded-xl border border-zinc-200 bg-[var(--admin-surface-mist,#f6eedf)]/50 p-3"
              >
                <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2">
                  <div>
                    <span className="text-xs font-black text-[var(--admin-ink,#171a16)]">
                      {seller.storeName || "Vendor Store"}
                    </span>
                    <span className="ml-2 rounded-md bg-white px-2 py-0.5 text-[9px] font-bold text-zinc-600 border border-zinc-200">
                      Status: {seller.applicationStatus || "Active"}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-zinc-600">
                    {seller.itemCount} line item{seller.itemCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-2 space-y-2">
                  {sellerItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 text-xs bg-white rounded-lg p-2 border border-zinc-100"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-zinc-900">{item.title}</p>
                        <p className="text-[11px] text-zinc-500 font-medium">
                          Qty: {item.quantity} · Price: {formatAdminCurrency(item.price)} · Status: {toTitleCase(item.vendorStatus.toLowerCase())}
                        </p>
                      </div>
                      <p className="font-black text-zinc-900">
                        {formatAdminCurrency(item.lineTotal)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. FULFILLMENT CONTROLS */}
      <section
        aria-label="Fulfillment Operations Controls"
        className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_28%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ink,#171a16)]">
              Fulfillment Controls
            </h3>
          </div>
          <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-900">
            Manual Dispatch MVP
          </span>
        </div>

        {canManageFulfillment ? (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-[var(--admin-ink-soft,#5f625a)] font-medium">
              Update manual dispatch state for this parcel. Physical delivery updates do not alter financial escrow, wallet, or payout states.
            </p>

            <div className="grid gap-3">
              {/* Next Status Selector */}
              <div>
                <label className="block text-[11px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)] mb-1">
                  Next Status Transition
                </label>
                <select
                  aria-label="Next order status transition"
                  value={nextStatus}
                  onChange={(e) => {
                    const val = e.target.value as AdminOrderStatus | "";
                    setNextStatus(val);
                    if (val === "CANCELLED") {
                      onOpenCancellationDialog();
                    }
                  }}
                  disabled={isMutating || allowedTransitions.length === 0}
                  className="h-10 w-full rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white px-3 text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
                >
                  <option value="">
                    {allowedTransitions.length === 0
                      ? "No allowed transitions from this status"
                      : "Select next legal transition..."}
                  </option>
                  {allowedTransitions.map((status) => (
                    <option key={status} value={status}>
                      Transition to {ORDER_STATUS_METADATA[status]?.label ?? status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Courier Tracking Reference */}
              <div>
                <label className="block text-[11px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)] mb-1">
                  Courier / Rider Reference (Optional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  disabled={isMutating}
                  placeholder="e.g. Rider John / Yango / Mercury LSK-402"
                  className="h-10 w-full rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white px-3 text-xs font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
                />
              </div>

              {/* Operations Notes */}
              <div>
                <label className="block text-[11px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)] mb-1">
                  Operations Notes
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isMutating}
                  placeholder="Internal dispatch context, handover notes, or special handling instructions..."
                  className="w-full rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white p-2.5 text-xs font-medium text-zinc-900 outline-none focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
                />
              </div>

              {/* Mutation or Validation Error */}
              {(localError || mutationError) && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-800">
                  {localError || mutationError}
                </div>
              )}

              {/* Action Button */}
              {allowedTransitions.length > 0 && (
                <Button
                  type="button"
                  onClick={handleSubmitFulfillment}
                  disabled={!nextStatus || isMutating}
                  className="h-10 w-full rounded-xl bg-[var(--admin-canopy-deep,#063b29)] font-black text-xs text-[var(--admin-surface-cream,#fff8ec)] shadow-sm hover:bg-[var(--admin-canopy,#075b36)] disabled:opacity-50"
                >
                  {isMutating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Applying fulfillment update...
                    </>
                  ) : (
                    "Apply fulfillment update"
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs font-medium text-zinc-600">
            This account holds read-only order viewing access. Fulfillment status modifications require the <code>manage_order_fulfillment</code> permission.
          </div>
        )}
      </section>
    </div>
  );
}

export function OrderDetailSheet({
  order,
  open,
  onOpenChange,
  canManageFulfillment = false,
  onUpdateStatus,
  isMutating = false,
  mutationError,
}: OrderDetailSheetProps) {
  const [showPackingSlip, setShowPackingSlip] = useState(false);
  const [showCancellationDialog, setShowCancellationDialog] = useState(false);
  const [nextStatus, setNextStatus] = useState<AdminOrderStatus | "">("");
  const [trackingNumber, setTrackingNumber] = useState(order?.trackingNumber ?? "");
  const [notes, setNotes] = useState(order?.notes ?? "");

  if (!order) return null;

  const currentMeta = ORDER_STATUS_METADATA[order.status] ?? {
    label: order.status,
    tone: "zinc" as const,
  };

  const handleConfirmCancellation = async (
    reason: OrderCancellationReason,
    cancellationNotes?: string
  ) => {
    const combinedNotes = [notes.trim(), cancellationNotes?.trim()]
      .filter(Boolean)
      .join(" | ");

    await onUpdateStatus(order.id, {
      status: "CANCELLED",
      trackingNumber: trackingNumber.trim() || undefined,
      notes: combinedNotes || undefined,
      cancellationReason: reason,
    });

    setShowCancellationDialog(false);
    setNextStatus("");
  };

  return (
    <>
      <AdminDetailSheet
        open={open}
        onOpenChange={onOpenChange}
        title={order.orderNumber}
        description={`${order.customer.name} · ${currentMeta.label}`}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPackingSlip(true)}
            className="h-8 gap-1.5 rounded-lg border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-200 shadow-xs hover:bg-zinc-800 hover:text-white"
          >
            <Printer className="h-3.5 w-3.5 text-zinc-300" />
            <span className="hidden sm:inline">Print Packing Slip</span>
            <span className="sm:hidden">Print Slip</span>
          </Button>
        }
        contentClassName="bg-[var(--admin-surface-cream,#fff8ec)]"
        bodyClassName="space-y-6 scrollbar-none"
      >
        <OrderDetailContent
          key={order.id}
          order={order}
          canManageFulfillment={canManageFulfillment}
          onUpdateStatus={onUpdateStatus}
          isMutating={isMutating}
          mutationError={mutationError}
          onOpenPackingSlip={() => setShowPackingSlip(true)}
          onOpenCancellationDialog={() => setShowCancellationDialog(true)}
          nextStatus={nextStatus}
          setNextStatus={setNextStatus}
          notes={notes}
          setNotes={setNotes}
          trackingNumber={trackingNumber}
          setTrackingNumber={setTrackingNumber}
        />
      </AdminDetailSheet>

      {/* Dedicated Printable Manifest Modal */}
      <OrderPackingSlipModal
        order={order}
        open={showPackingSlip}
        onOpenChange={setShowPackingSlip}
      />

      {/* Order Cancellation Confirmation Dialog */}
      <OrderCancellationDialog
        open={showCancellationDialog}
        onOpenChange={(openNext) => {
          setShowCancellationDialog(openNext);
          if (!openNext && nextStatus === "CANCELLED") {
            setNextStatus("");
          }
        }}
        orderNumber={order.orderNumber}
        onConfirm={handleConfirmCancellation}
        isMutating={isMutating}
      />
    </>
  );
}
