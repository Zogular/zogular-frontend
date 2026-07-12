"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Wallet,
  Clock3,
  Building2,
  AlertCircle,
  Receipt,
  Smartphone,
  ShieldAlert,
  LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import { BackendPendingBadge, FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import {
  SELLER_WALLET_BACKEND_PENDING_NOTICE,
  sellerWalletApi,
  type PayoutMethod,
} from "@/services/seller-wallet";

export default function SellerPayoutsPage() {
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sellerWalletApi.fetchDashboard();
      setMethods(data.methods);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const defaultMethod = useMemo(
    () => methods.find((method) => method.isDefault) ?? methods[0] ?? null,
    [methods],
  );

  if (loading) return <SellerPageLoading variant="table" />;

  if (error) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-base font-bold text-red-900">Failed to load payout readiness</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <Button onClick={loadDashboard} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 pb-24 md:pb-12">
      <div className="flex shrink-0 flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Payouts & Wallet</h1>
            <BackendPendingBadge />
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">Prepare your payout destination here, but wallet balances, releases, and payout execution remain backend-dependent.</p>
        </div>
      </div>

      <FeaturePendingNotice
        title="Payout execution is not live yet"
        description={SELLER_WALLET_BACKEND_PENDING_NOTICE}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl border border-[#008f42] bg-linear-to-br from-[#009E49] to-[#007a38] p-5 text-white shadow-[0_8px_20px_rgba(0,158,73,0.2)] md:p-6">
          <div className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <span className="rounded-md bg-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">Not live</span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#99e6bc]">Withdrawable Balance Status</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">Backend pending</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-white/85">
            No withdrawable, released, or held balance is shown until the backend ledger and escrow release flow are live.
          </p>
        </div>

        <div className="rounded-3xl border border-amber-200/70 bg-amber-50/70 p-5 shadow-sm md:p-6">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <Clock3 className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Settlement & Release</p>
          <h2 className="mt-1 text-xl font-black text-amber-950">Pending backend workflow</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-amber-900/85">
            Delivery confirmation, escrow release timing, payout review, and weekly transfer scheduling will appear here only after backend finance automation is available.
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
            <ShieldAlert className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">History & Confirmation</p>
          <h2 className="mt-1 text-xl font-black text-zinc-950">No payout ledger shown yet</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">
            This page does not show transfer confirmations, payout statuses, or net-settlement records until those values come from backend-owned ledger APIs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
            <Receipt className="h-4 w-4 text-zinc-400" />
            What Will Appear Later
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Ledger-backed balances</p>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-700">
                Released, pending, held, refunded, and fee-adjusted seller balances from backend finance records.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Weekly payout review</p>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-700">
                Reviewed payout runs, provider references, failed payout handling, and seller-facing payout history.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Escrow release timing</p>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-700">
                Delivery-confirmed release windows and dispute holds once backend escrow automation is active.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Payout issue handling</p>
              <p className="mt-2 text-sm font-medium leading-6 text-zinc-700">
                Verified failure reasons, retry controls, and support notes after real payout provider integrations exist.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
                <Building2 className="h-4 w-4 text-zinc-400" />
                Payout Destination
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Read only</span>
            </div>

            {defaultMethod ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm">
                    {defaultMethod.type === "bank" ? <Building2 className="h-4.5 w-4.5" /> : <Smartphone className="h-4.5 w-4.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900">{defaultMethod.provider}</p>
                    <p className="text-xs font-medium text-zinc-500">{defaultMethod.maskedAccount}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-medium leading-5 text-zinc-500">
                  This is a setup preview only. It does not confirm payout approval, payout eligibility, or transfer readiness.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm font-medium leading-6 text-amber-900">
                No payout destination is exposed here yet. When backend wallet services are ready, your verified payout destination will appear on this page.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
              <LifeBuoy className="h-4 w-4 text-zinc-400" />
              Need Help?
            </h2>
            <p className="text-sm font-medium leading-6 text-zinc-600">
              If you need to confirm payout setup or ask about seller finance readiness, use seller support instead of relying on this preview page for money movement status.
            </p>
            <div className="mt-4">
              <Link href="/seller/support">
                <Button className="h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#00853d]">
                  Contact Seller Support
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
