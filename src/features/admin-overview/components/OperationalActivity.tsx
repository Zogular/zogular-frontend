"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Table2 } from "lucide-react";
import { useReducedMotion } from "motion/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FLOW_PRESENTATION,
  getSectionUnavailableCopy,
  getUnavailableActivitySeriesItems,
  type FlowKey,
} from "@/features/admin-overview/lib/overview-presentation";
import type { AdminDashboardOverview } from "@/features/admin-overview/types/dashboard-overview";
import { cn } from "@/lib/utils";
import theme from "@/components/admin/admin-theme.module.css";

const SERIES_STYLE: Readonly<
  Record<FlowKey, { color: string; dash?: string }>
> = {
  sellerApplicationsSubmitted: { color: "#075b36" },
  productsCreated: { color: "#d96a1f", dash: "8 4" },
  ordersCreated: { color: "#b83b32", dash: "3 3" },
  supportTicketsOpened: { color: "#6f542f", dash: "10 3 2 3" },
};

type ChartRow = {
  bucketStart: string;
  bucketEnd: string;
  label: string;
  currentRange: string;
  [key: string]: string | number;
};

type TooltipPayload = {
  dataKey?: string | number;
  value?: number;
  payload?: ChartRow;
};

function formatBucketLabel(
  timestamp: string,
  groupBy: AdminDashboardOverview["query"]["groupBy"],
): string {
  return new Intl.DateTimeFormat("en-ZM", {
    timeZone: "Africa/Lusaka",
    month: "short",
    day: "numeric",
    ...(groupBy === "WEEK" ? { year: "2-digit" as const } : {}),
  }).format(new Date(timestamp));
}

