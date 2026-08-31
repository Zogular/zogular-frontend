import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  FLOW_PRESENTATION,
  formatPercentageChange,
  formatSignedCount,
  getSectionUnavailableCopy,
  getUnavailableMetricCopy,
} from "@/features/admin-overview/lib/overview-presentation";
import type { AdminDashboardOverview } from "@/features/admin-overview/types/dashboard-overview";
import { cn } from "@/lib/utils";
import theme from "@/components/admin/admin-theme.module.css";

export function MarketplacePulse({
  overview,
}: {
  overview: AdminDashboardOverview;
}) {
  const metrics = FLOW_PRESENTATION.map(
    (item) => overview.periodFlows[item.key],
  );
  const availabilityCopy = getSectionUnavailableCopy(
    overview.periodFlows.availability,
    metrics,
    "period comparisons",
  );

  return (
    <section
      aria-labelledby="marketplace-pulse-heading"
      data-testid="marketplace-pulse"
      className={cn(
        theme.tactileSurface,
        "overflow-hidden rounded-2xl bg-[var(--admin-surface-cream)]",
      )}
    >
      <div className="flex flex-col gap-1 border-b border-[color:rgba(184,135,70,0.24)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <h2
            id="marketplace-pulse-heading"
            className="text-base font-semibold text-[var(--admin-ink)]"
          >
            Marketplace pulse
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
            New activity compared with the immediately previous period.
          </p>
        </div>
        {availabilityCopy ? (
          <p
            className="max-w-sm text-xs font-semibold leading-5 text-[var(--admin-escalation)]"
            data-testid="pulse-availability"
          >
            {availabilityCopy}
          </p>
        ) : null}
      </div>

      <dl className="grid gap-px bg-[var(--admin-canvas-depth)] sm:grid-cols-2 xl:grid-cols-4">
        {FLOW_PRESENTATION.map((item) => {
          const metric = overview.periodFlows[item.key];
          if (metric.availability !== "AVAILABLE") {
            return (
              <div
                key={item.key}
                className="min-h-40 bg-[var(--admin-surface-mist)] px-4 py-4 sm:px-5"
                data-testid={`pulse-${item.key}`}
              >
                <dt className="text-xs font-semibold leading-5 text-[var(--admin-ink-soft)]">
                  {item.label}
                </dt>
                <dd className="mt-5 text-sm font-semibold leading-5 text-[var(--admin-escalation)]">
                  {getUnavailableMetricCopy(metric)}
                </dd>
              </div>
            );
          }

          const DirectionIcon =
            metric.absoluteChange > 0
              ? ArrowUpRight
              : metric.absoluteChange < 0
                ? ArrowDownRight
                : Minus;

          return (
            <div
              key={item.key}
              className="min-h-40 bg-[var(--admin-surface-mist)] px-4 py-4 sm:px-5"
              data-testid={`pulse-${item.key}`}
            >
              <dt className="text-xs font-semibold leading-5 text-[var(--admin-ink-soft)]">
                {item.label}
              </dt>
              <dd className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums text-[var(--admin-canopy-deep)]">
                    {metric.currentValue.toLocaleString("en-ZM")}
                  </span>
                  <span className="text-xs tabular-nums text-[var(--admin-ink-soft)]">
                    previous {metric.comparisonValue.toLocaleString("en-ZM")}
                  </span>
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold leading-5 text-[var(--admin-ink)]">
                  <DirectionIcon
                    className="mt-0.5 size-4 shrink-0 text-[var(--admin-copper-muted)]"
                    aria-hidden="true"
                  />
                  {formatSignedCount(metric.absoluteChange)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xs leading-5 text-[var(--admin-ink-soft)]",
                    metric.percentageChange === null && "italic",
                  )}
                >
                  {formatPercentageChange(metric.percentageChange)}
                </p>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
