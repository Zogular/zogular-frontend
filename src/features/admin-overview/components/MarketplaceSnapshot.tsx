import {
  getSectionUnavailableCopy,
  getUnavailableMetricCopy,
  SNAPSHOT_PRESENTATION,
} from "@/features/admin-overview/lib/overview-presentation";
import type { AdminDashboardOverview } from "@/features/admin-overview/types/dashboard-overview";
import { cn } from "@/lib/utils";
import theme from "@/components/admin/admin-theme.module.css";

export function MarketplaceSnapshot({
  overview,
}: {
  overview: AdminDashboardOverview;
}) {
  const metrics = SNAPSHOT_PRESENTATION.map(
    (item) => overview.snapshot[item.key],
  );
  const availabilityCopy = getSectionUnavailableCopy(
    overview.snapshot.availability,
    metrics,
    "snapshot totals",
  );

  return (
    <section
      aria-labelledby="marketplace-snapshot-heading"
      data-testid="marketplace-snapshot"
      className={cn(
        theme.tactileSurface,
        "overflow-hidden rounded-2xl bg-[var(--admin-surface-cream)]",
      )}
    >
      <div className="flex flex-col gap-1 border-b border-[color:rgba(184,135,70,0.24)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <h2
            id="marketplace-snapshot-heading"
            className="text-base font-semibold text-[var(--admin-ink)]"
          >
            Marketplace snapshot
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-ink-soft)]">
            Current marketplace totals from available sources.
          </p>
        </div>
        {availabilityCopy ? (
          <p
            className="max-w-sm text-xs font-semibold leading-5 text-[var(--admin-escalation)]"
            data-testid="snapshot-availability"
          >
            {availabilityCopy}
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 bg-[var(--admin-canvas-depth)] p-px xl:grid-cols-4">
        {SNAPSHOT_PRESENTATION.map((item, index) => {
          const metric = overview.snapshot[item.key];
          return (
            <div
              key={item.key}
              className={cn(
                "min-w-0 bg-[var(--admin-surface-mist)] px-4 py-4 sm:px-5",
                index % 2 === 1 &&
                  "border-l border-[var(--admin-canvas-depth)]",
                index > 1 &&
                  "border-t border-[var(--admin-canvas-depth)] xl:border-t-0",
                index > 0 && "xl:border-l",
              )}
              data-testid={`snapshot-${item.key}`}
            >
              <dt className="text-xs font-semibold text-[var(--admin-ink-soft)]">
                {item.label}
              </dt>
              <dd className="mt-2">
                {metric.availability === "AVAILABLE" ? (
                  <span className="text-xl font-semibold tabular-nums text-[var(--admin-canopy-deep)]">
                    {metric.value.toLocaleString("en-ZM")}
                  </span>
                ) : (
                  <span className="text-sm font-semibold leading-5 text-[var(--admin-escalation)]">
                    {getUnavailableMetricCopy(metric)}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
