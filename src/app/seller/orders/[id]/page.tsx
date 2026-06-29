"use client";

import { useMemo, useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Package, Truck, CheckCircle2, Clock3, MapPin, Phone,
  Printer, User, Calendar, Circle, XCircle, RotateCcw, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { BRAND } from "@/config/brand";
import {
  sellerOrdersApi,
  type SellerOrderDetail,
  type SellerPaymentStatus,
  type SellerOrderStatus,
} from "@/services/seller-orders";

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================
// ============================================================================
// 3. UI CONFIGURATIONS & HELPERS
// ============================================================================
const STATUS_META: Record<SellerOrderStatus, {
  title: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }>; primaryAction?: { label: string; next: SellerOrderStatus };
}> = {
  new: { title: "New Order", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", icon: Clock3, primaryAction: { label: "Accept Order", next: "processing" } },
  processing: { title: "Processing", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: Package, primaryAction: { label: "Mark as Shipped", next: "shipped" } },
  shipped: { title: "Shipped", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200", icon: Truck, primaryAction: { label: "Mark as Delivered", next: "delivered" } },
  delivered: { title: "Delivered", color: "text-[#009E49]", bg: "bg-[#009E49]/10", border: "border-[#009E49]/20", icon: CheckCircle2 },
  cancelled: { title: "Cancelled", color: "text-red-600", bg: "bg-red-50", border: "border-red-200", icon: XCircle },
  refund: { title: "Refund Review", color: "text-[#FF6B00]", bg: "bg-orange-50", border: "border-orange-200", icon: RotateCcw },
};

const PROGRESS_STEPS: Array<{ id: "new" | "processing" | "shipped" | "delivered"; label: string }> = [
  { id: "new", label: "Received" },
  { id: "processing", label: "Processing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
];

function formatCurrency(value: number) { return `K${value.toLocaleString()}`; }

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "numeric", hour12: true }).format(new Date(dateString));
}

function getPaymentStatusLabel(status: SellerPaymentStatus) {
  if (status === "cod") return "COD";
  if (status === "paid") return "Paid";
  if (status === "refunded") return "Refunded";
  if (status === "failed") return "Failed";
  return "Pending backend";
}

function getStepState(current: SellerOrderStatus, step: "new" | "processing" | "shipped" | "delivered") {
  if (current === "cancelled" || current === "refund") return step === "new" ? "done" : "pending";
  const order = ["new", "processing", "shipped", "delivered"] as const;
  const currentIndex = order.indexOf(current as (typeof order)[number]);
  const stepIndex = order.indexOf(step);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "pending";
}

