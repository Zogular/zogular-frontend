import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { appendNextPath } from "@/services/auth-intent";
import type { CartItem } from "@/types/cart";
import { formatCheckoutCurrency } from "@/features/checkout/lib/checkout-presentation";
import type { CheckoutStage } from "@/features/checkout/types/checkout.types";

interface OrderSummaryProps {
  stage: CheckoutStage;
  items: CartItem[];
  itemCount: number;
  displayedSubtotal: number;
  deliveryFee?: number;
  total?: number;
  cashDue?: number;
  quoteError: string | null;
  isLoadingQuote: boolean;
  submitError: string | null;
  isGuest: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onBack: () => void;
}

export function OrderSummary({
  stage,
  items,
  itemCount,
  displayedSubtotal,
  deliveryFee,
  total,
  cashDue,
  quoteError,
  isLoadingQuote,
  submitError,
  isGuest,
  canSubmit,
  submitting,
  onBack,
}: OrderSummaryProps) {
  return (
    <div className={`${stage === "review" ? "block" : "hidden"} w-full shrink-0 md:block lg:w-100 xl:w-112.5`}>
      <div className="sticky top-28 rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-8">
        <h3 className="mb-6 text-xl font-black text-zinc-900">Order Summary</h3>
        <div className="hide-scrollbar mb-6 max-h-75 space-y-4 overflow-y-auto pb-1 pr-2 pt-2">
          {items.map((item) => (
            <div key={`${item.id}-${item.variant ?? "default"}`} className="flex gap-4">
              <div className="relative h-16 w-16 shrink-0 rounded-xl border border-zinc-200/50 bg-zinc-50 p-1">
                <div className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-[10px] font-bold text-white">
                  {item.quantity}
                </div>
                <Image src={item.image} alt={item.name} fill sizes="64px" unoptimized className="object-contain p-2 mix-blend-multiply" />
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <h4 className="line-clamp-2 text-xs font-bold leading-tight text-zinc-800">{item.name}</h4>
                {item.variant ? <span className="mt-1 text-[11px] font-medium text-zinc-500">{item.variant}</span> : null}
                <span className="mt-1 text-sm font-black text-zinc-900">{formatCheckoutCurrency(item.price)}</span>
              </div>
            </div>
          ))}
        </div>
        <Separator className="mb-6 bg-zinc-200" />
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between text-sm font-medium text-zinc-500">
            <span>Subtotal ({itemCount} items)</span>
            <span className="font-bold text-zinc-900">{formatCheckoutCurrency(displayedSubtotal)}</span>
          </div>
          {quoteError ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>{quoteError}</div>
            </div>
          ) : (
            <div className="flex items-center justify-between font-medium">
              <span className="flex items-center gap-1 text-zinc-500"><Truck className="h-4 w-4" /> Delivery Fee</span>
              {isLoadingQuote ? (
                <span className="h-4 w-12 animate-pulse rounded bg-zinc-200" />
              ) : (
                <span className="text-zinc-900">
                  {deliveryFee !== undefined ? formatCheckoutCurrency(deliveryFee) : "Calculated at next step"}
                </span>
              )}
            </div>
          )}
          <Separator className="bg-zinc-200" />
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-zinc-900">Order Total</span>
            {isLoadingQuote || total === undefined ? (
              <span className="text-xl font-black text-zinc-400">...</span>
            ) : (
              <span className="text-xl font-black text-zinc-900">{formatCheckoutCurrency(total)}</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-dashed border-zinc-200 pt-3">
            <span className="text-sm font-bold text-zinc-700">Delivery Fee (Due Now)</span>
            {isLoadingQuote ? (
              <span className="text-lg font-black text-[#FF6B00]">...</span>
            ) : deliveryFee !== undefined ? (
              <span className="text-lg font-black text-[#FF6B00]">{formatCheckoutCurrency(deliveryFee)}</span>
            ) : (
              <span className="text-lg font-black text-zinc-400">Pending</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-700">Cash Due on Delivery</span>
            {isLoadingQuote || cashDue === undefined ? (
              <span className="text-lg font-black text-zinc-900">...</span>
            ) : (
              <span className="text-lg font-black text-zinc-900">{formatCheckoutCurrency(cashDue)}</span>
            )}
          </div>
        </div>
        {submitError ? <p className="mb-3 text-sm font-semibold text-red-600">{submitError}</p> : null}
        <Button type="button" variant="outline" onClick={onBack} className="mb-3 h-11 w-full rounded-xl border-zinc-200 font-bold md:hidden">
          {isGuest ? "Back to Sign In" : "Back to Payment"}
        </Button>
        {isGuest ? (
          <Button asChild className="h-14 w-full rounded-xl bg-[#009E49] text-lg font-black text-white shadow-lg shadow-[#009E49]/20 transition-all hover:-translate-y-0.5 hover:bg-[#00853d]">
            <Link href={appendNextPath("/auth/login", "/checkout")}>Sign in to place order</Link>
          </Button>
        ) : (
          <Button disabled={!canSubmit} className="h-14 w-full rounded-xl bg-[#009E49] text-lg font-black text-white shadow-lg shadow-[#009E49]/20 transition-all hover:-translate-y-0.5 hover:bg-[#00853d] disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? "Placing Order..." : "Place Order Now"}
          </Button>
        )}
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-[#009E49]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#009E49]">
            <ShieldCheck className="h-4 w-4" /> Confirmed order totals
          </div>
          <p className="max-w-62.5 text-center text-[10px] font-medium leading-relaxed text-zinc-400">
            By placing your order, you agree to Zogular&apos;s Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
