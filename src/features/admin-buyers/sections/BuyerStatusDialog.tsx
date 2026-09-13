"use client";

/**
 * @file BuyerStatusDialog.tsx
 * @module features/admin-buyers/sections
 * @description
 * Administrative confirmation modal for buyer status mutation (activate/deactivate).
 * Captures required audit reason code and justification note with optimistic status updates and error handling,
 * styled with the Zogular warm admin aesthetic palette.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { adminBuyersApi } from "@/services/admin/buyers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getBuyerSafeError } from "../lib/buyer-list-state";
import type { BuyerStatusDialogState } from "../types/admin-buyer.types";

export interface BuyerStatusDialogProps {
  dialogState: BuyerStatusDialogState;
  onClose: () => void;
  onSuccess: () => void;
}

export function BuyerStatusDialog({
  dialogState,
  onClose,
  onSuccess,
}: BuyerStatusDialogProps) {
  const [reason, setReason] = useState("");
  const [reasonCode, setReasonCode] = useState("ADMIN_CORRECTION");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (payload: { id: string; isActive: boolean; reason: string; reasonCode: string }) => {
      return await adminBuyersApi.toggleBuyerStatus(payload.id, {
        isActive: payload.isActive,
        reason: payload.reason,
        reasonCode: payload.reasonCode,
      });
    },
    onSuccess: () => {
      toast.success(
        dialogState.nextStatus
          ? "Customer account reactivated successfully."
          : "Customer account deactivated successfully.",
      );
      onSuccess();
      onClose();
    },
    onError: (err) => {
      const safeError = getBuyerSafeError(err);
      setError(safeError.message);
    },
  });

  const { isOpen, buyer, nextStatus } = dialogState;
  if (!buyer) return null;

  const isSubmitting = mutation.isPending;

  function handleSubmit() {
    if (reason.trim().length < 5) {
      setError("Please provide a reason with at least 5 characters.");
      return;
    }
    setError(null);
    mutation.mutate({
      id: buyer!.id,
      isActive: nextStatus,
      reason: reason.trim(),
      reasonCode,
    });
  }

  const fullName = [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") || "Customer";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] p-0 shadow-2xl">
        <DialogHeader className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_25%,transparent)] bg-[var(--admin-canopy-deep)] px-6 py-5 text-[var(--admin-surface-cream)]">
          <DialogTitle className="text-lg font-black text-[var(--admin-surface-cream)]">
            {nextStatus ? "Reactivate Account" : "Deactivate Account"}
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-[var(--admin-surface-mist)]">
            {nextStatus
              ? `Confirm reactivating customer account for ${fullName}.`
              : `Confirm suspending customer account for ${fullName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--admin-escalation)_38%,transparent)] bg-[color-mix(in_srgb,var(--admin-escalation)_7%,var(--admin-surface-cream))] p-3 text-xs font-bold text-[var(--admin-escalation)]">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="status-reason-code" className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-ink-soft)]">
              Reason Code
            </label>
            <select
              id="status-reason-code"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="h-10 w-full rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_38%,transparent)] bg-[var(--admin-surface-mist)] px-3 text-xs font-bold text-[var(--admin-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)]"
            >
              <option value="POLICY_VIOLATION">Policy Violation</option>
              <option value="SUSPICIOUS_ACTIVITY">Suspicious Activity</option>
              <option value="CUSTOMER_REQUEST">Customer Request</option>
              <option value="ADMIN_CORRECTION">Admin Correction / Maintenance</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="status-reason-input" className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-ink-soft)]">
              Explanation / Reason (Required)
            </label>
            <Textarea
              id="status-reason-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Detail the operational reason for this account status change..."
              className="min-h-24 rounded-md border-[color-mix(in_srgb,var(--admin-copper-muted)_38%,transparent)] bg-[var(--admin-surface-mist)] text-xs font-medium text-[var(--admin-ink)] placeholder:text-[var(--admin-ink-soft)] focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)]"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] bg-[var(--admin-surface-mist)] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] text-xs font-bold text-[var(--admin-ink)] hover:bg-[var(--admin-surface-mist)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`rounded-md text-xs font-black ${
              nextStatus
                ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] hover:bg-[var(--admin-canopy)]"
                : "bg-rose-700 text-white hover:bg-rose-800"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="size-3.5 animate-spin" />
                Submitting...
              </span>
            ) : nextStatus ? (
              "Confirm Reactivation"
            ) : (
              "Confirm Deactivation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
