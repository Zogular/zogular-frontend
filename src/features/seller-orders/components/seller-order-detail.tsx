"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  MapPin,
  Package,
  Phone,
  Printer,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CollectionErrorState } from "@/components/collection/collection-state";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sanitizeInternalNextPath } from "@/services/auth-intent";
import {
  sellerOrderQueryKeys,
  sellerOrdersApi,
  type SellerOrderDetail,
  type SellerOrderStatus,
} from "@/services/seller-orders";
import {
  formatSellerOrderCurrency,
  formatSellerOrderDate,
  getSellerOrderStatusMeta,
} from "../order-ui";
import { OrderCancellationDialog } from "./order-cancellation-dialog";

const SELLER_PRODUCTS_QUERY_KEY = ["seller", "products"] as const;
const SELLER_INVENTORY_QUERY_KEY = ["seller", "inventory"] as const;
const PROGRESS_STEPS = [
  { id: "new", label: "Received" },
  { id: "confirmed", label: "Confirmed" },
  { id: "processing", label: "Preparing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
] as const;
type ProgressStatus = (typeof PROGRESS_STEPS)[number]["id"];

function OrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-250 space-y-4" aria-label="Loading order details" role="status">
      <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
      <div className="h-28 animate-pulse rounded-2xl border border-zinc-100 bg-white" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="h-96 animate-pulse rounded-2xl border border-zinc-100 bg-white" />
        <div className="h-72 animate-pulse rounded-2xl border border-zinc-100 bg-white" />
      </div>
    </div>
  );
}

function getProgressState(status: SellerOrderStatus, step: ProgressStatus) {
  if (["cancelled", "refund", "unknown"].includes(status)) return "inactive";
  const currentIndex = PROGRESS_STEPS.findIndex((item) => item.id === status);
  const stepIndex = PROGRESS_STEPS.findIndex((item) => item.id === step);
  if (stepIndex < currentIndex) return "complete";
  if (stepIndex === currentIndex) return "current";
  return "pending";
}

function OrderProgress({ status }: { status: SellerOrderStatus }) {
  const terminal = ["cancelled", "refund", "unknown"].includes(status);
  const statusMeta = getSellerOrderStatusMeta(status);
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Fulfillment progress" data-order-progress>
      <div className="grid grid-cols-5">
        {PROGRESS_STEPS.map((step, index) => {
          const state = getProgressState(status, step.id);
          const complete = state === "complete";
          const current = state === "current";
          return (
            <div key={step.id} className="relative min-w-0 text-center">
              {index > 0 ? <span className={cn("absolute right-1/2 top-3.5 h-0.5 w-full", complete || current ? "bg-emerald-500" : "bg-zinc-200")} aria-hidden="true" /> : null}
              <span className={cn("relative z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full border bg-white", complete && "border-emerald-500 bg-emerald-500 text-white", current && "border-emerald-500 text-emerald-600", !complete && !current && "border-zinc-200 text-zinc-300")}>
                {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : <Circle className={cn("h-3 w-3", current && "fill-emerald-500")} aria-hidden="true" />}
              </span>
              <span className={cn("mt-1.5 block px-0.5 text-[9px] font-bold leading-tight", complete || current ? "text-zinc-900" : "text-zinc-400")}>{step.label}</span>
            </div>
          );
        })}
      </div>
      {terminal ? <p className={`mt-4 rounded-xl border px-3 py-2.5 text-xs font-bold ${statusMeta.background} ${statusMeta.color} ${statusMeta.border}`}>{status === "cancelled" ? "This seller order was cancelled and is no longer in fulfillment." : status === "refund" ? "This order is under refund handling. Contact seller support if you need to provide context." : "Fulfillment progress is unavailable for this order."}</p> : null}
    </section>
  );
}

function actionLabel(status: SellerOrderStatus) {
  if (status === "confirmed") return "Accept order";
  if (status === "processing") return "Start preparing";
  return null;
}

