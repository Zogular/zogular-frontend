"use client";

import { CircleCheck, CircleDashed, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERIOD_OPTIONS } from "@/features/admin-overview/lib/overview-presentation";
import type { AdminOverviewFreshness } from "@/features/admin-overview/hooks/useAdminOverview";
import type {
  AdminDashboardOverviewAvailability,
  AdminDashboardOverviewGroupBy,
  AdminDashboardOverviewPeriod,
} from "@/features/admin-overview/types/dashboard-overview";
import { cn } from "@/lib/utils";
import theme from "@/components/admin/admin-theme.module.css";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-ZM", {
  timeZone: "Africa/Lusaka",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const UPDATED_FORMATTER = new Intl.DateTimeFormat("en-ZM", {
  timeZone: "Africa/Lusaka",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function OverviewHeader({
  nowIso,
  generatedAt,
  availability,
  freshness,
  period,
  groupBy,
  isRefreshing,
  refreshDisabled,
  onRefresh,
}: {
  nowIso: string;
  generatedAt: string | null;
  availability: AdminDashboardOverviewAvailability | null;
  freshness: AdminOverviewFreshness;
  period: AdminDashboardOverviewPeriod;
  groupBy: AdminDashboardOverviewGroupBy;
  isRefreshing: boolean;
  refreshDisabled: boolean;
  onRefresh: () => void;
}) {
  const HealthIcon = availability === "AVAILABLE"
    ? CircleCheck
    : availability === null
      ? CircleDashed
      : ShieldAlert;
  const healthLabel = freshness === "degraded"
    ? "Degraded"
    : freshness === "stale"
      ? "Stale"
      : availability === "AVAILABLE"
        ? "Fresh"
        : availability === "PARTIAL"
          ? "Limited view"
          : availability === "UNAVAILABLE"
            ? "Unavailable view"
            : "Connecting";
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label
    ?? "Selected period";

  return (
    <header
      className={cn(
        theme.tactileSurface,
        "flex flex-col gap-4 rounded-2xl bg-[var(--admin-surface-cream)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-bold text-[var(--admin-canopy)]">
          Marketplace operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--admin-ink)] sm:text-[1.75rem]">
          Overview
        </h1>
        <p className="mt-1.5 text-sm text-[var(--admin-ink-soft)]">
          {DATE_FORMATTER.format(new Date(nowIso))}
        </p>
        <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">
          {periodLabel} / {groupBy === "DAY" ? "Daily" : "Weekly"} / Africa/Lusaka
        </p>
        <p className="mt-1 text-xs text-[var(--admin-ink-soft)]">
          Auto-refreshes every 60 seconds while this page is visible
        </p>
      </div>

      <div className="flex min-w-0 items-stretch gap-2 sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[color:rgba(184,135,70,0.26)] bg-[var(--admin-surface-mist)] px-3 py-2 sm:flex-none">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              availability === "AVAILABLE" && freshness === "fresh"
                ? "bg-[color:rgba(7,91,54,0.1)] text-[var(--admin-canopy)]"
                : availability === null
                  ? "bg-[var(--admin-canvas-depth)] text-[var(--admin-ink-soft)]"
                  : "bg-[color:rgba(217,106,31,0.1)] text-[var(--admin-escalation)]",
            )}
          >
            <HealthIcon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-[var(--admin-ink)]">
              {healthLabel}
            </span>
            <span
              className="block text-[11px] leading-4 text-[var(--admin-ink-soft)]"
              data-testid="overview-last-updated"
            >
              {generatedAt
                ? `Updated ${UPDATED_FORMATTER.format(new Date(generatedAt))}`
                : "Waiting for verified data"}
            </span>
          </span>
        </div>
        <div className="group relative shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 border-[color:rgba(7,91,54,0.25)] bg-[var(--admin-canopy)] text-[var(--admin-surface-cream)] shadow-[inset_0_1px_0_rgba(255,248,236,0.2)] hover:bg-[var(--admin-canopy-deep)] hover:text-[var(--admin-surface-cream)] focus-visible:ring-[var(--admin-ember)]"
            aria-label={isRefreshing ? "Refreshing overview" : "Refresh overview"}
            aria-describedby="overview-refresh-tooltip"
            disabled={refreshDisabled}
            onClick={onRefresh}
            data-testid="overview-refresh"
          >
            <RefreshCw
              className={isRefreshing ? "animate-spin motion-reduce:animate-none" : undefined}
            />
          </Button>
          <span
            id="overview-refresh-tooltip"
            role="tooltip"
            className="pointer-events-none absolute right-0 top-[calc(100%+0.4rem)] z-20 whitespace-nowrap rounded-md bg-[var(--admin-canopy-deep)] px-2 py-1 text-[11px] font-medium text-[var(--admin-surface-cream)] opacity-0 shadow-sm transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
          >
            Refresh overview
          </span>
        </div>
      </div>
    </header>
  );
}
