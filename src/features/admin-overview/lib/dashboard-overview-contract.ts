import { z } from "zod";
import type {
  AdminDashboardOverview,
  AdminDashboardOverviewActivitySeries,
  AdminDashboardOverviewAvailability,
  AdminDashboardOverviewFlowMetric,
  AdminDashboardOverviewGroupBy,
  AdminDashboardOverviewQuery,
  AdminDashboardOverviewQueryInput,
  AdminDashboardOverviewResponse,
  AdminDashboardOverviewResolvedPeriod,
} from "../types/dashboard-overview";

export const ADMIN_DASHBOARD_OVERVIEW_VERSION = 1 as const;
export const ADMIN_DASHBOARD_OVERVIEW_TIME_ZONE = "Africa/Lusaka" as const;
export const ADMIN_DASHBOARD_OVERVIEW_SCOPE = "MARKETPLACE" as const;

type CalendarDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

const lusakaDateFormatter = new Intl.DateTimeFormat("en-CA-u-ca-gregory", {
  timeZone: ADMIN_DASHBOARD_OVERVIEW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const lusakaDateTimeFormatter = new Intl.DateTimeFormat(
  "en-CA-u-ca-gregory",
  {
    timeZone: ADMIN_DASHBOARD_OVERVIEW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  },
);

export const ADMIN_DASHBOARD_OVERVIEW_PERIODS = [
  "LAST_7_DAYS",
  "LAST_30_DAYS",
  "MONTH_TO_DATE",
  "QUARTER_TO_DATE",
] as const;
export const ADMIN_DASHBOARD_OVERVIEW_COMPARISONS = ["PREVIOUS_PERIOD"] as const;
export const ADMIN_DASHBOARD_OVERVIEW_GROUPINGS = ["DAY", "WEEK"] as const;

export const DEFAULT_ADMIN_DASHBOARD_OVERVIEW_QUERY: AdminDashboardOverviewQuery =
  Object.freeze({
    period: "LAST_30_DAYS",
    comparison: "PREVIOUS_PERIOD",
    groupBy: "DAY",
  });

export const DEFAULT_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY = Object.freeze({
  LAST_7_DAYS: "DAY",
  LAST_30_DAYS: "DAY",
  MONTH_TO_DATE: "DAY",
  QUARTER_TO_DATE: "WEEK",
} satisfies Readonly<Record<AdminDashboardOverviewQuery["period"], AdminDashboardOverviewGroupBy>>);

export const ALLOWED_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY = Object.freeze({
  LAST_7_DAYS: Object.freeze(["DAY"]),
  LAST_30_DAYS: Object.freeze(["DAY", "WEEK"]),
  MONTH_TO_DATE: Object.freeze(["DAY", "WEEK"]),
  QUARTER_TO_DATE: Object.freeze(["WEEK"]),
} satisfies Readonly<Record<AdminDashboardOverviewQuery["period"], readonly AdminDashboardOverviewGroupBy[]>>);

const dateTimeSchema = z
  .iso.datetime({ offset: true })
  .refine(
    (value) =>
      /T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    "Overview timestamps must include seconds and an explicit UTC offset.",
  );
const safeNonnegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const availabilitySchema = z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE"]);
const unavailableReasonSchema = z.enum([
  "PERMISSION_REQUIRED",
  "DATA_SOURCE_UNAVAILABLE",
]);
const permissionModeSchema = z.enum(["ANY", "ALL"]);

export const adminDashboardOverviewPeriodSchema = z.enum(
  ADMIN_DASHBOARD_OVERVIEW_PERIODS,
);
export const adminDashboardOverviewComparisonSchema = z.enum(
  ADMIN_DASHBOARD_OVERVIEW_COMPARISONS,
);
export const adminDashboardOverviewGroupBySchema = z.enum(
  ADMIN_DASHBOARD_OVERVIEW_GROUPINGS,
);

const queryInputSchema = z
  .strictObject({
    period: adminDashboardOverviewPeriodSchema.optional(),
    comparison: adminDashboardOverviewComparisonSchema.optional(),
    groupBy: adminDashboardOverviewGroupBySchema.optional(),
  })
  .transform((input): AdminDashboardOverviewQuery => {
    const period = input.period ?? DEFAULT_ADMIN_DASHBOARD_OVERVIEW_QUERY.period;
    return {
      period,
      comparison:
        input.comparison ?? DEFAULT_ADMIN_DASHBOARD_OVERVIEW_QUERY.comparison,
      groupBy: input.groupBy ?? DEFAULT_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY[period],
    };
  })
  .superRefine((query, context) => {
    if (!ALLOWED_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY[query.period].some((groupBy) => groupBy === query.groupBy)) {
      context.addIssue({
        code: "custom",
        path: ["groupBy"],
        message: "The requested grouping is not available for this period.",
      });
    }
  });

const requiredStringSchema = z.string().min(1);
const requiredPermissionsSchema = z
  .array(requiredStringSchema)
  .min(1)
  .superRefine((permissions, context) => {
    if (new Set(permissions).size !== permissions.length) {
      context.addIssue({
        code: "custom",
        message: "Required permissions must be unique.",
      });
    }
  });

const metricMetadataShape = {
  id: requiredStringSchema,
  label: requiredStringSchema,
  definition: requiredStringSchema,
  unit: z.literal("COUNT"),
  source: requiredStringSchema,
  requiredPermissions: requiredPermissionsSchema,
  permissionMode: permissionModeSchema,
} as const;

const unavailableMetricSchema = z.strictObject({
  ...metricMetadataShape,
  availability: z.literal("UNAVAILABLE"),
  reason: unavailableReasonSchema,
});

export const adminDashboardOverviewCountMetricSchema = z.discriminatedUnion(
  "availability",
  [
    z.strictObject({
      ...metricMetadataShape,
      availability: z.literal("AVAILABLE"),
      value: safeNonnegativeIntegerSchema,
    }),
    unavailableMetricSchema,
  ],
);

export const adminDashboardOverviewQueueMetricSchema = z.discriminatedUnion(
  "availability",
  [
    z
      .strictObject({
        ...metricMetadataShape,
        availability: z.literal("AVAILABLE"),
        value: safeNonnegativeIntegerSchema,
        oldestItemAgeSeconds: safeNonnegativeIntegerSchema.nullable(),
        ageBasis: z.enum(["SUBMITTED_AT", "CREATED_AT", "NOT_AVAILABLE"]),
      })
      .superRefine((metric, context) => {
        if (
          metric.ageBasis === "NOT_AVAILABLE" &&
          metric.oldestItemAgeSeconds !== null
        ) {
          context.addIssue({
            code: "custom",
            path: ["oldestItemAgeSeconds"],
            message: "A queue without an age basis cannot expose an age.",
          });
        }
        if (metric.value === 0 && metric.oldestItemAgeSeconds !== null) {
          context.addIssue({
            code: "custom",
            path: ["oldestItemAgeSeconds"],
            message: "An empty queue cannot expose an oldest-item age.",
          });
        }
        if (
          metric.ageBasis !== "NOT_AVAILABLE" &&
          metric.value > 0 &&
          metric.oldestItemAgeSeconds === null
        ) {
          context.addIssue({
            code: "custom",
            path: ["oldestItemAgeSeconds"],
            message: "A non-empty queue with a timestamp basis requires an oldest-item age.",
          });
        }
      }),
    unavailableMetricSchema,
  ],
);

export const adminDashboardOverviewFlowMetricSchema = z.discriminatedUnion(
  "availability",
  [
    z
      .strictObject({
        ...metricMetadataShape,
        availability: z.literal("AVAILABLE"),
        currentValue: safeNonnegativeIntegerSchema,
        comparisonValue: safeNonnegativeIntegerSchema,
        absoluteChange: z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
        percentageChange: z.number().finite().nullable(),
      })
      .superRefine((metric, context) => {
        if (metric.absoluteChange !== metric.currentValue - metric.comparisonValue) {
          context.addIssue({
            code: "custom",
            path: ["absoluteChange"],
            message: "Flow comparison values are inconsistent.",
          });
        }
        const expectedPercentage = resolvePercentageChange(
          metric.currentValue,
          metric.comparisonValue,
        );
        if (metric.percentageChange !== expectedPercentage) {
          context.addIssue({
            code: "custom",
            path: ["percentageChange"],
            message: "Percentage change does not match the compared values.",
          });
        }
      }),
    unavailableMetricSchema,
  ],
);

const activityPointSchema = z.strictObject({
  bucketStart: dateTimeSchema,
  bucketEnd: dateTimeSchema,
  count: safeNonnegativeIntegerSchema,
  comparisonBucketStart: dateTimeSchema,
  comparisonBucketEnd: dateTimeSchema,
  comparisonCount: safeNonnegativeIntegerSchema,
});

export const adminDashboardOverviewActivitySeriesSchema =
  z.discriminatedUnion("availability", [
    z.strictObject({
      ...metricMetadataShape,
      availability: z.literal("AVAILABLE"),
      points: z.array(activityPointSchema).min(1),
    }),
    unavailableMetricSchema,
  ]);

const resolvedPeriodSchema = z.strictObject({
  start: dateTimeSchema,
  end: dateTimeSchema,
  endExclusive: z.literal(true),
});

const queuesSectionSchema = z.strictObject({
  availability: availabilitySchema,
  permissionPolicy: z.literal("METRIC_LEVEL"),
  sellerReviews: adminDashboardOverviewQueueMetricSchema,
  productReviews: adminDashboardOverviewQueueMetricSchema,
  ordersNeedingAction: adminDashboardOverviewQueueMetricSchema,
  openSupportRequests: adminDashboardOverviewQueueMetricSchema,
});

const snapshotSectionSchema = z.strictObject({
  availability: availabilitySchema,
  permissionPolicy: z.literal("METRIC_LEVEL"),
  activeSellers: adminDashboardOverviewCountMetricSchema,
  publishedProducts: adminDashboardOverviewCountMetricSchema,
  customers: adminDashboardOverviewCountMetricSchema,
  openOrders: adminDashboardOverviewCountMetricSchema,
});

const periodFlowsSectionSchema = z.strictObject({
  availability: availabilitySchema,
  permissionPolicy: z.literal("METRIC_LEVEL"),
  sellerApplicationsSubmitted: adminDashboardOverviewFlowMetricSchema,
  productsCreated: adminDashboardOverviewFlowMetricSchema,
  ordersCreated: adminDashboardOverviewFlowMetricSchema,
  supportTicketsOpened: adminDashboardOverviewFlowMetricSchema,
});

const operationalActivitySectionSchema = z.strictObject({
  id: z.literal("operationalWorkEntered"),
  label: z.literal("Operational work entered"),
  question: z.literal(
    "How much new operational work entered Zogular during the selected period compared with the immediately preceding equivalent period?",
  ),
  unit: z.literal("COUNT"),
  groupBy: adminDashboardOverviewGroupBySchema,
  availability: availabilitySchema,
  permissionPolicy: z.literal("METRIC_LEVEL"),
  series: z.strictObject({
    sellerApplicationsSubmitted: adminDashboardOverviewActivitySeriesSchema,
    productsCreated: adminDashboardOverviewActivitySeriesSchema,
    ordersCreated: adminDashboardOverviewActivitySeriesSchema,
    supportTicketsOpened: adminDashboardOverviewActivitySeriesSchema,
  }),
});

export const adminDashboardOverviewSchema = z
  .strictObject({
    version: z.literal(ADMIN_DASHBOARD_OVERVIEW_VERSION),
    generatedAt: dateTimeSchema,
    timeZone: z.literal(ADMIN_DASHBOARD_OVERVIEW_TIME_ZONE),
    scope: z.literal(ADMIN_DASHBOARD_OVERVIEW_SCOPE),
    query: z.strictObject({
      period: adminDashboardOverviewPeriodSchema,
      comparison: adminDashboardOverviewComparisonSchema,
      groupBy: adminDashboardOverviewGroupBySchema,
    }),
    periods: z.strictObject({
      current: resolvedPeriodSchema,
      comparison: resolvedPeriodSchema,
    }),
    queues: queuesSectionSchema,
    snapshot: snapshotSectionSchema,
    periodFlows: periodFlowsSectionSchema,
    operationalActivity: operationalActivitySectionSchema,
  })
  .superRefine((overview, context) => {
    validateResolvedPeriods(overview.periods.current, overview.periods.comparison, context);
    validateGeneratedAt(overview.generatedAt, overview.periods.current, context);
    validateExpectedCurrentPeriod(
      overview.query.period,
      overview.generatedAt,
      overview.periods.current,
      context,
    );
    validateQueryCombination(overview.query, context, ["query", "groupBy"]);
    validateSectionAvailability(
      overview.queues.availability,
      [
        overview.queues.sellerReviews,
        overview.queues.productReviews,
        overview.queues.ordersNeedingAction,
        overview.queues.openSupportRequests,
      ],
      context,
      ["queues", "availability"],
    );
    validateSectionAvailability(
      overview.snapshot.availability,
      [
        overview.snapshot.activeSellers,
        overview.snapshot.publishedProducts,
        overview.snapshot.customers,
        overview.snapshot.openOrders,
      ],
      context,
      ["snapshot", "availability"],
    );
    validateSectionAvailability(
      overview.periodFlows.availability,
      [
        overview.periodFlows.sellerApplicationsSubmitted,
        overview.periodFlows.productsCreated,
        overview.periodFlows.ordersCreated,
        overview.periodFlows.supportTicketsOpened,
      ],
      context,
      ["periodFlows", "availability"],
    );

    const activitySeries = overview.operationalActivity.series;
    validateSectionAvailability(
      overview.operationalActivity.availability,
      [
        activitySeries.sellerApplicationsSubmitted,
        activitySeries.productsCreated,
        activitySeries.ordersCreated,
        activitySeries.supportTicketsOpened,
      ],
      context,
      ["operationalActivity", "availability"],
    );

    if (overview.operationalActivity.groupBy !== overview.query.groupBy) {
      context.addIssue({
        code: "custom",
        path: ["operationalActivity", "groupBy"],
        message: "Operational grouping does not match the resolved query.",
      });
    }

    Object.entries(activitySeries).forEach(([key, series]) => {
      validateActivitySeries(
        series,
        overview.periods.current,
        overview.periods.comparison,
        overview.query.groupBy,
        context,
        ["operationalActivity", "series", key],
      );
    });

    const flowPairs = [
      [
        "sellerApplicationsSubmitted",
        overview.periodFlows.sellerApplicationsSubmitted,
        activitySeries.sellerApplicationsSubmitted,
      ],
      [
        "productsCreated",
        overview.periodFlows.productsCreated,
        activitySeries.productsCreated,
      ],
      [
        "ordersCreated",
        overview.periodFlows.ordersCreated,
        activitySeries.ordersCreated,
      ],
      [
        "supportTicketsOpened",
        overview.periodFlows.supportTicketsOpened,
        activitySeries.supportTicketsOpened,
      ],
    ] as const;
    flowPairs.forEach(([key, flow, series]) => {
      validateFlowAndSeries(key, flow, series, context);
    });

    const keyedMetrics = [
      ["sellerReviews", overview.queues.sellerReviews],
      ["productReviews", overview.queues.productReviews],
      ["ordersNeedingAction", overview.queues.ordersNeedingAction],
      ["openSupportRequests", overview.queues.openSupportRequests],
      ["activeSellers", overview.snapshot.activeSellers],
      ["publishedProducts", overview.snapshot.publishedProducts],
      ["customers", overview.snapshot.customers],
      ["openOrders", overview.snapshot.openOrders],
    ] as const;
    keyedMetrics.forEach(([key, metric]) => {
      if (metric.id !== key) {
        context.addIssue({
          code: "custom",
          path: ["id"],
          message: `Metric ${key} has an inconsistent identifier.`,
        });
      }
    });
  });

export const adminDashboardOverviewResponseSchema = z.strictObject({
  status: z.literal("success"),
  data: z.strictObject({
    overview: adminDashboardOverviewSchema,
  }),
});

export class AdminDashboardOverviewContractError extends Error {
  constructor() {
    super("Admin dashboard overview response did not match the expected contract.");
    this.name = "AdminDashboardOverviewContractError";
  }
}

export function resolveAdminDashboardOverviewQuery(
  input: AdminDashboardOverviewQueryInput = {},
): AdminDashboardOverviewQuery {
  const result = queryInputSchema.safeParse(input);
  if (!result.success) throw new AdminDashboardOverviewContractError();
  return result.data;
}

export const parseAdminDashboardOverviewQuery =
  resolveAdminDashboardOverviewQuery;

export function serializeAdminDashboardOverviewQuery(
  input: AdminDashboardOverviewQueryInput = {},
): Readonly<Record<"period" | "comparison" | "groupBy", string>> {
  const query = resolveAdminDashboardOverviewQuery(input);
  return {
    period: query.period,
    comparison: query.comparison,
    groupBy: query.groupBy,
  };
}

export function serializeAdminDashboardOverviewQueryString(
  input: AdminDashboardOverviewQueryInput = {},
): string {
  const query = serializeAdminDashboardOverviewQuery(input);
  return new URLSearchParams([
    ["period", query.period],
    ["comparison", query.comparison],
    ["groupBy", query.groupBy],
  ]).toString();
}

export function parseAdminDashboardOverviewResponse(
  payload: unknown,
): AdminDashboardOverview {
  const result = adminDashboardOverviewResponseSchema.safeParse(payload);
  if (!result.success) throw new AdminDashboardOverviewContractError();
  return (result.data as AdminDashboardOverviewResponse).data.overview;
}

function resolvePercentageChange(
  currentValue: number,
  comparisonValue: number,
): number | null {
  if (comparisonValue === 0) return null;
  return (
    Math.round(((currentValue - comparisonValue) / comparisonValue) * 10_000) /
    100
  );
}

function validateFlowAndSeries(
  key: string,
  flow: AdminDashboardOverviewFlowMetric,
  series: AdminDashboardOverviewActivitySeries,
  context: z.RefinementCtx,
): void {
  if (flow.id !== key || series.id !== key) {
    context.addIssue({
      code: "custom",
      path: ["periodFlows", key, "id"],
      message: "Flow metric and activity identifiers must match their keys.",
    });
  }
  if (flow.availability !== series.availability) {
    context.addIssue({
      code: "custom",
      path: ["operationalActivity", "series", key, "availability"],
      message: "Flow and activity availability must match.",
    });
    return;
  }
  if (flow.availability === "UNAVAILABLE") {
    if (
      series.availability === "UNAVAILABLE" &&
      flow.reason !== series.reason
    ) {
      context.addIssue({
        code: "custom",
        path: ["operationalActivity", "series", key, "reason"],
        message: "Flow and activity unavailability reasons must match.",
      });
    }
    return;
  }
  if (series.availability !== "AVAILABLE") return;

  const currentTotal = sumSafe(series.points.map((point) => point.count));
  const comparisonTotal = sumSafe(
    series.points.map((point) => point.comparisonCount),
  );
  if (
    currentTotal === null ||
    comparisonTotal === null ||
    currentTotal !== flow.currentValue ||
    comparisonTotal !== flow.comparisonValue
  ) {
    context.addIssue({
      code: "custom",
      path: ["operationalActivity", "series", key, "points"],
      message: "Activity totals must match the corresponding flow metric.",
    });
  }
}

function sumSafe(values: readonly number[]): number | null {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

function validateQueryCombination(
  query: AdminDashboardOverviewQuery,
  context: z.RefinementCtx,
  path: PropertyKey[],
): void {
  if (!ALLOWED_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY[query.period].some((groupBy) => groupBy === query.groupBy)) {
    context.addIssue({
      code: "custom",
      path,
      message: "The resolved period and grouping are inconsistent.",
    });
  }
}

function validateResolvedPeriods(
  current: AdminDashboardOverviewResolvedPeriod,
  comparison: AdminDashboardOverviewResolvedPeriod,
  context: z.RefinementCtx,
): void {
  const currentStart = Date.parse(current.start);
  const currentEnd = Date.parse(current.end);
  const comparisonStart = Date.parse(comparison.start);
  const comparisonEnd = Date.parse(comparison.end);

  if (currentStart >= currentEnd) {
    context.addIssue({ code: "custom", path: ["periods", "current"], message: "Current period boundaries are invalid." });
  }
  if (comparisonStart >= comparisonEnd) {
    context.addIssue({ code: "custom", path: ["periods", "comparison"], message: "Comparison period boundaries are invalid." });
  }
  if (comparisonEnd !== currentStart || currentEnd - currentStart !== comparisonEnd - comparisonStart) {
    context.addIssue({ code: "custom", path: ["periods"], message: "Current and comparison periods are not contiguous equivalents." });
  }
}

function validateGeneratedAt(
  generatedAt: string,
  current: AdminDashboardOverviewResolvedPeriod,
  context: z.RefinementCtx,
): void {
  const generated = Date.parse(generatedAt);
  if (generated < Date.parse(current.start) || generated >= Date.parse(current.end)) {
    context.addIssue({ code: "custom", path: ["generatedAt"], message: "Generated time falls outside the current reporting period." });
  }
}

function validateExpectedCurrentPeriod(
  period: AdminDashboardOverviewQuery["period"],
  generatedAt: string,
  current: AdminDashboardOverviewResolvedPeriod,
  context: z.RefinementCtx,
): void {
  const generatedDate = new Date(generatedAt);
  if (!Number.isFinite(generatedDate.getTime())) {
    context.addIssue({
      code: "custom",
      path: ["generatedAt"],
      message: "Generated time cannot be resolved in the reporting time zone.",
    });
    return;
  }
  const localToday = getLusakaCalendarDate(generatedDate);
  if (!localToday) {
    context.addIssue({
      code: "custom",
      path: ["generatedAt"],
      message: "Generated time cannot be resolved in the reporting time zone.",
    });
    return;
  }

  const endDate = addCalendarDays(localToday, 1);
  const startDate = resolvePeriodStartDate(period, localToday, endDate);
  const expectedStart = zonedMidnight(startDate);
  const expectedEnd = zonedMidnight(endDate);
  if (expectedStart === null || expectedEnd === null) {
    context.addIssue({
      code: "custom",
      path: ["periods", "current"],
      message: "Reporting period boundaries cannot be resolved.",
    });
    return;
  }

  if (
    Date.parse(current.start) !== expectedStart ||
    Date.parse(current.end) !== expectedEnd
  ) {
    context.addIssue({
      code: "custom",
      path: ["periods", "current"],
      message: "Current period does not match the selected reporting period.",
    });
  }
}

function resolvePeriodStartDate(
  period: AdminDashboardOverviewQuery["period"],
  localToday: CalendarDate,
  endDate: CalendarDate,
): CalendarDate {
  switch (period) {
    case "LAST_7_DAYS":
      return addCalendarDays(endDate, -7);
    case "LAST_30_DAYS":
      return addCalendarDays(endDate, -30);
    case "MONTH_TO_DATE":
      return { year: localToday.year, month: localToday.month, day: 1 };
    case "QUARTER_TO_DATE":
      return {
        year: localToday.year,
        month: Math.floor((localToday.month - 1) / 3) * 3 + 1,
        day: 1,
      };
  }
}

function getLusakaCalendarDate(date: Date): CalendarDate | null {
  if (!Number.isFinite(date.getTime())) return null;
  const parts = readCalendarParts(lusakaDateFormatter.formatToParts(date));
  return parts
    ? { year: parts.year, month: parts.month, day: parts.day }
    : null;
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function zonedMidnight(date: CalendarDate): number | null {
  const target = Date.UTC(date.year, date.month - 1, date.day);
  let candidate = target;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const candidateDate = new Date(candidate);
    if (!Number.isFinite(candidateDate.getTime())) return null;
    const parts = readCalendarParts(
      lusakaDateTimeFormatter.formatToParts(candidateDate),
    );
    if (!parts) return null;
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const correction = target - represented;
    candidate += correction;
    if (correction === 0) return candidate;
  }

  return null;
}

function readCalendarParts(
  parts: Intl.DateTimeFormatPart[],
): (CalendarDate & {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}) | null {
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const parsed = {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour") ?? 0),
    minute: Number(values.get("minute") ?? 0),
    second: Number(values.get("second") ?? 0),
  };

  return Object.values(parsed).every(Number.isInteger) ? parsed : null;
}

function validateSectionAvailability(
  availability: AdminDashboardOverviewAvailability,
  children: readonly { availability: "AVAILABLE" | "UNAVAILABLE" }[],
  context: z.RefinementCtx,
  path: PropertyKey[],
): void {
  const availableCount = children.filter((child) => child.availability === "AVAILABLE").length;
  const expected = availableCount === children.length
    ? "AVAILABLE"
    : availableCount === 0
      ? "UNAVAILABLE"
      : "PARTIAL";
  if (availability !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message: "Section availability does not match its metrics.",
    });
  }
}

function validateActivitySeries(
  series: AdminDashboardOverviewActivitySeries,
  current: AdminDashboardOverviewResolvedPeriod,
  comparison: AdminDashboardOverviewResolvedPeriod,
  groupBy: AdminDashboardOverviewGroupBy,
  context: z.RefinementCtx,
  path: PropertyKey[],
): void {
  if (series.availability === "UNAVAILABLE") return;

  const step = groupBy === "DAY" ? 86_400_000 : 604_800_000;
  const currentStart = Date.parse(current.start);
  const currentEnd = Date.parse(current.end);
  const comparisonStart = Date.parse(comparison.start);
  const comparisonEnd = Date.parse(comparison.end);
  const expectedPointCount = Math.ceil((currentEnd - currentStart) / step);

  if (series.points.length !== expectedPointCount) {
    context.addIssue({ code: "custom", path: [...path, "points"], message: "Series bucket count does not match the reporting period." });
    return;
  }

  let currentCursor = currentStart;
  let comparisonCursor = comparisonStart;
  series.points.forEach((point, index) => {
    const bucketStart = Date.parse(point.bucketStart);
    const bucketEnd = Date.parse(point.bucketEnd);
    const comparisonBucketStart = Date.parse(point.comparisonBucketStart);
    const comparisonBucketEnd = Date.parse(point.comparisonBucketEnd);
    const expectedCurrentEnd = Math.min(currentCursor + step, currentEnd);
    const expectedComparisonEnd = Math.min(comparisonCursor + step, comparisonEnd);

    if (
      bucketStart !== currentCursor ||
      bucketEnd !== expectedCurrentEnd ||
      comparisonBucketStart !== comparisonCursor ||
      comparisonBucketEnd !== expectedComparisonEnd ||
      bucketEnd <= bucketStart ||
      comparisonBucketEnd <= comparisonBucketStart ||
      bucketEnd - bucketStart !== comparisonBucketEnd - comparisonBucketStart
    ) {
      context.addIssue({
        code: "custom",
        path: [...path, "points", index],
        message: "Series bucket boundaries are invalid or out of order.",
      });
    }

    currentCursor = expectedCurrentEnd;
    comparisonCursor = expectedComparisonEnd;
  });

  if (currentCursor !== currentEnd || comparisonCursor !== comparisonEnd) {
    context.addIssue({ code: "custom", path: [...path, "points"], message: "Series does not cover both reporting periods." });
  }
}
