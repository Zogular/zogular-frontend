import { z } from "zod";
import { AdminCapabilityIdSchema } from "./capabilities";

export const ADMIN_METRIC_CONTRACT_VERSION = 1 as const;
export const ADMIN_CHART_CONTRACT_VERSION = 1 as const;

const TimestampSchema = z.iso.datetime({ offset: true });
const MetricKeySchema = z.string().min(1).max(80).regex(/^[a-z][a-zA-Z0-9]*$/);

export const AdminMetricPeriodSchema = z
  .strictObject({
    start: TimestampSchema,
    end: TimestampSchema,
    timeZone: z.string().min(1).max(80).regex(/^[A-Za-z_+-]+\/[A-Za-z0-9_+/-]+$/),
  })
  .superRefine((value, context) => {
    if (Date.parse(value.start) >= Date.parse(value.end)) {
      context.addIssue({
        code: "custom",
        path: ["end"],
        message: "Metric period end must be later than its start.",
      });
    }
  });

export const AdminMetricUnitSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("count") }),
  z.strictObject({ kind: z.literal("percentage") }),
  z.strictObject({ kind: z.literal("duration_seconds") }),
  z.strictObject({
    kind: z.literal("currency"),
    currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  }),
]);

export const AdminMetricValueSchema = z.discriminatedUnion("availability", [
  z.strictObject({
    availability: z.literal("available"),
    value: z.number().finite(),
  }),
  z.strictObject({
    availability: z.literal("unavailable"),
    reason: z.enum([
      "permission_required",
      "not_implemented",
      "data_source_unavailable",
      "definition_unavailable",
    ]),
  }),
]);

export const AdminMetricComparisonSchema = z.discriminatedUnion("availability", [
  z.strictObject({
    availability: z.literal("available"),
    value: z.number().finite(),
    label: z.string().min(1).max(100),
    period: AdminMetricPeriodSchema,
  }),
  z.strictObject({
    availability: z.literal("unavailable"),
    reason: z.enum([
      "permission_required",
      "not_requested",
      "not_supported",
      "data_source_unavailable",
    ]),
  }),
]);

export const AdminMetricSchema = z
  .strictObject({
    version: z.literal(ADMIN_METRIC_CONTRACT_VERSION),
    key: MetricKeySchema,
    label: z.string().min(1).max(100),
    definition: z.string().min(1).max(500),
    source: z.string().min(1).max(300),
    unit: AdminMetricUnitSchema,
    period: AdminMetricPeriodSchema,
    current: AdminMetricValueSchema,
    comparison: AdminMetricComparisonSchema,
    generatedAt: TimestampSchema,
    permissionState: z.enum(["allowed", "forbidden", "unknown"]),
    drillThrough: z
      .strictObject({
        capabilityId: AdminCapabilityIdSchema,
        route: z.string().min(1).max(200).regex(/^\/admin(?:\/[a-z0-9-]+)*$/),
      })
      .nullable(),
  })
  .superRefine((value, context) => {
    if (value.permissionState !== "allowed") {
      if (
        value.current.availability !== "unavailable" ||
        value.current.reason !== "permission_required"
      ) {
        context.addIssue({
          code: "custom",
          path: ["current"],
          message: "A metric without confirmed visibility must hide its current value.",
        });
      }
      if (
        value.comparison.availability !== "unavailable" ||
        value.comparison.reason !== "permission_required"
      ) {
        context.addIssue({
          code: "custom",
          path: ["comparison"],
          message: "A metric without confirmed visibility must hide its comparison.",
        });
      }
      if (value.drillThrough !== null) {
        context.addIssue({
          code: "custom",
          path: ["drillThrough"],
          message: "A metric without confirmed visibility cannot expose drill-through navigation.",
        });
      }
      return;
    }
    if (
      value.current.availability === "unavailable" &&
      value.current.reason === "permission_required"
    ) {
      context.addIssue({
        code: "custom",
        path: ["current"],
        message: "An allowed metric cannot report permission-required current data.",
      });
    }
    if (
      value.comparison.availability === "unavailable" &&
      value.comparison.reason === "permission_required"
    ) {
      context.addIssue({
        code: "custom",
        path: ["comparison"],
        message: "An allowed metric cannot report a permission-required comparison.",
      });
    }
  });

