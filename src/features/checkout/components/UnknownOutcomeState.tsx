import Link from "next/link";
import { useLayoutEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INTENT_CONFLICT_MESSAGE } from "@/features/checkout/lib/checkout-presentation";

export function UnknownOutcomeState({ onResume, modern, busy, message, onReview, onRetry, intentConflict, onViewExistingOrder }: {
  onResume: () => void; modern?: boolean; busy?: boolean; message?: string | null;
  onReview?: () => void; onRetry?: () => void;
  intentConflict?: boolean; onViewExistingOrder?: () => void;
}) {
  const Heading = modern ? "h1" : "h2";
  useLayoutEffect(() => {
    // The standalone recovery screen replaces a much taller Review. Do not
    // carry its scroll offset under the sticky header or move keyboard focus.
    if (modern) window.scrollTo({ top: 0, behavior: "instant" });
  }, [modern]);

  return (
    <section role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <Heading className="font-black">{intentConflict ? "This cart already has an order" : onViewExistingOrder ? "Existing order found" : "Order outcome not confirmed"}</Heading>
          <p className="mt-1 text-sm font-medium leading-6">
            {intentConflict ? `${INTENT_CONFLICT_MESSAGE} Check the existing order for its delivery details.`
              : onViewExistingOrder ? "We found an order for this cart. View it to check its items and delivery details."
              : modern ? "Check for your receipt before placing another order." : "Check your orders first. If no new order appears, return here before trying again."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {onViewExistingOrder ? <Button type="button" onClick={onViewExistingOrder} className="h-11 rounded-xl bg-zinc-950 px-5 font-bold text-white">
              View existing order
            </Button> : <Button asChild className="h-11 rounded-xl bg-zinc-950 px-5 font-bold text-white hover:bg-zinc-800">
              <Link href="/account/orders">Check my orders</Link>
            </Button>}
            <Button asChild variant="outline" className="h-11 rounded-xl border-amber-300 bg-white px-5 font-bold">
              <Link href="/help">Contact support</Link>
            </Button>
            {!onViewExistingOrder && <Button type="button" variant="ghost" className="h-11 rounded-xl px-5 font-bold" disabled={busy} onClick={onResume}>
              {modern ? "Check order status" : "I checked — try again"}
            </Button>}
            {onReview && <Button type="button" disabled={busy} onClick={onReview}>Review my updated cart</Button>}
            {onRetry && <Button type="button" disabled={busy} onClick={onRetry}>Retry this exact order</Button>}
          </div>
          {message && !(intentConflict && message === INTENT_CONFLICT_MESSAGE) && <p role="status" className="mt-2 text-sm">{message}</p>}
        </div>
      </div>
    </section>
  );
}
