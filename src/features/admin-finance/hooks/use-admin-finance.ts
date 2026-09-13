/**
 * @file use-admin-finance.ts
 * @module features/admin-finance/hooks
 * @description
 * Primary state management hook for the Admin Finance, Treasury & MoMo Settlement Control Center.
 * Handles view tabs (Overview, Payouts, Ledger), payout queue filtering, debounced search,
 * pagination, selected payout detail inspection, status update mutations, and scroll restoration.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import {
  fetchLedgerTransactions,
  fetchPayoutRequests,
  fetchTreasurySummary,
  updatePayoutStatus,
} from "../api/admin-finance";
import type {
  AdminLedgerRecord,
  AdminPayoutRecord,
  FinanceTabKey,
  PayoutQueueTabKey,
  PayoutStatus,
  TreasuryMetrics,
} from "../types";
import { PAYOUT_QUEUE_TABS } from "../types";

const PAGE_SIZE = 12;

const INITIAL_METRICS: TreasuryMetrics = {
  totalEscrowHeld: 0,
  netCommissionEarned: 0,
  pendingDisbursements: 0,
  collectedCodTotal: 0,
  activeSellersCount: 0,
};

export function useAdminFinance() {
  // Navigation & View Tabs
  const [activeTab, setActiveTab] = useState<FinanceTabKey>("overview");
  const [queueTab, setQueueTab] = useState<PayoutQueueTabKey>("all");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Data Collections
  const [metrics, setMetrics] = useState<TreasuryMetrics>(INITIAL_METRICS);
  const [payouts, setPayouts] = useState<AdminPayoutRecord[]>([]);
  const [ledgerTransactions, setLedgerTransactions] = useState<AdminLedgerRecord[]>([]);

  // Paginations
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutsPagination, setPayoutsPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    pages: 1,
  });

  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPagination, setLedgerPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    pages: 1,
  });

  // Selected Item for Inspection Sheet
  const [selectedPayoutId, setSelectedPayoutId] = useState<string | null>(null);

  // Loading & Error States
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  // Return scroll restoration
  const isInitialLoadFinished = !loadingMetrics && (!loadingPayouts || activeTab === "overview");
  useListScrollRestoration("/admin/finance", isInitialLoadFinished);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPayoutsPage(1);
      setLedgerPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Derive statusFilter from queueTab
  const currentStatusFilter = useMemo(() => {
    const tabDef = PAYOUT_QUEUE_TABS.find((t) => t.key === queueTab);
    return tabDef?.statusFilter;
  }, [queueTab]);

  // Load Treasury Summary
  const loadTreasurySummary = useCallback(async () => {
    try {
      setLoadingMetrics(true);
      const data = await fetchTreasurySummary();
      setMetrics(data);
    } catch {
      // Set initial metrics if backend is unavailable or not yet populated
      setMetrics(INITIAL_METRICS);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // Load Payout Requests
  const loadPayouts = useCallback(async () => {
    try {
      setLoadingPayouts(true);
      setRequestError(null);
      const res = await fetchPayoutRequests({
        page: payoutsPage,
        limit: PAGE_SIZE,
        status: currentStatusFilter,
        search: debouncedSearch,
      });
      setPayouts(res.payouts);
      setPayoutsPagination(res.pagination);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load payout queue";
      setRequestError(message);
      setPayouts([]);
    } finally {
      setLoadingPayouts(false);
    }
  }, [payoutsPage, currentStatusFilter, debouncedSearch]);

  // Load Ledger Transactions
  const loadLedger = useCallback(async () => {
    try {
      setLoadingLedger(true);
      const res = await fetchLedgerTransactions({
        page: ledgerPage,
        limit: PAGE_SIZE,
        search: debouncedSearch,
      });
      setLedgerTransactions(res.transactions);
      setLedgerPagination(res.pagination);
    } catch {
      setLedgerTransactions([]);
    } finally {
      setLoadingLedger(false);
    }
  }, [ledgerPage, debouncedSearch]);

  // Initial and reactive effects
  useEffect(() => {
    loadTreasurySummary();
  }, [loadTreasurySummary]);

  useEffect(() => {
    if (activeTab === "overview" || activeTab === "payouts") {
      loadPayouts();
    }
  }, [activeTab, loadPayouts]);

  useEffect(() => {
    if (activeTab === "ledger" || activeTab === "overview") {
      loadLedger();
    }
  }, [activeTab, loadLedger]);

  // Selected payout record derived
  const selectedPayout = useMemo(() => {
    if (!selectedPayoutId) return null;
    return payouts.find((p) => p.id === selectedPayoutId) ?? null;
  }, [selectedPayoutId, payouts]);

  // Queue tab counts computation
  const tabCounts = useMemo(() => {
    const counts: Record<PayoutQueueTabKey, number | null> = {
      all: payoutsPagination.total || payouts.length,
      needs_action: payouts.filter((p) => p.status === "PENDING").length,
      processing: payouts.filter((p) => p.status === "PROCESSING").length,
      completed: payouts.filter((p) => p.status === "COMPLETED").length,
      exceptions: payouts.filter((p) => p.status === "REJECTED").length,
    };
    return counts;
  }, [payouts, payoutsPagination.total]);

  // Handlers
  const handleTabChange = useCallback((tab: FinanceTabKey) => {
    setActiveTab(tab);
    setSearch("");
  }, []);

  const handleQueueTabChange = useCallback((tab: PayoutQueueTabKey) => {
    setQueueTab(tab);
    setPayoutsPage(1);
  }, []);

  const handleRefresh = useCallback(async () => {
    await Promise.allSettled([
      loadTreasurySummary(),
      loadPayouts(),
      loadLedger(),
    ]);
    toast.success("Finance telemetry refreshed");
  }, [loadTreasurySummary, loadPayouts, loadLedger]);

  const handleUpdatePayoutStatus = useCallback(
    async (
      payoutId: string,
      payload: { status: PayoutStatus; reference?: string; notes: string }
    ) => {
      try {
        setIsMutating(true);
        await updatePayoutStatus(payoutId, payload);
        toast.success(
          `Payout marked as ${payload.status.toLowerCase()}${
            payload.reference ? ` (Ref: ${payload.reference})` : ""
          }`
        );
        // Refresh collections
        await Promise.allSettled([loadPayouts(), loadTreasurySummary(), loadLedger()]);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to update payout status";
        toast.error(message);
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [loadPayouts, loadTreasurySummary, loadLedger]
  );

  return {
    // Navigation / Tabs
    activeTab,
    handleTabChange,
    queueTab,
    handleQueueTabChange,
    tabCounts,

    // Search
    search,
    setSearch,

    // Metrics
    metrics,
    loadingMetrics,

    // Payouts
    payouts,
    payoutsPagination,
    payoutsPage,
    setPayoutsPage,
    loadingPayouts,
    selectedPayoutId,
    selectedPayout,
    setSelectedPayoutId,

    // Ledger
    ledgerTransactions,
    ledgerPagination,
    ledgerPage,
    setLedgerPage,
    loadingLedger,

    // Shared Status
    loading: loadingMetrics && loadingPayouts,
    requestError,
    isMutating,

    // Actions
    handleRefresh,
    handleUpdatePayoutStatus,
  };
}
