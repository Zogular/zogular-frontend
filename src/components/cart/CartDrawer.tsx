"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  PackageOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetClose,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCart, type CartItem } from "@/hooks/use-cart";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";

type CartDrawerProps = {
  children: ReactNode;
};

type CartIdentity = {
  id: string | number;
  variant?: string | null;
};

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function CartItemRow({
  item,
  onNavigate,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItem;
  onNavigate: () => void;
  onIncrease: (identity: CartIdentity) => void;
  onDecrease: (identity: CartIdentity) => void;
  onRemove: (identity: CartIdentity) => void;
}) {
  const identity: CartIdentity = { id: item.id, variant: item.variant };

  return (
    <div className="flex gap-4">
      <Link
        href={`/product/${item.slug}`}
        onClick={onNavigate}
        className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200/50 bg-zinc-50 p-1"
      >
        <div className="absolute inset-1 mix-blend-multiply">
          <Image
            src={item.image}
            alt={item.name ?? "Cart item image"}
            fill
            className="object-contain"
          />
        </div>
      </Link>

      <div className="flex flex-1 min-w-0 flex-col justify-between">
        <div>
          <Link
            href={`/product/${item.slug}`}
            onClick={onNavigate}
            className="mb-0.5 line-clamp-1 text-sm font-bold leading-tight text-zinc-800 transition-colors hover:text-[#009E49]"
          >
            {item.name}
          </Link>

          {item.variant ? (
            <p className="text-[11px] font-medium text-zinc-500">
              Variant: {item.variant}
            </p>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-black text-zinc-900">
            {formatCurrency(item.price)}
          </span>

          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200/50 bg-zinc-100 p-1 shadow-sm">
            <button
              type="button"
              title={item.quantity <= 1 ? "Remove item" : "Decrease quantity"}
              onClick={() => {
                if (item.quantity <= 1) onRemove(identity);
                else onDecrease(identity);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-zinc-600 transition-all hover:text-zinc-900 hover:shadow-sm"
            >
              {item.quantity <= 1 ? (
                <Trash2 className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
            </button>

            <span className="w-4 text-center text-xs font-bold text-zinc-900">
              {item.quantity}
            </span>

            <button
              type="button"
              title="Increase quantity"
              onClick={() => onIncrease(identity)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-zinc-600 transition-all hover:text-[#009E49] hover:shadow-sm"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCartState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
        <PackageOpen className="h-7 w-7" />
      </div>

      <h3 className="text-lg font-black text-zinc-900">Your cart is empty</h3>
      <p className="mt-2 max-w-xs text-sm font-medium text-zinc-500">
        Add something you like and it’ll show up here.
      </p>

      <Link href="/categories" className="mt-5" onClick={onNavigate}>
        <Button className="rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]">
          Continue Shopping
        </Button>
      </Link>
    </div>
  );
}

export function CartDrawer({ children }: CartDrawerProps) {
  const [open, setOpen] = useState(false);

  const {
    items,
    itemCount,
    totalAmount,
    hasHydrated,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
  } = useCart();

  const displayItemCount = hasHydrated ? itemCount : 0;
  const displayItems = hasHydrated ? items : [];
  const displayTotalAmount = hasHydrated ? totalAmount : 0;
  const total = displayTotalAmount;
  const closeDrawer = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>

      <SheetContent className="flex h-full min-h-0 w-full flex-col overflow-hidden border-l border-white/50 bg-white/85 p-0 shadow-[0_0_60px_rgba(0,0,0,0.1)] backdrop-blur-2xl sm:max-w-md">
        <SheetHeader className="shrink-0 border-b border-zinc-200/50 bg-white/40 px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-xl font-black text-zinc-900">
            <ShoppingCart className="h-5 w-5 text-[#009E49]" />
            Your Cart
            <Badge className="ml-1 bg-zinc-900 text-white hover:bg-zinc-800">
              {displayItemCount}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {!hasHydrated ? (
          <div className="flex flex-1 items-center justify-center px-6 py-12 text-sm font-medium text-zinc-500">
            Loading your cart...
          </div>
        ) : displayItems.length > 0 ? (
          <>
            <ScrollArea className="min-h-0 flex-1 overflow-hidden px-6 py-4">
              <div className="flex flex-col gap-5">
                {displayItems.map((item) => (
                  <CartItemRow
                    key={`${item.id}-${item.variant ?? "default"}`}
                    item={item}
                    onNavigate={closeDrawer}
                    onIncrease={increaseQuantity}
                    onDecrease={decreaseQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            </ScrollArea>

            <SheetFooter className="shrink-0 flex flex-col border-t border-zinc-200/50 bg-white/60 px-6 py-5 backdrop-blur-md">
              <div className="mb-5 space-y-3">
                <div className="flex items-center justify-between text-sm font-medium text-zinc-500">
                  <span>
                    Subtotal ({displayItemCount} item{displayItemCount > 1 ? "s" : ""})
                  </span>
                  <span className="font-bold text-zinc-900">
                    {formatCurrency(displayTotalAmount)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm font-medium text-zinc-500">
                  <span>Delivery (Lusaka Area)</span>
                  <span className="font-bold text-zinc-500">
                    Calculated at checkout
                  </span>
                </div>

                <Separator className="bg-zinc-200" />

                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-zinc-900">Total</span>
                  <span className="text-xl font-black text-[#FF6B00]">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <SheetClose asChild>
                <Link href="/checkout" className="w-full" onClick={closeDrawer}>
                  <Button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#009E49] text-base font-bold text-white shadow-lg shadow-[#009E49]/20 transition-all hover:-translate-y-0.5 hover:bg-[#00853d]">
                    Proceed to Checkout
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </SheetClose>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                <ShieldCheck className="h-3.5 w-3.5 text-[#009E49]" />
                100% Secure Checkout
              </div>
            </SheetFooter>
          </>
        ) : (
          <div className="flex-1">
            <EmptyCartState onNavigate={closeDrawer} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
