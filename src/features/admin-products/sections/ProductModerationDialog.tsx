/**
 * @file ProductModerationDialog.tsx
 * @module features/admin-products/sections
 * @description
 * Administrative confirmation modal for single and bulk product rejection or changes request.
 * Displays predefined reason templates (Image Quality, Misleading Title, Policy Violation, etc.),
 * populates standard explanation text, allows custom note editing, and submits with full audit tracking.
 * Styled using the tactile warm admin palette.
 */

import React from "react";
import { AlertCircle, AlertTriangle, Check, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MODERATION_REASON_TEMPLATES } from "../lib/product-moderation.utils";
import type { ProductModerationDialogState } from "../types/admin-product.types";

export interface ProductModerationDialogProps {
  dialogState: ProductModerationDialogState;
  onClose: () => void;
  onReasonCodeChange: (code: string) => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function ProductModerationDialog({
  dialogState,
  onClose,
  onReasonCodeChange,
  onNoteChange,
  onSubmit,
  isSubmitting,
}: ProductModerationDialogProps) {
  const { isOpen, action, productIds, targetTitle, isBulk, reasonCode, note } =
    dialogState;

  const isRequestChanges = action === "request_changes";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto max-w-xl border-[color-mix(in_srgb,var(--admin-copper-muted)_45%,transparent)] bg-[var(--admin-surface-cream)] p-6 shadow-[0_24px_50px_rgb(6_59_41_/_18%)] sm:max-w-2xl"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isRequestChanges ? (
              <div className="flex size-9 items-center justify-center rounded-md bg-amber-100 text-amber-800">
                <AlertTriangle className="size-5" />
              </div>
            ) : (
              <div className="flex size-9 items-center justify-center rounded-md bg-rose-100 text-rose-800">
                <XCircle className="size-5" />
              </div>
            )}
            <div>
              <DialogTitle className="text-base font-black text-[var(--admin-ink)] sm:text-lg">
                {isRequestChanges ? "Request Product Changes" : "Reject Product Listing"}
              </DialogTitle>
              <DialogDescription className="text-xs font-semibold text-[var(--admin-ink-soft)]">
                {isBulk
                  ? `Applying moderation decision to ${productIds.length} selected pending products.`
                  : targetTitle
                    ? `Review decision for "${targetTitle}".`
                    : "Review decision for product."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Reason Template Selector */}
          <div>
            <label className="text-[11px] font-black uppercase text-[var(--admin-ink-soft)]">
              Select Reason Template
            </label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MODERATION_REASON_TEMPLATES.map((template) => {
                const isSelected = reasonCode === template.code;
                return (
                  <button
                    key={template.code}
                    type="button"
                    onClick={() => onReasonCodeChange(template.code)}
                    className={`flex flex-col items-start rounded-md border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-[var(--admin-canopy)] bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)] ring-1 ring-[var(--admin-canopy)]"
                        : "border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-mist)] hover:bg-white"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-black text-[var(--admin-ink)]">
                        {template.label}
                      </span>
                      {isSelected && (
                        <Check className="size-3.5 text-[var(--admin-canopy)]" />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] font-semibold text-[var(--admin-ink-soft)] line-clamp-2">
                      {template.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Note Input */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="moderation-note"
                className="text-[11px] font-black uppercase text-[var(--admin-ink-soft)]"
              >
                Feedback & Instructions for Seller
              </label>
              <span className="text-[10px] font-bold text-[var(--admin-ink-soft)]">
                Visible to seller
              </span>
            </div>
            <Textarea
              id="moderation-note"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={4}
              placeholder="Explain clearly what changes are needed or why this listing cannot be published..."
              className="mt-1.5 rounded-md border-[color-mix(in_srgb,var(--admin-copper-muted)_45%,transparent)] bg-white text-xs font-semibold text-[var(--admin-ink)] placeholder:text-[var(--admin-ink-soft)] focus-visible:ring-[var(--admin-canopy)]"
            />
          </div>

          {/* Informational Guidance Alert */}
          <div className="flex items-start gap-2.5 rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-mist)] p-3 text-[11px] font-semibold text-[var(--admin-ink)]">
            <AlertCircle className="size-4 shrink-0 text-[var(--admin-copper-muted)] mt-0.5" />
            <p>
              {isRequestChanges
                ? "The product status will change to Needs Changes. The vendor will be notified and given the opportunity to edit attributes and resubmit for review."
                : "The product will be rejected and removed from review. This action is permanently audited under your administrator identity."}
            </p>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onClose}
            className="border-[color-mix(in_srgb,var(--admin-copper-muted)_45%,transparent)] bg-[var(--admin-surface-mist)] text-xs font-bold text-[var(--admin-ink)]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || !note.trim()}
            onClick={onSubmit}
            className={`text-xs font-black text-white ${
              isRequestChanges
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-[var(--admin-ember)] hover:bg-rose-800"
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : isRequestChanges ? (
              <span>Send Changes Request</span>
            ) : (
              <span>Confirm Rejection</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
