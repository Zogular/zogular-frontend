"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Wallet, TrendingUp, Download, CheckCircle2, XCircle, 
  Clock, Banknote, ShieldAlert, Search, Lock, X, RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Architecture Imports
import { adminFinanceApi, PayoutRequest, LedgerEntry, TreasuryMetrics, TransactionType } from "@/services/admin/finance";
import { recordAdminAudit } from "@/services/admin/audit";
import { adminHasPermission, CURRENT_ADMIN_IDENTITY } from "@/services/admin/session";

// ============================================================================
// LOGIC HELPERS & UI MAPS
// ============================================================================
function formatCurrency(value: number) { return `K${value.toLocaleString()}`; }
function formatDate(isoString: string) { 
  return new Intl.DateTimeFormat("en-ZM", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(isoString)); 
}

const PAYOUT_STATUS_UI: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  "pending": { label: "Pending", bg: "bg-amber-950", text: "text-amber-100", border: "border-amber-400/50", icon: Clock },
  "processing": { label: "Processing", bg: "bg-sky-950", text: "text-sky-100", border: "border-sky-400/50", icon: RefreshCcw },
  "completed": { label: "Completed", bg: "bg-emerald-950", text: "text-emerald-100", border: "border-emerald-400/50", icon: CheckCircle2 },
  "failed": { label: "Failed", bg: "bg-rose-950", text: "text-rose-100", border: "border-rose-400/50", icon: XCircle },
  "rejected": { label: "Rejected", bg: "bg-rose-950", text: "text-rose-100", border: "border-rose-400/50", icon: XCircle },
};

const TXN_TYPE_UI: Record<string, { label: string; color: string; sign: string }> = {
  "escrow_deposit": { label: "Escrow Deposit", color: "text-blue-600", sign: "+" },
  "commission_fee": { label: "Platform Commission", color: "text-emerald-600", sign: "+" },
  "payout_release": { label: "Payout Release", color: "text-rose-600", sign: "-" },
  "refund_debit": { label: "Refund Debit", color: "text-rose-600", sign: "-" },
};

type ViewTab = "payouts" | "ledger" | "refunds" | "reconciliation";

