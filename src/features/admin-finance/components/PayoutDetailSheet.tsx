/**
 * @file PayoutDetailSheet.tsx
 * @module features/admin-finance/components
 * @description
 * Tactical slide-out detail sheet for inspecting seller payout requests,
 * reviewing destination phone/account info, verifying financial breakdowns,
 * and performing authorized disbursements or rejections with mandatory operational notes.
 */

"use client";

import React, { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Info,
  Loader2,
  Phone,
  RefreshCw,
  ShieldCheck,
  Store,
  User,
  XCircle,
} from "lucide-react";
import {
  AdminDetailSheet,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatAdminCurrency,
  formatAdminDateTime,
} from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type { AdminPayoutRecord, PayoutStatus } from "../types";
import {
  PAYOUT_STATUS_METADATA,
} from "../types";
import { PayoutRailBadge } from "./PayoutsTable";

interface PayoutDetailSheetProps {
  payout: AdminPayoutRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canProcessPayouts?: boolean;
  onUpdateStatus: (
    payoutId: string,
    payload: { status: PayoutStatus; reference?: string; notes: string }
  ) => Promise<void>;
  isMutating?: boolean;
}

export function PayoutDetailSheet({
  payout,
  open,
  onOpenChange,
  canProcessPayouts = false,
  onUpdateStatus,
  isMutating = false,
}: PayoutDetailSheetProps) {
  // Action state: which action modal or prompt is active
  const [targetAction, setTargetAction] = useState<PayoutStatus | null>(null);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!payout) return null;

  const meta = PAYOUT_STATUS_METADATA[payout.status];

  const resetForm = () => {
    setTargetAction(null);
    setReference("");
    setNotes("");
    setValidationError(null);
  };

  const handleActionConfirm = async () => {
    if (!targetAction) return;

    if (notes.trim().length < 5) {
      setValidationError("Mandatory operational reason must be at least 5 characters.");
      return;
    }

    if (targetAction === "COMPLETED" && !reference.trim()) {
      setValidationError("MoMo telco transaction reference is required to mark as completed.");
      return;
    }

    try {
      await onUpdateStatus(payout.id, {
        status: targetAction,
        reference: reference.trim() || undefined,
        notes: notes.trim(),
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // Error handled by hook toast
    }
  };

  return (
    <AdminDetailSheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm();
        onOpenChange(isOpen);
      }}
      title={`Payout Request: ${payout.storeName}`}
      description={`ID: ${payout.id} • ${meta.label}`}
      actions={
        <AdminStatusBadge tone={meta.tone} className="shrink-0">
          {meta.label}
        </AdminStatusBadge>
      }
    >
      <div className="space-y-6 pb-6 text-zinc-900">
        {/* Vendor & Merchant Identity Panel */}
        <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-[var(--admin-canopy-deep,#063b29)] mb-3 flex items-center gap-1.5">
            <Store className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
            Vendor & Identity Profile
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Store Name</span>
              <span className="font-black text-sm text-zinc-950">{payout.storeName}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Owner / Registered Name</span>
              <span className="font-bold text-zinc-900 flex items-center gap-1">
                <User className="h-3 w-3 text-zinc-400" />
                {payout.ownerName}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Registered Phone</span>
              <span className="font-mono font-bold text-zinc-900 flex items-center gap-1">
                <Phone className="h-3 w-3 text-zinc-400" />
                {payout.phone}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Seller ID</span>
              <span className="font-mono text-[11px] text-zinc-600">{payout.sellerId}</span>
            </div>
          </div>
        </section>

        {/* Payout Destination Carrier & Account */}
        <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-white p-4 shadow-sm">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-[var(--admin-canopy-deep,#063b29)] mb-3 flex items-center gap-1.5">
            <Banknote className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
            Settlement Destination Rail
          </h4>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3 border border-zinc-200/80">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Carrier / Rail</span>
              <div className="mt-1">
                <PayoutRailBadge rail={payout.payoutRail} />
              </div>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase font-bold">Account / MoMo Number</span>
              <span className="font-mono text-sm font-black text-zinc-950">
                {payout.accountNumber}
              </span>
            </div>
          </div>
        </section>

        {/* Financial Breakdown */}
        <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-white p-4 shadow-sm">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-[var(--admin-canopy-deep,#063b29)] mb-3 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[var(--admin-canopy,#075b36)]" />
            Financial Breakdown & Balance
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                Cleared Balance For Disbursement
              </span>
              <span className="text-xl font-black text-emerald-950 mt-1 block">
                {formatAdminCurrency(payout.clearedAmount)}
              </span>
              <span className="text-[10px] font-medium text-emerald-700 mt-1 block">
                Eligible for immediate push
              </span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                Pending In Escrow
              </span>
              <span className="text-xl font-black text-amber-950 mt-1 block">
                {formatAdminCurrency(payout.pendingEscrowAmount)}
              </span>
              <span className="text-[10px] font-medium text-amber-700 mt-1 block">
                Locked under 72h window
              </span>
            </div>
          </div>
        </section>

        {/* Timeline & Metadata */}
        <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_20%,transparent)] bg-zinc-50/80 p-4 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-500 font-medium">Requested:</span>
            <span className="font-bold text-zinc-900">{formatAdminDateTime(payout.requestedAt)}</span>
          </div>
          {payout.processedAt && (
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Processed:</span>
              <span className="font-bold text-zinc-900">{formatAdminDateTime(payout.processedAt)}</span>
            </div>
          )}
          {payout.reference && (
            <div className="flex justify-between">
              <span className="text-zinc-500 font-medium">Carrier Ref:</span>
              <span className="font-mono font-bold text-zinc-900">{payout.reference}</span>
            </div>
          )}
          {payout.notes && (
            <div className="pt-2 border-t border-zinc-200">
              <span className="text-zinc-500 font-medium block">Auditor Notes:</span>
              <p className="mt-0.5 text-zinc-700 italic">{payout.notes}</p>
            </div>
          )}
        </section>

        {/* Operational Action Controls */}
        {canProcessPayouts ? (
          <section className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-[var(--admin-canopy-deep,#063b29)] mb-3">
              Operator Settlement Actions
            </h4>

            {targetAction === null ? (
              <div className="flex flex-wrap gap-2">
                {payout.status !== "PROCESSING" && payout.status !== "COMPLETED" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTargetAction("PROCESSING")}
                    className="h-9 gap-1.5 rounded-xl border-sky-300 bg-sky-50 text-xs font-bold text-sky-900 hover:bg-sky-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Mark Processing</span>
                  </Button>
                )}

                {payout.status !== "COMPLETED" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setTargetAction("COMPLETED")}
                    className="h-9 gap-1.5 rounded-xl bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Mark Completed</span>
                  </Button>
                )}

                {payout.status !== "REJECTED" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTargetAction("REJECTED")}
                    className="h-9 gap-1.5 rounded-xl border-rose-300 bg-rose-50 text-xs font-bold text-rose-900 hover:bg-rose-100"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Reject Payout</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-900">
                    Confirm: Transition to {targetAction}
                  </span>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-800"
                  >
                    Cancel
                  </button>
                </div>

                {targetAction === "COMPLETED" && (
                  <div>
                    <label
                      htmlFor="payout-ref-input"
                      className="text-[10px] font-black uppercase text-zinc-600 block mb-1"
                    >
                      MoMo / Telco Reference Number *
                    </label>
                    <Input
                      id="payout-ref-input"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. MTN-892189412 or AIR-99210"
                      className="h-9 font-mono text-xs rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="payout-notes-input"
                    className="text-[10px] font-black uppercase text-zinc-600 block mb-1"
                  >
                    Operational Reason / Notes (min 5 chars) *
                  </label>
                  <textarea
                    id="payout-notes-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Provide mandatory compliance reason or disbursement notes..."
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[var(--admin-canopy,#075b36)]"
                  />
                </div>

                {validationError && (
                  <p className="text-xs font-bold text-rose-700">{validationError}</p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    disabled={isMutating}
                    className="h-8 text-xs font-bold"
                  >
                    Dismiss
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleActionConfirm}
                    disabled={isMutating}
                    className={cn(
                      "h-8 gap-1 rounded-lg text-xs font-bold text-white",
                      targetAction === "REJECTED"
                        ? "bg-rose-700 hover:bg-rose-800"
                        : "bg-[var(--admin-canopy-deep,#063b29)] hover:bg-[var(--admin-canopy,#075b36)]"
                    )}
                  >
                    {isMutating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Confirm {targetAction}</span>
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 text-center">
            <Info className="mx-auto h-4 w-4 text-zinc-400 mb-1" />
            <p className="font-medium">
              You have read-only viewing access. Payout processing authority requires <span className="font-bold">process_payouts</span> permission.
            </p>
          </div>
        )}
      </div>
    </AdminDetailSheet>
  );
}
