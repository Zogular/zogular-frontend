"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, MapPin, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PurchaseProgress } from "@/components/checkout/PurchaseProgress";
import { getInvoiceById } from "@/services/orders";
import { getStoredAuthUser } from "@/services/auth-session";
import type { Invoice } from "@/types/order";

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  
  const [order, setOrder] = React.useState<Invoice | null>(null);
  const [isGuest, setIsGuest] = React.useState(false);
  const [isError, setIsError] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!orderId) {
      setLoaded(true);
      return;
    }

    getInvoiceById(orderId)
      .then((data) => {
        setOrder(data);
      })
      .catch((err) => {
        // Fallback to guest UI if unauthorized, otherwise error
        if (err && typeof err === "object" && "status" in err && err.status === 401) {
          setIsGuest(true);
        } else {
          setIsError(true);
        }
      })
      .finally(() => {
        setLoaded(true);
      });
  }, [orderId]);

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4fbf6] px-4 py-12">
        <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Loading order confirmation...</p>
        </div>
      </main>
    );
  }

  // Missing or Invalid Order ID
  if (!orderId) {
    return (
      <main className="min-h-screen bg-[#f4fbf6] px-4 py-12">
        <div className="mx-auto w-full max-w-2xl">
          <PurchaseProgress currentStep="cart" className="mb-5" />
          <div className="rounded-[2rem] border border-zinc-200/60 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
              <Package className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Invalid or missing order reference</h1>
            <p className="mx-auto mt-3 max-w-md text-sm font-medium text-zinc-500">
              We couldn&apos;t find an order matching that link. 
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 md:flex-row">
              <Link href="/account/orders" className="w-full md:w-auto">
                <Button className="h-12 w-full rounded-xl bg-zinc-900 px-8 font-bold text-white hover:bg-zinc-800">
                  My Orders
                </Button>
              </Link>
              <Link href="/categories" className="w-full md:w-auto">
                <Button variant="outline" className="h-12 w-full rounded-xl border-zinc-200 px-8 font-bold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // General Error Fetching Order
  if (isError) {
    return (
      <main className="min-h-screen bg-[#f4fbf6] px-4 py-12">
        <div className="mx-auto w-full max-w-2xl">
          <PurchaseProgress currentStep="cart" className="mb-5" />
          <div className="rounded-[2rem] border border-zinc-200/60 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-orange-500">
              <Clock className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">We&apos;re processing your request</h1>
            <p className="mx-auto mt-3 max-w-md text-sm font-medium text-zinc-500">
              Your order may have been placed successfully, but we are having trouble retrieving the details right now.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 md:flex-row">
              {getStoredAuthUser() ? (
                <Link href="/account/orders" className="w-full md:w-auto">
                  <Button className="h-12 w-full rounded-xl bg-zinc-900 px-8 font-bold text-white hover:bg-zinc-800">
                    Check My Orders
                  </Button>
                </Link>
              ) : (
                <Link href="/categories" className="w-full md:w-auto">
                  <Button className="h-12 w-full rounded-xl bg-zinc-900 px-8 font-bold text-white hover:bg-zinc-800">
                    Continue Shopping
                  </Button>
                </Link>
              )}
              <Button onClick={() => window.location.reload()} variant="outline" className="h-12 w-full rounded-xl border-zinc-200 px-8 font-bold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 md:w-auto">
                Refresh Page
              </Button>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
            Your order has been placed.
          </h1>

          <Separator className="mb-8 mt-6 bg-zinc-100" />

          <div className="mb-8 grid grid-cols-1 gap-4 text-left md:grid-cols-2">
            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5">
              <div className="mb-2 flex items-center gap-2 text-zinc-500">
                <Package className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Order Number</span>
              </div>
              <p className="text-lg font-black text-zinc-900">{order?.orderNumber || orderId}</p>
            </div>
            
            {order && (
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5">
                <div className="mb-2 flex items-center gap-2 text-zinc-500">
                  <MapPin className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Delivery To</span>
                </div>
                <p className="text-sm font-bold text-zinc-900">{order.customer.name}</p>
                <p className="mt-1 text-xs text-zinc-500">{order.shipping.address}, {order.shipping.area}</p>
              </div>
            )}
          </div>

          {/* Guest/Unauthorized view */}
          {isGuest && (
            <div className="mb-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
              <p className="mb-3 font-semibold text-zinc-800">
                Full order details are safely hidden for guest visitors.
              </p>
              <p className="mb-4 text-sm text-zinc-500">
                To track your order, please log into the account you used during checkout.
              </p>
              <Link href={`/auth/login?redirect=/account/orders/${orderId}`}>
                <Button className="rounded-xl bg-zinc-900 px-6 font-bold text-white hover:bg-zinc-800">
                  Log In to View Order
                </Button>
              </Link>
            </div>
          )}

          {/* Authenticated order details */}
          {order && (
            <div className="mb-8 rounded-2xl border border-zinc-100 bg-white p-4 text-left">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-black text-zinc-900">Items Ordered</h2>
              </div>
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div key={`${item.name}-${idx}`} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-bold text-zinc-900">{item.name}</p>
                      <p className="text-[11px] font-medium text-zinc-500">Qty {item.qty}</p>
                    </div>
                    <span className="text-xs font-black text-zinc-900">{formatCurrency(item.price * item.qty)}</span>
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
                  <span className="font-bold text-zinc-900">{formatCurrency(order.shippingFee)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-zinc-900">
                  <span>Total</span>
                  <span className="text-[#FF6B00]">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Next steps section */}
          <div className="mb-8 text-left rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5">
            <h3 className="mb-3 text-sm font-bold text-zinc-900">Next Steps</h3>
            <ul className="space-y-2 text-xs font-medium text-zinc-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 block h-1.5 w-1.5 rounded-full bg-orange-400" />
                <span><strong className="text-zinc-800">Processing:</strong> Seller review and order processing is pending.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 block h-1.5 w-1.5 rounded-full bg-zinc-300" />
                <span><strong className="text-zinc-800">Delivery:</strong> Delivery confirmation is pending.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 block h-1.5 w-1.5 rounded-full bg-zinc-300" />
                <span><strong className="text-zinc-800">Payment:</strong> Payment confirmation will be handled through the current checkout process.</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col justify-center gap-4 md:flex-row">
            {!isGuest && (
              <Link href={`/account/orders`} className="w-full md:w-auto">
                <Button className="h-12 w-full rounded-xl bg-zinc-900 px-8 font-bold text-white shadow-md hover:bg-zinc-800">
                  Track My Order
                </Button>
              </Link>
            )}
            <Link href="/" className="w-full md:w-auto">
              <Button variant="outline" className="group h-12 w-full rounded-xl border-zinc-200 px-8 font-bold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900">
                Continue Shopping <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
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
