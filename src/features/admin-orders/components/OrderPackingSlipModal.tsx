/**
 * @file OrderPackingSlipModal.tsx
 * @module features/admin-orders/components
 * @description
 * Dedicated printable modal and dispatch manifest dialog for dispatchers and Lusaka couriers.
 * Features comprehensive recipient destination details, prominent Cash on Delivery (COD)
 * financial collection directives, multi-seller item checklists, and signature handoff lines.
 */

"use client";

import React from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { formatAdminCurrency, formatAdminDateTime } from "@/lib/admin-format";
import type { AdminOrderRecord } from "../types";

interface OrderPackingSlipModalProps {
  order: AdminOrderRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderPackingSlipModal({
  order,
  open,
  onOpenChange,
}: OrderPackingSlipModalProps) {
  if (!order) return null;

  const isCod =
    order.totals.cashDueOnDelivery > 0 ||
    order.payment.collectionMode === "CASH_ON_DELIVERY" ||
    order.payment.method === "CASH_ON_DELIVERY";

  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-0 shadow-2xl"
      >
        {/* Scoped Print Styles */}
        <style jsx global>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 10mm 12mm;
            }
            body * {
              visibility: hidden;
            }
            .zogular-packing-slip,
            .zogular-packing-slip * {
              visibility: visible;
            }
            .zogular-packing-slip {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              box-shadow: none !important;
              border: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>

        {/* Top Control Bar (Screen preview only) */}
        <div className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[var(--admin-canopy,#075b36)]" />
            <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
              Dispatch Packing Slip & Manifest Preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              className="h-9 gap-2 rounded-xl bg-[var(--admin-canopy-deep,#063b29)] px-4 text-xs font-black text-[var(--admin-surface-cream,#fff8ec)] shadow-sm hover:bg-[var(--admin-canopy,#075b36)]"
            >
              <Printer className="h-4 w-4" />
              Print Manifest
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-9 w-9 rounded-xl border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
              aria-label="Close manifest modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Printable Manifest Document Container */}
        <div className="p-6 sm:p-8">
          <div className="zogular-packing-slip mx-auto max-w-3xl rounded-xl border border-zinc-300 bg-white p-6 shadow-xs print:border-none print:p-0">
            {/* Header */}
            <div className="border-b-2 border-zinc-900 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="inline-block rounded-md bg-zinc-950 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-white print:bg-black">
                    ZOGULAR LOGISTICS · DISPATCH MANIFEST
                  </div>
                  <h1 className="mt-2 text-xl font-black text-zinc-950 tracking-tight">
                    Order #{order.orderNumber}
                  </h1>
                  <p className="text-xs font-medium text-zinc-600 mt-0.5">
                    Lusaka Hub Distribution & Delivery Handoff Document
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    Date / Time Placed
                  </p>
                  <p className="font-bold text-zinc-900">
                    {formatAdminDateTime(order.createdAt)}
                  </p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                    Dispatch Ref
                  </p>
                  <p className="font-mono font-bold text-zinc-800">
                    {order.trackingNumber || "MANUAL-DISPATCH-LSK"}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Buyer & Destination Grid */}
            <section className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 print:border-zinc-300">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-1.5 mb-2.5">
                1. Buyer & Destination Grid
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                    Recipient Full Name
                  </span>
                  <p className="font-bold text-zinc-950 text-sm">
                    {order.delivery.shippingAddress.fullName || order.customer.name}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                    Recipient Contact Phone
                  </span>
                  <p className="font-mono font-bold text-zinc-950 text-sm">
                    {order.delivery.shippingAddress.phone || order.customer.phone || "Not recorded"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                    Physical Delivery Address
                  </span>
                  <p className="font-medium text-zinc-900">
                    {order.delivery.shippingAddress.addressLine || "Address pending verification"}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                    District & Lusaka City
                  </span>
                  <p className="font-medium text-zinc-900">
                    {order.delivery.shippingAddress.district || "Lusaka Urban"},{" "}
                    {order.delivery.shippingAddress.city || "Lusaka"},{" "}
                    {order.delivery.shippingAddress.country || "Zambia"}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Financial Collection Box */}
            <section className="mt-5">
              {isCod ? (
                <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50/80 p-4 text-emerald-950 print:border-2 print:border-black print:bg-zinc-100 print:text-black">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="inline-block rounded-md bg-emerald-700 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white print:bg-black">
                        MANDATORY CASH COLLECTION
                      </span>
                      <h2 className="mt-1.5 text-base sm:text-lg font-black tracking-tight">
                        COLLECT CASH ON DELIVERY (COD): K {order.totals.cashDueOnDelivery.toLocaleString()}
                      </h2>
                      <p className="mt-0.5 text-xs font-semibold text-emerald-800 print:text-zinc-700">
                        Collect exact cash upon physical parcel handoff.
                      </p>
                    </div>
                    <div className="text-left sm:text-right border-t sm:border-t-0 border-emerald-200 pt-2 sm:pt-0">
                      <p className="text-[10px] font-bold uppercase text-emerald-800 print:text-zinc-600">
                        Delivery Fee Status
                      </p>
                      <p className="text-xs font-bold text-emerald-900 print:text-black">
                        {order.totals.deliveryFeeAmount > 0
                          ? `K ${order.totals.deliveryFeeAmount.toLocaleString()} (Included in COD)`
                          : "Prepaid or Waived"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-zinc-400 bg-zinc-50 p-4 text-zinc-900 print:border-2 print:border-black print:bg-zinc-50">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <span className="inline-block rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white print:bg-black">
                        PREPAID ORDER
                      </span>
                      <h2 className="mt-1.5 text-base font-black tracking-tight text-zinc-950">
                        DO NOT COLLECT CASH (PAID IN ADVANCE)
                      </h2>
                      <p className="mt-0.5 text-xs font-medium text-zinc-600">
                        Customer has settled payment electronically. No cash due at handoff.
                      </p>
                    </div>
                    <div className="text-left sm:text-right border-t sm:border-t-0 border-zinc-200 pt-2 sm:pt-0">
                      <p className="text-[10px] font-bold uppercase text-zinc-500">
                        Delivery Fee
                      </p>
                      <p className="text-xs font-bold text-zinc-800">
                        {order.totals.deliveryFeeAmount > 0
                          ? `Prepaid K ${order.totals.deliveryFeeAmount.toLocaleString()}`
                          : "Prepaid / Zero Balance"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 3: Multi-Seller Package Contents Table */}
            <section className="mt-5">
              <div className="flex items-center justify-between border-b border-zinc-300 pb-1.5 mb-2">
                <h2 className="text-[11px] font-black uppercase tracking-wider text-zinc-800">
                  3. Multi-Seller Package Contents & Packing Checklist
                </h2>
                <span className="text-[10px] font-bold text-zinc-500">
                  {order.items.length} line item{order.items.length === 1 ? "" : "s"} · {totalQuantity} total units
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-300 bg-zinc-100 print:bg-zinc-200 text-[10px] font-black uppercase tracking-wider text-zinc-700">
                      <th className="p-2.5 border-r border-zinc-300 w-36">Store / Vendor</th>
                      <th className="p-2.5 border-r border-zinc-300">Item Description</th>
                      <th className="p-2.5 border-r border-zinc-300 text-center w-16">Qty</th>
                      <th className="p-2.5 border-r border-zinc-300 text-right w-24">Price</th>
                      <th className="p-2.5 text-center w-24">Checklist [ ]</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {order.items.map((item) => (
                      <tr key={item.id} className="hover:bg-zinc-50 print:hover:bg-white">
                        <td className="p-2.5 border-r border-zinc-300 font-bold text-zinc-900">
                          {item.seller.storeName || item.seller.name || "Vendor Store"}
                        </td>
                        <td className="p-2.5 border-r border-zinc-300 font-medium text-zinc-900">
                          {item.title}
                        </td>
                        <td className="p-2.5 border-r border-zinc-300 text-center font-bold text-zinc-900">
                          {item.quantity}
                        </td>
                        <td className="p-2.5 border-r border-zinc-300 text-right font-mono font-medium text-zinc-900">
                          {formatAdminCurrency(item.price)}
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded border-2 border-zinc-400 text-[10px] font-bold print:border-black">
                            &nbsp;
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 bg-zinc-50 print:bg-white font-bold text-zinc-900">
                      <td colSpan={2} className="p-2.5 text-right uppercase text-[10px] tracking-wider text-zinc-600">
                        Item Subtotal:
                      </td>
                      <td className="p-2.5 text-center">{totalQuantity}</td>
                      <td className="p-2.5 text-right font-mono font-black">
                        {formatAdminCurrency(order.totals.itemSubtotal)}
                      </td>
                      <td className="p-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Section 4: Handoff & Dispatch Verification */}
            <section className="mt-6 rounded-lg border border-zinc-300 bg-zinc-50/70 p-4 print:border-zinc-400 print:bg-white">
              <h2 className="text-[11px] font-black uppercase tracking-wider text-zinc-800 border-b border-zinc-200 pb-1.5 mb-3">
                4. Handoff & Dispatch Verification
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                    Dispatch Date / Time
                  </span>
                  <p className="font-bold text-zinc-900 mt-0.5">
                    {formatAdminDateTime(new Date().toISOString())}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                    Courier Name / Rider Reference
                  </span>
                  <p className="font-mono font-bold text-zinc-900 mt-0.5">
                    {order.trackingNumber || "Assigned Driver"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-dashed border-zinc-300 text-xs">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-6">
                    Warehouse Packer Verification
                  </p>
                  <p className="font-mono text-zinc-800">
                    Packer Signature: ___________________________
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-6">
                    Courier Delivery Handoff Verification
                  </p>
                  <p className="font-mono text-zinc-800">
                    Driver / Recipient Signature: ___________________________
                  </p>
                </div>
              </div>
            </section>

            {/* Footer Notice */}
            <div className="mt-6 border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-500">
              <p>Zogular Marketplace Operations · Lusaka Hub Dispatch Manifest · Verified Physical Delivery Record</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
