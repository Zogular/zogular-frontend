"use client";

import Link from "next/link";
import { Clock3, LifeBuoy, Receipt, ShieldAlert, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackendPendingBadge, FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { SELLER_WALLET_BACKEND_PENDING_NOTICE } from "@/services/seller-wallet";

export default function SellerPayoutsPage() {
  return (
    <div className="mx-auto min-w-0 max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 pb-24 md:pb-12">
      <div className="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Payouts & Wallet</h1>
            <BackendPendingBadge />
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Payout balances, releases, and transfers will appear here when Zogular enables seller payouts.
          </p>
        </div>
      </div>

      <FeaturePendingNotice
        title="Payouts are not available yet"
        description={SELLER_WALLET_BACKEND_PENDING_NOTICE}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl border border-[#008f42] bg-linear-to-br from-[#009E49] to-[#007a38] p-5 text-white shadow-[0_8px_20px_rgba(0,158,73,0.2)] md:p-6">
          <div className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="rounded-md bg-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">Pending</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#99e6bc]">Balance status</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Not available yet</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-white/85">
            This page does not show seller balances until payouts are connected.
          </p>
        </div>

        <div className="rounded-3xl border border-amber-200/70 bg-amber-50/70 p-5 shadow-sm md:p-6">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Clock3 className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Release timing</p>
          <h2 className="mt-1 text-xl font-black text-amber-950">Coming later</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-amber-900/85">
            Delivery confirmation, review timing, and transfer schedules will appear only after they are available.
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
            <ShieldAlert className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">History</p>
          <h2 className="mt-1 text-xl font-black text-zinc-950">No payout records yet</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">
            Transfer confirmations and payout history will appear here when real payout records exist.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <section className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6" aria-labelledby="seller-payouts-later-title">
          <h2 id="seller-payouts-later-title" className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
            <Receipt className="h-4 w-4 text-zinc-400" />
            What will appear later
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Confirmed seller balances",
              "Payout destination details",
              "Release timing",
              "Transfer history",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                <p className="text-sm font-bold text-zinc-900">{item}</p>
                <p className="mt-2 text-xs font-medium leading-5 text-zinc-600">
                  This will show after Zogular enables payouts.
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6" aria-labelledby="seller-payouts-help-title">
          <h2 id="seller-payouts-help-title" className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
            <LifeBuoy className="h-4 w-4 text-zinc-400" />
            Need help?
          </h2>
          <p className="text-sm font-medium leading-6 text-zinc-600">
            Contact seller support if you have questions about payout setup or seller finance readiness.
          </p>
          <div className="mt-4">
            <Button asChild className="h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#00853d]">
              <Link href="/seller/support">Contact Seller Support</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
