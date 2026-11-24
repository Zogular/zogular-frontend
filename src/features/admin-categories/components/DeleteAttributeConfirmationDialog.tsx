"use client";

/**
 * @file DeleteAttributeConfirmationDialog.tsx
 * @module features/admin-categories/components
 * @description
 * Accessible confirmation dialog for deleting category attributes.
 * Uses the project's shared Radix Dialog primitive (src/components/ui/dialog.tsx),
 * which provides real focus containment (FocusScope), focus restoration to the
 * opener on close, and native Escape handling — no custom focus trap or fixed
 * div overlay needed.
 */

import React from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CategoryAttributeRecord } from "../types";

export interface DeleteAttributeConfirmationDialogProps {
  isOpen: boolean;
  attribute: CategoryAttributeRecord | null;
  onClose: () => void;
  onConfirm: (attribute: CategoryAttributeRecord) => Promise<void> | void;
  isDeleting?: boolean;
}

export function DeleteAttributeConfirmationDialog({
  isOpen,
  attribute,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteAttributeConfirmationDialogProps) {
  // Radix Dialog handles focus containment, focus restoration, and Escape via
  // onOpenChange. We suppress its default close when a deletion is in progress.
  const handleOpenChange = (open: boolean) => {
    if (!open && !isDeleting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen && Boolean(attribute)} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isDeleting}
        className="max-w-md rounded-[2rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[#fff8ec] text-stone-900"
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shadow-xs ring-1 ring-rose-300">
              <Trash2 className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-black tracking-tight text-[var(--admin-canopy-deep)]">
                Delete Attribute?
              </DialogTitle>
              <DialogDescription className="text-[11px] font-medium text-[var(--admin-ink-soft)]">
                Product field schema removal
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Attribute summary card */}
        {attribute && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-stone-200 bg-white/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-stone-900">{attribute.name}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 font-mono text-[10px] font-bold text-stone-600">
                  {attribute.slug}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-stone-500">
                <span>Type: {attribute.type}</span>
                {attribute.isRequired && (
                  <>
                    <span>•</span>
                    <span className="text-rose-600 font-bold">Required</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 text-amber-700 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold">Important Data Notice</p>
                  <p className="mt-1">
                    If any existing products already use this field, the server will reject this
                    deletion (409 Conflict). Archived products in this category may lose direct
                    schema reference for this field.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={onClose}
            className="min-h-11 rounded-xl text-xs font-bold"
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isDeleting || !attribute}
            onClick={() => attribute && void onConfirm(attribute)}
            className="min-h-11 rounded-xl bg-rose-600 px-5 text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-rose-700 shadow-sm"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              "Confirm Deletion"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
