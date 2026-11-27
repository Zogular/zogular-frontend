"use client";

import * as React from "react";
import { use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, MapPin, Printer, CheckCircle2, Clock, Truck, XCircle, MessageCircle, Phone, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AccountLoadErrorState } from "@/components/account/AccountLoadErrorState";
import { SUPPORT_WHATSAPP_NUMBER, SUPPORT_CALL_NUMBER } from "@/config/support";
import { useAuthSession } from "@/hooks/use-auth-session";
import { appendNextPath } from "@/services/auth-intent";
import { BuyerOrderCancelDialog } from "@/features/buyer-orders/components/BuyerOrderCancelDialog";
import { useBuyerOrderCancellation } from "@/features/buyer-orders/hooks/use-buyer-order-cancellation";
import { orderHistoryHref, parseOrderFilter } from "@/features/buyer-orders/lib/order-return-state";

const STATUS_CONFIG = {
  processing: {
    label: "Processing",
    icon: Clock,
    className: "bg-amber-100 text-amber-700",
  },
  shipped: {
    label: "In Transit",
    icon: Truck,
    className: "bg-blue-100 text-blue-700",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    className: "bg-[#009E49]/10 text-[#009E49]",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-red-100 text-red-700",
  },
} as const;

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

export default function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { id } = use(params);
  const backToOrders = orderHistoryHref(parseOrderFilter(use(searchParams).status));
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuthSession();
  const {
    invoice,
    loading,
    loadError: error,
    loadInvoice,
    dialogOpen,
    isSubmitting,
    isCheckingStatus,
    feedback,
    canShowCancelAction,
    openDialog,
    handleDialogOpenChange,
    confirmCancellation,
    checkOrderStatus,
  } = useBuyerOrderCancellation(id, auth);

  if (loading) {
    return <div className="py-16 text-center text-sm font-medium text-zinc-500">Loading invoice details...</div>;
  }

  if (error) {
    return (
      <AccountLoadErrorState
        error={error}
        resource="order"
        onRetry={loadInvoice}
        secondaryAction={{ href: backToOrders, label: "Back to Orders" }}
      />
    );
  }

  if (feedback?.kind === "auth-required") {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8 print:hidden"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="space-y-3">
            <h1 className="text-lg font-black text-zinc-900">Sign in to continue</h1>
            <p className="text-sm font-medium text-zinc-600">{feedback.message}</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button
                type="button"
                onClick={() => router.replace(appendNextPath("/auth/login?reason=signin-again", pathname))}
                className="h-11 bg-zinc-900 text-white hover:bg-zinc-800"
              >
                Sign in
              </Button>
              <Button asChild variant="ghost" className="h-11 text-zinc-600 hover:text-zinc-900">
                <Link href={backToOrders}>Back to Orders</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const whatsappLink = SUPPORT_WHATSAPP_NUMBER
    ? `https://wa.me/${SUPPORT_WHATSAPP_NUMBER.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi Zogular, I need help with Order #${invoice.orderNumber || invoice.id}`)}`
    : null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" className="h-11 text-zinc-600 hover:text-zinc-900">
          <Link href={backToOrders}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {canShowCancelAction ? (
            <BuyerOrderCancelDialog
              orderLabel={invoice.orderNumber || invoice.id}
              open={dialogOpen}
              isSubmitting={isSubmitting}
              csrfRetryMessage={feedback?.kind === "csrf-expired" ? feedback.message : null}
              onOpenTrigger={openDialog}
              onOpenChange={handleDialogOpenChange}
              onConfirmCancellation={confirmCancellation}
            />
          ) : null}

          <Button onClick={() => window.print()} className="h-11 bg-zinc-900 text-white hover:bg-zinc-800">
            <Printer className="mr-2 h-4 w-4" /> View / Print Receipt
          </Button>
        </div>
      </div>

      {feedback && feedback.kind !== "csrf-expired" ? (
        <div
          role={feedback.kind === "confirmed" ? "status" : "alert"}
          aria-live="polite"
          className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between print:hidden ${
            feedback.kind === "confirmed"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="flex items-start gap-2.5 text-sm font-medium">
            {feedback.kind === "confirmed" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>

          {feedback.kind === "uncertain" ? (
            <Button
              type="button"
              variant="outline"
              disabled={isCheckingStatus}
              onClick={() => void checkOrderStatus()}
              className="h-10 shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
            >
              {isCheckingStatus ? "Checking status…" : "Check order status"}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="@container/receipt rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-sm sm:p-10 print:border-none print:shadow-none print:p-0">
        <div className="mb-8 flex flex-col justify-between gap-6 sm:flex-row">
          <div>
            <h2 className="text-2xl font-black text-[#009E49]">Zogular</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Plot 45, Cairo Road
              <br />
              Lusaka, Zambia
            </p>
          </div>

          <div className="sm:text-right">
            <h1 className="text-2xl font-black text-zinc-900">RECEIPT</h1>
            <p className="mt-1 text-sm font-bold text-zinc-700">#{invoice.orderNumber || invoice.id}</p>
            <p className="text-sm text-zinc-500">Issued: {invoice.date}</p>
            
            {(() => {
              const config = STATUS_CONFIG[invoice.status];
              const Icon = config.icon;
              return (
                <div className="mt-3 sm:flex sm:justify-end">
                  <Badge className={`flex w-fit items-center gap-1.5 border-none px-3 py-1 text-xs shadow-none ${config.className}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                  </Badge>
                </div>
              );
            })()}
          </div>
        </div>

        {invoice.status !== "cancelled" ? (
          <div className="mb-8 rounded-2xl bg-zinc-50 p-4 sm:p-6 print:hidden">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Order Tracker</h3>
            <div className="flex items-center justify-between">
              {["processing", "shipped", "delivered"].map((step, index, arr) => {
                const isActive = invoice.status === step || (invoice.status === "delivered" && index < 2) || (invoice.status === "shipped" && step === "processing");
                const config = STATUS_CONFIG[step as keyof typeof STATUS_CONFIG];
                const StepIcon = config.icon;
                
                return (
                  <div key={step} className="flex flex-1 flex-col items-center gap-2 relative">
                    <div className={`z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-zinc-50 transition-colors ${isActive ? config.className : "bg-zinc-200 text-zinc-400"}`}>
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <p className={`text-xs font-bold ${isActive ? "text-zinc-900" : "text-zinc-400"}`}>
                      {config.label}
                    </p>
                    {index < arr.length - 1 && (
                      <div className={`absolute left-[50%] top-5 -z-0 h-1 w-full -translate-y-1/2 transition-colors ${
                        (invoice.status === "delivered") || (invoice.status === "shipped" && step === "processing") ? "bg-[#009E49]" : "bg-zinc-200"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
            {invoice.status === "shipped" && (
              <p className="mt-4 text-center text-sm font-medium text-blue-700">
                Delivery updates are coordinated by Zogular support from the latest order status. Contact support if the address, timing, or handoff details need attention.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-8 rounded-2xl bg-red-50 p-4 sm:p-6 print:hidden">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div>
                <h3 className="text-sm font-bold text-red-900">
                  {invoice.rawStatus === "REFUNDED" ? "Order Refunded" : "Order Cancelled"}
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {invoice.rawStatus === "REFUNDED"
                    ? "A refund has been recorded for this order."
                    : "Refund status will appear here if a refund is recorded for this cancelled order."}
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator className="bg-zinc-100" />

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Billed To</h3>
            <p className="font-bold text-zinc-900">{invoice.customer.name}</p>
            <p className="text-sm text-zinc-600">{invoice.customer.email}</p>
            <p className="text-sm text-zinc-600">{invoice.customer.phone}</p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">Shipping Details</h3>
            <div className="flex items-start gap-2 text-sm text-zinc-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <span>
                {invoice.shipping.address}
                <br />
                {invoice.shipping.area}, {invoice.shipping.city}
              </span>
            </div>
            {invoice.isLegacyIncomplete ? (
              <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-2.5">
                <p className="text-xs font-bold text-orange-900 leading-tight">Legacy payment breakdown unavailable.</p>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-zinc-200 p-3 bg-zinc-50">
                <p className="text-sm text-zinc-600">
                  <span className="font-bold text-zinc-700">Payment:</span> {invoice.paymentMethod}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Payment confirmation is handled during order processing.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10">
          <div className="hidden grid-cols-[1fr_80px_100px] border-b border-zinc-200 pb-3 sm:grid">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Item</span>
            <span className="text-right text-xs font-bold uppercase tracking-wider text-zinc-400">Qty</span>
            <span className="text-right text-xs font-bold uppercase tracking-wider text-zinc-400">Price</span>
          </div>

          <div className="divide-y divide-zinc-100">
            {invoice.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex flex-col py-4 sm:grid sm:grid-cols-[1fr_80px_100px] sm:items-center">
                <span className="font-bold text-zinc-900">{item.name}</span>
                <span className="mt-1 text-sm text-zinc-500 sm:mt-0 sm:text-right">{item.qty}</span>
                <span className="mt-1 font-medium text-zinc-900 sm:mt-0 sm:text-right">
                  {formatCurrency(item.price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-zinc-200 pt-6 @2xl/receipt:grid-cols-[minmax(0,1fr)_18rem] print:block">
          <div className="min-w-0 space-y-4 print:hidden">
            <div className="flex flex-col gap-3 @sm/receipt:flex-row @sm/receipt:flex-wrap">
              {whatsappLink && (
                <Button asChild variant="outline" className="h-11 w-full rounded-xl border-[#25D366]/20 bg-[#25D366]/5 text-[#128C7E] hover:bg-[#25D366]/10 sm:w-auto">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp Support
                  </a>
                </Button>
              )}
              {SUPPORT_CALL_NUMBER && (
                <Button asChild variant="outline" className="h-11 w-full rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50 sm:w-auto">
                  <a href={`tel:${SUPPORT_CALL_NUMBER}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call Support
                  </a>
                </Button>
              )}
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex gap-2">
                <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0 text-[#009E49]" />
                <div>
                  <p className="text-sm font-bold text-zinc-900">Need order help?</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-zinc-600">
                    Share your order number with Zogular support for help with delivery, address changes, or payment questions.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Button asChild className="h-11 w-full rounded-xl bg-zinc-900 font-bold text-white hover:bg-zinc-800 sm:w-auto">
                <Link href="/categories">Browse Products</Link>
              </Button>
            </div>
          </div>

          <section aria-label="Order totals" className="min-w-0 space-y-3 print:w-72 print:max-w-full">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-zinc-500">Subtotal</span>
              <span className="min-w-0 wrap-anywhere text-right font-medium text-zinc-900">{formatCurrency(invoice.subtotal)}</span>
            </div>

            {invoice.isLegacyIncomplete ? (
              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-bold text-orange-900">Payment breakdown unavailable for this legacy order.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-zinc-500">Shipping Fee</span>
                  <span className="min-w-0 wrap-anywhere text-right font-medium text-zinc-900">{formatCurrency(invoice.shippingFee!)}</span>
                </div>

                {invoice.discount > 0 ? (
                  <div className="flex justify-between gap-3 text-sm text-[#009E49]">
                    <span>Discount</span>
                    <span className="min-w-0 wrap-anywhere text-right font-medium">-{formatCurrency(invoice.discount)}</span>
                  </div>
                ) : null}

                <Separator className="bg-zinc-100" />

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="font-bold text-zinc-900">Total</span>
                  <span className="min-w-0 wrap-anywhere text-right text-2xl font-black text-[#009E49]">
                    {formatCurrency(invoice.total!)}
                  </span>
                </div>

                {typeof invoice.commitmentFeeAmount === "number" && typeof invoice.cashDueOnDelivery === "number" && (
                  <div className="mt-3 space-y-2 rounded-xl bg-orange-50 p-3 text-sm print:bg-transparent print:p-0 print:border print:border-zinc-200">
                    <div className="flex justify-between gap-3 font-bold text-orange-900 print:text-zinc-900">
                      <span>Delivery Fee (Due Now)</span>
                      <span className="min-w-0 wrap-anywhere text-right">{formatCurrency(invoice.commitmentFeeAmount)}</span>
                    </div>
                    <div className="flex justify-between gap-3 font-bold text-zinc-900">
                      <span>Cash Due on Delivery</span>
                      <span className="min-w-0 wrap-anywhere text-right">{formatCurrency(invoice.cashDueOnDelivery)}</span>
                    </div>
                    <p className="text-[10px] font-medium leading-tight text-orange-700 print:hidden">
                      * Official payment status is pending.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
