/**
 * @file AdminFinanceWorkspace.tsx
 * @module features/admin-finance/components
 * @description
 * Master workspace coordinator for F10 Finance, Treasury & MoMo Settlement Control Center.
 * Integrates:
 * - Header telemetry & "Refresh Telemetry" trigger
 * - Treasury metric strip (Total Escrow, Net Platform Revenue, Pending Disbursements, COD Cash Settled)
 * - View mode switcher tabs (Overview / Payouts / Ledger)
 * - Search & filter toolbar
 * - Payout queue tabs with live counts
 * - Desktop & mobile payout settlement presentations
 * - Auditable ledger view
 * - Slide-out payout inspection and disbursement sheet
 */

"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  RotateCw,
  Wallet,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminSearchField,
  AdminToolbar,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { cn } from "@/lib/utils";
import { useAdminFinance } from "../hooks/use-admin-finance";
import type { FinanceTabKey } from "../types";
import { FinanceTreasuryCards } from "./FinanceTreasuryCards";
import { PayoutQueueTabs } from "./PayoutQueueTabs";
import { PayoutsTable } from "./PayoutsTable";
import { PayoutsMobileCards } from "./PayoutsMobileCards";
import { PayoutDetailSheet } from "./PayoutDetailSheet";
import { LedgerTransactionsTable } from "./LedgerTransactionsTable";

const VIEW_TABS: { key: FinanceTabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Treasury Overview", icon: LayoutDashboard },
  { key: "payouts", label: "MoMo Disbursements", icon: Wallet },
  { key: "ledger", label: "Auditable Ledger", icon: FileSpreadsheet },
];

export function AdminFinanceWorkspace() {
  const identity = useAdminIdentity();
  const canProcessPayouts = identity
    ? adminIdentityHasPermission(identity, "process_payouts") ||
      identity.claims.role === "SUPER_ADMIN"
    : false;

  const {
    activeTab,
    handleTabChange,
    queueTab,
    handleQueueTabChange,
    tabCounts,
    search,
    setSearch,
    metrics,
    loadingMetrics,
    payouts,
    payoutsPagination,
    payoutsPage,
    setPayoutsPage,
    loadingPayouts,
    selectedPayoutId,
    selectedPayout,
    setSelectedPayoutId,
    ledgerTransactions,
    ledgerPagination,
    ledgerPage,
    setLedgerPage,
    loadingLedger,
    requestError,
    isMutating,
    handleRefresh,
    handleUpdatePayoutStatus,
  } = useAdminFinance();

  return (
    <div className="mx-auto max-w-7xl space-y-6 min-w-0 pb-16 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* 1. Page Header & Primary Actions */}
      <AdminPageHeader
        title="Finance, Treasury & MoMo Settlement"
        description="Monitor marketplace escrow lockups, platform category commissions, and authorize vendor mobile money disbursements."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-9 gap-1.5 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_30%,transparent)] bg-white/80 text-xs font-bold text-[var(--admin-canopy-deep,#063b29)] hover:bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_8%,transparent)] shadow-sm"
          >
            <RotateCw className={cn("h-3.5 w-3.5", loadingMetrics && "animate-spin")} />
            <span>Refresh Telemetry</span>
          </Button>
        }
      />

      {/* 2. Treasury KPI Cards */}
      <FinanceTreasuryCards metrics={metrics} loading={loadingMetrics} />

      {/* 3. View Mode Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_20%,transparent)] pb-3">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all",
                isActive
                  ? "bg-[var(--admin-canopy-deep,#063b29)] text-[var(--admin-surface-cream,#fff8ec)] shadow-sm"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Toolbar / Filters (Search & Queue Tabs) */}
      <div className="space-y-3">
        <AdminToolbar>
          <div className="flex-1 min-w-[240px]">
            <AdminSearchField
              value={search}
              onChange={setSearch}
              placeholder={
                activeTab === "ledger"
                  ? "Search ledger by order #, store, or ID..."
                  : "Search payouts by store name, phone, account..."
              }
            />
          </div>
        </AdminToolbar>

        {activeTab !== "ledger" && (
          <PayoutQueueTabs
            activeTab={queueTab}
            onTabChange={handleQueueTabChange}
            tabCounts={tabCounts}
          />
        )}
      </div>

      {/* 5. Main Content Area based on Tab */}
      {activeTab === "ledger" ? (
        <div className="space-y-4">
          <LedgerTransactionsTable
            transactions={ledgerTransactions}
            loading={loadingLedger}
          />

          {/* Ledger Pagination */}
          {ledgerPagination.pages > 1 && (
            <div className="flex items-center justify-between px-2 text-xs font-bold text-zinc-600">
              <span>
                Page {ledgerPagination.page} of {ledgerPagination.pages} ({ledgerPagination.total} transactions)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ledgerPage <= 1}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 rounded-lg text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ledgerPage >= ledgerPagination.pages}
                  onClick={() => setLedgerPage((p) => p + 1)}
                  className="h-8 gap-1 rounded-lg text-xs"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table Presentation */}
          <div className="hidden lg:block">
            <PayoutsTable
              payouts={payouts}
              loading={loadingPayouts}
              requestError={requestError}
              onRetry={handleRefresh}
              selectedPayoutId={selectedPayoutId}
              onSelectPayout={setSelectedPayoutId}
            />
          </div>

          {/* Mobile Cards Presentation */}
          <div className="block lg:hidden">
            <PayoutsMobileCards
              payouts={payouts}
              loading={loadingPayouts}
              requestError={requestError}
              onRetry={handleRefresh}
              selectedPayoutId={selectedPayoutId}
              onSelectPayout={setSelectedPayoutId}
            />
          </div>

          {/* Payouts Pagination */}
          {payoutsPagination.pages > 1 && (
            <div className="flex items-center justify-between px-2 text-xs font-bold text-zinc-600">
              <span>
                Page {payoutsPagination.page} of {payoutsPagination.pages} ({payoutsPagination.total} payouts)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={payoutsPage <= 1}
                  onClick={() => setPayoutsPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 rounded-lg text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={payoutsPage >= payoutsPagination.pages}
                  onClick={() => setPayoutsPage((p) => p + 1)}
                  className="h-8 gap-1 rounded-lg text-xs"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Inspection & Disbursement Slide-out Sheet */}
      <PayoutDetailSheet
        payout={selectedPayout}
        open={Boolean(selectedPayoutId)}
        onOpenChange={(open) => {
          if (!open) setSelectedPayoutId(null);
        }}
        canProcessPayouts={canProcessPayouts}
        onUpdateStatus={handleUpdatePayoutStatus}
        isMutating={isMutating}
      />
    </div>
  );
}