// ============================================================================
// MAIN PAGE EXPORT
// ============================================================================
export default function AdminFinancePage() {
  const [metrics, setMetrics] = useState<TreasuryMetrics | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState<ViewTab>("payouts");
  const [searchQuery, setSearchQuery] = useState("");
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<TransactionType | "all">("all");

  // Modal State
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutNotes, setPayoutNotes] = useState<Record<string, string[]>>({});
  const [reviewedRefunds, setReviewedRefunds] = useState<string[]>([]);

  // RBAC Guards
  const canApprovePayouts = adminHasPermission("approve_payouts");
  const canExport = adminHasPermission("export_reports");
  const canManageRefunds = adminHasPermission("manage_refunds");

  const loadTreasury = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminFinanceApi.fetchTreasuryData();
      setMetrics(data.metrics);
      setPayouts(data.payouts);
      setLedger(data.ledger);
    } catch {
      toast.error("Failed to load treasury data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTreasury(); }, [loadTreasury]);

  // Derived filters
  const filteredPayouts = useMemo(() => {
    return payouts.filter(p => !searchQuery || p.storeName.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [payouts, searchQuery]);

  const filteredLedger = useMemo(() => {
    return ledger.filter(l => {
      const matchesSearch = !searchQuery || l.description.toLowerCase().includes(searchQuery.toLowerCase()) || l.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = ledgerTypeFilter === "all" || l.type === ledgerTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [ledger, ledgerTypeFilter, searchQuery]);

  const refundQueue = useMemo(() => {
    return ledger.filter((entry) => entry.type === "refund_debit");
  }, [ledger]);

  // --- MUTATION HANDLERS ---
  const handleProcessPayout = async (newStatus: "completed" | "rejected") => {
    if (!selectedPayout || !canApprovePayouts) return toast.error("Unauthorized action.");
    setIsProcessing(true);
    try {
      await adminFinanceApi.updatePayoutStatus(selectedPayout.id, newStatus);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: `payout_${newStatus}`,
        target: selectedPayout.id,
        severity: "critical",
        note: payoutNote.trim() || "Payout reviewed by treasury admin.",
      });
      setPayouts(prev => prev.map(p => p.id === selectedPayout.id ? { ...p, status: newStatus } : p));
      setSelectedPayout(prev => prev ? { ...prev, status: newStatus } : null);
      setPayoutNotes(prev => ({ ...prev, [selectedPayout.id]: [payoutNote.trim() || `Payout ${newStatus}.`, ...(prev[selectedPayout.id] ?? [])] }));
      setPayoutNote("");
      toast.success(newStatus === "completed" ? "Funds released successfully." : "Payout rejected.");
    } catch {
      toast.error("Failed to process payout.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    if (!canExport) return toast.error("Unauthorized export.");
    const rows = activeTab === "payouts"
      ? filteredPayouts.map((payout) => [payout.id, payout.sellerId, payout.storeName, payout.status, String(payout.amount), payout.method, payout.requestedAt])
      : filteredLedger.map((entry) => [entry.id, entry.orderId ?? "", entry.type, entry.description, String(entry.amount), String(entry.balanceAfter), entry.timestamp]);
    const header = activeTab === "payouts"
      ? ["id", "seller_id", "store", "status", "amount", "method", "requested_at"]
      : ["id", "order_id", "type", "description", "amount", "balance_after", "timestamp"];
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zogular-finance-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${activeTab === "payouts" ? "Payout" : "Ledger"} CSV exported.`);
  };

  const handleBatchApproveVisible = async () => {
    if (!canApprovePayouts) return toast.error("Unauthorized action.");
    const pendingPayouts = filteredPayouts.filter((payout) => payout.status === "pending");
    if (pendingPayouts.length === 0) return toast.error("No visible pending payouts to approve.");

    try {
      setIsProcessing(true);
      await Promise.all(pendingPayouts.map((payout) => adminFinanceApi.updatePayoutStatus(payout.id, "completed", "Batch release")));
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "payout_batch_completed",
        target: `${pendingPayouts.length} visible payouts`,
        severity: "critical",
      });
      setPayouts((current) => current.map((payout) => pendingPayouts.some((pending) => pending.id === payout.id) ? { ...payout, status: "completed" } : payout));
      toast.success(`${pendingPayouts.length} visible payouts released.`);
    } catch {
      toast.error("Failed to batch approve payouts.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReviewRefund = async (entry: LedgerEntry) => {
    if (!canManageRefunds) return toast.error("You do not have permission to manage refunds.");
    await recordAdminAudit({
      actorId: CURRENT_ADMIN_IDENTITY.id,
      action: "refund_queue_reviewed",
      target: entry.id,
      severity: "warning",
      note: entry.orderId ?? "Manual refund debit",
    });
    setReviewedRefunds((current) => current.includes(entry.id) ? current : [entry.id, ...current]);
    toast.success("Refund queue item marked reviewed.");
  };

  if (loading || !metrics) return (
    <div className="animate-pulse space-y-6">
      <div className="flex justify-between"><div className="h-10 w-64 rounded-xl bg-zinc-200" /><div className="h-10 w-32 rounded-xl bg-zinc-200" /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4"><div className="h-32 rounded-3xl bg-zinc-200" /><div className="h-32 rounded-3xl bg-zinc-200" /><div className="h-32 rounded-3xl bg-zinc-200" /><div className="h-32 rounded-3xl bg-zinc-200" /></div>
      <div className="h-125 rounded-3xl bg-zinc-200" />
    </div>
  );

  return (
    <div className="mx-auto max-w-400 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-12">
      
      {/* 1. HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Finance & Treasury</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage escrow holdings, seller payouts, and platform revenue.</p>
        </div>
        {canExport && (
          <Button onClick={handleExport} variant="outline" className="h-10 rounded-xl border-emerald-200/70 bg-white/80 px-4 font-bold text-emerald-800 shadow-md shadow-emerald-900/5 backdrop-blur-xl hover:bg-emerald-50 md:w-auto">
            <Download className="mr-2 h-4 w-4" /> Export Ledger
          </Button>
        )}
        {canApprovePayouts && (
          <Button onClick={handleBatchApproveVisible} className="h-10 rounded-xl bg-zinc-950 px-4 font-bold text-white shadow-md shadow-zinc-900/20 hover:bg-zinc-800 md:w-auto">
            Batch Release Visible
          </Button>
        )}
      </div>

      {/* 2. PREMIUM KPI BENTO GRID */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-600 to-emerald-900 p-6 shadow-md shadow-emerald-900/20 border border-emerald-400/30 transition-all hover:-translate-y-0.5 hover:shadow-lg">
          <div className="absolute -right-4 -top-4 opacity-20"><TrendingUp className="h-24 w-24 text-white" /></div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Net Platform Revenue</p>
          <h3 className="mt-2 text-3xl font-black text-white">{formatCurrency(metrics.netRevenue)}</h3>
          <p className="mt-1 text-xs font-medium text-emerald-200">Zogular earned commission</p>
        </div>
        
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-zinc-950 to-zinc-800 p-6 shadow-md shadow-zinc-900/20 transition-all hover:-translate-y-0.5 hover:shadow-lg">
           <div className="absolute -right-4 -top-4 opacity-10"><Lock className="h-24 w-24 text-white" /></div>
           <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Escrow Holdings</p>
           <h3 className="mt-2 text-3xl font-black text-white">{formatCurrency(metrics.totalEscrow)}</h3>
           <p className="mt-1 text-xs font-medium text-zinc-400">Buyer funds securing orders</p>
        </div>

        <div className="rounded-3xl border border-amber-200/70 bg-linear-to-br from-white via-amber-50/70 to-orange-100/60 p-6 shadow-md shadow-amber-900/10 transition-all hover:-translate-y-0.5 hover:shadow-lg">
           <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Pending Payouts</p><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-900/20"><Banknote className="h-4 w-4" /></div></div>
           <h3 className="text-2xl font-black text-zinc-900">{formatCurrency(metrics.pendingPayouts)}</h3>
           <p className="mt-1 text-xs font-medium text-zinc-500">Awaiting treasury approval</p>
        </div>

        <div className="rounded-3xl border border-indigo-200/70 bg-linear-to-br from-white via-indigo-50/70 to-sky-100/60 p-6 shadow-md shadow-indigo-900/10 transition-all hover:-translate-y-0.5 hover:shadow-lg">
           <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">Available Liquidity</p><div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"><Wallet className="h-4 w-4" /></div></div>
           <h3 className="text-2xl font-black text-zinc-900">{formatCurrency(metrics.availableLiquidity)}</h3>
           <p className="mt-1 text-xs font-medium text-zinc-500">Operational buffer</p>
        </div>
      </div>

      {/* 3. FUNCTIONAL TABS & FILTERS */}
      <div className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/75 shadow-md shadow-zinc-900/5 backdrop-blur-xl overflow-hidden">
        
        {/* Tab Header */}
        <div className="flex border-b border-zinc-100 bg-zinc-100/80 px-4 pt-4 backdrop-blur-sm">
          <button 
            onClick={() => setActiveTab("payouts")}
            className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === "payouts" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700")}
          >
            Payout Queue
          </button>
          <button
            onClick={() => setActiveTab("ledger")}
            className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === "ledger" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700")}
          >
            Master Ledger
          </button>
          <button
            onClick={() => setActiveTab("refunds")}
            className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === "refunds" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700")}
          >
            Refund Queue
          </button>
          <button
            onClick={() => setActiveTab("reconciliation")}
            className={cn("px-6 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === "reconciliation" ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-700")}
          >
            Reconciliation
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder={`Search ${activeTab === 'payouts' ? 'Stores or Payout IDs' : 'Transactions'}...`} 
              className="h-10 w-full rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium focus-visible:ring-zinc-900 shadow-inner" 
            />
          </div>
          {activeTab === "ledger" && (
            <select value={ledgerTypeFilter} onChange={(event) => setLedgerTypeFilter(event.target.value as TransactionType | "all")} className="mt-3 h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold text-zinc-700 shadow-inner">
              <option value="all">All ledger types</option>
              <option value="escrow_deposit">Escrow deposits</option>
              <option value="commission_fee">Commission fees</option>
              <option value="payout_release">Payout releases</option>
              <option value="refund_debit">Refund debits</option>
            </select>
          )}
        </div>

        {/* 4. TABBED DATA VIEWS */}
        <div className="overflow-x-auto hide-scrollbar">
          
          {/* Payouts View */}
          {activeTab === "payouts" && (
            <table className="w-full text-left text-sm min-w-250">
              <thead className="bg-white">
                <tr>
                  <th className="rounded-tl-2xl p-4 pl-6 text-[10px] font-black uppercase tracking-wider text-zinc-500">Request ID & Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Seller Entity</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Destination</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Amount</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Status</th>
                  <th className="rounded-tr-2xl p-4 pr-6 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredPayouts.length === 0 ? (
                  <tr><td colSpan={6} className="p-12 text-center"><p className="text-sm font-bold text-zinc-500">No payout requests found.</p></td></tr>
                ) : (
                  filteredPayouts.map((payout) => {
                    const statUI = PAYOUT_STATUS_UI[payout.status];
                    const StatIcon = statUI.icon;

                    return (
                      <tr key={payout.id} className="group transition-colors hover:bg-emerald-50/35">
                        <td className="p-4 pl-6">
                          <p className="font-black text-zinc-900">{payout.id}</p>
                          <p className="text-[10px] font-bold text-zinc-500 mt-0.5">{formatDate(payout.requestedAt)}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-zinc-900">{payout.storeName}</p>
                          <p className="text-[10px] font-bold text-zinc-400 mt-0.5">{payout.sellerId}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-bold text-zinc-900">{payout.method}</p>
                          <p className="text-[10px] font-medium text-zinc-500 tracking-wider mt-0.5">{payout.accountDetails}</p>
                        </td>
                        <td className="p-4 font-black text-zinc-900">{formatCurrency(payout.amount)}</td>
                        <td className="p-4">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", statUI.bg, statUI.text, statUI.border)}>
                            <StatIcon className="h-3 w-3" /> {statUI.label}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <Button onClick={() => setSelectedPayout(payout)} variant="outline" size="sm" className="h-9 rounded-xl border-zinc-200 font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-900 hover:text-white">
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* Ledger View */}
          {activeTab === "ledger" && (
            <table className="w-full text-left text-sm min-w-250">
              <thead className="bg-white">
                <tr>
                  <th className="rounded-tl-2xl p-4 pl-6 text-[10px] font-black uppercase tracking-wider text-zinc-500">TXN & Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Description</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Type</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Amount</th>
                  <th className="rounded-tr-2xl p-4 pr-6 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredLedger.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center"><p className="text-sm font-bold text-zinc-500">No ledger entries found.</p></td></tr>
                ) : (
                  filteredLedger.map((entry) => {
                    const typeUI = TXN_TYPE_UI[entry.type];

                    return (
                      <tr key={entry.id} className="transition-colors hover:bg-indigo-50/35">
                        <td className="p-4 pl-6">
                          <p className="font-bold text-zinc-900">{entry.id}</p>
                          <p className="text-[10px] font-bold text-zinc-500 mt-0.5">{formatDate(entry.timestamp)}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-bold text-zinc-900">{entry.description}</p>
                          {entry.orderId && <p className="text-[10px] font-medium text-indigo-600 mt-0.5">Ref: {entry.orderId}</p>}
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md">{typeUI.label}</span>
                        </td>
                        <td className={cn("p-4 text-right font-black", typeUI.color)}>
                          {typeUI.sign}{formatCurrency(Math.abs(entry.amount))}
                        </td>
                        <td className="p-4 pr-6 text-right font-bold text-zinc-600">
                          {formatCurrency(entry.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === "refunds" && (
            <table className="w-full text-left text-sm min-w-250">
              <thead className="bg-white">
                <tr>
                  <th className="rounded-tl-2xl p-4 pl-6 text-[10px] font-black uppercase tracking-wider text-zinc-500">Refund</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Order</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Reason</th>
                  <th className="p-4 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Amount</th>
                  <th className="rounded-tr-2xl p-4 pr-6 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {refundQueue.length === 0 ? (
                  <tr><td colSpan={5} className="p-12 text-center"><p className="text-sm font-bold text-zinc-500">No refund queue entries found.</p></td></tr>
                ) : refundQueue.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-rose-50/35">
                    <td className="p-4 pl-6"><p className="font-black text-zinc-900">{entry.id}</p><p className="text-[10px] font-bold text-zinc-500">{formatDate(entry.timestamp)}</p></td>
                    <td className="p-4 text-xs font-bold text-indigo-600">{entry.orderId ?? "Manual refund"}</td>
                    <td className="p-4 text-xs font-bold text-zinc-700">{entry.description}</td>
                    <td className="p-4 text-right font-black text-rose-600">{formatCurrency(Math.abs(entry.amount))}</td>
                    <td className="p-4 pr-6 text-right">
                      <Button disabled={!canManageRefunds || reviewedRefunds.includes(entry.id)} onClick={() => handleReviewRefund(entry)} variant="outline" size="sm" className="h-9 rounded-xl font-bold">
                        {reviewedRefunds.includes(entry.id) ? "Reviewed" : "Review"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "reconciliation" && (
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-[10px] font-black uppercase text-emerald-700">Ledger balance</p>
                <p className="mt-2 text-2xl font-black text-zinc-950">{formatCurrency(ledger[0]?.balanceAfter ?? 0)}</p>
              </div>
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-[10px] font-black uppercase text-amber-700">Pending payouts</p>
                <p className="mt-2 text-2xl font-black text-zinc-950">{formatCurrency(metrics.pendingPayouts)}</p>
              </div>
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5">
                <p className="text-[10px] font-black uppercase text-indigo-700">Processing fees</p>
                <p className="mt-2 text-2xl font-black text-zinc-950">Backend-ready</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. SLIDE-OVER MODAL (PAYOUT REVIEW) */}
      {selectedPayout && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedPayout(null)} aria-hidden="true" />
          
          <div className="relative h-full w-full max-w-md border-l border-white/40 bg-white/90 shadow-2xl shadow-zinc-950/30 backdrop-blur-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5 bg-zinc-950 text-white">
              <div>
                <h2 className="text-lg font-black text-white">Review Payout</h2>
                <p className="text-xs font-bold text-zinc-400">{selectedPayout.id}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedPayout(null)} aria-label="Close payout review" className="h-8 w-8 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Target Details */}
              <div className="rounded-3xl border border-white/70 p-5 shadow-md shadow-zinc-900/5 bg-white/75">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-4">Destination Target</p>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-zinc-500">Seller Entity</p>
                    <p className="font-black text-zinc-900">{selectedPayout.storeName}</p>
                  </div>
                  <div className="h-px w-full bg-zinc-200/60" />
                  <div>
                    <p className="text-xs font-medium text-zinc-500">Method</p>
                    <p className="font-black text-zinc-900">{selectedPayout.method}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500">Account Details</p>
                    <p className="font-mono font-bold text-indigo-600 text-lg">{selectedPayout.accountDetails}</p>
                  </div>
                </div>
              </div>

              {/* Amount Details */}
              <div className="rounded-3xl border border-emerald-200/70 p-5 shadow-md shadow-emerald-900/5 bg-linear-to-br from-white to-emerald-50">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Requested Amount</p>
                <p className="text-4xl font-black text-zinc-900">{formatCurrency(selectedPayout.amount)}</p>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-blue-50 p-3 border border-blue-100">
                  <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0" />
                  <p className="text-[10px] font-bold text-blue-800 leading-tight">Escrow cleared. Platform commissions have already been deducted from this balance.</p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/70 p-5 shadow-md shadow-zinc-900/5 bg-white/75">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-3">Payout notes / history</p>
                <Textarea value={payoutNote} onChange={(event) => setPayoutNote(event.target.value)} placeholder="Add payout approval, rejection, or reconciliation note..." className="min-h-24 rounded-2xl border-zinc-200 bg-white" />
                <div className="mt-3 space-y-2">
                  {(payoutNotes[selectedPayout.id] ?? ["No payout notes recorded in this frontend session."]).map((note, index) => (
                    <p key={`${selectedPayout.id}-note-${index}`} className="rounded-2xl bg-zinc-50 p-3 text-sm font-bold text-zinc-600">{note}</p>
                  ))}
                </div>
              </div>

              {/* RBAC Payout Actions */}
              {selectedPayout.status === "pending" && (
                <div className="pt-4 border-t border-zinc-100 space-y-3">
                  {!canApprovePayouts ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 p-4 border border-zinc-200">
                      <Lock className="h-4 w-4 text-zinc-400" />
                      <p className="text-xs font-bold text-zinc-500">Your role does not have authorization to release funds.</p>
                    </div>
                  ) : (
                    <>
                      <Button onClick={() => handleProcessPayout("completed")} disabled={isProcessing} className="w-full h-12 rounded-xl bg-emerald-600 text-sm font-black text-white hover:bg-emerald-700 shadow-md">
                        {isProcessing ? "Processing..." : "Approve & Release Funds"}
                      </Button>
                      <Button onClick={() => handleProcessPayout("rejected")} disabled={isProcessing} variant="outline" className="w-full h-12 rounded-xl border-rose-200 text-sm font-bold text-rose-700 hover:bg-rose-50">
                        Reject Request
                      </Button>
                    </>
                  )}
                </div>
              )}

              {selectedPayout.status !== "pending" && (
                <div className="pt-4 border-t border-zinc-100 text-center">
                  <p className="text-xs font-bold text-zinc-500">This payout has been processed.</p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