export const AdminChartSeriesSchema = z.strictObject({
  key: MetricKeySchema,
  label: z.string().min(1).max(100),
  unit: AdminMetricUnitSchema,
});

const AdminTimeSeriesPointSchema = z.strictObject({
  kind: z.literal("time_series"),
  timestamp: TimestampSchema,
  seriesKey: MetricKeySchema,
  value: z.number().finite(),
});

const AdminCategoryPointSchema = z.strictObject({
  kind: z.literal("category"),
  categoryKey: z.string().min(1).max(120),
  categoryLabel: z.string().min(1).max(160),
  seriesKey: MetricKeySchema,
  value: z.number().finite(),
});

const AccessibleCellSchema = z.union([z.string().max(240), z.number().finite(), z.null()]);

const AdminAvailableChartSchema = z.strictObject({
    version: z.literal(ADMIN_CHART_CONTRACT_VERSION),
    key: MetricKeySchema,
    label: z.string().min(1).max(120),
    definition: z.string().min(1).max(500),
    period: AdminMetricPeriodSchema,
    generatedAt: TimestampSchema,
    permissionState: z.literal("allowed"),
    availability: z.literal("available"),
    series: z.array(AdminChartSeriesSchema).min(1).max(20),
    points: z
      .array(z.discriminatedUnion("kind", [AdminTimeSeriesPointSchema, AdminCategoryPointSchema]))
      .min(1)
      .max(2_000),
    accessibility: z.strictObject({
      textSummary: z.string().min(1).max(1_000),
      tableCaption: z.string().min(1).max(240),
      columns: z.array(z.string().min(1).max(120)).min(2).max(30),
      rows: z.array(z.array(AccessibleCellSchema).min(2).max(30)).min(1).max(2_000),
    }),
  });

const AdminUnavailableChartSchema = z.strictObject({
  version: z.literal(ADMIN_CHART_CONTRACT_VERSION),
  key: MetricKeySchema,
  label: z.string().min(1).max(120),
  definition: z.string().min(1).max(500),
  period: AdminMetricPeriodSchema,
  generatedAt: TimestampSchema,
  permissionState: z.enum(["allowed", "forbidden", "unknown"]),
  availability: z.literal("unavailable"),
  reason: z.enum([
    "permission_required",
    "not_implemented",
    "data_source_unavailable",
    "definition_unavailable",
  ]),
  accessibility: z.strictObject({
    textSummary: z.literal("Chart data is unavailable."),
  }),
});

export const AdminChartSchema = z
  .discriminatedUnion("availability", [AdminAvailableChartSchema, AdminUnavailableChartSchema])
  .superRefine((value, context) => {
    if (value.availability === "unavailable") {
      if (value.permissionState !== "allowed" && value.reason !== "permission_required") {
        context.addIssue({
          code: "custom",
          path: ["reason"],
          message: "A chart without confirmed visibility must report permission-required unavailability.",
        });
      }
      if (value.permissionState === "allowed" && value.reason === "permission_required") {
        context.addIssue({
          code: "custom",
          path: ["reason"],
          message: "An allowed chart cannot report permission-required unavailability.",
        });
      }
      return;
    }

    const seriesKeys = value.series.map((series) => series.key);
    if (new Set(seriesKeys).size !== seriesKeys.length) {
      context.addIssue({ code: "custom", path: ["series"], message: "Chart series keys must be unique." });
    }
    for (const [index, point] of value.points.entries()) {
      if (!seriesKeys.includes(point.seriesKey)) {
        context.addIssue({
          code: "custom",
          path: ["points", index, "seriesKey"],
          message: "Chart points must reference a declared series.",
        });
      }
    }
    for (const [index, row] of value.accessibility.rows.entries()) {
      if (row.length !== value.accessibility.columns.length) {
        context.addIssue({
          code: "custom",
          path: ["accessibility", "rows", index],
          message: "Accessible table rows must match the declared columns.",
        });
      }
    }
  });

export type AdminMetric = z.infer<typeof AdminMetricSchema>;
export type AdminChart = z.infer<typeof AdminChartSchema>;
