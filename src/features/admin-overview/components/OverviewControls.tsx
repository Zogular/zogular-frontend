"use client";

import { CalendarRange, Rows3 } from "lucide-react";
import {
  GROUP_BY_OPTIONS,
  PERIOD_OPTIONS,
} from "@/features/admin-overview/lib/overview-presentation";
import type {
  AdminDashboardOverviewGroupBy,
  AdminDashboardOverviewPeriod,
} from "@/features/admin-overview/types/dashboard-overview";
import { cn } from "@/lib/utils";

interface OverviewControlsProps {
  period: AdminDashboardOverviewPeriod;
  groupBy: AdminDashboardOverviewGroupBy;
  onPeriodChange: (period: AdminDashboardOverviewPeriod) => void;
  onGroupByChange: (groupBy: AdminDashboardOverviewGroupBy) => void;
  disabled?: boolean;
}

const groupByLabels: Readonly<Record<AdminDashboardOverviewGroupBy, string>> = {
  DAY: "Daily",
  WEEK: "Weekly",
};

export function OverviewControls({
  period,
  groupBy,
  onPeriodChange,
  onGroupByChange,
  disabled = false,
}: OverviewControlsProps) {
  const allowedGroups = GROUP_BY_OPTIONS[period];

  return (
    <section
      aria-label="Overview reporting controls"
      className="flex flex-col gap-3 rounded-xl border border-[color:rgba(184,135,70,0.28)] bg-[var(--admin-surface-mist)] p-3 lg:flex-row lg:items-end lg:justify-between"
      data-testid="overview-controls"
    >
      <fieldset className="min-w-0">
        <legend className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-ink-soft)]">
          <CalendarRange className="size-4" aria-hidden="true" />
          Reporting period
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-[var(--admin-canvas-depth)] p-1 sm:flex sm:flex-wrap">
          {PERIOD_OPTIONS.map((option) => {
            const selected = option.value === period;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onPeriodChange(option.value)}
                className={cn(
                  "min-h-11 rounded-md px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canvas-depth)] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
                  selected
                    ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] shadow-sm"
                    : "text-[var(--admin-ink-soft)] hover:bg-[var(--admin-surface-cream)] hover:text-[var(--admin-ink)]",
                )}
                data-testid={`overview-period-${option.value}`}
              >
                <span className="sm:hidden">{option.shortLabel}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        {allowedGroups.length > 1 ? (
          <fieldset>
            <legend className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-ink-soft)]">
              <Rows3 className="size-4" aria-hidden="true" />
              Group results
            </legend>
            <div className="mt-2 inline-flex rounded-lg bg-[var(--admin-canvas-depth)] p-1">
              {allowedGroups.map((option) => {
                const selected = option === groupBy;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => onGroupByChange(option)}
                    className={cn(
                      "min-h-11 min-w-20 rounded-md px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-canvas-depth)] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
                      selected
                        ? "bg-[var(--admin-surface-cream)] text-[var(--admin-canopy-deep)] shadow-sm"
                        : "text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]",
                    )}
                    data-testid={`overview-group-${option}`}
                  >
                    {groupByLabels[option]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="min-h-11 border-l border-[color:rgba(184,135,70,0.32)] pl-3">
          <p className="text-xs font-semibold text-[var(--admin-ink-soft)]">
            Comparison
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--admin-ink)]">
            Previous period
          </p>
        </div>
      </div>
    </section>
  );
}
