"use client";

import Link from "next/link";
import { ChevronRight, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseProgress } from "@/components/checkout/PurchaseProgress";
import { useAuthSession, type ClientAuthState } from "@/hooks/use-auth-session";
import { AddressSection } from "@/features/checkout/components/AddressSection";
import { OrderSummary } from "@/features/checkout/components/OrderSummary";
import { PaymentSection } from "@/features/checkout/components/PaymentSection";
import { UnknownOutcomeState } from "@/features/checkout/components/UnknownOutcomeState";
import { useCheckoutFlow } from "@/features/checkout/hooks/useCheckoutFlow";

function CheckoutContent({ auth }: { auth: ClientAuthState }) {
  const flow = useCheckoutFlow(auth);

  if (auth.status === "unavailable") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center bg-[#f4fbf6] px-4">
        <div className="space-y-4 text-center" role="alert">
          <p className="text-sm font-semibold text-zinc-700">Checkout could not open.</p>
          <Button type="button" variant="outline" onClick={auth.retry} className="h-11 rounded-xl px-5">Try again</Button>
        </div>
      </main>
    );
  }

  if (auth.status === "guest") {
    return <main className="flex min-h-[60vh] items-center justify-center bg-[#f4fbf6] px-4" aria-live="polite"><p className="text-sm font-semibold text-zinc-600">Opening sign in…</p></main>;
  }

  if (!flow.hasHydrated || !flow.identityResolved || auth.status !== "authenticated") {
    return (
      <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8">
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Checking your checkout…</p>
          </div>
        </div>
      </main>
    );
  }

  if (!flow.items.length) {
    return (
      <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8">
        <div className="container mx-auto max-w-3xl px-4 md:px-6">
          <PurchaseProgress currentStep="cart" className="mb-5" />
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center shadow-sm">
            <h1 className="text-2xl font-black text-zinc-900">Your cart is empty</h1>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium text-zinc-500">Add products to your cart before starting checkout.</p>
            <Button asChild className="mt-6 h-11 rounded-xl bg-zinc-900 px-6 font-bold text-white hover:bg-zinc-800"><Link href="/categories">Browse categories</Link></Button>
          </div>
        </div>
      </main>
    );
  }

  const isGuest = auth.status !== "authenticated";
  const displayedSubtotal = flow.orderQuote?.itemSubtotal ?? flow.totalAmount;
  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24">
      <form onSubmit={flow.handleSubmit}>
        <PurchaseProgress currentStep={flow.checkoutStage} />
        <div className="container mx-auto max-w-6xl px-4 pt-6 md:px-6">
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-zinc-500">
              <Link href="/cart" className="hover:text-[#009E49]">Cart</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-zinc-900">COD Checkout</span>
            </div>
            <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-zinc-900 md:text-4xl">
              Cash on Delivery Checkout <Truck className="h-6 w-6 text-[#009E49]" />
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-zinc-500">Review your delivery details and confirmed order total.</p>
          </div>
          {flow.hasUnknownOutcome ? (
            <UnknownOutcomeState onResume={() => flow.ownerId && flow.resumeCheckoutAfterReview(flow.ownerId)} />
          ) : null}
          <div className="flex flex-col gap-8 lg:flex-row xl:gap-12">
            <div className="flex-1 space-y-6">
              <AddressSection
                stage={flow.checkoutStage}
                addresses={flow.savedAddresses}
                selectedAddressId={flow.selectedAddressId}
                isLoading={flow.isLoadingAddresses}
                hasLoadError={flow.addressLoadError}
                detailsComplete={flow.detailsComplete}
                onSelect={flow.setSelectedAddressId}
                onRetry={flow.retryAddresses}
                onContinue={() => flow.setCheckoutStage("payment")}
              />
              <PaymentSection
                stage={flow.checkoutStage}
                onBack={() => flow.setCheckoutStage("details")}
                onReview={() => flow.setCheckoutStage("review")}
              />
            </div>
            <OrderSummary
              stage={flow.checkoutStage}
              items={flow.items}
              itemCount={flow.itemCount}
              displayedSubtotal={displayedSubtotal}
              deliveryFee={flow.orderQuote?.deliveryFeeAmount}
              total={flow.orderQuote?.grandTotalAmount}
              cashDue={flow.orderQuote?.cashDueOnDelivery}
              quoteError={flow.quoteError}
              isLoadingQuote={flow.isLoadingQuote}
              submitError={flow.submitError}
              isGuest={isGuest}
              canSubmit={flow.canSubmit}
              submitting={flow.submitting}
              onBack={() => flow.setCheckoutStage(isGuest ? "details" : "payment")}
            />
          </div>
        </div>
      </form>
    </main>
  );
}

export function CheckoutPageContent() {
  const auth = useAuthSession();
  const identityKey = auth.status === "authenticated" ? auth.user.id : auth.status;
  return <CheckoutContent key={identityKey} auth={auth} />;
}
