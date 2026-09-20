/**
 * @file SupportTicketDetailSheet.tsx
 * @module features/admin-support/components
 * @description
 * Tactical slide-out detail inspection sheet for support ticket operations.
 * Displays merchant context, full conversation thread, canned operational macros,
 * reply composer, and ticket status transition quick-actions.
 */

import React, { useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  MessageCircle,
  MessageSquare,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Store,
  TicketCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminDetailSheet,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import { SUPPORT_MACROS } from "../config/macros";
import type {
  AdminSupportTicket,
  AdminTicketStatus,
} from "../types";
import {
  getTicketSlaStatus,
  TICKET_CATEGORY_METADATA,
  TICKET_PRIORITY_METADATA,
  TICKET_STATUS_METADATA,
} from "../types";

interface SupportTicketDetailSheetProps {
  ticket: AdminSupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReply: (body: string, nextStatus?: AdminTicketStatus) => Promise<boolean>;
  onUpdateStatus: (status: AdminTicketStatus) => Promise<boolean>;
  isMutating?: boolean;
  detailLoading?: boolean;
  canReplySupport?: boolean;
  canManageSupport?: boolean;
}

export function SupportTicketDetailSheet({
  ticket,
  open,
  onOpenChange,
  onReply,
  onUpdateStatus,
  isMutating = false,
  detailLoading = false,
  canReplySupport = true,
  canManageSupport = true,
}: SupportTicketDetailSheetProps) {
  const [replyText, setReplyText] = useState("");
  const [selectedMacroId, setSelectedMacroId] = useState("");

  const handleApplyMacro = (macroId: string) => {
    if (!macroId) {
      setSelectedMacroId("");
      return;
    }
    const macro = SUPPORT_MACROS.find((m) => m.id === macroId);
    if (!macro || !ticket) return;

    setSelectedMacroId(macroId);

    const sellerName =
      ticket.seller.displayName || ticket.seller.storeName || "Merchant";
    const hydratedText = macro.templateText
      .replace(/\{\{seller_name\}\}/g, sellerName)
      .replace(/\{\{order_id\}\}/g, ticket.id);

    setReplyText(hydratedText);
    toast.success(`Applied macro: "${macro.title}"`);
  };

  const handleSendStandardReply = async () => {
    if (!replyText.trim()) {
      toast.error("Please compose a reply message first.");
      return;
    }
    const success = await onReply(replyText.trim(), "waiting-seller");
    if (success) {
      setReplyText("");
      setSelectedMacroId("");
    }
  };

  const handleSendAndResolve = async () => {
    if (!replyText.trim()) {
      toast.error("Please compose a reply message first.");
      return;
    }
    const success = await onReply(replyText.trim(), "resolved");
    if (success) {
      setReplyText("");
      setSelectedMacroId("");
    }
  };

  const statusMeta = ticket
    ? TICKET_STATUS_METADATA[ticket.status] || {
        label: ticket.status,
        tone: "zinc" as const,
      }
    : null;

  const priorityMeta = ticket
    ? TICKET_PRIORITY_METADATA[ticket.priority] || {
        label: ticket.priority,
        tone: "zinc" as const,
      }
    : null;

  const categoryMeta = ticket
    ? TICKET_CATEGORY_METADATA[ticket.category] || {
        label: ticket.category,
        tone: "zinc" as const,
      }
    : null;

  const sla = ticket ? getTicketSlaStatus(ticket) : null;
  const kycApproved =
    ticket?.seller.applicationStatus?.toUpperCase() === "APPROVED";

  const sellerProfileId =
    ticket?.seller.vendorApplicationId || ticket?.seller.userId;

  return (
    <AdminDetailSheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setReplyText("");
          setSelectedMacroId("");
        }
        onOpenChange(isOpen);
      }}
      title={ticket?.subject ?? "Support Ticket"}
      description={
        ticket
          ? `Ticket ID: ${ticket.id} · Requester: ${
              ticket.seller.storeName || ticket.seller.displayName
            }`
          : "Support ticket details"
      }
    >
      {detailLoading && !ticket ? (
        <div className="space-y-6">
          <div className="grid gap-3 grid-cols-2">
            <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-zinc-100" />
          </div>
          <div className="h-44 animate-pulse rounded-2xl bg-zinc-100" />
          <div className="h-64 animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      ) : ticket ? (
        <div className="space-y-6 pb-8">
          {/* 1. STATUS & SLA HEADER STRIP */}
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-3.5 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              {statusMeta && (
                <AdminStatusBadge tone={statusMeta.tone}>
                  {statusMeta.label}
                </AdminStatusBadge>
              )}
              {priorityMeta && (
                <AdminStatusBadge tone={priorityMeta.tone}>
                  Priority: {priorityMeta.label}
                </AdminStatusBadge>
              )}
              {categoryMeta && (
                <AdminStatusBadge tone={categoryMeta.tone}>
                  {categoryMeta.label}
                </AdminStatusBadge>
              )}
            </div>

            {sla && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  SLA:
                </span>
                <AdminStatusBadge tone={sla.tone} className="gap-1 font-bold">
                  {sla.isOverdue ? (
                    <Clock className="h-3 w-3 animate-pulse text-rose-300" />
                  ) : null}
                  <span>{sla.label}</span>
                </AdminStatusBadge>
              </div>
            )}
          </section>

          {/* 2. SELLER CONTEXT CARD */}
          <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--admin-surface-mist,#f6eedf)] text-[var(--admin-canopy-deep,#063b29)]">
                  <Store className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ink,#171a16)]">
                  Seller Profile & Verification
                </h3>
              </div>

              {sellerProfileId && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs font-bold text-[var(--admin-canopy-deep,#063b29)] hover:bg-emerald-50"
                >
                  <Link
                    href={`/admin/sellers/${sellerProfileId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>View Merchant File</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>

            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  Store Legal Name
                </span>
                <p className="mt-0.5 font-black text-[var(--admin-ink,#171a16)]">
                  {ticket.seller.storeName || "Direct Individual Seller"}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  Account Owner
                </span>
                <p className="mt-0.5 font-bold text-[var(--admin-ink,#171a16)]">
                  {ticket.seller.displayName}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  Primary Email
                </span>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-ink-soft,#5f625a)]">
                  {ticket.seller.email}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-[var(--admin-ink-soft,#5f625a)]">
                  Merchant KYC Status
                </span>
                <div className="mt-1 flex items-center gap-1.5 font-bold">
                  {kycApproved ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" /> Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" />{" "}
                      {toTitleCase(ticket.seller.applicationStatus || "Pending Review")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 3. STATUS TRANSITION QUICK-ACTIONS BAR */}
          <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-3.5 shadow-xs">
            <p className="text-[10px] font-black uppercase text-[var(--admin-ink-soft,#5f625a)] mb-2">
              Lifecycle Transition Bar
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  isMutating ||
                  ticket.status === "waiting-support" ||
                  !canManageSupport
                }
                onClick={() => onUpdateStatus("waiting-support")}
                className="h-8 gap-1.5 rounded-xl border-amber-200 bg-white text-xs font-black text-amber-800 hover:bg-amber-50"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Mark Waiting Support</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  isMutating ||
                  ticket.status === "waiting-seller" ||
                  !canManageSupport
                }
                onClick={() => onUpdateStatus("waiting-seller")}
                className="h-8 gap-1.5 rounded-xl border-indigo-200 bg-white text-xs font-black text-indigo-800 hover:bg-indigo-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Mark Waiting Seller</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={
                  isMutating || ticket.status === "resolved" || !canManageSupport
                }
                onClick={() => onUpdateStatus("resolved")}
                className="h-8 gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700"
              >
                <TicketCheck className="h-3.5 w-3.5" />
                <span>Mark Resolved</span>
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={
                  isMutating || ticket.status === "closed" || !canManageSupport
                }
                onClick={() => onUpdateStatus("closed")}
                className="h-8 gap-1.5 rounded-xl bg-zinc-950 px-3 text-xs font-black text-white hover:bg-zinc-800"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Close Ticket</span>
              </Button>

              {(ticket.status === "resolved" || ticket.status === "closed") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isMutating || !canManageSupport}
                  onClick={() => onUpdateStatus("open")}
                  className="h-8 gap-1.5 rounded-xl border-zinc-300 bg-white text-xs font-black text-zinc-800 hover:bg-zinc-100"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Reopen Ticket</span>
                </Button>
              )}
            </div>
          </section>

          {/* 4. REPLY COMPOSER & MACRO SELECT */}
          <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--admin-surface-mist,#f6eedf)] text-[var(--admin-canopy-deep,#063b29)]">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ink,#171a16)]">
                  Reply Composer
                </h3>
              </div>

              {/* Macro Quick-Select */}
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <select
                  value={selectedMacroId}
                  onChange={(e) => handleApplyMacro(e.target.value)}
                  disabled={isMutating || !canReplySupport}
                  className="h-8 rounded-xl border border-zinc-200 bg-[var(--admin-surface-cream,#fff8ec)] px-2.5 text-xs font-bold text-zinc-800 shadow-xs focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]"
                >
                  <option value="">Insert Canned Operational Macro...</option>
                  {SUPPORT_MACROS.map((macro) => (
                    <option key={macro.id} value={macro.id}>
                      [{toTitleCase(macro.category)}] {macro.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your official response to the merchant or choose a canned macro from the dropdown above..."
                disabled={isMutating || !canReplySupport}
                rows={5}
                className="min-h-28 resize-y rounded-xl border-zinc-200 bg-zinc-50/50 p-3 text-xs font-medium leading-relaxed shadow-inner focus:bg-white"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-[var(--admin-ink-soft,#5f625a)]">
                  Sending updates notify the merchant via email and Seller Studio.
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      !replyText.trim() || isMutating || !canReplySupport
                    }
                    onClick={handleSendStandardReply}
                    className="h-9 gap-1.5 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_30%,transparent)] bg-white px-3.5 text-xs font-black text-[var(--admin-ink,#171a16)] shadow-xs hover:bg-[var(--admin-canopy-deep,#063b29)] hover:text-[var(--admin-surface-cream,#fff8ec)]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send Reply</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !replyText.trim() || isMutating || !canReplySupport
                    }
                    onClick={handleSendAndResolve}
                    className="h-9 gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Send & Mark Resolved</span>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* 5. CONVERSATION THREAD */}
          <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ink,#171a16)]">
                Conversation History (
                {ticket.messages ? ticket.messages.length : 0} Messages)
              </h3>
              <span className="text-[10px] font-medium text-[var(--admin-ink-soft,#5f625a)]">
                Chronological audit
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {(!ticket.messages || ticket.messages.length === 0) && (
                <p className="py-6 text-center text-xs text-zinc-400">
                  No previous dialogue recorded for this ticket.
                </p>
              )}

              {ticket.messages?.map((msg) => {
                const isSeller = msg.senderType === "seller";
                const isSupport = msg.senderType === "support";
                const isSystem = msg.senderType === "system";

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "rounded-2xl p-4 transition-all",
                      isSeller &&
                        "border border-amber-200/80 bg-[var(--admin-surface-cream,#fff8ec)]/60 text-[var(--admin-ink,#171a16)]",
                      isSupport &&
                        "border border-emerald-200/80 bg-emerald-50/50 text-zinc-900",
                      isSystem &&
                        "border border-dashed border-zinc-200 bg-zinc-50 text-zinc-600 text-xs"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-100/80 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        {isSeller && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200/80 text-amber-900">
                            <User className="h-3 w-3" />
                          </div>
                        )}
                        {isSupport && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                            <ShieldCheck className="h-3 w-3" />
                          </div>
                        )}
                        {isSystem && (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-300 text-zinc-700">
                            <Bot className="h-3 w-3" />
                          </div>
                        )}
                        <span className="text-xs font-black">
                          {msg.senderName || (isSeller ? "Merchant" : "Support Officer")}
                        </span>
                        <AdminStatusBadge
                          tone={
                            isSeller
                              ? "amber"
                              : isSupport
                              ? "emerald"
                              : "zinc"
                          }
                          className="py-0 px-1.5 text-[8px]"
                        >
                          {isSeller
                            ? "Merchant"
                            : isSupport
                            ? "Support Admin"
                            : "System"}
                        </AdminStatusBadge>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {formatAdminDateTime(msg.createdAt)}
                      </span>
                    </div>

                    <div className="text-xs leading-relaxed whitespace-pre-wrap">
                      {msg.body}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </AdminDetailSheet>
  );
}
