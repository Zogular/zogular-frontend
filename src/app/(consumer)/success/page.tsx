"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, LockKeyhole, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseProgress } from "@/components/checkout/PurchaseProgress";
import { ApiError } from "@/services/api";
import { appendNextPath } from "@/services/auth-intent";
import { useAuthSession, type ClientAuthState } from "@/hooks/use-auth-session";
import { getInvoiceById } from "@/services/orders";
import type { Invoice } from "@/types/order";

type LoadState =
  | { status: "loading" }
  | { status: "success"; order: Invoice }
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "not-found" }
  | { status: "network" }
  | { status: "error" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function OrderConfirmation({
  auth,
  orderId,
}: {
  auth: ClientAuthState;
  orderId: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setState({ status: "loading" });
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    if (auth.status !== "guest") return;
    const nextPath = orderId ? `/success?orderId=${encodeURIComponent(orderId)}` : "/account/orders";
    const loginPath = auth.reason === "expired" ? "/auth/login?reason=signin-again" : "/auth/login";
    router.replace(appendNextPath(loginPath, nextPath));
  }, [auth, orderId, router]);

  useEffect(() => {
    if (auth.status !== "authenticated" || !orderId || !UUID_PATTERN.test(orderId)) return;
    let active = true;
    const abortController = new AbortController();

    getInvoiceById(orderId, auth.user, abortController.signal)
      .then((order) => {
        if (active) setState({ status: "success", order });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof ApiError) {
          if (error.status === 401) return setState({ status: "unauthorized" });
          if (error.status === 403) return setState({ status: "forbidden" });
          if (error.status === 404) return setState({ status: "not-found" });
          if (error.status === 408 || error.status === 503) return setState({ status: "network" });
        }
        setState({ status: "error" });
      });

    return () => {
      active = false;
      abortController.abort();
    };
  }, [auth, orderId, retryCount]);

  if (auth.status === "unavailable") {
    return (
      <OrderState title="Order confirmation could not open" description="Please try again in a moment.">
        <Button type="button" onClick={auth.retry} className="h-11 rounded-xl bg-zinc-950 px-6 font-bold text-white hover:bg-zinc-800">
          Try again
        </Button>
      </OrderState>
    );
  }

  if (auth.status !== "authenticated") {
    return <OrderState title="Checking your order" description="This will only take a moment." />;
  }

  if (!orderId || !UUID_PATTERN.test(orderId)) {
    return (
      <OrderState title="Order not found" description="Choose an order from your order history.">
        <Button asChild className="h-12 rounded-xl bg-zinc-950 px-6 font-bold text-white hover:bg-zinc-800">
          <Link href="/account/orders">View my orders</Link>
        </Button>
      </OrderState>
    );
  }

  if (state.status === "loading") {
    return <OrderState title="Confirming your order" description="Checking your order details." />;
  }

  if (state.status !== "success") {
    const nextPath = orderId ? `/success?orderId=${encodeURIComponent(orderId)}` : "/account/orders";
    const content = {
      unauthorized: {
        icon: LockKeyhole,
        title: "Sign in to view this order",
        description: "Sign in again to continue.",
        action: "Sign in",
        href: appendNextPath("/auth/login", nextPath),
      },
      forbidden: {
        icon: LockKeyhole,
        title: "This order is not available to your account",
        description: "For privacy, Zogular only shows order details to the buyer who placed the order.",
        action: "View my orders",
        href: "/account/orders",
      },
      "not-found": {
        icon: Package,
        title: "Order not found",
        description: "Choose an order from your order history.",
        action: "View my orders",
        href: "/account/orders",
      },
      network: {
        icon: AlertTriangle,
        title: "Order confirmation is temporarily unavailable",
        description: "Please try again before treating this order as confirmed.",
        action: "Retry",
        onAction: handleRetry,
      },
      error: {
        icon: AlertTriangle,
        title: "Order confirmation could not be verified",
        description: "Check your orders or contact support.",
        action: "View my orders",
        href: "/account/orders",
      },
    }[state.status];

    return (
      <OrderState title={content.title} description={content.description} icon={content.icon}>
        {content.onAction ? (
          <Button onClick={content.onAction} className="h-12 rounded-xl bg-zinc-950 px-6 font-bold text-white hover:bg-zinc-800">
            {content.action}
          </Button>
        ) : (
          <Button asChild className="h-12 rounded-xl bg-zinc-950 px-6 font-bold text-white hover:bg-zinc-800">
            <Link href={content.href!}>{content.action}</Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-12 rounded-xl border-zinc-200 px-6 font-bold">
          <Link href="/help">Contact support</Link>
        </Button>
      </OrderState>
    );
  }

  const { order } = state;
  return (
    <main className="min-h-dvh bg-[#f4fbf6] px-4 py-10 md:py-14">
      <div className="mx-auto max-w-2xl">
        <PurchaseProgress currentStep="confirmed" className="mb-5" />
        <section className="rounded-[2rem] border border-white/80 bg-white p-5 text-center shadow-[0_24px_70px_rgba(0,158,73,0.09)] md:p-9">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-[#009E49]">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-zinc-950 md:text-4xl">Order confirmed by Zogular</h1>
          <p className="mt-2 text-sm font-semibold text-zinc-500">Order {order.orderNumber}</p>

          <div className="mt-7 space-y-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-left">
            {order.items.map((item) => (
              <div key={item.productId} className="flex items-start justify-between gap-4 text-sm">
                <span className="font-semibold text-zinc-700">{item.name} × {item.qty}</span>
                <span className="shrink-0 font-black text-zinc-950">{formatCurrency(item.price * item.qty)}</span>
              </div>
            ))}
            {order.isLegacyIncomplete ? (
              <div className="border-t border-zinc-200 pt-3 mt-3">
                <div className="flex justify-between text-sm font-semibold text-zinc-600 mb-3"><span>Item subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                  <p className="text-xs font-bold text-orange-900">Payment breakdown unavailable for this legacy order.</p>
                </div>
              </div>
            ) : (
              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between text-sm font-semibold text-zinc-600"><span>Delivery fee</span><span>{formatCurrency(order.shippingFee!)}</span></div>
                <div className="mt-2 flex justify-between text-base font-black text-zinc-950"><span>Order total</span><span>{formatCurrency(order.total!)}</span></div>
                {typeof order.cashDueOnDelivery === "number" ? (
                  <div className="mt-2 flex justify-between text-sm font-bold text-[#009E49]"><span>Cash due on delivery</span><span>{formatCurrency(order.cashDueOnDelivery)}</span></div>
                ) : null}
              </div>
            )}
          </div>

          <p className="mt-5 text-sm font-medium leading-6 text-zinc-600">Check your order for the latest delivery updates.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild className="h-12 w-full rounded-xl bg-[#009E49] px-6 font-bold text-white hover:bg-[#00853d]">
              <Link href={`/account/orders/${order.id}`}>View order</Link>
            </Button>
            <Button asChild variant="outline" className="h-12 w-full rounded-xl border-zinc-200 px-6 font-bold">
              <Link href="/categories">Continue shopping</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const auth = useAuthSession();
  const orderId = searchParams.get("orderId")?.trim() || null;
  const identityKey = auth.status === "authenticated" ? auth.user.id : auth.status;

  return (
    <OrderConfirmation
      key={`${identityKey}:${orderId ?? "missing"}`}
      auth={auth}
      orderId={orderId}
    />
  );
}

function OrderState({ title, description, icon: Icon = Package, children }: { title: string; description: string; icon?: typeof Package; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4fbf6] px-4 py-10">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/80 bg-white p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><Icon className="h-7 w-7" /></div>
        <h1 className="mt-5 text-2xl font-black tracking-tight text-zinc-950 md:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm font-medium leading-6 text-zinc-600">{description}</p>
        {children ? <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">{children}</div> : null}
      </section>
    </main>
  );
}

export default function SuccessPage() {
  return <Suspense fallback={<OrderState title="Confirming your order" description="Checking your order details." />}><SuccessContent /></Suspense>;
}
