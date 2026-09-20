/**
 * @file AdminDisputesWorkspace.tsx
 * @module features/admin-disputes/components
 * @description
 * Primary master workspace coordinator for F10 Returns, Claims & Disputes Control Center.
 * Combines page header telemetry, metric indicators, lifecycle queue tabs, search & filter toolbar,
 * responsive desktop table / mobile cards, pagination controls, and detail inspection drawer.
 */

"use client";

import React from "react";
import {
  AlertOctagon,
  AlertTriangle,
  RotateCw,
  Scale,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSearchField,
  AdminToolbar,
} from "@/components/admin/AdminPrimitives";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { Button } from "@/components/ui/button";
import { formatAdminCurrency } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminDisputes } from "../hooks/use-admin-disputes";
import type {
  DisputeCategory,
  DisputeSeverity,
  DisputeStatus,
} from "../types";
import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_SEVERITY_METADATA,
  DISPUTE_STATUS_METADATA,
} from "../types";
import { DisputeDetailSheet } from "./DisputeDetailSheet";
import { DisputeQueueTabs } from "./DisputeQueueTabs";
import { DisputesMobileCards } from "./DisputesMobileCards";
import { DisputesTable } from "./DisputesTable";

export function AdminDisputesWorkspace() {
  const identity = useAdminIdentity();
  const canAccessDisputes = identity
    ? adminIdentityHasPermission(identity, "manage_support_tickets") ||
      adminIdentityHasPermission(identity, "access_admin_panel")
    : false;

  const {
    disputes,
    pagination,
    loading,
    requestError,
    loadDisputes,
    activeTab,
    handleTabChange,
    tabCounts,
    metrics,
    categoryFilter,
    setCategoryFilter,
    severityFilter,
    setSeverityFilter,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    setPage,
    selectedDisputeId,
    setSelectedDisputeId,
    selectedDispute,
    detailLoading,
    isMutating,
    handleUpdateStatus,
    handleAddNote,
  } = useAdminDisputes({ enabled: canAccessDisputes });

  if (!canAccessDisputes) {
    return (
      <AdminEmptyState
        title="Access Restricted"
        description="Your administrator role lacks the necessary permissions to access the Returns, Claims & Disputes Control Center."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Context */}
      <AdminPageHeader
        title="Returns, Claims & Dispute Operations"
        description="Arbitrate contested orders, inspect buyer proof vs merchant rebuttals, enforce Lusaka delivery return policies, and record authorized escrow decisions."
      />

      {/* 2. Tactical Advisory Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_32%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] px-4 py-3 text-xs font-medium text-amber-950 shadow-sm">
        <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--admin-ember,#d96a1f)]" />
        <span>
          <strong>Strict Escrow Integrity:</strong> Releasing held funds or issuing refunds updates the transaction status immediately. All status transitions mandate a recorded justification of at least 10 characters for audit compliance.
        </span>
      </div>

      {/* 3. Metric Indicator Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminMetricCard
          title="Active Disputes"
          value={metrics.totalOpen}
          note="Unresolved cases in registry"
          icon={<Scale className="h-5 w-5" />}
          tone="zinc"
        />
        <AdminMetricCard
          title="Needs Urgent Action"
          value={tabCounts.needs_action}
          note="Awaiting triage or assignment"
          icon={<AlertOctagon className="h-5 w-5" />}
          tone="amber"
        />
        <AdminMetricCard
          title="Escalated Cases"
          value={tabCounts.escalated}
          note="Senior leadership escalation"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="rose"
        />
        <AdminMetricCard
          title="Value Under Dispute"
          value={formatAdminCurrency(metrics.totalClaimValue)}
          note="Contested buyer/seller escrow"
          icon={<Wallet className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      {/* 4. Queue Lifecycle Tabs */}
      <DisputeQueueTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={tabCounts}
      />

      {/* 5. Search & Filters Toolbar */}
      <AdminToolbar>
        <AdminSearchField
          value={search}
          onChange={(val) => setSearch(val)}
          placeholder="Search by case title, buyer, merchant, or order ID..."
          className="flex-1"
        />

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            aria-label="Filter by dispute category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as DisputeCategory | "all");
              setPage(1);
            }}
            className="h-11 rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white px-3 text-xs font-bold text-[var(--admin-ink,#171a16)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy,#075b36)]"
          >
            <option value="all">All Categories</option>
            {Object.entries(DISPUTE_CATEGORY_LABELS).map(([catKey, label]) => (
              <option key={catKey} value={catKey}>
                {label}
              </option>
            ))}
          </select>

          {/* Severity Filter */}
          <select
            aria-label="Filter by dispute severity"
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value as DisputeSeverity | "all");
              setPage(1);
            }}
            className="h-11 rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white px-3 text-xs font-bold text-[var(--admin-ink,#171a16)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy,#075b36)]"
          >
            <option value="all">All Severities</option>
            {Object.entries(DISPUTE_SEVERITY_METADATA).map(([sevKey, meta]) => (
              <option key={sevKey} value={sevKey}>
                {meta.label} Severity
              </option>
            ))}
          </select>

          {/* Specific Status Filter */}
          <select
            aria-label="Filter by dispute status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as DisputeStatus | "all");
              setPage(1);
            }}
            className="h-11 rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white px-3 text-xs font-bold text-[var(--admin-ink,#171a16)] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy,#075b36)]"
          >
            <option value="all">All Statuses in Tab</option>
            {Object.entries(DISPUTE_STATUS_METADATA).map(([statusKey, meta]) => (
              <option key={statusKey} value={statusKey}>
                {meta.label}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void loadDisputes()}
            disabled={loading}
            aria-label="Refresh disputes queue"
            title="Refresh queue"
            className="h-11 w-11 shrink-0 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white shadow-sm hover:bg-[var(--admin-surface-mist,#f6eedf)]"
          >
            <RotateCw
              className={cn(
                "h-4 w-4 text-[var(--admin-canopy-deep,#063b29)]",
                loading && "animate-spin"
              )}
            />
          </Button>
        </div>
      </AdminToolbar>

      {/* 6. Desktop Table Presentation */}
      <DisputesTable
        disputes={disputes}
        loading={loading}
        requestError={requestError}
        onRetry={loadDisputes}
        selectedDisputeId={selectedDisputeId}
        onSelectDispute={(id) => setSelectedDisputeId(id)}
      />

      {/* 7. Mobile Cards Presentation */}
      <DisputesMobileCards
        disputes={disputes}
        loading={loading}
        requestError={requestError}
        onRetry={loadDisputes}
        selectedDisputeId={selectedDisputeId}
        onSelectDispute={(id) => setSelectedDisputeId(id)}
      />

      {/* 8. Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] px-4 py-3 shadow-sm">
          <span className="text-xs font-bold text-[var(--admin-ink-soft,#5f625a)]">
            Page {pagination.page} of {pagination.pages}
            <span className="ml-1 text-zinc-400">· {pagination.total} total cases</span>
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage((curr) => Math.max(1, curr - 1))}
              className="h-8 rounded-lg border-zinc-200 bg-white text-xs font-black text-[var(--admin-ink,#171a16)] hover:bg-[var(--admin-surface-mist,#f6eedf)]"
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages || loading}
              onClick={() => setPage((curr) => Math.min(pagination.pages, curr + 1))}
              className="h-8 rounded-lg border-zinc-200 bg-white text-xs font-black text-[var(--admin-ink,#171a16)] hover:bg-[var(--admin-surface-mist,#f6eedf)]"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* 9. Slide-out Detail & Arbitration Drawer */}
      <DisputeDetailSheet
        dispute={selectedDispute}
        open={Boolean(selectedDisputeId)}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedDisputeId(null);
          }
        }}
        loading={detailLoading}
        isMutating={isMutating}
        onUpdateStatus={handleUpdateStatus}
        onAddNote={handleAddNote}
      />
    </div>
  );
}
