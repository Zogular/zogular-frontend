import {
  ClipboardCheck,
  Headphones,
  PackageCheck,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import theme from "@/components/admin/admin-theme.module.css";
import {
  getUnavailableMetricCopy,
  PRIORITY_PRESENTATION,
} from "@/features/admin-overview/lib/overview-presentation";
import type {
  AdminDashboardPriorityKey,
  AdminDashboardSummary,
} from "@/features/admin-overview/types/dashboard-summary";

const ICONS: Record<AdminDashboardPriorityKey, LucideIcon> = {
  sellerReviews: ClipboardCheck,
  productReviews: PackageCheck,
  ordersNeedingAction: ShoppingBag,
  openSupportRequests: Headphones,
};

export function PrioritySummary({ summary }: { summary: AdminDashboardSummary }) {
  return (
    <section
      aria-labelledby="priority-summary-heading"
      data-testid="priority-summary"
      className={cn(theme.tactileSurface, "h-full rounded-2xl bg-[var(--admin-surface-cream)] p-4 sm:p-5")}
    >
      <div className="flex flex-col gap-1">
        <div>
          <h2 id="priority-summary-heading" className="text-base font-semibold text-[var(--admin-ink)]">
            Priority summary
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">Current work across available queues.</p>
        </div>
        {summary.priorities.availability !== "AVAILABLE" ? (
          <p className="mt-1 text-xs font-semibold text-[var(--admin-escalation)]" data-testid="priority-availability">
            {summary.priorities.availability === "PARTIAL"
              ? "Some priority counts are unavailable."
              : "Priority counts are unavailable for this account."}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {PRIORITY_PRESENTATION.map((item) => {
          const metric = summary.priorities[item.key];
          const Icon = ICONS[item.key];
          return (
            <div
              key={item.key}
              className="min-w-0 rounded-xl border border-[color:rgba(184,135,70,0.22)] bg-[var(--admin-surface-mist)] p-3 shadow-[inset_0_1px_0_rgba(255,248,236,0.85)]"
              data-testid={`priority-${item.key}`}
            >
              <div className="flex min-w-0 items-start gap-2 text-[var(--admin-ink-soft)]">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color:rgba(7,91,54,0.09)] text-[var(--admin-canopy)]">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <p className="min-w-0 pt-1 text-[11px] font-semibold leading-4">{item.label}</p>
              </div>
              {metric.availability === "AVAILABLE" ? (
                <p className="mt-3 text-2xl font-semibold tabular-nums text-[var(--admin-ink)]">
                  {metric.count.toLocaleString("en-ZM")}
                </p>
              ) : (
                <p className="mt-3 text-xs font-semibold leading-5 text-[var(--admin-escalation)]">
                  {getUnavailableMetricCopy(metric)}
                </p>
              )}
              <p className="mt-1 text-[11px] leading-4 text-[var(--admin-ink-soft)]">{item.detail}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
