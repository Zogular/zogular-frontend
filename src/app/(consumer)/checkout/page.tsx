"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, CreditCard, Lock, ShieldCheck, Smartphone, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { PurchaseProgress, type PurchaseProgressStep } from "@/components/checkout/PurchaseProgress";
import { useCart } from "@/hooks/use-cart";
import { getStoredAuthUser } from "@/services/auth-session";
import { getSavedAddresses } from "@/services/account";
import type { Address } from "@/types/address";
import {
  CHECKOUT_DELIVERY_FEE,
  CHECKOUT_DELIVERY_FEE_NOTICE,
  createCheckoutOrder,
  type CheckoutPaymentMethod,
} from "@/services/checkout";

type CheckoutStage = Extract<PurchaseProgressStep, "details" | "payment" | "review">;

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { hasHydrated, items, itemCount, totalAmount, clearCart, syncWithBackend } = useCart();
  
  const [authUser, setAuthUser] = React.useState<ReturnType<typeof getStoredAuthUser>>(null);
  const [savedAddresses, setSavedAddresses] = React.useState<Address[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = React.useState(true);
  const [addressLoadError, setAddressLoadError] = React.useState(false);
  const [selectedAddressId, setSelectedAddressId] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<CheckoutPaymentMethod>("mobile-money");
  const [checkoutStage, setCheckoutStage] = React.useState<CheckoutStage>("details");

  const loadAddresses = React.useCallback(async () => {
    setIsLoadingAddresses(true);
    setAddressLoadError(false);
    try {
      const addresses = await getSavedAddresses();
      setSavedAddresses(addresses);
      if (addresses.length > 0) {
        const def = addresses.find((a) => a.isDefault) || addresses[0];
        setSelectedAddressId(def.id);
      }
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        setAuthUser(null);
        setSavedAddresses([]);
        setSelectedAddressId(null);
        setAddressLoadError(false);
      } else {
        setAddressLoadError(true);
      }
    } finally {
      setIsLoadingAddresses(false);
    }
  }, []);

  React.useEffect(() => {
    if (hasHydrated) {
      const user = getStoredAuthUser();
      setAuthUser(user);

      if (user) {
        void loadAddresses();
      } else {
        setIsLoadingAddresses(false);
      }
    }
  }, [hasHydrated, loadAddresses]);

  const deliveryFee = itemCount > 0 ? CHECKOUT_DELIVERY_FEE : 0;
  const total = totalAmount + deliveryFee;
  
  const isGuest = !authUser;
  const detailsComplete = selectedAddressId !== null;
  const canSubmit = hasHydrated && items.length > 0 && detailsComplete && !submitting && !isGuest && !isLoadingAddresses;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (isGuest) {
      setSubmitError("Please sign in to place your order.");
      return;
    }

    if (!canSubmit) {
      setCheckoutStage("details");
      setSubmitError("Please select a delivery address before placing the order.");
      return;
    }

    const selected = savedAddresses.find((a) => a.id === selectedAddressId);
    if (!selected) {
      setSubmitError("Please select a delivery address.");
      setCheckoutStage("details");
      return;
    }

    const submitContact = {
      firstName: selected.name,
      lastName: "",
      email: authUser.email,
      phone: selected.phone,
    };
    const submitDelivery = {
      street: selected.street,
      area: selected.area,
      instructions: "",
    };

    setSubmitting(true);
    try {
      await syncWithBackend();
      const order = await createCheckoutOrder({
        items,
        contact: {
          firstName: submitContact.firstName.trim(),
          lastName: submitContact.lastName.trim(),
          email: submitContact.email.trim(),
          phone: submitContact.phone.trim(),
        },
        delivery: {
          street: submitDelivery.street.trim(),
          area: submitDelivery.area.trim(),
          instructions: submitDelivery.instructions?.trim(),
        },
        paymentMethod,
      });

      clearCart();
      router.push(`/success?orderId=${encodeURIComponent(order.id)}`);
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        setSubmitError("Your session expired. Please sign in again.");
        setAuthUser(null);
      } else {
        setSubmitError(error instanceof Error ? error.message : "Could not place your order.");
      }
      setSubmitting(false);
    }
  };

  if (!hasHydrated) {
    return (
      <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8">
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Loading checkout...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!items.length) {
    return (
      <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8">
        <div className="container mx-auto max-w-3xl px-4 md:px-6">
          <PurchaseProgress currentStep="cart" className="mb-5" />
          <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center shadow-sm">
            <h1 className="text-2xl font-black text-zinc-900">Your cart is empty</h1>
            <p className="mx-auto mt-2 max-w-md text-sm font-medium text-zinc-500">
              Add products to your cart before starting secure checkout.
            </p>
            <Link href="/categories" className="mt-6 inline-flex">
              <Button className="rounded-xl bg-zinc-900 px-6 font-bold text-white hover:bg-zinc-800">
                Browse Categories
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24">
      <form onSubmit={handleSubmit}>
        <PurchaseProgress currentStep={checkoutStage} />

        <div className="container mx-auto max-w-6xl px-4 pt-6 md:px-6">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-zinc-500">
            <Link href="/cart" className="hover:text-[#009E49]">Cart</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-900">Secure Checkout</span>
          </div>
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-zinc-900 md:text-4xl">
            Secure Checkout <Lock className="h-6 w-6 text-[#009E49]" />
          </h1>
        </div>

        <div className="flex flex-col gap-8 xl:gap-12 lg:flex-row">
          <div className="flex-1 space-y-6">
            
            {authUser ? (
              isLoadingAddresses ? (
                <section className={`${checkoutStage === "details" ? "block" : "hidden"} rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:block md:p-8`}>
                  <div className="flex h-32 items-center justify-center">
                    <p className="text-sm font-medium text-zinc-500">Loading delivery addresses...</p>
                  </div>
                </section>
              ) : addressLoadError ? (
                <section className={`${checkoutStage === "details" ? "block" : "hidden"} rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:block md:p-8`}>
                  <div className="flex h-32 flex-col items-center justify-center gap-3">
                    <p className="text-sm font-medium text-red-500">Failed to load delivery addresses.</p>
                    <Button type="button" onClick={() => loadAddresses()} variant="outline">Retry</Button>
                  </div>
                </section>
              ) : (
                <section className={`${checkoutStage === "details" ? "block" : "hidden"} rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:block md:p-8`}>
                  <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-zinc-900">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">1</span>
                    Delivery Address
                  </h2>
                  {savedAddresses.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 py-10 text-center">
                      <p className="mb-4 text-sm font-semibold text-zinc-900">Add a delivery address before checkout.</p>
                      <Link href="/account/addresses">
                        <Button type="button" className="rounded-xl bg-zinc-900 px-6 font-bold text-white hover:bg-zinc-800">
                          Manage Addresses
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {savedAddresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={`relative flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md ${
                              selectedAddressId === addr.id ? "border-[#009E49] bg-[#009E49]/5" : "border-zinc-200 bg-white hover:border-zinc-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name="saved-address"
                              className="sr-only"
                              checked={selectedAddressId === addr.id}
                              onChange={() => setSelectedAddressId(addr.id)}
                            />
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-900">{addr.name}</span>
                              {addr.isDefault && (
                                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500">
                              <p>{addr.street}</p>
                              <p>{addr.area}, {addr.city}</p>
                              <p className="mt-1 font-medium">{addr.phone}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="mt-4 text-right">
                        <Link href="/account/addresses" className="text-xs font-bold text-[#009E49] hover:underline">
                          Manage Addresses
                        </Link>
                      </div>
                    </>
                  )}
                  <Button
                    type="button"
                    disabled={!detailsComplete}
                    onClick={() => setCheckoutStage("payment")}
                    className="mt-6 h-12 w-full rounded-xl bg-[#009E49] font-black text-white hover:bg-[#00853d] disabled:opacity-50 md:hidden"
                  >
                    Continue to Payment
                  </Button>
                </section>
              )
            ) : (
              <section className="rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
                <div className="flex flex-col items-center justify-center text-center py-6">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#009E49]/10">
                    <Lock className="h-8 w-8 text-[#009E49]" />
                  </div>
                  <h2 className="mb-2 text-2xl font-black text-zinc-900">Sign in to continue</h2>
                  <p className="mb-8 text-sm font-medium text-zinc-500">
                    Sign in or create an account to place your order.
                  </p>
                  <div className="flex w-full max-w-sm flex-col gap-3">
                    <Link href="/auth/login?next=/checkout" className="w-full">
                      <Button type="button" className="h-12 w-full rounded-xl bg-[#009E49] font-black text-white hover:bg-[#00853d]">
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/auth/register?next=/checkout" className="w-full">
                      <Button type="button" variant="outline" className="h-12 w-full rounded-xl border-zinc-200 font-bold">
                        Create Account
                      </Button>
                    </Link>
                    <Link href="/categories" className="w-full">
                      <Button type="button" variant="ghost" className="h-12 w-full rounded-xl font-bold text-zinc-500 hover:text-zinc-900">
                        Continue Shopping
                      </Button>
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {!isGuest && (
              <section className={`${checkoutStage === "payment" ? "block" : "hidden"} rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:block md:p-8`}>
                <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-zinc-900">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">
                    2
                  </span>
                Payment Method
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { id: "mobile-money" as const, label: "Mobile Money", description: "Pay instantly via MTN or Airtel Mobile Money.", Icon: Smartphone },
                  { id: "bank-card" as const, label: "Bank Card", description: "Visa or Mastercard supported securely.", Icon: CreditCard },
                ].map(({ id, label, description, Icon }) => {
                  const isSelected = paymentMethod === id;

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPaymentMethod(id)}
                      className={`relative flex cursor-pointer flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all hover:shadow-md ${
                        isSelected ? "border-[#009E49] bg-[#009E49]/5" : "border-zinc-200 bg-white hover:border-zinc-300"
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span className={`flex items-center gap-2 font-bold ${isSelected ? "text-zinc-900" : "text-zinc-600"}`}>
                          <Icon className={`h-5 w-5 ${isSelected ? "text-[#009E49]" : ""}`} />
                          {label}
                        </span>
                        <span className={`h-4 w-4 rounded-full bg-white ${isSelected ? "border-4 border-[#009E49]" : "border-2 border-zinc-300"}`} />
                      </span>
                      <span className="text-xs font-medium text-zinc-500">{description}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 md:hidden">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCheckoutStage("details")}
                  className="h-12 rounded-xl border-zinc-200 font-bold"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setCheckoutStage("review")}
                  className="h-12 rounded-xl bg-[#009E49] font-black text-white hover:bg-[#00853d]"
                >
                  Review Order
                </Button>
              </div>
            </section>
            )}
          </div>

          <div className={`${checkoutStage === "review" ? "block" : "hidden"} w-full shrink-0 md:block lg:w-100 xl:w-112.5`}>
            <div className="sticky top-28 rounded-3xl border border-zinc-200/60 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-8">
              <h3 className="mb-6 text-xl font-black text-zinc-900">Order Summary</h3>

              <div className="hide-scrollbar mb-6 max-h-75 space-y-4 overflow-y-auto pr-2">
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
                      <span className="mt-1 text-sm font-black text-zinc-900">{formatCurrency(item.price)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="mb-6 bg-zinc-200" />

              <div className="mb-8 space-y-3">
                <div className="flex items-center justify-between text-sm font-medium text-zinc-500">
                  <span>Subtotal ({itemCount} items)</span>
                  <span className="font-bold text-zinc-900">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-medium text-zinc-500">
                  <span className="flex items-center gap-1"><Truck className="h-4 w-4" /> Delivery</span>
                  <span className="font-bold text-zinc-900">{formatCurrency(deliveryFee)}</span>
                </div>
                <FeaturePendingNotice
                  compact
                  title="Delivery quote pending"
                  description={CHECKOUT_DELIVERY_FEE_NOTICE}
                />
                <Separator className="bg-zinc-200" />
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-zinc-900">Total to Pay</span>
                  <span className="text-2xl font-black text-[#FF6B00]">{formatCurrency(total)}</span>
                </div>
              </div>

              {submitError ? <p className="mb-3 text-sm font-semibold text-red-600">{submitError}</p> : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => setCheckoutStage("payment")}
                className="mb-3 h-11 w-full rounded-xl border-zinc-200 font-bold md:hidden"
              >
                Back to Payment
              </Button>
              {isGuest ? (
                <Link href="/auth/login?next=/checkout" className="w-full block">
                  <Button type="button" className="h-14 w-full rounded-xl bg-[#009E49] text-lg font-black text-white shadow-lg shadow-[#009E49]/20 transition-all hover:-translate-y-0.5 hover:bg-[#00853d]">
                    Sign in to Place Order
                  </Button>
                </Link>
              ) : (
                <Button disabled={!canSubmit} className="h-14 w-full rounded-xl bg-[#009E49] text-lg font-black text-white shadow-lg shadow-[#009E49]/20 transition-all hover:-translate-y-0.5 hover:bg-[#00853d] disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? "Placing Order..." : "Place Order Now"}
                </Button>
              )}

              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5 rounded-lg bg-[#009E49]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#009E49]">
                  <ShieldCheck className="h-4 w-4" /> 256-bit Secure Encryption
                </div>
                <p className="max-w-62.5 text-center text-[10px] font-medium leading-relaxed text-zinc-400">
                  By placing your order, you agree to Zogular&apos;s Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </form>
    </main>
  );
}
