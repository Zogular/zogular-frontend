import Link from "next/link";
import { Activity, AlertTriangle, CircleSlash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminOverviewSafeError } from "@/services/admin/dashboard";
import { cn } from "@/lib/utils";
import theme from "@/components/admin/admin-theme.module.css";

const LOADING_QUEUES = [
  "Seller reviews",
  "Product reviews",
  "Orders needing action",
  "Open support requests",
] as const;

const LOADING_SNAPSHOT = [
  "Active sellers",
  "Published products",
  "Customers",
  "Open orders",
] as const;

export function OverviewLoading() {
  return (
    <section
      className={cn(theme.tactileSurface, "overflow-hidden rounded-2xl bg-[var(--admin-surface-cream)]")}
      aria-labelledby="marketplace-activity-heading"
      aria-busy="true"
      data-testid="overview-loading"
    >
      <div className="flex items-start gap-3 border-b border-[color:rgba(184,135,70,0.24)] p-4 sm:items-center sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] shadow-[inset_0_1px_0_rgba(255,248,236,0.16)]">
          <Activity className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="marketplace-activity-heading" className="text-base font-semibold text-[var(--admin-ink)]">
            Marketplace activity board
          </h2>
          <p className="mt-0.5 text-sm text-[var(--admin-ink-soft)]">
            Loading current marketplace activity
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className={cn(theme.activityRail, "flex h-2 gap-1 rounded-full bg-[var(--admin-canvas-depth)] p-0.5")} aria-hidden="true">
          <span className="flex-1 rounded-full bg-[var(--admin-canopy)]" />
          <span className="flex-1 rounded-full bg-[var(--admin-ember)]" />
          <span className="flex-1 rounded-full bg-[var(--admin-escalation)]" />
          <span className="flex-1 rounded-full bg-[var(--admin-ink)]" />
          <span className={theme.activityCursor} data-testid="overview-activity-cursor" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <div className={cn(theme.darkAnchor, "rounded-xl bg-[var(--admin-canopy-deep)] p-3 sm:p-4")}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:rgba(255,248,236,0.6)]">
              Needs attention
            </p>
            <div className="mt-3 space-y-2">
              {LOADING_QUEUES.map((label, index) => (
                <div
                  key={label}
                  className="flex min-h-11 items-center gap-3 rounded-lg border border-[color:rgba(255,248,236,0.1)] bg-[color:rgba(255,248,236,0.06)] px-3"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      index === 0 && "bg-[var(--admin-ember)]",
                      index === 1 && "bg-[var(--admin-escalation)]",
                      index === 2 && "bg-[var(--admin-copper-muted)]",
                      index === 3 && "bg-[var(--admin-surface-cream)]",
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-[var(--admin-surface-cream)]">{label}</span>
                  <span className="ml-auto text-xs text-[color:rgba(255,248,236,0.56)]">Checking</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5" aria-label="Priority queues loading">
            {LOADING_QUEUES.map((label) => (
              <div key={label} className="min-h-28 rounded-xl border border-[color:rgba(184,135,70,0.22)] bg-[var(--admin-surface-mist)] p-3">
                <p className="text-xs font-semibold leading-4 text-[var(--admin-ink-soft)]">{label}</p>
                <p className="mt-5 text-sm font-semibold text-[var(--admin-canopy)]">Checking</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[color:rgba(184,135,70,0.22)] bg-[var(--admin-surface-mist)]">
          <p className="border-b border-[var(--admin-canvas-depth)] px-4 py-3 text-sm font-semibold text-[var(--admin-ink)]">
            Marketplace snapshot
          </p>
          <div className="grid grid-cols-2 bg-[var(--admin-canvas-depth)] p-px xl:grid-cols-4">
            {LOADING_SNAPSHOT.map((label, index) => (
              <div
                key={label}
                className={cn(
                  "min-h-20 bg-[var(--admin-surface-mist)] px-4 py-3",
                  index % 2 === 1 && "border-l border-[var(--admin-canvas-depth)]",
                  index > 1 && "border-t border-[var(--admin-canvas-depth)] xl:border-t-0",
                  index > 0 && "xl:border-l",
                )}
              >
                <p className="text-xs font-semibold text-[var(--admin-ink-soft)]">{label}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--admin-canopy)]">Checking</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function OverviewErrorState({
  error,
  onRetry,
}: {
  error: AdminOverviewSafeError;
  onRetry: () => void;
}) {
  const canRetry = error.kind !== "forbidden" && error.kind !== "unauthenticated";
  return (
    <section
      className={cn(theme.tactileSurface, "rounded-2xl border-[color:rgba(184,59,50,0.28)] bg-[var(--admin-surface-cream)] p-5")}
      aria-labelledby="overview-error-heading"
      data-testid="overview-error"
    >
      <div className="flex items-start gap-3">
        <CircleSlash2 className="mt-0.5 size-5 shrink-0 text-[var(--admin-escalation)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="overview-error-heading" className="text-sm font-semibold text-[var(--admin-ink)]">
            Overview unavailable
          </h2>
          <p className="mt-1 text-sm leading-6 text-[var(--admin-ink-soft)]">{error.message}</p>
          {canRetry ? (
            <Button
              type="button"
              variant="outline"
              className="mt-4 h-11 border-[color:rgba(184,59,50,0.35)] bg-[var(--admin-surface-mist)] px-4 text-[var(--admin-escalation)] hover:bg-[color:rgba(184,59,50,0.08)]"
              onClick={onRetry}
            >
              <RotateCcw /> Try again
            </Button>
          ) : null}
          {error.kind === "unauthenticated" ? (
            <Button
              asChild
              variant="outline"
              className="mt-4 h-11 border-[color:rgba(184,59,50,0.35)] bg-[var(--admin-surface-mist)] px-4 text-[var(--admin-escalation)] hover:bg-[color:rgba(184,59,50,0.08)]"
            >
              <Link href="/admin/login">Sign in</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function RefreshFailureBanner({
  error,
  onRetry,
}: {
  error: AdminOverviewSafeError;
  onRetry: () => void;
}) {
  const canRetry = error.kind !== "forbidden" && error.kind !== "unauthenticated";
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-[color:rgba(217,106,31,0.32)] bg-[var(--admin-surface-cream)] p-3 shadow-[inset_4px_0_0_var(--admin-ember)] sm:flex-row sm:items-center sm:justify-between"
      data-testid="overview-refresh-error"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--admin-escalation)]" aria-hidden="true" />
        <p className="text-sm text-[var(--admin-ink)]">
          {error.message} The last updated values remain visible.
        </p>
      </div>
      {canRetry ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 border-[color:rgba(217,106,31,0.36)] bg-[var(--admin-surface-mist)] px-4 text-[var(--admin-ink)] hover:bg-[var(--admin-canvas-depth)]"
          onClick={onRetry}
        >
          <RotateCcw /> Try again
        </Button>
      ) : null}
      {error.kind === "unauthenticated" ? (
        <Button
          asChild
          variant="outline"
          className="h-11 shrink-0 border-[color:rgba(217,106,31,0.36)] bg-[var(--admin-surface-mist)] px-4 text-[var(--admin-ink)] hover:bg-[var(--admin-canvas-depth)]"
        >
          <Link href="/admin/login">Sign in</Link>
        </Button>
      ) : null}
    </div>
  );
}

export function OverviewEmptyNotice() {
  return (
    <div className="rounded-xl border border-[color:rgba(7,91,54,0.2)] bg-[var(--admin-surface-mist)] px-4 py-3" data-testid="overview-empty">
      <p className="text-sm font-medium text-[var(--admin-ink)]">No marketplace activity is listed yet.</p>
    </div>
  );
}