function formatBucketRange(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat("en-ZM", {
    timeZone: "Africa/Lusaka",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(new Date(start))} to ${formatter.format(new Date(end))}`;
}

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="max-w-64 rounded-lg border border-[color:rgba(184,135,70,0.36)] bg-[var(--admin-surface-cream)] p-3 shadow-lg">
      <p className="text-xs font-semibold text-[var(--admin-ink)]">
        Current bucket: {payload[0]?.payload?.currentRange ?? label}
      </p>
      <dl className="mt-2 space-y-2">
        {payload.map((entry) => {
          const key = entry.dataKey as FlowKey;
          const presentation = FLOW_PRESENTATION.find((item) => item.key === key);
          if (!presentation || !entry.payload) return null;
          const comparisonValue = entry.payload[`${key}Comparison`];
          const comparisonRange = entry.payload[`${key}ComparisonRange`];
          return (
            <div key={key} className="text-xs leading-5">
              <dt className="font-semibold text-[var(--admin-ink)]">
                {presentation.shortLabel}
              </dt>
              <dd className="text-[var(--admin-ink-soft)]">
                <span className="block">
                  Current: {Number(entry.value ?? 0).toLocaleString("en-ZM")}
                </span>
                <span className="block">
                  Previous ({String(comparisonRange)}):{" "}
                  {Number(comparisonValue ?? 0).toLocaleString("en-ZM")}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function OperationalActivity({
  overview,
}: {
  overview: AdminDashboardOverview;
}) {
  const reduceMotion = useReducedMotion();
  const [hiddenSeries, setHiddenSeries] = useState<ReadonlySet<FlowKey>>(
    () => new Set(),
  );
  const availableSeries = FLOW_PRESENTATION.filter(
    (item) => overview.operationalActivity.series[item.key].availability === "AVAILABLE",
  );
  const seriesMetrics = FLOW_PRESENTATION.map(
    (item) => overview.operationalActivity.series[item.key],
  );
  const availabilityCopy = getSectionUnavailableCopy(
    overview.operationalActivity.availability,
    seriesMetrics,
    "activity series",
  );
  const unavailableSeries = getUnavailableActivitySeriesItems(overview);

  const rows = useMemo(() => {
    const rowsByStart = new Map<string, ChartRow>();
    for (const item of availableSeries) {
      const series = overview.operationalActivity.series[item.key];
      if (series.availability !== "AVAILABLE") continue;
      for (const point of series.points) {
        const row = rowsByStart.get(point.bucketStart) ?? {
          bucketStart: point.bucketStart,
          bucketEnd: point.bucketEnd,
          label: formatBucketLabel(
            point.bucketStart,
            overview.operationalActivity.groupBy,
          ),
          currentRange: formatBucketRange(point.bucketStart, point.bucketEnd),
        };
        row[item.key] = point.count;
        row[`${item.key}Comparison`] = point.comparisonCount;
        row[`${item.key}ComparisonBucketStart`] = point.comparisonBucketStart;
        row[`${item.key}ComparisonBucketEnd`] = point.comparisonBucketEnd;
        row[`${item.key}ComparisonRange`] = formatBucketRange(
          point.comparisonBucketStart,
          point.comparisonBucketEnd,
        );
        rowsByStart.set(point.bucketStart, row);
      }
    }
    return [...rowsByStart.values()].sort(
      (left, right) =>
        Date.parse(left.bucketStart) - Date.parse(right.bucketStart),
    );
  }, [availableSeries, overview.operationalActivity]);

  const totals = useMemo(() => {
    let current = 0;
    let comparison = 0;
    for (const row of rows) {
      for (const item of availableSeries) {
        current += Number(row[item.key] ?? 0);
        comparison += Number(row[`${item.key}Comparison`] ?? 0);
      }
    }
    return { current, comparison };
  }, [availableSeries, rows]);

  const toggleSeries = (key: FlowKey) => {
    setHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section
      aria-labelledby="operational-activity-heading"
      data-testid="operational-activity"
      className={cn(
        theme.tactileSurface,
        "overflow-hidden rounded-2xl bg-[var(--admin-surface-cream)]",
      )}
    >
      <div className="border-b border-[color:rgba(184,135,70,0.24)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2
              id="operational-activity-heading"
              className="text-base font-semibold text-[var(--admin-ink)]"
            >
              Operational activity
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--admin-ink-soft)]">
              New marketplace work recorded during the selected period, compared with the previous period.
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--admin-ink-soft)]">
            {overview.operationalActivity.groupBy === "DAY" ? "Daily" : "Weekly"} view
          </span>
        </div>
        {availabilityCopy ? (
          <p
            className="mt-2 text-xs font-semibold leading-5 text-[var(--admin-escalation)]"
            data-testid="activity-availability"
          >
            {availabilityCopy}
          </p>
        ) : null}
        {unavailableSeries.length > 0 ? (
          <ul
            className="mt-2 grid gap-1 text-xs leading-5 text-[var(--admin-ink-soft)] sm:grid-cols-2"
            data-testid="activity-unavailable-series"
          >
            {unavailableSeries.map((item) => (
              <li key={item.key}>
                <span className="font-semibold text-[var(--admin-ink)]">
                  {item.label}:
                </span>{" "}
                {item.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {availableSeries.length === 0 ? (
        <div className="p-5" data-testid="activity-unavailable">
          <p className="text-sm font-medium text-[var(--admin-ink)]">
            {availabilityCopy ?? "Operational activity is currently unavailable."}
          </p>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <div
            className="flex flex-wrap gap-2"
            aria-label="Operational activity series"
          >
            {availableSeries.map((item) => {
              const visible = !hiddenSeries.has(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={visible}
                  onClick={() => toggleSeries(item.key)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)] focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none",
                    visible
                      ? "border-[color:rgba(7,91,54,0.28)] bg-[var(--admin-surface-mist)] text-[var(--admin-ink)]"
                      : "border-[color:rgba(184,135,70,0.24)] bg-transparent text-[var(--admin-ink-soft)]",
                  )}
                  data-testid={`activity-toggle-${item.key}`}
                >
                  <span
                    className="h-0.5 w-5 shrink-0"
                    style={{
                      backgroundColor: SERIES_STYLE[item.key].color,
                      borderTop: SERIES_STYLE[item.key].dash
                        ? `1px dashed ${SERIES_STYLE[item.key].color}`
                        : undefined,
                    }}
                    aria-hidden="true"
                  />
                  {visible ? (
                    <Eye className="size-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  )}
                  {item.shortLabel}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-sm leading-6 text-[var(--admin-ink-soft)]" data-testid="activity-summary">
            Available series recorded {totals.current.toLocaleString("en-ZM")} entries in the current period and {" "}
            {totals.comparison.toLocaleString("en-ZM")} in the previous period.
          </p>

          {availableSeries.every((item) => hiddenSeries.has(item.key)) ? (
            <div className="mt-4 flex h-80 items-center justify-center rounded-xl border border-dashed border-[color:rgba(184,135,70,0.36)] bg-[var(--admin-surface-mist)] px-4 text-center">
              <p className="text-sm font-medium text-[var(--admin-ink-soft)]">
                All series are hidden. Select a series above to show the chart.
              </p>
            </div>
          ) : (
            <div className="mt-4 h-80 min-h-80 w-full min-w-0" data-testid="activity-chart">
              <p className="sr-only">
                Current-period operational activity. Recharts provides the interactive chart accessibility layer; the complete current and previous-period values and date ranges are also available in the table below.
              </p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={rows}
                  margin={{ top: 12, right: 12, bottom: 8, left: -14 }}
                  accessibilityLayer
                >
                  <CartesianGrid stroke="rgba(184,135,70,0.22)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#5f625a", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(184,135,70,0.28)" }}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={44}
                    tick={{ fill: "#5f625a", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<ActivityTooltip />} />
                  {availableSeries.map((item) =>
                    hiddenSeries.has(item.key) ? null : (
                      <Line
                        key={item.key}
                        type="monotone"
                        dataKey={item.key}
                        name={item.shortLabel}
                        stroke={SERIES_STYLE[item.key].color}
                        strokeWidth={2.5}
                        strokeDasharray={SERIES_STYLE[item.key].dash}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2 }}
                        connectNulls={false}
                        isAnimationActive={!reduceMotion}
                      />
                    ),
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <details className="mt-4 rounded-xl border border-[color:rgba(184,135,70,0.28)] bg-[var(--admin-surface-mist)]">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--admin-ink)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-canopy)]">
              <Table2 className="size-4" aria-hidden="true" />
              View activity data
            </summary>
            <div className="overflow-x-auto border-t border-[color:rgba(184,135,70,0.24)]">
              <table className="w-full min-w-max border-collapse text-left text-xs">
                <caption className="sr-only">
                  Current and previous-period operational activity values and bucket date ranges for every available series
                </caption>
                <thead>
                  <tr className="bg-[var(--admin-canvas-depth)] text-[var(--admin-ink)]">
                    <th scope="col" className="px-3 py-3 font-semibold">Current bucket</th>
                    {availableSeries.map((item) => (
                      <th key={item.key} scope="colgroup" colSpan={3} className="border-l border-[color:rgba(184,135,70,0.24)] px-3 py-3 text-center font-semibold">
                        {item.shortLabel}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-[var(--admin-surface-cream)] text-[var(--admin-ink-soft)]">
                    <th scope="col" className="px-3 py-2 font-medium">Start and end</th>
                    {availableSeries.flatMap((item) => [
                      <th key={`${item.key}-current`} scope="col" className="border-l border-[color:rgba(184,135,70,0.2)] px-3 py-2 text-right font-medium">Current</th>,
                      <th key={`${item.key}-comparison-range`} scope="col" className="px-3 py-2 font-medium">Previous bucket</th>,
                      <th key={`${item.key}-comparison`} scope="col" className="px-3 py-2 text-right font-medium">Previous</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.bucketStart} className="border-t border-[color:rgba(184,135,70,0.18)] text-[var(--admin-ink)]">
                      <th scope="row" className="whitespace-nowrap px-3 py-2.5 font-medium">{row.currentRange}</th>
                      {availableSeries.flatMap((item) => [
                        <td key={`${item.key}-current`} className="border-l border-[color:rgba(184,135,70,0.18)] px-3 py-2.5 text-right tabular-nums">{Number(row[item.key] ?? 0).toLocaleString("en-ZM")}</td>,
                        <td key={`${item.key}-comparison-range`} className="whitespace-nowrap px-3 py-2.5">{String(row[`${item.key}ComparisonRange`] ?? "")}</td>,
                        <td key={`${item.key}-comparison`} className="px-3 py-2.5 text-right tabular-nums">{Number(row[`${item.key}Comparison`] ?? 0).toLocaleString("en-ZM")}</td>,
                      ])}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
