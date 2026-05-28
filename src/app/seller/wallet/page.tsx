"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Eye,
  EyeOff,
  RefreshCw,
  Landmark,
  Smartphone,
  CircleDollarSign,
  Shield,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster, toast } from "sonner";
import {
  sellerWalletApi,
  type SellerWalletDashboard,
  type PayoutMethod,
  type PayoutTransaction,
} from "@/services/seller-wallet";

// ============================================================
// TYPES & HELPERS
// ============================================================

function formatCurrency(amount: number): string {
  return `K${amount.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-ZM", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  successful: { label: "Successful", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  cancelled: { label: "Cancelled", icon: AlertCircle, color: "text-zinc-500", bg: "bg-zinc-50 border-zinc-200" },
};

// ============================================================
// MAIN PAGE
// ============================================================

export default function SellerWalletPage() {
  const [dashboard, setDashboard] = useState<SellerWalletDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const data = await sellerWalletApi.fetchDashboard();
      setDashboard(data);
      if (!selectedMethod && data.methods.length) {
        setSelectedMethod(data.methods.find((m) => m.isDefault) ?? data.methods[0]);
      }
    } catch {
      toast.error("Failed to load wallet data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRequestPayout = async () => {
    if (!selectedMethod || !payoutAmount) return;
    const amount = Number(payoutAmount);
    if (amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    setIsRequesting(true);
    try {
      await sellerWalletApi.requestPayout(amount, selectedMethod);
      toast.success("Payout request submitted!", {
        description: `K${amount.toLocaleString()} will be sent to ${selectedMethod.provider}.`,
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      });
      setShowPayoutModal(false);
      setPayoutAmount("");
      fetchDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payout request failed.");
    } finally {
      setIsRequesting(false);
    }
  };

  if (isLoading || !dashboard) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-[#009E49]" />
          <p className="text-sm font-medium text-zinc-500">Loading wallet...</p>
        </div>
      </div>
    );
  }

  const { balances, history, methods } = dashboard;
  const bal = showBalance;

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in pb-24 duration-500 md:pb-12">
      <Toaster position="top-center" />

      {/* HEADER */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Wallet</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage your earnings and payouts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowBalance(!showBalance)}
            className="h-9 w-9 rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm"
          >
            {showBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchDashboard}
            className="h-9 w-9 rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* BALANCE HERO CARD */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-[#009E49] via-[#00B854] to-[#00D463] p-6 text-white shadow-[0_20px_60px_rgba(0,158,73,0.3)] md:p-8">
        {/* Glassmorphism decorative orbs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full bg-white/5 blur-xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/80">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Available Balance</span>
          </div>

          <p className="mt-2 text-4xl font-black tracking-tight md:text-5xl">
            {bal ? formatCurrency(balances.availableBalance) : "K••••••"}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatBadge
              label="Pending"
              value={bal ? formatCurrency(balances.pendingBalance) : "••••"}
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <StatBadge
              label="Total Sales"
              value={bal ? formatCurrency(balances.totalSales) : "••••"}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            />
            <StatBadge
              label="Withdrawn"
              value={bal ? formatCurrency(balances.totalWithdrawn) : "••••"}
              icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            />
            <StatBadge
              label="Commission"
              value={bal ? formatCurrency(balances.totalCommissionPaid) : "••••"}
              icon={<CircleDollarSign className="h-3.5 w-3.5" />}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <Button
              onClick={() => setShowPayoutModal(true)}
              className="h-12 rounded-xl bg-white px-8 text-sm font-black text-[#009E49] shadow-lg transition-all hover:bg-white/90 active:scale-95"
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Request Payout
            </Button>
          </div>
        </div>
      </div>

      {/* PAYOUT MODAL */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md animate-in zoom-in-95 rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl md:p-8">
            <h2 className="text-lg font-black text-zinc-900">Request Payout</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Available: <strong className="text-[#009E49]">{formatCurrency(balances.availableBalance)}</strong>
            </p>

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Amount (Kwacha)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">K</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="h-12 rounded-xl bg-zinc-50 pl-8 text-lg font-bold shadow-inner focus-visible:ring-[#009E49]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Payout Method
                </label>
                <div className="space-y-2">
                  {methods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        selectedMethod?.id === method.id
                          ? "border-[#009E49] bg-[#009E49]/5 shadow-sm"
                          : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                      }`}
                    >
                      {method.type === "mobile_money" ? (
                        <Smartphone className="h-5 w-5 text-[#009E49]" />
                      ) : (
                        <Landmark className="h-5 w-5 text-blue-600" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-bold text-zinc-900">{method.provider}</p>
                        <p className="text-xs text-zinc-500">{method.maskedAccount}</p>
                      </div>
                      {method.isDefault && (
                        <span className="rounded-md bg-[#009E49]/10 px-2 py-0.5 text-[10px] font-bold text-[#009E49]">
                          Default
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security notice */}
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs font-medium text-amber-800">
                  Payouts are processed within 24-48 hours. A withdrawal fee of K6 applies.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPayoutModal(false)}
                className="h-12 rounded-xl border-zinc-200 font-bold text-zinc-600"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRequestPayout}
                disabled={isRequesting || !payoutAmount || !selectedMethod}
                className="h-12 rounded-xl bg-[#009E49] font-bold text-white shadow-[0_4px_15px_rgba(0,158,73,0.3)] transition-all active:scale-95 hover:bg-[#00853d]"
              >
                {isRequesting ? "Processing..." : "Confirm Payout"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION HISTORY */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-7">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
            <ArrowDownLeft className="h-4 w-4 text-zinc-400" />
            Payout History
          </h2>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
            {history.length} transactions
          </span>
        </div>

        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
              <Wallet className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="text-sm font-bold text-zinc-700">No payouts yet</p>
            <p className="mt-1 text-xs text-zinc-500">Request your first payout above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} showBalance={showBalance} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function StatBadge({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/15 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-white/70">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 text-sm font-extrabold">{value}</p>
    </div>
  );
}

function TransactionRow({
  transaction,
  showBalance,
}: {
  transaction: PayoutTransaction;
  showBalance: boolean;
}) {
  const config = statusConfig[transaction.status] ?? statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="group flex items-center gap-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4 transition-all hover:border-zinc-200 hover:bg-white hover:shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${config.bg}`}>
        <StatusIcon className={`h-4.5 w-4.5 ${config.color}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-zinc-900">{transaction.method}</p>
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${config.bg} ${config.color}`}>
            {config.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">
          {formatDate(transaction.requestedAt)} · Ref: {transaction.reference}
        </p>
        {transaction.failureReason && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-500">
            <AlertCircle className="h-3 w-3" />
            {transaction.failureReason}
          </p>
        )}
      </div>

      <div className="text-right">
        <p className="text-sm font-extrabold text-zinc-900">
          {showBalance ? formatCurrency(transaction.requestedAmount) : "K••••"}
        </p>
        <p className="text-[10px] font-medium text-zinc-400">
          Fee: {showBalance ? formatCurrency(transaction.withdrawalFee) : "••"}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5" />
    </div>
  );
}
