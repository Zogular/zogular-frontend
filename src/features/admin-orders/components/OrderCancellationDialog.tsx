/**
 * @file OrderCancellationDialog.tsx
 * @module features/admin-orders/components
 * @description
 * Tactical cancellation modal requiring a structured operational or customer reason,
 * optional contextual notes, and confirmation warning before releasing reserved
 * inventory and transitioning the order to CANCELLED.
 */

"use client";

import React, { useState } from "react";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CANCELLATION_REASON_LABELS,
  type OrderCancellationReason,
} from "../types";

export interface OrderCancellationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  onConfirm: (reason: OrderCancellationReason, notes?: string) => Promise<void>;
  isMutating: boolean;
}

const REASON_KEYS = Object.keys(
  CANCELLATION_REASON_LABELS
) as OrderCancellationReason[];

export function OrderCancellationDialog({
  open,
  onOpenChange,
  orderNumber,
  onConfirm,
  isMutating,
}: OrderCancellationDialogProps) {
  const [reason, setReason] = useState<OrderCancellationReason>("BUYER_REQUESTED");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = () => {
    setReason("BUYER_REQUESTED");
    setNotes("");
    setValidationError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!reason) {
      setValidationError("Please select a valid cancellation reason.");
      return;
    }
    setValidationError(null);
    try {
      await onConfirm(reason, notes.trim() ? notes.trim() : undefined);
      resetForm();
    } catch {
      // Error handling is managed by the caller/toast
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isMutating) {
          if (!nextOpen) {
            resetForm();
          }
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl sm:max-w-md">
        <DialogHeader className="gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <XCircle className="h-6 w-6" aria-hidden="true" />
          </div>
          <DialogTitle className="text-base font-black text-zinc-950">
            Cancel Order #{orderNumber}?
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-600">
            Select the official operational rationale for stopping fulfillment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Warning Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200/90 bg-rose-50/90 p-3 text-xs font-medium text-rose-900 shadow-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>
              Cancelling this order will release held inventory back to seller catalog and notify operations. This action cannot be reversed.
            </span>
          </div>

          {/* Cancellation Reason Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="cancellation-reason-select"
              className="block text-[11px] font-black uppercase tracking-wider text-zinc-700"
            >
              Cancellation Reason <span className="text-rose-600">*</span>
            </label>
            <select
              id="cancellation-reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value as OrderCancellationReason)}
              disabled={isMutating}
              className="h-10 w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-xs font-bold text-zinc-900 outline-none transition focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
            >
              {REASON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {CANCELLATION_REASON_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {/* Operational Notes / Remarks */}
          <div className="space-y-1.5">
            <label
              htmlFor="cancellation-notes"
              className="block text-[11px] font-black uppercase tracking-wider text-zinc-700"
            >
              Internal Notes / Context (Optional)
            </label>
            <textarea
              id="cancellation-notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isMutating}
              placeholder="e.g. Buyer called requesting cancellation due to change of address; rider notified."
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 p-2.5 text-xs font-medium text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-rose-500 focus:bg-white focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          {validationError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-bold text-rose-700">
              {validationError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isMutating}
            onClick={handleClose}
            className="h-10 rounded-xl border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
          >
            Keep Order
          </Button>
          <Button
            type="button"
            disabled={isMutating}
            onClick={handleConfirm}
            className="h-10 rounded-xl bg-rose-600 text-xs font-black text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
          >
            {isMutating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling Order...
              </>
            ) : (
              "Confirm Order Cancellation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
