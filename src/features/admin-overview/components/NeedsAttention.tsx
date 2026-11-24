import Link from "next/link";
import { ArrowRight, Clock3, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import theme from "@/components/admin/admin-theme.module.css";
import type { AdminIdentity } from "@/services/admin/session";
import {
  getNeedsAttentionItems,
  getSectionUnavailableCopy,
  QUEUE_PRESENTATION,
} from "@/features/admin-overview/lib/overview-presentation";
import type { AdminDashboardOverview } from "@/features/admin-overview/types/dashboard-overview";

const queueRowClassName =
  "group flex min-h-16 items-center gap-3 rounded-xl border border-[color:rgba(255,248,236,0.12)] bg-[color:rgba(255,248,236,0.07)] px-3 py-2.5 outline-none transition-[background-color,box-shadow,transform] motion-reduce:transform-none motion-reduce:transition-none";

export function NeedsAttention({
  overview,
  identity,
}: {
  overview: AdminDashboardOverview;
  identity: AdminIdentity;
}) {
  const items = getNeedsAttentionItems(overview, identity);
  const queueMetrics = QUEUE_PRESENTATION.map(
    (item) => overview.queues[item.key],
  );
  const hasAvailableQueue = queueMetrics.some(
    (metric) => metric.availability === "AVAILABLE",
  );
  const availabilityCopy = getSectionUnavailableCopy(
    overview.queues.availability,
    queueMetrics,
    "review queues",
  );

  return (
    <section
      aria-labelledby="needs-attention-heading"
      data-testid="needs-attention"
      className={cn(
        theme.darkAnchor,
        "h-full overflow-hidden rounded-2xl bg-[var(--admin-canopy-deep)] p-4 text-[var(--admin-surface-cream)] sm:p-5",
      )}
    >
      <div>
        <div
          className="mb-3 h-1 w-12 rounded-full bg-[var(--admin-ember)]"
          aria-hidden="true"
        />
        <h2
          id="needs-attention-heading"
          className="text-base font-semibold text-[var(--admin-surface-cream)]"
        >
          Needs attention
        </h2>
        <p className="mt-1 text-sm text-[color:rgba(255,248,236,0.68)]">
          The busiest available queues appear first.
        </p>
        {availabilityCopy ? (
          <p
            className="mt-2 text-xs font-medium leading-5 text-[color:rgba(255,248,236,0.72)]"
            data-testid="queues-availability"
          >
            {availabilityCopy}
          </p>
        ) : null}
      </div>

      {items.length > 0 ? (
        <ol className="mt-4 space-y-2">
          {items.map((item, index) => {
            const content = (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[color:rgba(255,248,236,0.16)] bg-[color:rgba(255,248,236,0.09)] text-xs font-semibold text-[var(--admin-surface-cream)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--admin-surface-cream)]">
                    {item.label}
                  </span>
                  <span className="block text-xs leading-5 text-[color:rgba(255,248,236,0.62)]">
                    {item.detail}
                  </span>
                  {item.oldestWaitingLabel ? (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[color:rgba(255,248,236,0.78)]">
                      <Clock3 className="size-3" aria-hidden="true" />
                      {item.oldestWaitingLabel}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 rounded-md border border-[color:rgba(217,106,31,0.55)] px-2 py-1 text-sm font-bold tabular-nums text-[var(--admin-surface-cream)]">
                  {item.count.toLocaleString("en-ZM")}
                </span>
                {item.href ? (
                  <ArrowRight
                    className="mr-1 size-4 shrink-0 text-[color:rgba(255,248,236,0.5)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-[color:rgba(255,248,236,0.68)]">
                    <LockKeyhole className="size-3.5" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">View restricted</span>
                  </span>
                )}
              </>
            );

            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      queueRowClassName,
                      "hover:-translate-y-px hover:bg-[color:rgba(255,248,236,0.11)] hover:shadow-[inset_0_1px_0_rgba(255,248,236,0.12)] focus-visible:ring-2 focus-visible:ring-[var(--admin-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canopy-deep)]",
                    )}
                    data-testid={`attention-${item.key}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    className={queueRowClassName}
                    data-testid={`attention-${item.key}`}
                    data-drill-through="restricted"
                  >
                    {content}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div
          className="mt-4 rounded-xl border border-[color:rgba(255,248,236,0.12)] bg-[color:rgba(255,248,236,0.07)] p-4"
          data-testid="needs-attention-empty"
        >
          <p className="text-sm font-medium text-[color:rgba(255,248,236,0.76)]">
            {hasAvailableQueue
              ? "No work is currently waiting in the available queues."
              : availabilityCopy ?? "Review queues are currently unavailable."}
          </p>
        </div>
      )}
    </section>
  );
}
