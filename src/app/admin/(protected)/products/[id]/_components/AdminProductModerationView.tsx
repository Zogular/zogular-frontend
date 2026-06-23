"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SellerProductListing } from "@/services/seller-catalog";
import {
  SellerProductGallery,
  SellerProductInfoGrid,
  SellerProductSpecs,
  SellerProductStatusBadge,
  SellerProductStatusBanner,
} from "@/app/seller/products/[id]/_components/seller-product-ui";
import { type ProductModerationAction } from "@/services/product-moderation";

const ACTION_COPY: Record<
  ProductModerationAction,
  {
    title: string;
    description: string;
    confirmLabel: string;
    confirmClassName: string;
    noteLabel?: string;
    notePlaceholder?: string;
    requireNote?: boolean;
  }
> = {
  approve: {
    title: "Approve Product",
    description: "This product will be published immediately to the marketplace.",
    confirmLabel: "Approve Product",
    confirmClassName: "bg-[#009E49] text-white hover:bg-[#00853d]",
    noteLabel: "Approval Notes (Optional)",
    notePlaceholder: "Add any internal notes about this approval...",
  },
  request_changes: {
    title: "Request Changes",
    description: "The product will be sent back to the seller. They must make the requested changes before it can be approved.",
    confirmLabel: "Send Request",
    confirmClassName: "bg-orange-600 text-white hover:bg-orange-700",
    noteLabel: "Required Changes",
    notePlaceholder: "Explain exactly what the seller must update (e.g. better images, clear description)...",
    requireNote: true,
  },
  reject: {
    title: "Reject Product",
    description: "This product violates marketplace rules and will be permanently rejected.",
    confirmLabel: "Reject Product",
    confirmClassName: "bg-rose-600 text-white hover:bg-rose-700",
    noteLabel: "Rejection Reason",
    notePlaceholder: "State the reason for rejection clearly...",
    requireNote: true,
  },
};

export function ProductReviewActionDialog({
  open,
  onOpenChange,
  action,
  product,
  initialNote,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ProductModerationAction | null;
  product: SellerProductListing | null;
  initialNote: string;
  submitting: boolean;
  onConfirm: (action: ProductModerationAction, note: string) => void;
}) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote(initialNote);
  }, [open, initialNote]);

  const copy = useMemo(() => (action ? ACTION_COPY[action] : null), [action]);

  if (!copy || !product) return null;

  function handleConfirm() {
    if (copy!.requireNote && note.trim().length < 5) return;
    onConfirm(action!, note.trim());
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setNote("");
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl rounded-[1.9rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] p-0 shadow-[0_28px_80px_rgba(15,23,42,0.22)] backdrop-blur-2xl">
        <DialogHeader className="border-b border-zinc-100 bg-zinc-950 px-6 py-5 text-white">
          <DialogTitle className="text-xl font-black text-white">{copy.title}</DialogTitle>
          <DialogDescription className="text-sm font-semibold text-zinc-400">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-[1.45rem] border border-emerald-200/60 bg-[linear-gradient(135deg,rgba(236,253,245,0.95),rgba(255,255,255,0.85))] p-4">
            <p className="text-lg font-black tracking-[-0.03em] text-zinc-950">
              {product.title}
            </p>
            <p className="mt-1 text-sm font-bold text-zinc-500">{product.seller.name}</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              {copy.noteLabel}
            </label>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={copy.notePlaceholder}
              className="min-h-28 rounded-[1.2rem] border-zinc-200 bg-white text-sm font-medium focus-visible:ring-[#009E49]"
            />
          </div>
        </div>

        <DialogFooter className="gap-3 border-t border-zinc-100 px-6 py-5 sm:justify-between">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="rounded-xl border-zinc-200 font-black">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting || (copy.requireNote && note.trim().length < 5)}
            className={`rounded-xl font-black ${copy.confirmClassName}`}
          >
            {copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdminProductActionBar({
  product,
  onSubmit,
  isSubmitting,
  horizontal,
}: {
  product: SellerProductListing;
  onSubmit: (action: ProductModerationAction) => void;
  isSubmitting: boolean;
  horizontal?: boolean;
}) {
  if (product.status !== "pending_review") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-center text-sm font-bold text-zinc-500">
        Product not awaiting review
      </div>
    );
  }

  const approveBtn = (
    <Button
      onClick={() => onSubmit("approve")}
      disabled={isSubmitting}
      className={`h-11 rounded-xl border border-transparent bg-[#009E49] px-6 font-bold text-white shadow-sm transition-all hover:bg-[#00853d] hover:shadow-md ${!horizontal && "w-full"}`}
    >
      Approve Product
    </Button>
  );

  const requestChangesBtn = (
    <Button
      onClick={() => onSubmit("request_changes")}
      disabled={isSubmitting}
      variant="outline"
      className={`h-11 rounded-xl border-orange-200 bg-white px-5 font-bold text-orange-700 shadow-sm transition-all hover:bg-orange-50 hover:shadow-md ${!horizontal && "w-full"}`}
    >
      Request Changes
    </Button>
  );

  const rejectBtn = (
    <Button
      onClick={() => onSubmit("reject")}
      disabled={isSubmitting}
      variant="outline"
      className={`h-11 rounded-xl border-rose-200 bg-white px-5 font-bold text-rose-700 shadow-sm transition-all hover:bg-rose-50 hover:shadow-md ${!horizontal && "w-full"}`}
    >
      Reject
    </Button>
  );

  if (horizontal) {
    return (
      <div className="flex flex-row flex-nowrap items-center gap-3">
        {approveBtn}
        {requestChangesBtn}
        {rejectBtn}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      {approveBtn}
      <div className="grid grid-cols-2 gap-3">
        {requestChangesBtn}
        {rejectBtn}
      </div>
    </div>
  );
}

