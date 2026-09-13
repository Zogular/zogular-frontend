"use client";

/**
 * @file DisputesMobileCards.tsx
 * @module features/admin-disputes/components
 * @description
 * Mobile-first card list for viewports < 1024px in the Returns, Claims & Disputes Control Center.
 * Compact, tactile card presentation with dispute parties, SLA deadlines, claim amounts, and inspect triggers.
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

interface DisputesMobileCardsProps {
  disputes: AdminDisputeRecord[];
  loading?: boolean;
  requestError?: string | null;
  onRetry?: () => void;
  selectedDisputeId: string | null;
  onSelectDispute: (disputeId: string) => void;
  className?: string;
}

export function DisputesMobileCards({
  disputes,
  loading = false,
  requestError,
  onRetry,
  selectedDisputeId,
  onSelectDispute,
  className,
}: DisputesMobileCardsProps) {
  const handleSelect = (id: string) => {
    rememberListScroll("/admin/disputes");
    onSelectDispute(id);
  };

  if (loading) {
    return (
      <div className={cn("grid gap-3 lg:hidden", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`mobile-dispute-skeleton-${i}`}
            className="h-48 animate-pulse rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_20%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm"
          />
        ))}
      </div>
    );
  }

  if (requestError) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm lg:hidden",
          className
        )}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-black text-zinc-900">Disputes queue unavailable</p>
        <p className="mt-1 text-xs font-medium text-zinc-500">{requestError}</p>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            onClick={onRetry}
            className="mt-4 rounded-xl border-zinc-200 font-black text-xs"
          >
            Retry queue load
          </Button>
        )}
      </div>
    );
  }

  if (disputes.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-8 text-center lg:hidden",
          className
        )}
      >
        <p className="text-sm font-black text-[var(--admin-ink,#171a16)]">
          No disputes found
        </p>
        <p className="mt-1 text-xs font-medium text-[var(--admin-ink-soft,#5f625a)]">
          Try switching queue tabs or clearing active search keywords.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3 lg:hidden", className)}>
      {disputes.map((dispute) => {
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
          <div
            key={dispute.id}
            onClick={() => handleSelect(dispute.id)}
            className={cn(
              "cursor-pointer rounded-2xl border bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-[0_4px_16px_rgb(6_59_41_/_4%)] transition-all duration-200",
              isSelected
                ? "border-[var(--admin-canopy,#075b36)] ring-2 ring-[var(--admin-canopy,#075b36)]/20"
                : "border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] hover:border-[var(--admin-canopy,#075b36)]/50"
            )}
          >
            {/* Header: Title, Category & Status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-[var(--admin-ink,#171a16)] truncate">
                  {dispute.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_30%,transparent)] bg-[var(--admin-surface-mist,#f6eedf)] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-ink-soft,#5f625a)]">
                    {DISPUTE_CATEGORY_LABELS[dispute.category] || dispute.category}
                  </span>
                  <AdminStatusBadge tone={severityMeta.tone}>
                    {severityMeta.label}
                  </AdminStatusBadge>
                </div>
              </div>
              <AdminStatusBadge tone={statusMeta.tone}>
                {statusMeta.label}
              </AdminStatusBadge>
            </div>

            {/* Parties & Financial Context */}
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_18%,transparent)] bg-[var(--admin-surface-mist,#f6eedf)] p-2.5 text-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  Dispute Parties
                </span>
                <div className="mt-1 flex items-center gap-1 font-bold text-[var(--admin-ink,#171a16)] truncate">
                  <User className="h-3 w-3 text-zinc-500 shrink-0" />
                  <span className="truncate">{dispute.buyerName}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 font-medium text-[var(--admin-ink-soft,#5f625a)] truncate">
                  <Store className="h-3 w-3 text-[var(--admin-copper-deep,#8c531b)] shrink-0" />
                  <span className="truncate">{dispute.sellerName}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  Claim Value
                </span>
                <p className="mt-1 font-black text-[var(--admin-ink,#171a16)]">
                  {formatAdminCurrency(dispute.claimAmount)}
                </p>
                <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-zinc-500 truncate">
                  <Package className="h-3 w-3 shrink-0" />
                  <span>{dispute.linkedOrder.id}</span>
                </div>
              </div>
            </div>

            {/* SLA countdown & action */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                <AdminStatusBadge tone={slaMeta.tone}>
                  {slaMeta.label}
                </AdminStatusBadge>
              </div>

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
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
