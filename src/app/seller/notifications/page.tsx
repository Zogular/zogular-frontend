"use client";

import Link from "next/link";
import { Bell, Inbox, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SellerNotificationsPage() {
  return (
    <div className="mx-auto flex min-w-0 max-w-250 animate-in flex-col gap-6 fade-in slide-in-from-bottom-4 duration-500 pb-24 md:pb-12">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
          Notifications
        </h1>
        <p className="mt-1 text-sm font-medium text-zinc-500">
          Seller alerts will appear here when Zogular enables notifications.
        </p>
      </div>

      <section
        aria-labelledby="seller-notifications-pending-title"
        className="rounded-3xl border border-dashed border-zinc-200 bg-white/70 p-6 text-center shadow-sm md:p-10"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
          <Inbox className="h-6 w-6" />
        </div>
        <h2 id="seller-notifications-pending-title" className="text-base font-black text-zinc-900">
          Notifications are not available yet
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm font-medium leading-relaxed text-zinc-500">
          Order, payout, inventory, and support alerts will show here after notifications are connected.
        </p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="h-11 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white hover:bg-zinc-800">
            <Link href="/seller/support">
              <LifeBuoy className="mr-2 h-4 w-4" />
              Contact support
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-xl border-zinc-200 bg-white px-5 text-sm font-bold text-zinc-700 hover:bg-zinc-50">
            <Link href="/seller/orders">
              <Bell className="mr-2 h-4 w-4" />
              View orders
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
