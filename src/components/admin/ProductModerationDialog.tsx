"use client";

import Image from "next/image";
import { AlertTriangle, CheckCircle2, CopyCheck, ImageIcon, ShieldAlert, Sparkles, Store, Tag, XCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  getProductModerationStatusLabel,
  type ProductModerationAction,
} from "@/services/product-moderation";
import type { AdminProductRecord } from "@/services/admin/products";

const STATUS_STYLES: Record<AdminProductRecord["status"], string> = {
  draft: "border-zinc-200 bg-zinc-100 text-zinc-700",
  pending_review: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  needs_changes: "border-orange-200 bg-orange-50 text-orange-700",
  published: "border-[#009E49]/20 bg-[#009E49]/10 text-[#009E49]",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  suspended: "border-red-200 bg-red-50 text-red-700",
};

interface ProductModerationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  product: AdminProductRecord | null;
  moderationNote: string;
  onModerationNoteChange: (value: string) => void;
  onSubmit: (action: ProductModerationAction) => void;
  isSubmitting: boolean;
}

export function ProductModerationDialog({
  isOpen,
  onOpenChange,
  product,
  moderationNote,
  onModerationNoteChange,
  onSubmit,
  isSubmitting,
}: ProductModerationDialogProps) {
  if (!product) return null;

  const hasSignals =
    (product.moderationFlags?.length ?? 0) > 0 ||
    (product.duplicateWarnings?.length ?? 0) > 0 ||
    (product.categorySuggestions?.length ?? 0) > 0 ||
    (product.imageSafetyWarnings?.length ?? 0) > 0 ||
    product.riskScore != null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-3xl border border-white/70 bg-white/95 p-0 shadow-2xl shadow-zinc-950/20 backdrop-blur-xl">
        <DialogHeader className="border-b border-zinc-100 px-6 py-5">
          <DialogTitle className="text-xl font-black text-zinc-950">Product Review</DialogTitle>
          <DialogDescription className="text-sm font-medium text-zinc-500">
            Review seller-submitted product details and moderation notes before updating the backend-controlled status.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5 border-b border-zinc-100 px-6 py-5 lg:border-b-0 lg:border-r">
            <div className="flex gap-4">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.name} fill sizes="112px" unoptimized className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-zinc-400" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", STATUS_STYLES[product.status])}>
                    {getProductModerationStatusLabel(product.status)}
                  </span>
                  {product.flags > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-700">
                      <ShieldAlert className="h-3 w-3" /> {product.flags} Flags
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-xl font-black text-zinc-950">{product.name}</h3>
                <div className="mt-2 space-y-1 text-xs font-medium text-zinc-500">
                  <p className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> {product.sellerStore}</p>
                  <p className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> {product.categoryName} / {product.subcategoryName}</p>
                  <p>{product.id}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard label="Price" value={`K${product.price.toLocaleString()}`} />
              <InfoCard label="Stock" value={`${product.stock} units`} />
              <InfoCard label="Submitted" value={formatDate(product.submittedAt ?? product.updatedAt)} />
            </div>

            {product.moderationNotes ? (
              <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-orange-700">Latest Moderation Note</p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-700">{product.moderationNotes}</p>
              </div>
            ) : null}

            {hasSignals ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                  <Sparkles className="h-3.5 w-3.5" />
                  Optional Backend Signals
                </p>
                <div className="mt-3 space-y-2 text-sm text-zinc-700">
                  {product.riskScore != null ? <SignalRow label="Risk Score" value={String(product.riskScore)} /> : null}
                  {(product.moderationFlags?.length ?? 0) > 0 ? <SignalRow label="Moderation Flags" value={product.moderationFlags!.join(", ")} /> : null}
                  {(product.duplicateWarnings?.length ?? 0) > 0 ? <SignalRow label="Duplicate Warnings" value={product.duplicateWarnings!.join(", ")} /> : null}
                  {(product.categorySuggestions?.length ?? 0) > 0 ? <SignalRow label="Category Suggestions" value={product.categorySuggestions!.join(", ")} /> : null}
                  {(product.imageSafetyWarnings?.length ?? 0) > 0 ? <SignalRow label="Image Safety" value={product.imageSafetyWarnings!.join(", ")} /> : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-5 px-6 py-5">
            <div>
              <p className="text-sm font-black text-zinc-950">Moderator Notes</p>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                Keep this flexible. The backend will own the final moderation note contract.
              </p>
            </div>

            <Textarea
              value={moderationNote}
              onChange={(event) => onModerationNoteChange(event.target.value)}
              placeholder="Write the reason for approval, rejection, or requested changes..."
              className="min-h-40 rounded-2xl border-zinc-200 bg-zinc-50 px-4 py-3 text-sm shadow-inner focus-visible:ring-[#009E49]"
            />

            {product.status === "pending_review" ? (
              <DialogFooter className="gap-3 sm:flex-col" showCloseButton>
                <Button
                  onClick={() => onSubmit("approve")}
                  disabled={isSubmitting}
                  className="h-11 w-full rounded-xl bg-[#009E49] font-bold text-white hover:bg-[#00853d]"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button
                  onClick={() => onSubmit("request_changes")}
                  disabled={isSubmitting}
                  variant="outline"
                  className="h-11 w-full rounded-xl border-orange-200 font-bold text-orange-700 hover:bg-orange-50"
                >
                  <CopyCheck className="mr-2 h-4 w-4" /> Request Changes
                </Button>
                <Button
                  onClick={() => onSubmit("reject")}
                  disabled={isSubmitting}
                  variant="outline"
                  className="h-11 w-full rounded-xl border-rose-200 font-bold text-rose-700 hover:bg-rose-50"
                >
                  <XCircle className="mr-2 h-4 w-4" /> Reject
                </Button>
              </DialogFooter>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm font-medium text-zinc-600">
                This product is not currently awaiting review.
              </div>
            )}

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs font-medium leading-relaxed text-blue-800">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Backend Source Of Truth</p>
              <p className="mt-2">
                This UI is intentionally prepared for backend-driven moderation. Optional AI-assist fields are display-only when present and no client-side moderation logic is executed here.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-black text-zinc-950">{value}</p>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white bg-white/80 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-800">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZM", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
