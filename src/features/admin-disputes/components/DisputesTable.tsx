"use client";

/**
 * @file DisputesTable.tsx
 * @module features/admin-disputes/components
 * @description
 * Dense desktop table for the Returns, Claims & Disputes Control Center.
 * Displays dispute cases, severity chips, buyer/seller parties, linked orders,
 * claim amounts, SLA countdowns, and inspection triggers with smooth row states.
 */

import React from "react";
import {
  Clock,
  ExternalLink,
  Package,
  ShieldAlert,
  Store,
  User,
} from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { rememberListScroll } from "@/hooks/use-list-scroll-restoration";
import { formatAdminCurrency } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type { AdminDisputeRecord } from "../types";
import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_SEVERITY_METADATA,
  DISPUTE_STATUS_METADATA,
  getDisputeSlaMeta,
} from "../types";

interface DisputesTableProps {
  disputes: AdminDisputeRecord[];
  loading?: boolean;
  requestError?: string | null;
  onRetry?: () => void;
  selectedDisputeId: string | null;
  onSelectDispute: (disputeId: string) => void;
  className?: string;
}

export function DisputesTable({
  disputes,
  loading = false,
  requestError,
  onRetry,
  selectedDisputeId,
  onSelectDispute,
  className,
}: DisputesTableProps) {
  const handleSelect = (id: string) => {
    rememberListScroll("/admin/disputes");
    onSelectDispute(id);
  };

  return (
    <section
      aria-label="Disputes operational registry"
      className={cn(
        "hidden lg:block overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] shadow-[0_12px_32px_rgb(6_59_41_/_6%)]",
        className
      )}
    >
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[1140px] text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-canopy-deep,#063b29)] text-[10px] font-black uppercase tracking-wider text-[var(--admin-surface-cream,#fff8ec)]">
              <th scope="col" className="px-5 py-3.5">Case & Category</th>
              <th scope="col" className="px-5 py-3.5">Severity</th>
              <th scope="col" className="px-5 py-3.5">Parties (Buyer / Seller)</th>
              <th scope="col" className="px-5 py-3.5">Linked Order</th>
              <th scope="col" className="px-5 py-3.5">Claim Amount</th>
              <th scope="col" className="px-5 py-3.5">SLA Target</th>
              <th scope="col" className="px-5 py-3.5">Status</th>
              <th scope="col" className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_18%,transparent)]">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`dispute-skeleton-${index}`} className="animate-pulse">
                  <td colSpan={8} className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <div className="h-6 w-36 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_16%,transparent)]" />
                      <div className="h-6 w-20 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_12%,transparent)]" />
                      <div className="h-6 w-40 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_12%,transparent)]" />
                      <div className="h-6 w-24 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_12%,transparent)]" />
                      <div className="h-6 w-24 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_12%,transparent)]" />
                      <div className="ml-auto h-8 w-20 rounded-lg bg-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_16%,transparent)]" />
                    </div>
                  </td>
                </tr>
              ))
            ) : requestError ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-zinc-900">Dispute registry unavailable</p>
                      <p className="mt-1 text-xs text-zinc-500 font-medium">
                        {requestError}
                      </p>
                    </div>
                    {onRetry && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onRetry}
                        className="rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_38%,transparent)] bg-white font-black text-xs hover:bg-[var(--admin-surface-mist,#f6eedf)]"
                      >
                        Retry queue load
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ) : disputes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center">
                  <div className="mx-auto max-w-sm space-y-1">
                    <p className="text-sm font-black text-[var(--admin-ink,#171a16)]">
                      No disputes in this queue
                    </p>
                    <p className="text-xs font-medium text-[var(--admin-ink-soft,#5f625a)]">
                      There are no dispute records matching the selected queue tab or filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              disputes.map((dispute) => {
                const statusMeta = DISPUTE_STATUS_METADATA[dispute.status] ?? {
                  label: dispute.status,
                  tone: "zinc" as const,
                };
                const severityMeta = DISPUTE_SEVERITY_METADATA[dispute.severity] ?? {
                  label: dispute.severity,
                  tone: "zinc" as const,
                };
                const slaMeta = getDisputeSlaMeta(dispute.dueAt, dispute.status);
                const isSelected = dispute.id === selectedDisputeId;

                return (
                  <tr
                    key={dispute.id}
                    onClick={() => handleSelect(dispute.id)}
                    className={cn(
                      "cursor-pointer transition-colors duration-150",
                      isSelected
                        ? "bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_10%,transparent)] ring-1 ring-inset ring-[var(--admin-canopy,#075b36)]"
                        : "hover:bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_5%,transparent)]"
                    )}
                  >
                    {/* Case Title & Category */}
                    <td className="px-5 py-4 align-top">
                      <div className="font-bold text-xs text-[var(--admin-ink,#171a16)] max-w-xs truncate">
                        {dispute.title}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_30%,transparent)] bg-[var(--admin-surface-mist,#f6eedf)] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-ink-soft,#5f625a)]">
                          {DISPUTE_CATEGORY_LABELS[dispute.category] || dispute.category}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          #{dispute.id.slice(-6)}
                        </span>
                      </div>
                    </td>

                    {/* Severity Chip */}
                    <td className="px-5 py-4 align-top">
                      <AdminStatusBadge tone={severityMeta.tone}>
                        {severityMeta.label}
                      </AdminStatusBadge>
                    </td>

                    {/* Parties (Buyer & Seller) */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--admin-ink,#171a16)]">
                        <User className="h-3.5 w-3.5 text-[var(--admin-ink-soft,#5f625a)] shrink-0" />
                        <span className="truncate max-w-[130px]">{dispute.buyerName}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--admin-ink-soft,#5f625a)]">
                        <Store className="h-3.5 w-3.5 text-[var(--admin-copper-deep,#8c531b)] shrink-0" />
                        <span className="truncate max-w-[130px]">{dispute.sellerName}</span>
                      </div>
                    </td>

                    {/* Linked Order */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-1 font-mono text-xs font-bold text-[var(--admin-ink,#171a16)]">
                        <Package className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{dispute.linkedOrder.id}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--admin-ink-soft,#5f625a)]">
                        Total: {formatAdminCurrency(dispute.linkedOrder.total)}
                      </div>
                    </td>

                    {/* Claim Amount */}
                    <td className="px-5 py-4 align-top">
                      <div className="text-xs font-black text-[var(--admin-ink,#171a16)]">
                        {formatAdminCurrency(dispute.claimAmount)}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase font-bold text-[var(--admin-ember,#d96a1f)]">
                        ZMW Escrow
                      </div>
                    </td>

                    {/* SLA Target */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <AdminStatusBadge tone={slaMeta.tone}>
                          {slaMeta.label}
                        </AdminStatusBadge>
                      </div>
                    </td>

                    {/* Status Pill */}
                    <td className="px-5 py-4 align-top">
                      <AdminStatusBadge tone={statusMeta.tone}>
                        {statusMeta.label}
                      </AdminStatusBadge>
                    </td>

                    {/* Inspect Button */}
                    <td className="px-5 py-4 text-right align-top">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(dispute.id);
                        }}
                        className="rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_36%,transparent)] bg-white font-black text-xs text-[var(--admin-canopy-deep,#063b29)] shadow-sm hover:bg-[var(--admin-surface-mist,#f6eedf)]"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
