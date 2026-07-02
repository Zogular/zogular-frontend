"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchaseProgress } from "@/components/checkout/PurchaseProgress";
import { useCart, type CartItemIdentity } from "@/hooks/use-cart";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

export default function CartPage() {
  const {
    hasHydrated,
    items,
    itemCount,
    totalAmount,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
  } = useCart();

  const finalTotal = totalAmount;

  if (!hasHydrated) {
    return (
      <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8 md:pt-12">
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <div className="rounded-3xl border border-zinc-200/70 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-zinc-500">Loading your cart...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8 md:pt-12">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 md:text-4xl">Your Cart</h1>
          <p className="mt-2 text-sm font-medium text-zinc-500">Review your items before checkout.</p>
        </div>
        <PurchaseProgress currentStep="cart" className="mb-5" />

        {items.length ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <section className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-sm">
              <div className="divide-y divide-zinc-100">
                {items.map((item) => {
                  const identity: CartItemIdentity = { id: item.id, variant: item.variant };

                  return (
                    <div key={`${item.id}-${item.variant ?? "default"}`} className="flex gap-4 p-4 md:p-5">
                      <Link
                        href={`/product/${item.slug}`}
                        className="relative h-22 w-22 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50"
                      >
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="88px"
                          unoptimized
                          className="object-contain p-2 mix-blend-multiply"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link href={`/product/${item.slug}`} className="line-clamp-2 text-sm font-bold text-zinc-900 hover:text-[#009E49]">
                          {item.name}
                        </Link>
                        {item.variant ? (
                          <p className="mt-1 text-xs font-medium text-zinc-500">Variant: {item.variant}</p>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-sm font-black text-zinc-900">{formatCurrency(item.price)}</span>
                          <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.quantity <= 1) removeItem(identity);
                                else decreaseQuantity(identity);
                              }}
                              title={item.quantity <= 1 ? "Remove item from cart" : "Decrease quantity"}
                              aria-label={item.quantity <= 1 ? "Remove item from cart" : "Decrease quantity"}
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-zinc-500 transition-colors hover:text-zinc-900"
                            >
                              {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5 text-red-500" /> : <Minus className="h-3.5 w-3.5" />}
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-zinc-900">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => increaseQuantity(identity)}
                              title="Increase quantity"
                              aria-label="Increase quantity"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-zinc-500 transition-colors hover:text-[#009E49]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="h-fit rounded-3xl border border-zinc-200/60 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-zinc-900">Order Summary</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between font-medium text-zinc-500">
                  <span>Subtotal ({itemCount} items)</span>
                  <span className="font-bold text-zinc-900">{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between font-medium text-zinc-500">
                  <span>Delivery</span>
                  <span className="font-bold text-zinc-500">Calculated at checkout</span>
                </div>
                <div className="flex justify-between border-t border-zinc-100 pt-2 text-base font-black text-zinc-900">
                  <span>Total</span>
                  <span className="text-[#FF6B00]">{formatCurrency(finalTotal)}</span>
                </div>
              </div>
              <Link href="/checkout" className="mt-5 block">
                <Button className="h-11 w-full rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]">
                  Proceed to Checkout
                </Button>
              </Link>
            </aside>
          </div>
        ) : (
          <div className="rounded-3xl border border-zinc-200 border-dashed bg-white px-6 py-20 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-black text-zinc-900">Your cart is empty</h2>
            <p className="mt-2 text-sm font-medium text-zinc-500">Add products to start checkout.</p>
            <Link href="/categories" className="mt-6 inline-flex">
              <Button className="rounded-xl bg-zinc-900 px-6 font-bold text-white hover:bg-zinc-800">
                Browse Categories
              </Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
