import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import theme from "@/components/admin/admin-theme.module.css";
import type { AdminIdentity } from "@/services/admin/session";
import {
  getNeedsAttentionItems,
  PRIORITY_PRESENTATION,
} from "@/features/admin-overview/lib/overview-presentation";
import type { AdminDashboardSummary } from "@/features/admin-overview/types/dashboard-summary";

export function NeedsAttention({
  summary,
  identity,
}: {
  summary: AdminDashboardSummary;
  identity: AdminIdentity;
}) {
  const items = getNeedsAttentionItems(summary, identity);
  const hasAvailablePriority = PRIORITY_PRESENTATION.some(
    (item) => summary.priorities[item.key].availability === "AVAILABLE",
  );

  return (
    <section
      aria-labelledby="needs-attention-heading"
      data-testid="needs-attention"
      className={cn(theme.darkAnchor, "h-full overflow-hidden rounded-2xl bg-[var(--admin-canopy-deep)] p-4 text-[var(--admin-surface-cream)] sm:p-5")}
    >
      <div>
        <div className="mb-3 h-1 w-12 rounded-full bg-[var(--admin-ember)]" aria-hidden="true" />
        <h2 id="needs-attention-heading" className="text-base font-semibold text-[var(--admin-surface-cream)]">
          Needs attention
        </h2>
        <p className="mt-1 text-sm text-[color:rgba(255,248,236,0.68)]">The busiest available queues appear first.</p>
      </div>

      {items.length > 0 ? (
        <ol className="mt-4 space-y-2">
          {items.map((item, index) => (
            <li key={item.key}>
              <Link
                href={item.href}
                prefetch={false}
                className="group flex min-h-14 items-center gap-3 rounded-xl border border-[color:rgba(255,248,236,0.12)] bg-[color:rgba(255,248,236,0.07)] px-3 py-2.5 outline-none transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:bg-[color:rgba(255,248,236,0.11)] hover:shadow-[inset_0_1px_0_rgba(255,248,236,0.12)] focus-visible:ring-2 focus-visible:ring-[var(--admin-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canopy-deep)] motion-reduce:transform-none motion-reduce:transition-none"
                data-testid={`attention-${item.key}`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-[color:rgba(255,248,236,0.16)] bg-[color:rgba(255,248,236,0.09)] text-xs font-semibold text-[var(--admin-surface-cream)]">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--admin-surface-cream)]">{item.label}</span>
                  <span className="block truncate text-xs text-[color:rgba(255,248,236,0.62)]">{item.detail}</span>
                </span>
                <span className="shrink-0 rounded-md border border-[color:rgba(217,106,31,0.55)] px-2 py-1 text-sm font-bold tabular-nums text-[var(--admin-surface-cream)]">
                  {item.count.toLocaleString("en-ZM")}
                </span>
                <ArrowRight className="mr-1 size-4 shrink-0 text-[color:rgba(255,248,236,0.5)] transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4 rounded-xl border border-[color:rgba(255,248,236,0.12)] bg-[color:rgba(255,248,236,0.07)] p-4" data-testid="needs-attention-empty">
          <p className="text-sm font-medium text-[color:rgba(255,248,236,0.76)]">
            {hasAvailablePriority
              ? "No items are currently waiting in the available queues."
              : "No priority queues are available for this account."}
          </p>
        </div>
      )}
    </section>
  );
}
