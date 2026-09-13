"use client";

/**
 * @file DisputeDetailSheet.tsx
 * @module features/admin-disputes/components
 * @description
 * Slide-out inspection drawer for dispute arbitration.
 * Provides complete case evidence review (buyer vs seller), linked order details,
 * resolution action triggers with mandatory justification prompts (>= 10 chars),
 * and operator audit note threads.
 */

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileQuestion,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Package,
  Send,
  Shield,
  Store,
  User,
  X,
} from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatAdminCurrency,
  formatAdminDateTime,
} from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type {
  AdminDisputeRecord,
  DisputeStatus,
} from "../types";
import {
  DISPUTE_CATEGORY_LABELS,
  DISPUTE_SEVERITY_METADATA,
  DISPUTE_STATUS_METADATA,
  getDisputeSlaMeta,
} from "../types";

interface DisputeDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispute: AdminDisputeRecord | null;
  loading?: boolean;
  isMutating?: boolean;
  onUpdateStatus: (
    id: string,
    payload: { status: DisputeStatus; note: string; assignedTo?: string }
  ) => Promise<void>;
  onAddNote: (id: string, note: string) => Promise<void>;
}

export function DisputeDetailSheet({
  open,
  onOpenChange,
  dispute,
  loading = false,
  isMutating = false,
  onUpdateStatus,
  onAddNote,
}: DisputeDetailSheetProps) {
  // Modal / Prompt State for Status Resolution
  const [pendingStatus, setPendingStatus] = useState<DisputeStatus | null>(null);
  const [justificationNote, setJustificationNote] = useState("");
  const [justificationError, setJustificationError] = useState<string | null>(null);

  // Internal Note Input State
  const [internalNoteText, setInternalNoteText] = useState("");

  const handleOpenActionPrompt = (status: DisputeStatus) => {
    setPendingStatus(status);
    setJustificationNote("");
    setJustificationError(null);
  };

  const handleCancelActionPrompt = () => {
    setPendingStatus(null);
    setJustificationNote("");
    setJustificationError(null);
  };

  const handleConfirmStatusChange = async () => {
    if (!dispute || !pendingStatus) return;

    const trimmed = justificationNote.trim();
    if (trimmed.length < 10) {
      setJustificationError("Mandatory justification must be at least 10 characters long.");
      return;
    }

    try {
      await onUpdateStatus(dispute.id, {
        status: pendingStatus,
        note: trimmed,
      });
      handleCancelActionPrompt();
    } catch {
      // Error handled by parent toast
    }
  };

  const handleSaveInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispute || !internalNoteText.trim() || isMutating) return;

    try {
      await onAddNote(dispute.id, internalNoteText.trim());
      setInternalNoteText("");
    } catch {
      // Error handled by parent toast
    }
  };

  const isImageString = (str: string): boolean => {
    return (
      str.startsWith("http://") ||
      str.startsWith("https://") ||
      str.includes("cloudinary.com") ||
      /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(str)
    );
  };

  if (!dispute && !loading) {
    return null;
  }

  const statusMeta = dispute
    ? DISPUTE_STATUS_METADATA[dispute.status] ?? {
        label: dispute.status,
        tone: "zinc" as const,
        description: "",
      }
    : null;

  const severityMeta = dispute
    ? DISPUTE_SEVERITY_METADATA[dispute.severity] ?? {
        label: dispute.severity,
        tone: "zinc" as const,
      }
    : null;

  const slaMeta = dispute ? getDisputeSlaMeta(dispute.dueAt, dispute.status) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full border-l border-white/40 bg-[var(--admin-surface-cream,#fff8ec)] p-0 shadow-2xl shadow-zinc-950/20 backdrop-blur-2xl sm:max-w-2xl flex flex-col h-full overflow-hidden">
        {/* Drawer Header */}
        <SheetHeader className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-canopy-deep,#063b29)] px-6 py-5 text-[var(--admin-surface-cream,#fff8ec)] shrink-0">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-black uppercase tracking-wider text-[var(--admin-copper-muted,#b88746)]">
                  Dispute Case #{dispute?.id}
                </span>
                {severityMeta && (
                  <AdminStatusBadge tone={severityMeta.tone}>
                    {severityMeta.label}
                  </AdminStatusBadge>
                )}
                {slaMeta && (
                  <AdminStatusBadge tone={slaMeta.tone}>
                    {slaMeta.label}
                  </AdminStatusBadge>
                )}
              </div>
              <SheetTitle className="mt-1.5 text-lg font-black text-[var(--admin-surface-cream,#fff8ec)] leading-tight">
                {dispute?.title || "Loading dispute details..."}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs font-bold text-emerald-200/70">
                {dispute ? DISPUTE_CATEGORY_LABELS[dispute.category] : ""}
              </SheetDescription>
            </div>

            {/* Claim Amount Pill */}
            {dispute && (
              <div className="shrink-0 rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_40%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)]/10 px-3.5 py-2 text-right">
                <p className="text-[10px] font-black uppercase text-emerald-200/80 tracking-wider">
                  Claim Value
                </p>
                <p className="text-base font-black text-[var(--admin-surface-cream,#fff8ec)]">
                  {formatAdminCurrency(dispute.claimAmount)}
                </p>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
          {loading && !dispute ? (
            <div className="space-y-4 py-8 animate-pulse">
              <div className="h-24 rounded-2xl bg-zinc-200" />
              <div className="h-40 rounded-2xl bg-zinc-200" />
              <div className="h-32 rounded-2xl bg-zinc-200" />
            </div>
          ) : dispute ? (
            <>
              {/* Status Summary & Case Meta */}
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                      Current Status:
                    </span>
                    {statusMeta && (
                      <AdminStatusBadge tone={statusMeta.tone}>
                        {statusMeta.label}
                      </AdminStatusBadge>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium">
                    Opened: {formatAdminDateTime(dispute.openedAt)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--admin-surface-mist,#f6eedf)]">
                    <User className="h-4 w-4 text-zinc-500 shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Buyer (Claimant)</span>
                      <p className="font-black text-zinc-900">{dispute.buyerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--admin-surface-mist,#f6eedf)]">
                    <Store className="h-4 w-4 text-[var(--admin-copper-deep,#8c531b)] shrink-0" />
                    <div>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">Merchant</span>
                      <p className="font-black text-zinc-900">{dispute.sellerName}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked Order Card */}
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                    <Package className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
                    <span>Linked Order Details</span>
                  </div>
                  <span className="font-mono text-xs font-black text-zinc-700">
                    {dispute.linkedOrder.id}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] font-bold uppercase text-zinc-400">Order Total</span>
                    <p className="font-black text-zinc-900">
                      {formatAdminCurrency(dispute.linkedOrder.total)}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] font-bold uppercase text-zinc-400">Order Status</span>
                    <p className="font-bold text-zinc-800 capitalize">
                      {dispute.linkedOrder.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] font-bold uppercase text-zinc-400">Payment Mode</span>
                    <p className="font-bold text-zinc-800 capitalize">
                      {dispute.linkedOrder.paymentProvider || "Escrow"}
                    </p>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <span className="text-[10px] font-bold uppercase text-zinc-400">Shipping</span>
                    <p className="font-bold text-zinc-800 capitalize truncate">
                      {dispute.linkedOrder.shippingMethod || "Lusaka Delivery"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Evidence Viewer: Buyer vs Seller */}
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                    <FileQuestion className="h-4 w-4 text-[var(--admin-ember,#d96a1f)]" />
                    <span>Evidence Comparison</span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    Buyer Claim vs Merchant Rebuttal
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Buyer Evidence */}
                  <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/40 p-3">
                    <div className="flex items-center justify-between text-xs font-black text-sky-900">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-sky-600" />
                        <span>Buyer Evidence</span>
                      </span>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-md">
                        {dispute.evidence.buyer.length} items
                      </span>
                    </div>

                    {dispute.evidence.buyer.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic py-3 text-center">
                        No buyer evidence photos or statements provided.
                      </p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {dispute.evidence.buyer.map((item, idx) => (
                          <div
                            key={`buyer-ev-${idx}`}
                            className="rounded-lg border border-sky-200/70 bg-white p-2 text-xs text-zinc-800"
                          >
                            {isImageString(item) ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[11px] font-bold text-sky-700">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  <span>Attached Photo Evidence</span>
                                </div>
                                <a
                                  href={item}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 hover:underline truncate max-w-full"
                                >
                                  <span>View Photo #{idx + 1}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
                                <p className="text-xs leading-relaxed">{item}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Seller Evidence */}
                  <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <div className="flex items-center justify-between text-xs font-black text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-amber-700" />
                        <span>Merchant Response</span>
                      </span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md">
                        {dispute.evidence.seller.length} items
                      </span>
                    </div>

                    {dispute.evidence.seller.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic py-3 text-center">
                        Merchant has not uploaded counter-evidence yet.
                      </p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {dispute.evidence.seller.map((item, idx) => (
                          <div
                            key={`seller-ev-${idx}`}
                            className="rounded-lg border border-amber-200/70 bg-white p-2 text-xs text-zinc-800"
                          >
                            {isImageString(item) ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                  <span>Merchant Proof / Waybill</span>
                                </div>
                                <a
                                  href={item}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 hover:underline truncate max-w-full"
                                >
                                  <span>View Document #{idx + 1}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-zinc-400 mt-0.5 shrink-0" />
                                <p className="text-xs leading-relaxed">{item}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resolution Action Trigger Panel */}
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-white p-4 shadow-sm">
                <div className="border-b border-zinc-100 pb-2.5">
                  <p className="font-black text-xs uppercase tracking-wider text-zinc-900">
                    Authorized Arbitration Decisions
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 font-medium">
                    All status transitions require a mandatory recorded justification of at least 10 characters.
                  </p>
                </div>

                {/* If an action prompt is active, show mandatory justification modal / form */}
                {pendingStatus ? (
                  <div className="mt-3 rounded-xl border-2 border-[var(--admin-canopy,#075b36)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
                        <span className="text-xs font-black text-zinc-900">
                          Justification Required:{" "}
                          <span className="text-[var(--admin-canopy-deep,#063b29)]">
                            {DISPUTE_STATUS_METADATA[pendingStatus]?.label || pendingStatus}
                          </span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCancelActionPrompt}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2.5">
                      <label
                        htmlFor="dispute-justification-note"
                        className="block text-[11px] font-bold text-zinc-600 mb-1"
                      >
                        Explain the operational grounds for this ruling (min 10 characters):
                      </label>
                      <textarea
                        id="dispute-justification-note"
                        rows={3}
                        value={justificationNote}
                        onChange={(e) => {
                          setJustificationNote(e.target.value);
                          if (justificationError && e.target.value.trim().length >= 10) {
                            setJustificationError(null);
                          }
                        }}
                        placeholder="e.g. Courier confirmed package was delivered to wrong compound; authorizing full buyer refund."
                        className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[var(--admin-canopy,#075b36)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-canopy,#075b36)]/20"
                      />
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span
                          className={cn(
                            "font-bold",
                            justificationNote.trim().length < 10
                              ? "text-rose-600"
                              : "text-emerald-700"
                          )}
                        >
                          {justificationNote.trim().length}/10 characters
                        </span>
                        {justificationError && (
                          <span className="text-rose-600 font-bold">
                            {justificationError}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCancelActionPrompt}
                        disabled={isMutating}
                        className="rounded-xl border-zinc-200 text-xs font-bold"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={justificationNote.trim().length < 10 || isMutating}
                        onClick={handleConfirmStatusChange}
                        className="rounded-xl bg-[var(--admin-canopy-deep,#063b29)] text-white text-xs font-black hover:bg-[var(--admin-canopy,#075b36)] disabled:opacity-50"
                      >
                        {isMutating ? "Recording decision..." : "Confirm & Apply Ruling"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Action 1: Resolve Buyer */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenActionPrompt("resolved_buyer")}
                      disabled={dispute.status === "resolved_buyer" || isMutating}
                      className="rounded-xl border-emerald-300 bg-emerald-50/60 font-black text-xs text-emerald-900 hover:bg-emerald-100 justify-start"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Resolve in Buyer Favor (Refund)</span>
                    </Button>

                    {/* Action 2: Resolve Seller */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenActionPrompt("resolved_seller")}
                      disabled={dispute.status === "resolved_seller" || isMutating}
                      className="rounded-xl border-zinc-300 bg-zinc-50 font-black text-xs text-zinc-900 hover:bg-zinc-100 justify-start"
                    >
                      <Shield className="mr-2 h-4 w-4 text-zinc-700 shrink-0" />
                      <span>Resolve in Seller Favor (Release)</span>
                    </Button>

                    {/* Action 3: Request Counter Evidence */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenActionPrompt("waiting_evidence")}
                      disabled={dispute.status === "waiting_evidence" || isMutating}
                      className="rounded-xl border-indigo-200 bg-indigo-50/50 font-black text-xs text-indigo-900 hover:bg-indigo-100 justify-start"
                    >
                      <Clock className="mr-2 h-4 w-4 text-indigo-600 shrink-0" />
                      <span>Request Counter-Evidence</span>
                    </Button>

                    {/* Action 4: Escalate */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenActionPrompt("escalated")}
                      disabled={dispute.status === "escalated" || isMutating}
                      className="rounded-xl border-rose-200 bg-rose-50/50 font-black text-xs text-rose-900 hover:bg-rose-100 justify-start"
                    >
                      <AlertTriangle className="mr-2 h-4 w-4 text-rose-600 shrink-0" />
                      <span>Escalate to Senior Admin</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Internal Notes Thread */}
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-2.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                    <MessageSquare className="h-4 w-4 text-[var(--admin-copper-deep,#8c531b)]" />
                    <span>Internal Audit & Operator Notes</span>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400">
                    {dispute.internalNotes?.length || 0} notes
                  </span>
                </div>

                {/* Notes List */}
                <div className="mt-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {!dispute.internalNotes || dispute.internalNotes.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic py-2 text-center">
                      No internal operator notes recorded for this dispute yet.
                    </p>
                  ) : (
                    dispute.internalNotes.map((note, index) => (
                      <div
                        key={`note-${index}`}
                        className="rounded-xl border border-zinc-100 bg-[var(--admin-surface-mist,#f6eedf)]/50 p-2.5 text-xs text-zinc-800"
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{note}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Note Form */}
                <form onSubmit={handleSaveInternalNote} className="mt-3.5 pt-3 border-t border-zinc-100 flex gap-2">
                  <input
                    type="text"
                    value={internalNoteText}
                    onChange={(e) => setInternalNoteText(e.target.value)}
                    placeholder="Add an internal operations note..."
                    disabled={isMutating}
                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-[var(--admin-canopy,#075b36)] focus:outline-none"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!internalNoteText.trim() || isMutating}
                    className="rounded-xl bg-[var(--admin-canopy-deep,#063b29)] px-3 text-white text-xs font-black hover:bg-[var(--admin-canopy,#075b36)] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>

              {/* Resolution History Audit Trail */}
              {dispute.resolutionHistory && dispute.resolutionHistory.length > 0 && (
                <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-white p-4 shadow-sm">
                  <p className="font-black text-xs uppercase tracking-wider text-zinc-900 border-b border-zinc-100 pb-2">
                    Action History & Resolution Timeline
                  </p>
                  <div className="mt-3 space-y-2">
                    {dispute.resolutionHistory.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start justify-between gap-3 text-xs border-b border-zinc-50 pb-2 last:border-0"
                      >
                        <div>
                          <p className="font-bold text-zinc-900">{event.action}</p>
                          <p className="text-[11px] text-zinc-500">{event.note}</p>
                          <p className="mt-0.5 text-[10px] font-mono text-zinc-400">By: {event.actor}</p>
                        </div>
                        <span className="text-[10px] font-medium text-zinc-400 shrink-0">
                          {formatAdminDateTime(event.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
