"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PurchaseProgress } from "@/components/checkout/PurchaseProgress";
import { getStoredCheckoutOrder, type CheckoutOrder } from "@/services/checkout";

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function paymentLabel(value: CheckoutOrder["paymentMethod"]) {
  return value === "mobile-money" ? "Mobile Money" : "Bank Card";
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const [order, setOrder] = React.useState<CheckoutOrder | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setOrder(getStoredCheckoutOrder(searchParams.get("orderId")));
    setLoaded(true);
  }, [searchParams]);

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4fbf6] px-4 py-12">
        <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Loading order confirmation...</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-[#f4fbf6] px-4 py-12">
        <div className="mx-auto w-full max-w-2xl">
          <PurchaseProgress currentStep="cart" className="mb-5" />
          <div className="rounded-[2rem] border border-zinc-200/60 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <Package className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">No recent order found</h1>
            <p className="mx-auto mt-3 max-w-md text-sm font-medium text-zinc-500">
              This confirmation page needs an order created from checkout. Start from your cart to generate a matching receipt.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 md:flex-row">
              <Link href="/cart" className="w-full md:w-auto">
                <Button className="h-12 w-full rounded-xl bg-zinc-900 px-8 font-bold text-white hover:bg-zinc-800">
                  Go to Cart
                </Button>
              </Link>
              <Link href="/categories" className="w-full md:w-auto">
                <Button variant="outline" className="h-12 w-full rounded-xl border-zinc-200 px-8 font-bold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">
                  Browse Categories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const customerName = `${order.contact.firstName} ${order.contact.lastName}`.trim();

  return (
    <main className="min-h-screen bg-[#f4fbf6] px-4 py-12">
      <div className="mx-auto w-full max-w-2xl animate-in fade-in zoom-in-95 duration-500">
        <PurchaseProgress currentStep="confirmed" className="mb-5" />

        <div className="relative overflow-hidden rounded-[2rem] border border-zinc-200/60 bg-white p-8 text-center shadow-[0_20px_60px_rgba(0,158,73,0.08)] md:p-12">
          <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(0,158,73,0.15),transparent_70%)]" />

          <div className="relative z-10 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#009E49]/10">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#009E49] shadow-lg shadow-[#009E49]/30">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
          </div>

          <h1 className="relative z-10 mb-3 text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">
            Order Confirmed
          </h1>
          <p className="relative z-10 mx-auto mb-8 max-w-md text-sm font-medium text-zinc-500 md:text-base">
            Thanks for shopping with Zogular. We received your order and are getting it ready for dispatch.
          </p>

          <Separator className="mb-8 bg-zinc-100" />

          <div className="mb-8 grid grid-cols-1 gap-4 text-left md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5">
              <div className="mb-2 flex items-center gap-2 text-zinc-500">
                <Package className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Order Number</span>
              </div>
              <p className="text-lg font-black text-zinc-900">{order.id}</p>
              <p className="mt-1 text-xs font-bold text-[#009E49]">Estimated delivery: {order.estimatedDelivery}</p>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5">
              <div className="mb-2 flex items-center gap-2 text-zinc-500">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Delivery To</span>
              </div>
              <p className="text-sm font-bold text-zinc-900">{customerName}</p>
              <p className="mt-1 text-xs text-zinc-500">{order.delivery.street}, {order.delivery.area}</p>
            </div>
          </div>

          <div className="mb-8 rounded-2xl border border-zinc-100 bg-white p-4 text-left">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-black text-zinc-900">Items Ordered</h2>
              <span className="text-xs font-bold text-zinc-500">{paymentLabel(order.paymentMethod)}</span>
            </div>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={`${item.id}-${item.variant ?? "default"}`} className="flex items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                    <Image src={item.image} alt={item.name} fill sizes="48px" unoptimized className="object-contain p-1.5 mix-blend-multiply" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-bold text-zinc-900">{item.name}</p>
                    <p className="text-[11px] font-medium text-zinc-500">Qty {item.quantity}{item.variant ? ` · ${item.variant}` : ""}</p>
                  </div>
                  <span className="text-xs font-black text-zinc-900">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <Separator className="my-4 bg-zinc-100" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span className="font-bold text-zinc-900">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>Delivery</span>
                <span className="font-bold text-zinc-900">{formatCurrency(order.deliveryFee)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-zinc-900">
                <span>Total</span>
                <span className="text-[#FF6B00]">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4 md:flex-row">
            <Link href={`/account/orders?orderId=${encodeURIComponent(order.id)}`} className="w-full md:w-auto">
              <Button className="h-12 w-full rounded-xl bg-zinc-900 px-8 font-bold text-white shadow-md hover:bg-zinc-800">
                Track My Order
              </Button>
            </Link>
            <Link href="/" className="w-full md:w-auto">
              <Button variant="outline" className="group h-12 w-full rounded-xl border-zinc-200 px-8 font-bold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">
                Continue Shopping <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs font-bold text-zinc-400">
          A confirmation email has been prepared for {order.contact.email}.
        </p>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <React.Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#f4fbf6] px-4 py-12">
          <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Loading order confirmation...</p>
          </div>
        </main>
      }
    >
      <SuccessContent />
    </React.Suspense>
  );
}
