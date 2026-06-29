import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProductStatus = "draft" | "pending_review";

export const ToggleSwitch = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative h-6 w-11 shrink-0 rounded-full border-2 transition-colors ${
      active ? "border-[#009E49] bg-[#009E49]" : "border-zinc-200 bg-zinc-100"
    }`}
  >
    <span className="sr-only">Toggle setting</span>
    <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${active ? "translate-x-5" : "translate-x-0.5"}`} />
  </button>
);

export const GlassSection = ({
  children,
  icon,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) => (
  <section className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-zinc-900/3 backdrop-blur-2xl md:p-6">
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-linear-to-br from-white to-emerald-50 text-[#009E49] shadow-inner">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-black uppercase tracking-wider text-zinc-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs font-semibold leading-relaxed text-zinc-500">{subtitle}</p> : null}
      </div>
    </div>
    {children}
  </section>
);

export const fieldError = (msg?: string) =>
  msg ? (
    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-600">
      <AlertCircle className="h-3.5 w-3.5" />
      {msg}
    </p>
  ) : null;

export const inputErrorClass = (err?: string) =>
  err ? "border-rose-300 focus-visible:ring-rose-500" : "border-zinc-200 focus-visible:ring-[#009E49]";

export function InputField({ icon, label, input, error }: { icon: React.ReactNode; label: string; input: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</label>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-zinc-400">{icon}</span>
        {input}
      </div>
      {fieldError(error)}
    </div>
  );
}

export function ProductListingStudioHeader({
  backHref,
  isEditMode,
  isSubmitting,
  revealDetails,
  onSave,
  canSubmitForReview = true,
  submitLabel = "Submit for Review",
}: {
  backHref: string;
  isEditMode: boolean;
  isSubmitting: boolean;
  revealDetails: boolean;
  onSave: (event: React.MouseEvent, status: ProductStatus) => void;
  canSubmitForReview?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="sticky top-18 z-20 mb-5 -mx-4 flex items-center justify-between border-b border-white/60 bg-[#f4fbf6]/85 px-4 py-4 backdrop-blur-2xl md:top-0 md:mx-0 md:border-none md:bg-transparent md:px-0">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button aria-label={isEditMode ? "Go back to product preview" : "Go back to products"} type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-white/70 bg-white/80 text-zinc-600 shadow-sm hover:bg-white">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#009E49]">{isEditMode ? "Product Edit Studio" : "Product Launch Studio"}</p>
          <h1 className="text-xl font-black leading-tight tracking-tight text-zinc-950 md:text-2xl">{isEditMode ? "Edit Product" : "Add Product"}</h1>
        </div>
      </div>
      <div className="hidden items-center gap-2 md:flex">
        <Button type="button" variant="outline" onClick={(event) => onSave(event, "draft")} disabled={isSubmitting} className="h-10 rounded-xl border-white/70 bg-white/80 px-4 font-bold text-zinc-700 shadow-sm hover:bg-white">
          {isEditMode ? "Save Changes" : "Save Draft"}
        </Button>
        {revealDetails && canSubmitForReview ? (
          <Button type="submit" disabled={isSubmitting || !canSubmitForReview} className="h-10 rounded-xl bg-[#009E49] px-5 font-bold text-white shadow-[0_10px_25px_rgba(0,158,73,0.22)] hover:bg-[#00853d] disabled:bg-zinc-300">
            {isSubmitting ? "Submitting..." : submitLabel}
          </Button>
        ) : null}
        {revealDetails && !canSubmitForReview ? (
          <p className="max-w-56 text-right text-xs font-bold leading-5 text-amber-700">
            Draft-only mode until seller approval unlocks review submission.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ProductListingMobileActions({
  isEditMode,
  isSubmitting,
  revealDetails,
  onSave,
  canSubmitForReview = true,
  submitLabel = "Submit for Review",
}: {
  isEditMode: boolean;
  isSubmitting: boolean;
  revealDetails: boolean;
  onSave: (event: React.MouseEvent, status: ProductStatus) => void;
  canSubmitForReview?: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="fixed inset-x-3 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-white/70 bg-white/92 p-3 shadow-[0_-10px_28px_rgba(15,23,42,0.12)] backdrop-blur-2xl md:hidden">
      {!canSubmitForReview ? (
        <p className="mb-3 text-center text-xs font-bold leading-5 text-amber-700">
          Draft-only mode until seller approval unlocks review submission.
        </p>
      ) : null}
      <div className={`grid gap-3 ${canSubmitForReview ? "grid-cols-2" : "grid-cols-1"}`}>
        <Button type="button" variant="outline" onClick={(event) => onSave(event, "draft")} disabled={isSubmitting} className="h-12 rounded-xl border-zinc-200 bg-white font-bold text-zinc-700">
          {isEditMode ? "Save" : "Save Draft"}
        </Button>
        {canSubmitForReview ? (
          <Button type="button" onClick={(event) => onSave(event, "pending_review")} disabled={isSubmitting || !revealDetails || !canSubmitForReview} className="h-12 rounded-xl bg-[#009E49] font-extrabold text-white shadow-[0_4px_15px_rgba(0,158,73,0.3)] transition-all active:scale-95 hover:bg-[#00853d] disabled:bg-zinc-300 disabled:shadow-none">
            {isSubmitting ? "Submitting..." : submitLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