// ============================================================================
// 4. SUBCOMPONENTS
// ============================================================================
function ProgressStepper({ status }: { status: SellerOrderStatus }) {
  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <div className="grid grid-cols-4 gap-2">
        {PROGRESS_STEPS.map((step, index) => {
          const state = getStepState(status, step.id);
          const isDone = state === "done";
          const isCurrent = state === "current";

          return (
            <div key={step.id} className="relative min-w-0">
              {index < PROGRESS_STEPS.length - 1 && (
                <div className="absolute left-[calc(50%+16px)] right-[-50%] top-4 h-0.5 bg-zinc-200">
                  <div className={cn("h-full rounded-full transition-all duration-500", isDone ? "w-full bg-[#009E49]" : "w-0 bg-[#009E49]")} />
                </div>
              )}
              <div className="relative z-10 flex flex-col items-center gap-2 text-center">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-sm transition-colors", isDone && "border-[#009E49] bg-[#009E49] text-white", isCurrent && "border-[#009E49] text-[#009E49]", state === "pending" && "border-zinc-200 text-zinc-300")}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Circle className={cn("h-3.5 w-3.5", isCurrent && "fill-[#009E49]")} />}
                </div>
                <div className="min-w-0">
                  <p className={cn("text-[10px] font-bold uppercase tracking-wider", isDone || isCurrent ? "text-zinc-900" : "text-zinc-400")}>
                    {step.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(status === "cancelled" || status === "refund") && (
        <div className={cn("mt-5 rounded-xl border px-4 py-3 text-xs font-bold", status === "cancelled" ? "border-red-200 bg-red-50 text-red-600" : "border-orange-200 bg-orange-50 text-[#FF6B00]")}>
          {status === "cancelled" ? "This order has been cancelled and is no longer moving through fulfillment." : "This order is currently under refund review. Please wait for admin resolution."}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. MAIN PAGE EXPORT
// ============================================================================
export default function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderId } = use(params);
  
  const [order, setOrder] = useState<SellerOrderDetail | null>(null);
  const [orderStatus, setOrderStatus] = useState<SellerOrderStatus>("new");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sellerOrdersApi.fetchById(orderId);
      setOrder(data);
      setOrderStatus(data.status); // Sync initial status
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const itemCount = useMemo(() => (order ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0), [order]);

  const handleStatusUpdate = async (nextStatus: SellerOrderStatus) => {
    setIsProcessing(true);
    try {
      const updated = await sellerOrdersApi.updateStatus(orderId, nextStatus);
      setOrder(updated);
      setOrderStatus(updated.status);
      setIsProcessing(false);
      toast.success(`Order updated to ${STATUS_META[nextStatus].title}.`);
    } catch (error) {
      setIsProcessing(false);
      toast.error(error instanceof Error ? error.message : "Failed to update order.");
    }
  };

  const handlePrintReceipt = () => {
    toast.success("Preparing receipt for printing...");
    setTimeout(() => window.print(), 400);
  };

  // --- SYSTEM STATES ---
  if (loading) return <SellerPageLoading variant="detail" className="max-w-250" />;

  if (error || !order) {
    return (
      <div className="mx-auto max-w-250 animate-in space-y-6 fade-in pb-24 duration-500 md:pb-12">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center shadow-sm">
          <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
          <h1 className="text-xl font-black text-red-900">Failed to load order</h1>
          <p className="mt-2 text-sm font-medium text-red-700">{error || "Order not found"}</p>
          <div className="mt-6 flex gap-3">
            <Link href="/seller/orders">
              <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-100">Back to Orders</Button>
            </Link>
            <Button onClick={loadOrder} className="bg-red-600 text-white hover:bg-red-700">Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN UI ---
  const currentConfig = STATUS_META[orderStatus];
  const StatusIcon = currentConfig.icon;

  return (
    <div className="mx-auto max-w-250 animate-in space-y-6 fade-in pb-24 duration-500 md:pb-12">
      
      {/* 1. HEADER */}
      <div className="sticky top-18 z-20 -mx-4 mb-6 border-b border-zinc-200/50 bg-[#f4fbf6]/80 px-4 py-4 backdrop-blur-md md:top-0 md:mx-0 md:border-none md:px-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <Link href="/seller/orders">
                <Button aria-label="Go back to orders" variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm hover:bg-zinc-100">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-black leading-none tracking-tight text-zinc-900 md:text-2xl">{order.id}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", currentConfig.bg, currentConfig.color, currentConfig.border)}>
                    <StatusIcon className="h-3 w-3" /> {currentConfig.title}
                  </span>
                  <span suppressHydrationWarning className="hidden text-[10px] font-bold text-zinc-500 sm:inline-flex">
                    <Calendar className="mr-1 h-3 w-3" /> {formatDate(order.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Button variant="outline" onClick={handlePrintReceipt} className="h-10 rounded-xl border-zinc-200 bg-white px-4 font-bold text-zinc-700 shadow-sm hover:bg-zinc-50">
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            {currentConfig.primaryAction && (
              <Button onClick={() => handleStatusUpdate(currentConfig.primaryAction!.next)} disabled={isProcessing} className="h-10 rounded-xl bg-zinc-900 px-6 font-bold text-white shadow-md transition-all hover:bg-zinc-800">
                {isProcessing ? "Updating..." : currentConfig.primaryAction.label}
              </Button>
            )}
            {orderStatus === "refund" && (
              <Button onClick={() => setIsRefundModalOpen(true)} className="h-10 rounded-xl bg-zinc-900 px-5 font-bold text-white shadow-md transition-all hover:bg-zinc-800">
                Contest Refund
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. PROGRESS STEPPER */}
      <ProgressStepper status={orderStatus} />

      <FeaturePendingNotice
        compact
        title="Seller finance truth is partial"
        description="This order shows backend-confirmed fulfillment data. Totals on this page cover only the seller-visible items, not necessarily the buyer's full basket. Payment method, payment status, commission, and seller net remain pending until seller finance endpoints are available."
      />

      {/* 3. KPI STRIP */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Items</p>
          <p className="mt-1 text-lg font-black text-zinc-900">{itemCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Payment</p>
          <p className="mt-1 text-sm font-black text-zinc-900">{order.paymentMethod ?? "Pending backend"}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status</p>
          <p className="mt-1 text-sm font-black text-zinc-900 uppercase">{getPaymentStatusLabel(order.paymentStatus)}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Delivery</p>
          <p className="mt-1 text-sm font-black text-zinc-900 truncate">{order.shipping.method}</p>
        </div>
      </div>

      {/* 4. MAIN CONTENT */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
        
        {/* Left Col: Items */}
        <div className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 p-4 md:p-5">
              <Package className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Order Items</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-4 transition-colors hover:bg-zinc-50/50 md:p-5">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100">
                    <Package className="h-6 w-6 text-zinc-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-zinc-900">{item.name}</h3>
                    <p className="mt-0.5 text-xs font-medium text-zinc-500">{item.brand} • {item.id}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-zinc-700">Qty: {item.quantity}</p>
                      <p className="text-sm font-black text-zinc-900">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-zinc-100 bg-zinc-50/30 p-4 md:p-5">
              <div className="flex justify-between text-xs font-medium text-zinc-500">
                <span>Subtotal ({itemCount} items)</span>
                <span>{formatCurrency(order.totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-zinc-500">
                <span>Shipping Fee</span>
                <span>{order.totals.shipping === null ? "Pending backend" : formatCurrency(order.totals.shipping)}</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-zinc-500">
                <span>Zogular Commission</span>
                <span>{order.earnings.commission === null ? "Pending backend" : `-${formatCurrency(order.earnings.commission)}`}</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-zinc-500">
                <span>Seller Net</span>
                <span>{order.earnings.sellerNet === null ? "Pending backend" : formatCurrency(order.earnings.sellerNet)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200/60 pt-2 text-base font-black text-zinc-900">
                <span>Visible Items Total</span>
                <span className="text-[#009E49]">{formatCurrency(order.totals.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Customer & Shipping */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
              <User className="h-4 w-4 text-zinc-400" /> Customer
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-zinc-900">{order.customer.name}</p>
                <p className="text-xs text-zinc-500">{order.customer.email}</p>
              </div>
              <a href={`tel:${order.customer.phone}`} className="group flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 transition-colors hover:border-[#009E49] hover:bg-[#009E49]/5">
                <Phone className="h-4 w-4 text-zinc-400 group-hover:text-[#009E49]" />
                <span className="text-sm font-bold text-zinc-700 group-hover:text-[#009E49]">{order.customer.phone}</span>
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
              <MapPin className="h-4 w-4 text-zinc-400" /> Logistics
            </h2>
            <div className="space-y-5">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Delivery Address</p>
                <p className="text-sm font-bold text-zinc-900">{order.shipping.address}</p>
                <p className="text-sm font-medium text-zinc-500">{order.shipping.area}, {order.shipping.city}</p>
              </div>
              {order.shipping.instructions && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">Instructions</p>
                  <p className="text-xs font-medium text-amber-900">{order.shipping.instructions}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. MOBILE BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 z-30 flex w-full gap-3 border-t border-zinc-200 bg-white/95 p-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] backdrop-blur-md md:hidden">
        <Button aria-label="Print receipt" variant="outline" size="icon" onClick={handlePrintReceipt} className="h-12 w-12 shrink-0 rounded-xl border-zinc-200 text-zinc-700 bg-white">
          <Printer className="h-5 w-5" />
        </Button>

        {currentConfig.primaryAction ? (
          <Button onClick={() => handleStatusUpdate(currentConfig.primaryAction!.next)} disabled={isProcessing} className="h-12 flex-1 rounded-xl bg-zinc-900 font-extrabold text-white shadow-md transition-all active:scale-95 hover:bg-zinc-800">
            {isProcessing ? "Updating..." : currentConfig.primaryAction.label}
          </Button>
        ) : orderStatus === "refund" ? (
          <Button onClick={() => setIsRefundModalOpen(true)} className="h-12 flex-1 rounded-xl bg-zinc-900 font-extrabold text-white shadow-md transition-all active:scale-95 hover:bg-zinc-800">
            Contest Refund
          </Button>
        ) : (
          <Button disabled className="h-12 flex-1 rounded-xl bg-zinc-100 font-extrabold text-zinc-400">
            Order Complete
          </Button>
        )}
      </div>

      {isRefundModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close refund contest modal"
            className="absolute inset-0 bg-zinc-900/45 backdrop-blur-sm"
            onClick={() => setIsRefundModalOpen(false)}
          />
            <div className="relative z-10 w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-zinc-900">Refund Review Contact Path</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              Seller-side refund contest submission is not wired to the backend yet. Use the support contact fallback with the order ID and your delivery evidence.
            </p>
            <FeaturePendingNotice
              compact
              className="mt-4"
              title="No local refund submission"
              description="Do not rely on this page to record refund contests until backend dispute endpoints are available."
            />
            <a
              href={`mailto:${BRAND.supportEmail}?subject=Refund%20review%20request%20${order.id}`}
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-bold text-zinc-900 transition-colors hover:bg-white"
            >
              Email {BRAND.supportEmail}
            </a>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setIsRefundModalOpen(false)} className="rounded-xl">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
