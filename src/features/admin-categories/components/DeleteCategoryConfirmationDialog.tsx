"use client";

/**
 * @file DeleteCategoryConfirmationDialog.tsx
 * @module features/admin-categories/components
 * @description
 * Sleek, tactile confirmation modal for category deletion with safety checks for
 * child subcategories and assigned products, adhering to Zogular admin design tokens.
 */

import React from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DeleteCategoryConfirmationDialogProps {
  isOpen: boolean;
  category: {
    id: string;
    name: string;
    _count?: {
      children?: number;
      products?: number;
    };
  } | null;
  onClose: () => void;
  onConfirm: (categoryId: string) => Promise<void> | void;
  isDeleting?: boolean;
}

export function DeleteCategoryConfirmationDialog({
  isOpen,
  category,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteCategoryConfirmationDialogProps) {
  if (!isOpen || !category) return null;

  const childCount = category._count?.children ?? 0;
  const productCount = category._count?.products ?? 0;
  const hasRelations = childCount > 0 || productCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm transition-opacity duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-category-dialog-title"
        className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[#fff8ec] text-stone-900 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] bg-[#fff8ec]/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shadow-xs ring-1 ring-rose-300">
              <Trash2 className="size-4" />
            </div>
            <div>
              <h2
                id="delete-category-dialog-title"
                className="text-base font-black tracking-tight text-[var(--admin-canopy-deep)]"
              >
                Delete Category?
              </h2>
              <p className="text-[11px] font-medium text-[var(--admin-ink-soft)]">
                Permanent taxonomy removal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex size-8 items-center justify-center rounded-xl bg-stone-200/70 text-stone-600 hover:bg-stone-300 transition-colors disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 p-6">
          <p className="text-xs leading-relaxed text-stone-700">
            Are you sure you want to delete{" "}
            <span className="font-bold text-stone-900">“{category.name}”</span>?
          </p>

          {/* Warning Banner */}
          <div className="rounded-xl border border-amber-300/80 bg-amber-50/80 p-3.5 text-xs text-amber-900">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 text-amber-700 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Deletion Precondition Warning</p>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Categories with subcategories or products cannot be deleted. Any existing subcategories or assigned catalog items must be migrated or removed beforehand.
                </p>
              </div>
            </div>
          </div>

          {/* Relation Snapshot */}
          <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-stone-200/90 bg-white/70 p-3">
            <div className="rounded-lg bg-stone-50 p-2 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Subcategories
              </span>
              <span
                className={`text-base font-black ${
                  childCount > 0 ? "text-rose-600" : "text-stone-700"
                }`}
              >
                {childCount}
              </span>
            </div>
            <div className="rounded-lg bg-stone-50 p-2 text-center">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Products
              </span>
              <span
                className={`text-base font-black ${
                  productCount > 0 ? "text-rose-600" : "text-stone-700"
                }`}
              >
                {productCount}
              </span>
            </div>
          </div>

          {hasRelations && (
            <p className="text-[11px] font-medium text-rose-700">
              Note: This node currently has linked dependencies. Server validation will block this request until relations are resolved.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-stone-200/80 bg-[#fff8ec]/70 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(category.id)}
            disabled={isDeleting}
            className="rounded-xl bg-rose-600 px-4 text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-rose-700 shadow-sm"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-1.5 size-3.5" />
                Delete Category
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
