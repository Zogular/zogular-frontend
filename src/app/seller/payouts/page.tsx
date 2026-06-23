"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Wallet, ArrowUpRight, Clock3, CheckCircle2, XCircle, Search,
  Building2, AlertCircle, Receipt, Smartphone, X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import { cn } from "@/lib/utils";
import { calculatePayoutQuote, DEFAULT_PLATFORM_FINANCE_CONFIG, type SellerWalletBalances } from "@/services/platform-finance";
import { CollectionViewToggle, type CollectionViewMode } from "@/components/shared/CollectionViewToggle";
import { BackendPendingBadge, FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import {
  SELLER_WALLET_BACKEND_PENDING_NOTICE,
  sellerWalletApi,
  type PayoutMethod,
  type PayoutStatus,
  type PayoutTransaction,
} from "@/services/seller-wallet";

// ============================================================================
// 1. DATA CONTRACTS (Strictly Typed)
// ============================================================================
type PayoutFilterStatus = PayoutStatus | "all";
type SortBy = "newest" | "oldest" | "amount-high";

type StatusUI = {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: LucideIcon;
};

type PayoutMethodDraft = {
  type: PayoutMethod["type"];
  provider: string;
  accountName: string;
  accountNumber: string;
};

const SELLER_WALLET_BACKEND_PENDING = true;

// ============================================================================
// 3. LOGIC HELPERS
// ============================================================================
function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function formatDate(isoString: string) {
  return new Intl.DateTimeFormat("en-ZM", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function getStatusUI(status: PayoutStatus): StatusUI {
  switch (status) {
    case "successful":
      return { label: "Successful", bg: "bg-[#009E49]/10", text: "text-[#009E49]", border: "border-[#009E49]/20", icon: CheckCircle2 };
    case "pending":
      return { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Clock3 };
    case "failed":
      return { label: "Failed", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: XCircle };
    case "cancelled":
      return { label: "Cancelled", bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-200", icon: XCircle };
    default:
      return { label: "Unknown", bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-200", icon: AlertCircle };
  }
}

// ============================================================================
// 4. MAIN PAGE EXPORT
// ============================================================================
export default function SellerPayoutsPage() {
  const [balances, setBalances] = useState<SellerWalletBalances | null>(null);
  const [history, setHistory] = useState<PayoutTransaction[]>([]);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayoutFilterStatus>("all");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [mobileView, setMobileView] = useState<CollectionViewMode>("list");

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<PayoutTransaction | null>(null);
  const [methodDraft, setMethodDraft] = useState<PayoutMethodDraft>({
    type: "mobile_money",
    provider: "",
    accountName: "",
    accountNumber: "",
  });

  const payoutConfig = DEFAULT_PLATFORM_FINANCE_CONFIG.payoutFee;
  const MIN_WITHDRAWAL = payoutConfig.minimumWithdrawal;
  const withdrawalQuote = useMemo(
    () => calculatePayoutQuote(Number(withdrawAmount) || 0, payoutConfig),
    [payoutConfig, withdrawAmount],
  );

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sellerWalletApi.fetchDashboard();
      setBalances(data.balances);
      setHistory(data.history);
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

  const filteredHistory = useMemo(() => {
    const result = history.filter((tx) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        tx.id.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      if (sortBy === "amount-high") return b.requestedAmount - a.requestedAmount;
      if (sortBy === "oldest") return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    });

    return result;
  }, [history, searchQuery, statusFilter, sortBy]);

  const defaultMethod = useMemo(
    () => methods.find((m) => m.isDefault) ?? methods[0] ?? null,
    [methods]
  );

  const openMethodEditor = useCallback(() => {
    if (!defaultMethod) return;
    setMethodDraft({
      type: defaultMethod.type,
      provider: defaultMethod.provider,
      accountName: defaultMethod.accountName,
      accountNumber: getTailDigits(defaultMethod.maskedAccount),
    });
    setIsMethodModalOpen(true);
  }, [defaultMethod]);

  const saveMethodDraft = useCallback(() => {
    if (!defaultMethod) return;

    if (!methodDraft.provider.trim() || !methodDraft.accountName.trim() || !methodDraft.accountNumber.trim()) {
      toast.error("Provider, account name, and account number are required.");
      return;
    }

    setMethods((prev) =>
      prev.map((method) =>
        method.id === defaultMethod.id
          ? {
              ...method,
              type: methodDraft.type,
              provider: methodDraft.provider.trim(),
              accountName: methodDraft.accountName.trim(),
              maskedAccount: maskAccount(methodDraft.accountNumber),
            }
          : method,
      ),
    );
    setIsMethodModalOpen(false);
    toast.success("Payout method updated.");
  }, [defaultMethod, methodDraft]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balances || !defaultMethod) return;

    const amountNum = Number(withdrawAmount);
    if (Number.isNaN(amountNum) || amountNum < MIN_WITHDRAWAL) {
      toast.error(`Minimum withdrawal is ${formatCurrency(MIN_WITHDRAWAL)}`);
      return;
    }
    if (amountNum > balances.availableBalance) {
      toast.error("Amount exceeds available balance");
      return;
    }

    setIsWithdrawing(true);
    try {
      const newTx = await sellerWalletApi.requestPayout(amountNum, defaultMethod);
      setBalances((current) =>
        current
          ? {
              ...current,
              availableBalance: current.availableBalance - newTx.requestedAmount,
              pendingBalance: current.pendingBalance + newTx.requestedAmount,
              totalWithdrawn: current.totalWithdrawn + newTx.requestedAmount,
              totalPayoutFeesPaid: current.totalPayoutFeesPaid + newTx.withdrawalFee,
            }
          : current,
      );
      setHistory((prev) => [newTx, ...prev]);
      toast.success("Withdrawal requested successfully!");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to process withdrawal";
      toast.error(message);
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (loading) return <SellerPageLoading variant="table" />;

  if (error || !balances) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-base font-bold text-red-900">System Error</h3>
        <p className="mt-1 text-sm text-red-700">{error || "Failed to load wallet"}</p>
        <Button onClick={loadDashboard} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 pb-24 md:pb-12">
      <div className="shrink-0 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Payouts & Wallet</h1>
            <BackendPendingBadge />
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">View the wallet preview while backend wallet, balance, and payout support is pending.</p>
        </div>
      </div>

      <FeaturePendingNotice
        title="Operations-only preview"
        description={SELLER_WALLET_BACKEND_PENDING_NOTICE}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-[#008f42] bg-linear-to-br from-[#009E49] to-[#007a38] p-5 text-white shadow-[0_8px_20px_rgba(0,158,73,0.2)] md:p-6">
          <div className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="rounded-md bg-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">Backend pending</span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#99e6bc]">Available Balance</p>
            <h3 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">{formatCurrency(balances.availableBalance)}</h3>
          </div>

          <Button
            onClick={() => setIsWithdrawModalOpen(true)}
            disabled={SELLER_WALLET_BACKEND_PENDING || balances.availableBalance < MIN_WITHDRAWAL}
            className="mt-6 h-11 w-full rounded-xl bg-white text-sm font-black text-[#009E49] shadow-sm hover:bg-zinc-50 active:scale-95 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:opacity-90"
          >
            {SELLER_WALLET_BACKEND_PENDING ? "Backend integration pending" : balances.availableBalance < MIN_WITHDRAWAL ? `Min. Withdrawal: ${formatCurrency(MIN_WITHDRAWAL)}` : "Request Payout"}
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-3xl border border-amber-200/60 bg-amber-50/40 p-5 shadow-sm">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Clock3 className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/70">Pending Balance</p>
            <h3 className="mt-1 text-2xl font-black text-amber-900">{formatCurrency(balances.pendingBalance)}</h3>
            <p className="mt-1 text-xs font-medium text-amber-700/80">Clears 24h after delivery</p>
          </div>

          <div className="flex-1 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Withdrawn</p>
            <h3 className="mt-1 text-2xl font-black text-zinc-900">{formatCurrency(balances.totalWithdrawn)}</h3>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex-1 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-900">
              <Receipt className="h-4 w-4 text-zinc-400" />
              Earnings Ledger
            </h2>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between font-bold text-zinc-700">
                <span>Sales Revenue</span>
                <span>{formatCurrency(balances.totalSales)}</span>
              </div>
              <div className="flex justify-between font-medium text-zinc-500">
                <span>Zogular Commission</span>
                <span className="text-red-500">-{formatCurrency(balances.totalCommissionPaid)}</span>
              </div>
              <div className="flex justify-between font-medium text-zinc-500">
                <span>Withdrawal Fees</span>
                <span className="text-red-500">-{formatCurrency(balances.totalPayoutFeesPaid)}</span>
              </div>
              <div className="flex justify-between font-medium text-zinc-500">
                <span>Refunds</span>
                <span className="text-red-500">-{formatCurrency(balances.totalRefunds)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-100 pt-2 font-black text-zinc-900">
                <span>Net Earnings</span>
                <span className="text-[#009E49]">{formatCurrency(balances.totalSales - balances.totalCommissionPaid - balances.totalRefunds)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 shadow-inner">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Active Payout Method</p>
              <button
                type="button"
                onClick={openMethodEditor}
                disabled={SELLER_WALLET_BACKEND_PENDING}
                className="cursor-pointer text-[10px] font-bold text-[#009E49] hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline"
              >
                Backend pending
              </button>
            </div>
            {defaultMethod ? (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 shadow-sm">
                  {defaultMethod.type === "bank" ? <Building2 className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-900">{defaultMethod.provider}</p>
                  <p className="text-xs font-medium text-zinc-500">{defaultMethod.maskedAccount}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs font-medium text-zinc-500">No payout method added.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID or reference..."
            className="h-11 w-full rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row">
          <select
            aria-label="Filter payouts by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PayoutFilterStatus)}
            className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] sm:w-40"
          >
            <option value="all">All Statuses</option>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <select
            aria-label="Sort payouts"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="col-span-2 h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] sm:w-40"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount-high">Highest Amount</option>
          </select>
        </div>
      </div>

      <CollectionViewToggle
        value={mobileView}
        onChange={setMobileView}
        className="md:hidden"
      />

      <div className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/50">
              <tr>
                <th className="p-4 pl-6 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Date & ID</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Method</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Net Amount</th>
                <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status</th>
                <th className="p-4 pr-6 text-right text-[10px] font-bold uppercase tracking-wider text-zinc-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-sm font-medium text-zinc-500">
                    <Wallet className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((tx) => {
                  const statusUI = getStatusUI(tx.status);
                  const Icon = statusUI.icon;
                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-zinc-50/50">
                      <td className="p-4 pl-6">
                        <p className="font-bold text-zinc-900">{formatDate(tx.requestedAt)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{tx.id}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-zinc-700">{tx.method}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{tx.reference}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-black text-zinc-900">{formatCurrency(tx.sellerReceives)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Withdrawal Fee: {formatCurrency(tx.withdrawalFee)}</p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusUI.bg} ${statusUI.text} ${statusUI.border}`}>
                          <Icon className="h-3 w-3" />
                          {statusUI.label}
                        </span>
                        {tx.failureReason ? (
                          <p className="mt-1 max-w-45 truncate text-[10px] font-semibold text-red-500" title={tx.failureReason}>
                            {tx.failureReason}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => setSelectedTransaction(tx)}
                          className="h-8 rounded-lg text-xs font-bold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={cn("md:hidden", mobileView === "grid" ? "grid grid-cols-1 gap-3 p-3" : "flex flex-col divide-y divide-zinc-100")}>
          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-sm font-medium text-zinc-500">
              <Wallet className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
              No transactions found.
            </div>
          ) : (
            filteredHistory.map((tx) => {
              const statusUI = getStatusUI(tx.status);
              const Icon = statusUI.icon;
              return (
                <div key={tx.id} className={cn(mobileView === "grid" ? "rounded-[1.4rem] border border-zinc-200/80 bg-white p-4 shadow-sm" : "p-3.5 transition-colors hover:bg-zinc-50/50")}>
                  {mobileView === "list" ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-zinc-900">{formatCurrency(tx.sellerReceives)}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{tx.id}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusUI.bg} ${statusUI.text} ${statusUI.border}`}>
                          <Icon className="h-3 w-3" />
                          {statusUI.label}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-600">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Date</span>
                          <span>{formatDate(tx.requestedAt)}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Method</span>
                          <span>{tx.method}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Ref</span>
                          <span>{tx.reference}</span>
                        </span>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setSelectedTransaction(tx)}
                          className="h-8 rounded-xl border-zinc-200 bg-white px-3 text-[10px] font-bold text-zinc-700"
                        >
                          Details
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-zinc-900">{formatCurrency(tx.sellerReceives)}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{formatDate(tx.requestedAt)}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusUI.bg} ${statusUI.text} ${statusUI.border}`}>
                          <Icon className="h-3 w-3" />
                          {statusUI.label}
                        </span>
                      </div>

                      <div className="mt-2.5 rounded-[1rem] border border-zinc-200 bg-zinc-50/80 px-3">
                        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-zinc-100 py-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Method</span>
                          <span className="truncate text-right text-[11px] font-bold text-zinc-900">{tx.method}</span>
                        </div>
                        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-zinc-100 py-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Reference</span>
                          <span className="truncate text-right text-[11px] font-bold text-zinc-900">{tx.reference}</span>
                        </div>
                        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-2">
                          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">Fee</span>
                          <span className="truncate text-right text-[11px] font-bold text-zinc-900">{formatCurrency(tx.withdrawalFee)}</span>
                        </div>
                      </div>

                      <div className="mt-2.5 flex justify-end">
                        <Button
                          variant="outline"
                          onClick={() => setSelectedTransaction(tx)}
                          className="h-9 rounded-xl border-zinc-200 bg-white px-3 text-[11px] font-bold text-zinc-700"
                        >
                          Details
                        </Button>
                      </div>
                    </>
                  )}

                  {tx.failureReason ? (
                    <p className="mt-2 rounded-lg border border-red-100 bg-red-50 p-2 text-[10px] font-semibold text-red-500">
                      {tx.failureReason}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {isWithdrawModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !isWithdrawing && setIsWithdrawModalOpen(false)}
          />

          <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
            <div className="absolute right-4 top-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close withdrawal modal"
                disabled={isWithdrawing}
                onClick={() => setIsWithdrawModalOpen(false)}
                className="h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <h2 className="mb-1 text-xl font-black text-zinc-900">Request Payout</h2>
            <p className="mb-6 text-xs font-medium text-zinc-500">Backend integration pending. This action is disabled until backend support is implemented.</p>

            <form onSubmit={handleWithdrawSubmit} className="space-y-5">
              <div className="flex items-center justify-between rounded-2xl border border-[#009E49]/20 bg-[#009E49]/5 p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#009E49]">Available Balance</span>
                <span className="text-lg font-black text-zinc-900">{formatCurrency(balances.availableBalance)}</span>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Withdrawal Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-zinc-400">K</span>
                  <Input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-14 rounded-2xl bg-zinc-50 pl-10 text-xl font-black shadow-inner focus-visible:ring-[#009E49]"
                    disabled={SELLER_WALLET_BACKEND_PENDING || isWithdrawing}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(balances.availableBalance.toString())}
                    disabled={SELLER_WALLET_BACKEND_PENDING}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-zinc-200/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600 hover:bg-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-400"
                  >
                    Max
                  </button>
                </div>
              </div>

              {defaultMethod ? (
                <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    {defaultMethod.type === "bank" ? <Building2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Transfer To</p>
                    <p className="truncate text-sm font-bold text-zinc-900">{defaultMethod.provider}</p>
                    <p className="text-xs font-medium text-zinc-500">{defaultMethod.maskedAccount}</p>
                  </div>
                </div>
              ) : null}

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                <div className="flex justify-between font-bold text-zinc-700">
                  <span>Requested Amount</span>
                  <span>{formatCurrency(withdrawalQuote.requestedAmount)}</span>
                </div>
                <div className="mt-2 flex justify-between font-medium text-zinc-500">
                  <span>Withdrawal Fee</span>
                  <span>-{formatCurrency(withdrawalQuote.withdrawalFee)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-zinc-200 pt-2 font-black text-zinc-900">
                  <span>Seller Receives</span>
                  <span className="text-[#009E49]">{formatCurrency(withdrawalQuote.sellerReceives)}</span>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={SELLER_WALLET_BACKEND_PENDING || isWithdrawing || !withdrawAmount}
                  className="h-12 w-full rounded-xl bg-[#009E49] text-base font-black text-white shadow-[0_4px_15px_rgba(0,158,73,0.3)] transition-all hover:bg-[#00853d] active:scale-95"
                >
                  {SELLER_WALLET_BACKEND_PENDING ? "Backend integration pending" : isWithdrawing ? "Processing..." : "Confirm Withdrawal"}
                </Button>
                <p className="mt-3 text-center text-[10px] font-medium text-zinc-500">
                  Withdrawal fee is 1%, minimum K3 and capped at K15. Minimum withdrawal is {formatCurrency(MIN_WITHDRAWAL)}.
                </p>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isMethodModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close payout method editor"
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            onClick={() => setIsMethodModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-zinc-900">Edit Payout Method</h2>
            <p className="mt-1 text-xs font-medium text-zinc-500">Update where your earnings are sent.</p>

            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="method-type" className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Method Type</label>
                <select
                  id="method-type"
                  value={methodDraft.type}
                  onChange={(event) =>
                    setMethodDraft((prev) => ({
                      ...prev,
                      type: event.target.value as PayoutMethod["type"],
                    }))
                  }
                  disabled={SELLER_WALLET_BACKEND_PENDING}
                  className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] disabled:cursor-not-allowed disabled:text-zinc-400"
                >
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Bank</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Provider</label>
                <Input
                  value={methodDraft.provider}
                  onChange={(event) =>
                    setMethodDraft((prev) => ({ ...prev, provider: event.target.value }))
                  }
                  className="h-11 rounded-xl bg-zinc-50 shadow-inner focus-visible:ring-[#009E49]"
                  placeholder="e.g. MTN Mobile Money"
                  disabled={SELLER_WALLET_BACKEND_PENDING}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Account Name</label>
                <Input
                  value={methodDraft.accountName}
                  onChange={(event) =>
                    setMethodDraft((prev) => ({ ...prev, accountName: event.target.value }))
                  }
                  className="h-11 rounded-xl bg-zinc-50 shadow-inner focus-visible:ring-[#009E49]"
                  placeholder="Name on payout account"
                  disabled={SELLER_WALLET_BACKEND_PENDING}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Account Number</label>
                <Input
                  value={methodDraft.accountNumber}
                  onChange={(event) =>
                    setMethodDraft((prev) => ({ ...prev, accountNumber: event.target.value }))
                  }
                  className="h-11 rounded-xl bg-zinc-50 shadow-inner focus-visible:ring-[#009E49]"
                  placeholder="Enter account or mobile number"
                  disabled={SELLER_WALLET_BACKEND_PENDING}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setIsMethodModalOpen(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button disabled={SELLER_WALLET_BACKEND_PENDING} onClick={saveMethodDraft} className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">
                Backend pending
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTransaction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close transaction details"
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            onClick={() => setSelectedTransaction(null)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black text-zinc-900">Transaction Details</h2>
            <p className="mt-1 text-xs font-medium text-zinc-500">{selectedTransaction.id}</p>

            <div className="mt-5 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Requested</p>
                <p className="mt-1 font-bold text-zinc-900">{formatDate(selectedTransaction.requestedAt)}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Status</p>
                <p className="mt-1 font-bold text-zinc-900">{getStatusUI(selectedTransaction.status).label}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Requested Amount</p>
                <p className="mt-1 font-bold text-zinc-900">{formatCurrency(selectedTransaction.requestedAmount)}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Withdrawal Fee</p>
                <p className="mt-1 font-bold text-zinc-900">{formatCurrency(selectedTransaction.withdrawalFee)}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Net Amount Received</p>
                <p className="mt-1 font-bold text-zinc-900">{formatCurrency(selectedTransaction.sellerReceives)}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Provider</p>
                <p className="mt-1 font-bold capitalize text-zinc-900">{selectedTransaction.provider.providerName}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 md:col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Reference</p>
                <p className="mt-1 font-bold text-zinc-900">{selectedTransaction.reference}</p>
              </div>
            </div>

            {selectedTransaction.failureReason ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {selectedTransaction.failureReason}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedTransaction(null)} className="rounded-xl">
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getTailDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-4);
}

function maskAccount(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "******0000";
  const tail = digits.slice(-4).padStart(4, "0");
  return `******${tail}`;
}