export function AdminProductModerationView({
  product,
  moderationNote,
  onModerationNoteChange,
  onSubmit,
  isSubmitting,
}: {
  product: SellerProductListing;
  moderationNote: string;
  onModerationNoteChange: (value: string) => void;
  onSubmit: (action: ProductModerationAction, note: string) => void;
  isSubmitting: boolean;
}) {
  const [actionDialog, setActionDialog] = useState<{ isOpen: boolean; action: ProductModerationAction | null }>({
    isOpen: false,
    action: null,
  });

  const handleActionClick = (action: ProductModerationAction) => {
    setActionDialog({ isOpen: true, action });
  };

  const handleDialogConfirm = (action: ProductModerationAction, note: string) => {
    onSubmit(action, note);
    setActionDialog({ isOpen: false, action: null });
  };

  return (
    <div className="mx-auto min-w-0 max-w-[1400px] space-y-6 pb-28 md:pb-24">
      <ProductReviewActionDialog
        open={actionDialog.isOpen}
        onOpenChange={(isOpen) => setActionDialog((prev) => ({ ...prev, isOpen }))}
        action={actionDialog.action}
        product={product}
        initialNote={moderationNote}
        submitting={isSubmitting}
        onConfirm={handleDialogConfirm}
      />

      {/* 1. Header Area */}
      <div className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-[#f4fbf6]/90 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-2xl md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <Link href="/admin/products">
            <Button aria-label="Back to products" type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-2xl border border-white/70 bg-white/80 shadow-sm transition-all hover:bg-white hover:shadow-md md:h-10 md:w-10">
              <ArrowLeft className="h-4 w-4 md:h-4 md:w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#009E49] md:text-[10px]">Product Moderation</p>
              <SellerProductStatusBadge status={product.status} />
            </div>
            <h1 className="wrap-break-word pr-2 text-xl font-black tracking-tight text-zinc-950 md:text-3xl">{product.title}</h1>
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden shrink-0 lg:block">
          <AdminProductActionBar product={product} onSubmit={handleActionClick} isSubmitting={isSubmitting} horizontal />
        </div>
      </div>

      <div className="hidden md:block">
        <SellerProductStatusBanner product={product} />
      </div>

      {/* 2. Main Content Grid */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[400px_minmax(0,1fr)_340px] xl:grid-cols-[440px_minmax(0,1fr)_340px]">
        
        {/* Left Column: Media */}
        <div className="min-w-0 space-y-6 lg:sticky lg:top-0 lg:self-start">
          <div className="-mx-4 md:mx-0">
            <SellerProductGallery product={product} />
          </div>
          <div className="md:hidden">
            <SellerProductStatusBanner product={product} />
          </div>
        </div>

        {/* Center Column: Description & Specs */}
        <div className="min-w-0 space-y-6">
          <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-8">
            <h2 className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Description</h2>
            <div className="prose prose-sm prose-zinc max-w-none font-medium leading-relaxed text-zinc-700">
              {product.description ? (
                <p>{product.description}</p>
              ) : (
                <p className="italic text-zinc-400">No description provided.</p>
              )}
            </div>
          </section>
          
          <SellerProductSpecs product={product} />
        </div>

        {/* Right Column: Meta & Moderation Notes */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-0 lg:self-start">
          {/* Tablet Actions */}
          <div className="hidden md:block lg:hidden">
            <AdminProductActionBar product={product} onSubmit={handleActionClick} isSubmitting={isSubmitting} horizontal />
          </div>

          {product.status === "pending_review" ? (
            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-6">
              <h2 className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Moderator Notes</h2>
              <Textarea
                value={moderationNote}
                onChange={(event) => onModerationNoteChange(event.target.value)}
                placeholder="Reason for approval, rejection, or changes..."
                className="min-h-[120px] w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium shadow-sm transition-shadow focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2"
              />
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-[11px] font-semibold leading-relaxed text-blue-800 shadow-sm">
                <p className="flex items-center gap-1.5 font-bold"><AlertTriangle className="h-3 w-3 text-blue-600" /> Backend Validation</p>
                <p className="mt-1 text-blue-700/80">
                  Notes will be attached to the final moderation action when submitted to the backend.
                </p>
              </div>
            </section>
          ) : product.moderation?.moderationNotes ? (
            <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:p-6">
              <h2 className="mb-4 text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Moderator Notes</h2>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-medium leading-relaxed text-zinc-700">
                {product.moderation.moderationNotes}
              </div>
            </section>
          ) : null}

          <SellerProductInfoGrid product={product} />
        </aside>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      {product.status === "pending_review" && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200/50 bg-white/95 p-4 pb-safe shadow-[0_-15px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl md:hidden">
          <AdminProductActionBar product={product} onSubmit={handleActionClick} isSubmitting={isSubmitting} />
        </div>
      )}
    </div>
  );
}
