/**
 * @file AdminSupportWorkspace.tsx
 * @module features/admin-support/components
 * @description
 * Primary workspace coordinator for the Support Operations Center (F8).
 * Combines page telemetry, operational metrics, lifecycle queue tabs, search/filter toolbar,
 * high-density desktop table, responsive mobile cards, and inspection detail drawer.
 */

"use client";

import React from "react";
import {
  AlertCircle,
  Clock,
  MessageSquare,
  RotateCcw,
  RotateCw,
  ShieldAlert,
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
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminSupport } from "../hooks/use-admin-support";
import { SupportQueueTabs } from "./SupportQueueTabs";
import { SupportTicketTable } from "./SupportTicketTable";
import { SupportTicketMobileCards } from "./SupportTicketMobileCards";
import { SupportTicketDetailSheet } from "./SupportTicketDetailSheet";
import type {
  AdminTicketCategory,
  AdminTicketPriority,
  AdminTicketStatus,
} from "../types";

export function AdminSupportWorkspace() {
  const identity = useAdminIdentity();
  const canViewSupport = identity
    ? adminIdentityHasPermission(identity, "view_support_tickets")
    : false;
  const canReplySupport = identity
    ? adminIdentityHasPermission(identity, "reply_support_tickets")
    : false;
  const canManageSupport = identity
    ? adminIdentityHasPermission(identity, "manage_support_tickets")
    : false;

  const {
    filteredTickets,
    pagination,
    loading,
    requestError,
    activeTab,
    handleTabChange,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    priorityFilter,
    setPriorityFilter,
    search,
    setSearch,
    page,
    setPage,
    tabCounts,
    summaryMetrics,
    selectedTicketId,
    selectedTicket,
    detailLoading,
    openTicket,
    closeTicketDetail,
    handleReply,
    handleUpdateStatus,
    isMutating,
    reloadTickets,
  } = useAdminSupport({ enabled: canViewSupport });

  if (!canViewSupport) {
    return (
      <AdminEmptyState
        title="Access denied"
        description="Your admin role lacks the view_support_tickets permission required to access the Support Operations Center."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Telemetry */}
      <AdminPageHeader
        title="Support Operations Center"
        description="Seller dispute mediation, rapid merchant inquiry triage, and SLA enforcement across the Zambia marketplace network."
      />

      {/* 2. Tactical Advisory Banner */}
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-xs font-medium text-amber-950 shadow-sm">
        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-black text-amber-900">
            SLA Service Level Target:
          </span>
          <span className="text-amber-800">
            Urgent payout and delivery disputes require first response within 2 hours. High tickets 6h. Standard tickets 24h.
          </span>
        </div>
      </div>

      {/* 3. Operational Metric Indicators */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminMetricCard
          title="Total Ticket Volume"
          value={summaryMetrics.total}
          note="Active & archived registry"
          icon={<MessageSquare className="h-5 w-5" />}
          tone="zinc"
        />
        <AdminMetricCard
          title="Needs Action"
          value={summaryMetrics.needsAction}
          note="Open & escalated tickets"
          icon={<AlertCircle className="h-5 w-5" />}
          tone="amber"
        />
        <AdminMetricCard
          title="Waiting on Seller"
          value={summaryMetrics.waitingSeller}
          note="Awaiting merchant docs"
          icon={<RotateCcw className="h-5 w-5" />}
          tone="indigo"
        />
        <AdminMetricCard
          title="SLA Attention"
          value={summaryMetrics.urgentOverdue}
          note={
            summaryMetrics.urgentOverdue > 0
              ? `${summaryMetrics.urgentOverdue} tickets overdue`
              : "All tickets within SLA"
          }
          icon={<Clock className="h-5 w-5" />}
          tone={summaryMetrics.urgentOverdue > 0 ? "rose" : "emerald"}
        />
      </div>

      {/* 4. Queue Lifecycle Navigation Tabs */}
      <SupportQueueTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        tabCounts={tabCounts}
      />

      {/* 5. Search & Filters Toolbar */}
      <AdminToolbar>
        <AdminSearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by ticket subject, merchant store, or seller email..."
          className="flex-1"
        />

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value as AdminTicketCategory | "all");
            setPage(1);
          }}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 shadow-xs focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
        >
          <option value="all">All Categories</option>
          <option value="order">Order & Dispatch</option>
          <option value="payout">Payouts & MoMo</option>
          <option value="inventory">Inventory & Catalog</option>
          <option value="tech">Technical & Bug</option>
          <option value="account">Account & KYC</option>
          <option value="general">General Inquiries</option>
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value as AdminTicketPriority | "all");
            setPage(1);
          }}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 shadow-xs focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent (2h SLA)</option>
          <option value="high">High (6h SLA)</option>
          <option value="medium">Medium (24h SLA)</option>
          <option value="low">Low (48h SLA)</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as AdminTicketStatus | "all");
            setPage(1);
          }}
          className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 shadow-xs focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="waiting-support">Waiting on Support</option>
          <option value="waiting-seller">Waiting on Seller</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        {/* Reload Button */}
        <Button
          type="button"
          variant="outline"
          onClick={() => void reloadTickets()}
          disabled={loading}
          className="h-11 gap-1.5 rounded-xl border-zinc-200 bg-white px-3 text-xs font-black text-zinc-700 hover:bg-zinc-50"
          title="Refresh ticket queue"
        >
          <RotateCw
            className={`h-4 w-4 text-zinc-500 ${loading ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </AdminToolbar>

      {/* 6. Error Notice */}
      {requestError && !loading && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 text-center">
          <AdminEmptyState
            title="Support Queue Unavailable"
            description={requestError}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void reloadTickets()}
            className="mt-3 rounded-xl font-bold"
          >
            Retry Queue Load
          </Button>
        </div>
      )}

      {/* 7. Tickets Presentation (Desktop Table + Mobile Cards) */}
      {!requestError && (
        <>
          <SupportTicketTable
            tickets={filteredTickets}
            loading={loading}
            onInspect={openTicket}
          />

          <SupportTicketMobileCards
            tickets={filteredTickets}
            loading={loading}
            onInspect={openTicket}
          />

          {/* 8. Tactile Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] px-4 py-3 shadow-xs">
              <span className="text-xs font-bold text-zinc-500">
                Page {pagination.page} of {pagination.pages}
                <span className="text-zinc-400">
                  {" "}
                  · {pagination.total} tickets in inbox
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl font-bold text-xs"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-xl font-bold text-xs"
                  disabled={pagination.page >= pagination.pages || loading}
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 9. Ticket Detail Inspection Drawer */}
      <SupportTicketDetailSheet
        ticket={selectedTicket}
        open={Boolean(selectedTicketId)}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeTicketDetail();
        }}
        onReply={handleReply}
        onUpdateStatus={handleUpdateStatus}
        isMutating={isMutating}
        detailLoading={detailLoading}
        canReplySupport={canReplySupport}
        canManageSupport={canManageSupport}
      />
    </div>
  );
}
