/**
 * @file SupportTicketTable.tsx
 * @module features/admin-support/components
 * @description
 * High-density desktop presentation table for support ticket operations.
 * Displays ticket subjects, category tags, merchant KYC context, SLA aging pills,
 * and quick inspection triggers.
 */

import React from "react";
import { Eye, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
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

interface SupportTicketTableProps {
  tickets: AdminSupportTicket[];
  loading: boolean;
  onInspect: (ticketId: string) => void;
  className?: string;
}

export function SupportTicketTable({
  tickets,
  loading,
  onInspect,
  className,
}: SupportTicketTableProps) {
  return (
    <div
      className={cn(
        "hidden overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] shadow-[0_12px_32px_rgb(6_59_41_/_6%)] lg:block",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-xs">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-canopy-deep,#063b29)] text-[10px] font-black uppercase tracking-wider text-[var(--admin-surface-cream,#fff8ec)]">
              <th className="px-5 py-3.5">Ticket Subject & Category</th>
              <th className="px-5 py-3.5">Merchant / Requester</th>
              <th className="px-4 py-3.5">Priority</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">SLA Timeline</th>
              <th className="px-5 py-3.5">Last Updated</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_14%,transparent)]">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`table-skel-${i}`}>
                  <td colSpan={7} className="px-5 py-4">
                    <div className="h-10 w-full animate-pulse rounded-xl bg-zinc-200/50" />
                  </td>
                </tr>
              ))
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12">
                  <AdminEmptyState
                    title="No tickets match this view"
                    description="Try selecting a different lifecycle tab, clearing active filters, or changing your search terms."
                  />
                </td>
              </tr>
            ) : (
              tickets.map((ticket) => {
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
                  <tr
                    key={ticket.id}
                    className="bg-white/50 transition-colors hover:bg-amber-50/40"
                  >
                    {/* Ticket Subject & Category */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="font-black text-[var(--admin-ink,#171a16)] line-clamp-1">
                          {ticket.subject}
                        </span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="font-mono font-bold text-zinc-400">
                            {ticket.id.slice(0, 8)}...
                          </span>
                          <span className="text-zinc-300">•</span>
                          <AdminStatusBadge tone={categoryMeta.tone} className="py-0.5 px-2 text-[9px]">
                            {categoryMeta.label}
                          </AdminStatusBadge>
                        </div>
                      </div>
                    </td>

                    {/* Merchant / Requester */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 font-black text-[var(--admin-ink,#171a16)]">
                          <span>{ticket.seller.storeName || ticket.seller.displayName}</span>
                          {kycApproved ? (
                            <span title="KYC Verified Merchant">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            </span>
                          ) : (
                            <span title={`KYC Status: ${ticket.seller.applicationStatus || "Pending"}`}>
                              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-[var(--admin-ink-soft,#5f625a)] truncate">
                          {ticket.seller.displayName} · {ticket.seller.email}
                        </span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3.5">
                      <AdminStatusBadge tone={priorityMeta.tone}>
                        {priorityMeta.label}
                      </AdminStatusBadge>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <AdminStatusBadge tone={statusMeta.tone}>
                        {statusMeta.label}
                      </AdminStatusBadge>
                    </td>

                    {/* SLA Aging Indicator */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <AdminStatusBadge tone={sla.tone} className="gap-1 font-bold">
                          {sla.isOverdue ? (
                            <Clock className="h-3 w-3 animate-pulse text-rose-300" />
                          ) : null}
                          <span>{sla.label}</span>
                        </AdminStatusBadge>
                      </div>
                    </td>

                    {/* Updated Timestamp */}
                    <td className="px-5 py-3.5 text-[11px] font-medium text-[var(--admin-ink-soft,#5f625a)] whitespace-nowrap">
                      {formatAdminDateTime(ticket.updatedAt)}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onInspect(ticket.id)}
                        className="h-8 gap-1.5 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_30%,transparent)] bg-white px-3 text-xs font-black text-[var(--admin-ink,#171a16)] shadow-xs transition-all hover:bg-[var(--admin-canopy-deep,#063b29)] hover:text-[var(--admin-surface-cream,#fff8ec)]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
