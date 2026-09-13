/**
 * @file SupportTicketMobileCards.tsx
 * @module features/admin-support/components
 * @description
 * Compact mobile card presentation for support tickets on viewports < 1024px.
 * Preserves high density, SLA visibility, and quick inspection triggers.
 */

import React from "react";
import { Clock, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  AdminEmptyState,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { formatAdminDateTime } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type { AdminSupportTicket } from "../types";
import {
  getTicketSlaStatus,
  TICKET_CATEGORY_METADATA,
  TICKET_PRIORITY_METADATA,
  TICKET_STATUS_METADATA,
} from "../types";

interface SupportTicketMobileCardsProps {
  tickets: AdminSupportTicket[];
  loading: boolean;
  onInspect: (ticketId: string) => void;
  className?: string;
}

export function SupportTicketMobileCards({
  tickets,
  loading,
  onInspect,
  className,
}: SupportTicketMobileCardsProps) {
  if (loading) {
    return (
      <div className={cn("space-y-3 lg:hidden", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`mobile-skel-${i}`}
            className="h-36 animate-pulse rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_20%,transparent)] bg-white/70"
          />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-6 lg:hidden">
        <AdminEmptyState
          title="No tickets match this view"
          description="Try selecting a different lifecycle tab or clearing filters."
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 lg:hidden", className)}>
      {tickets.map((ticket) => {
        const statusMeta = TICKET_STATUS_METADATA[ticket.status] || {
          label: ticket.status,
          tone: "zinc" as const,
        };
        const priorityMeta = TICKET_PRIORITY_METADATA[ticket.priority] || {
          label: ticket.priority,
          tone: "zinc" as const,
        };
        const categoryMeta = TICKET_CATEGORY_METADATA[ticket.category] || {
          label: ticket.category,
          tone: "zinc" as const,
        };
        const sla = getTicketSlaStatus(ticket);
        const kycApproved =
          ticket.seller.applicationStatus?.toUpperCase() === "APPROVED";

        return (
          <article
            key={ticket.id}
            className="flex flex-col gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm"
          >
            {/* Header: Badges & Subject */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <AdminStatusBadge tone={categoryMeta.tone} className="py-0.5 px-2 text-[9px]">
                    {categoryMeta.label}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone={priorityMeta.tone} className="py-0.5 px-2 text-[9px]">
                    {priorityMeta.label}
                  </AdminStatusBadge>
                  <AdminStatusBadge tone={statusMeta.tone} className="py-0.5 px-2 text-[9px]">
                    {statusMeta.label}
                  </AdminStatusBadge>
                </div>
                <h3 className="text-sm font-black text-[var(--admin-ink,#171a16)] line-clamp-2">
                  {ticket.subject}
                </h3>
              </div>
            </div>

            {/* Merchant Details */}
            <div className="rounded-xl border border-zinc-100 bg-white p-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-black text-[var(--admin-ink,#171a16)] min-w-0">
                  <span className="truncate">
                    {ticket.seller.storeName || ticket.seller.displayName}
                  </span>
                  {kycApproved ? (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  )}
                </div>
                <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                  {ticket.id.slice(0, 8)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--admin-ink-soft,#5f625a)] truncate">
                {ticket.seller.displayName} ({ticket.seller.email})
              </p>
            </div>

            {/* Footer: SLA aging & Inspect button */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_14%,transparent)]">
              <div className="flex items-center gap-1.5">
                <AdminStatusBadge tone={sla.tone} className="gap-1 font-bold">
                  {sla.isOverdue ? (
                    <Clock className="h-3 w-3 animate-pulse text-rose-300" />
                  ) : null}
                  <span>{sla.label}</span>
                </AdminStatusBadge>
                <span className="text-[10px] text-zinc-400">
                  {formatAdminDateTime(ticket.updatedAt)}
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onInspect(ticket.id)}
                className="h-8 gap-1.5 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_30%,transparent)] bg-white px-3 text-xs font-black text-[var(--admin-ink,#171a16)] shadow-xs hover:bg-[var(--admin-canopy-deep,#063b29)] hover:text-[var(--admin-surface-cream,#fff8ec)]"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Inspect</span>
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