function SellerOrderDetailContent({ order, busy, onTransition, onCancel }: {
  order: SellerOrderDetail;
  busy: boolean;
  onTransition: (status: SellerOrderStatus) => void;
  onCancel: () => void;
}) {
  const status = getSellerOrderStatusMeta(order.status);
  const primaryTransition = order.allowedTransitions.find((item) => item === "confirmed" || item === "processing");
  const canCancel = order.allowedTransitions.includes("cancelled");
  const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <OrderProgress status={order.status} />
      {order.status === "processing" ? <FeaturePendingNotice compact title="Prepare for operations pickup" description="Keep your items ready for handoff. Shipping and delivery updates are handled by authorized Zogular operations." /> : null}
      <FeaturePendingNotice compact title="Seller total" description="The amount below covers only items assigned to your store. Payment and earnings appear only when confirmed by Zogular." />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Items</p><p className="mt-1 text-lg font-black">{itemCount}</p></div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Payment method</p><p className="mt-1 truncate text-sm font-black">{order.paymentMethod ?? "Not available"}</p></div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Payment</p><p className="mt-1 text-sm font-black">{order.paymentStatus === "unavailable" ? "Not available" : order.paymentStatus.toUpperCase()}</p></div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3"><p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Delivery</p><p className="mt-1 truncate text-sm font-black">{order.shipping.method}</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <header className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3"><Package className="h-4 w-4 text-zinc-400" aria-hidden="true" /><h2 className="text-xs font-black uppercase tracking-wider">Your items</h2></header>
          <div className="divide-y divide-zinc-100">
            {order.orderItems.map((item) => (
              <div key={item.id} className="flex min-h-22 items-center gap-3 p-3 md:p-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  {item.image ? <Image src={item.image} alt={item.name} fill sizes="64px" className="object-contain" /> : <Package className="absolute inset-0 m-auto h-6 w-6 text-zinc-300" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-black text-zinc-950">{item.name}</h3>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-zinc-500">{item.brand ?? "Brand not provided"}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="font-bold text-zinc-600">Qty {item.quantity}</span><span className="font-black text-zinc-950">{formatSellerOrderCurrency(item.price * item.quantity)}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-zinc-100 bg-zinc-50 p-4 text-xs">
            <div className="flex justify-between text-zinc-600"><span>Items subtotal</span><span>{formatSellerOrderCurrency(order.totals.subtotal)}</span></div>
            <div className="flex justify-between text-zinc-600"><span>Delivery assigned to seller</span><span>{order.totals.shipping === null ? "Not available" : formatSellerOrderCurrency(order.totals.shipping)}</span></div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-black text-zinc-950"><span>Your visible total</span><span className="text-emerald-700">{formatSellerOrderCurrency(order.totals.total)}</span></div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><User className="h-4 w-4 text-zinc-400" aria-hidden="true" /> Customer</h2>
            <p className="mt-3 text-sm font-black">{order.customer.name}</p><p className="text-xs text-zinc-500">{order.customer.email}</p>
            {order.customer.phone !== "Not provided" ? <a href={`tel:${order.customer.phone}`} className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3 text-sm font-bold text-zinc-700"><Phone className="h-4 w-4" aria-hidden="true" />{order.customer.phone}</a> : null}
          </section>
          <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider"><MapPin className="h-4 w-4 text-zinc-400" aria-hidden="true" /> Delivery</h2>
            <p className="mt-3 text-sm font-black">{order.shipping.address}</p><p className="text-xs text-zinc-500">{order.shipping.area}, {order.shipping.city}</p>
            {order.shipping.instructions ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-900">{order.shipping.instructions}</p> : null}
          </section>
          {order.status === "refund" ? <Link href={`/seller/support?orderId=${encodeURIComponent(order.id)}&topic=refund`} className="flex h-10 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-xs font-black text-orange-800">Contact support about this refund</Link> : null}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex gap-2 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <Button type="button" variant="outline" size="icon" aria-label="Print seller order" onClick={() => window.print()} className="h-11 w-11 rounded-xl"><Printer className="h-4 w-4" /></Button>
        {primaryTransition ? <Button type="button" disabled={busy} onClick={() => onTransition(primaryTransition)} className="h-11 flex-1 rounded-xl bg-zinc-950 text-white">{busy ? "Updating…" : actionLabel(primaryTransition)}</Button> : null}
        {canCancel ? <Button type="button" variant="outline" disabled={busy} onClick={onCancel} className="h-11 rounded-xl border-red-200 text-red-700">Cancel</Button> : null}
        {!primaryTransition && !canCancel ? <Button type="button" disabled className="h-11 flex-1 rounded-xl">No seller action needed</Button> : null}
      </div>
      <span className={`sr-only ${status.color}`}>{status.title}</span>
    </>
  );
}

export function SellerOrderDetailView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const orderQuery = useQuery({
    queryKey: sellerOrderQueryKeys.detail(orderId),
    queryFn: () => sellerOrdersApi.fetchById(orderId),
    staleTime: 30_000,
  });
  const returnTo = sanitizeInternalNextPath(searchParams.get("returnTo"));
  const order = orderQuery.data;
  const mutation = useMutation({
    mutationFn: (status: SellerOrderStatus) => sellerOrdersApi.updateStatus(orderId, status),
    onSuccess: async (updated) => {
      queryClient.setQueryData(sellerOrderQueryKeys.detail(orderId), updated);
      setCancelOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sellerOrderQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: SELLER_PRODUCTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SELLER_INVENTORY_QUERY_KEY }),
      ]);
      toast.success(`Order updated to ${getSellerOrderStatusMeta(updated.status).title}.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the order."),
  });
  const statusMeta = order ? getSellerOrderStatusMeta(order.status) : null;
  const StatusIcon = statusMeta?.icon ?? CheckCircle2;
  const summaryForDialog = useMemo(() => order ? {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: order.customer.name,
    phone: order.phone,
    items: order.itemCount,
    total: order.total,
    status: order.status,
    allowedTransitions: order.allowedTransitions,
    paymentStatus: order.paymentStatus,
    location: order.location,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  } : null, [order]);

  const handleBack = () => {
    if (returnTo?.startsWith("/seller/orders")) router.push(returnTo, { scroll: false });
    else router.push("/seller/orders");
  };

  if (orderQuery.isPending) return <OrderDetailSkeleton />;
  if (orderQuery.isError || !order || !statusMeta) return <CollectionErrorState title="Order could not be loaded" description={orderQuery.error instanceof Error ? orderQuery.error.message : "This order is unavailable."} action={{ label: "Try again", onClick: () => void orderQuery.refetch() }} className="mx-auto max-w-250" />;

  const primaryTransition = order.allowedTransitions.find((item) => item === "confirmed" || item === "processing");
  return (
    <div className="mx-auto max-w-250 space-y-4 pb-40 md:pb-8">
      <header className="sticky top-16 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-zinc-200 bg-[#f4fbf6]/95 px-4 py-3 backdrop-blur md:top-0 md:mx-0 md:rounded-xl md:border">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="outline" size="icon" aria-label="Back to seller orders" onClick={handleBack} className="h-9 w-9 shrink-0 rounded-xl"><ArrowLeft className="h-4 w-4" /></Button>
          <div className="min-w-0"><h1 className="truncate text-lg font-black text-zinc-950">{order.orderNumber}</h1><p className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500"><Calendar className="h-3 w-3" />{formatSellerOrderDate(order.createdAt)}</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`hidden items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black uppercase sm:inline-flex ${statusMeta.background} ${statusMeta.color} ${statusMeta.border}`}><StatusIcon className="h-3.5 w-3.5" />{statusMeta.title}</span>
          <Button type="button" variant="outline" onClick={() => window.print()} className="hidden h-9 rounded-xl text-xs font-bold md:inline-flex"><Printer className="mr-1.5 h-4 w-4" />Print</Button>
          {primaryTransition ? <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate(primaryTransition)} className="hidden h-9 rounded-xl bg-zinc-950 text-xs text-white md:inline-flex">{mutation.isPending ? "Updating…" : actionLabel(primaryTransition)}</Button> : null}
          {order.allowedTransitions.includes("cancelled") ? <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setCancelOpen(true)} className="hidden h-9 rounded-xl border-red-200 text-xs font-bold text-red-700 md:inline-flex">Cancel</Button> : null}
        </div>
      </header>

      <SellerOrderDetailContent order={order} busy={mutation.isPending} onTransition={(status) => mutation.mutate(status)} onCancel={() => setCancelOpen(true)} />
      <OrderCancellationDialog order={summaryForDialog} open={cancelOpen} pending={mutation.isPending} onOpenChange={setCancelOpen} onConfirm={() => mutation.mutate("cancelled")} />
    </div>
  );
}
