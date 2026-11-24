import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SellerReviewSafeError } from "../types/seller-review.types";

const QUEUE_LABELS = ["Account and store", "Signed documents", "Payout details", "Decision history"] as const;

export function SellerReviewLoadingState() {
  return (
    <section data-testid="seller-review-loading" aria-busy="true" aria-label="Loading seller review" className="mx-auto max-w-[96rem] rounded-3xl border border-[color:rgba(184,135,70,0.32)] bg-[var(--admin-canopy-deep)] p-5 text-[var(--admin-surface-cream)] shadow-[0_20px_44px_rgba(6,59,41,0.16)] sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--admin-ember)]">Seller review</p>
      <h1 className="mt-2 text-xl font-semibold">Preparing the application</h1>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[color:rgba(255,248,236,0.14)]"><div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--admin-ember)] motion-reduce:animate-none" /></div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {QUEUE_LABELS.map((label) => <li key={label} className="rounded-xl border border-[color:rgba(255,248,236,0.12)] bg-[color:rgba(255,248,236,0.06)] px-3 py-3 text-sm text-[color:rgba(255,248,236,0.75)]">{label}</li>)}
      </ul>
    </section>
  );
}

export function SellerReviewErrorState({ error, onRetry }: { error: SellerReviewSafeError; onRetry: () => void }) {
  const canRetry = error.kind === "timeout" || error.kind === "malformed" || error.kind === "unavailable";
  const Icon = error.kind === "forbidden" ? ShieldX : AlertTriangle;
  return (
    <section data-testid={`seller-review-error-${error.kind}`} className="mx-auto max-w-3xl rounded-3xl border border-[color:rgba(184,59,50,0.25)] bg-[var(--admin-surface-cream)] p-6 shadow-[0_18px_40px_rgba(6,59,41,0.08)] sm:p-8">
      <div className="flex size-11 items-center justify-center rounded-xl bg-[color:rgba(184,59,50,0.09)] text-[var(--admin-escalation)]"><Icon className="size-5" /></div>
      <h1 className="mt-4 text-xl font-semibold text-[var(--admin-ink)]">Seller review unavailable</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--admin-ink-soft)]">{error.message}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {canRetry ? <Button type="button" onClick={onRetry} className="min-h-11 bg-[var(--admin-canopy)] hover:bg-[var(--admin-canopy-deep)]"><RefreshCw />Try again</Button> : null}
        {error.kind === "unauthenticated" ? <Button asChild className="min-h-11 bg-[var(--admin-canopy)] hover:bg-[var(--admin-canopy-deep)]"><Link href="/admin/login" prefetch={false}>Sign in</Link></Button> : null}
        <Button asChild variant="outline" className="min-h-11 border-[color:rgba(184,135,70,0.3)] bg-[var(--admin-surface-mist)]"><Link href="/admin/sellers" prefetch={false}><ArrowLeft />Seller applications</Link></Button>
      </div>
    </section>
  );
}

export function SellerReviewInlineNotice({ error, onRefresh }: { error: SellerReviewSafeError; onRefresh?: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-[color:rgba(184,59,50,0.28)] bg-[color:rgba(184,59,50,0.07)] p-4 text-[var(--admin-escalation)] sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium leading-5">{error.message}</p>
      {onRefresh ? <Button type="button" variant="outline" onClick={onRefresh} className="min-h-11 shrink-0 border-[color:rgba(184,59,50,0.3)] bg-[var(--admin-surface-cream)] text-[var(--admin-escalation)]"><RefreshCw />Refresh</Button> : null}
    </div>
  );
}
