import type {
  AdminDashboardMetric,
  AdminDashboardMetricDefinition,
  AdminDashboardMetricDimension,
  AdminDashboardSectionAvailability,
  AdminDashboardSummary,
} from "@/features/admin-overview/types/dashboard-summary";

type RecordValue = Record<string, unknown>;

const SECTION_AVAILABILITIES = new Set<AdminDashboardSectionAvailability>([
  "AVAILABLE",
  "PARTIAL",
  "UNAVAILABLE",
]);

const METRIC_UNAVAILABLE_REASONS = new Set([
  "PERMISSION_REQUIRED",
  "DATA_SOURCE_UNAVAILABLE",
]);

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export class AdminDashboardSummaryContractError extends Error {
  constructor() {
    super("The admin overview response could not be verified.");
    this.name = "AdminDashboardSummaryContractError";
  }
}

function asRecord(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function failContract(): never {
  throw new AdminDashboardSummaryContractError();
}

function parseDefinition(
  value: unknown,
  expectedDimension: AdminDashboardMetricDimension,
): AdminDashboardMetricDefinition {
  const record = asRecord(value);
  if (record?.dimension !== expectedDimension || !Array.isArray(record.values)) {
    return failContract();
  }

  const values: string[] = [];
  const seen = new Set<string>();
  for (const item of record.values) {
    if (typeof item !== "string" || !item.trim() || seen.has(item)) {
      return failContract();
    }
    seen.add(item);
    values.push(item);
  }

  if (values.length === 0) return failContract();
  return { dimension: expectedDimension, values };
}

function parseMetric(
  value: unknown,
  expectedDimension: AdminDashboardMetricDimension,
): AdminDashboardMetric {
  const record = asRecord(value);
  if (!record) return failContract();

  const definition = parseDefinition(record.definition, expectedDimension);
  if (record.availability === "AVAILABLE") {
    if (
      !Number.isSafeInteger(record.count) ||
      typeof record.count !== "number" ||
      record.count < 0 ||
      "reason" in record
    ) {
      return failContract();
    }
    return { availability: "AVAILABLE", count: record.count, definition };
  }

  if (
    record.availability === "UNAVAILABLE" &&
    typeof record.reason === "string" &&
    METRIC_UNAVAILABLE_REASONS.has(record.reason) &&
    !("count" in record)
  ) {
    return {
      availability: "UNAVAILABLE",
      reason: record.reason as "PERMISSION_REQUIRED" | "DATA_SOURCE_UNAVAILABLE",
      definition,
    };
  }

  return failContract();
}

function resolveAvailability(
  metrics: readonly AdminDashboardMetric[],
): AdminDashboardSectionAvailability {
  const availableCount = metrics.filter(
    (metric) => metric.availability === "AVAILABLE",
  ).length;
  if (availableCount === metrics.length) return "AVAILABLE";
  if (availableCount === 0) return "UNAVAILABLE";
  return "PARTIAL";
}

function parseSectionAvailability(
  value: unknown,
  metrics: readonly AdminDashboardMetric[],
): AdminDashboardSectionAvailability {
  if (
    typeof value !== "string" ||
    !SECTION_AVAILABILITIES.has(value as AdminDashboardSectionAvailability) ||
    value !== resolveAvailability(metrics)
  ) {
    return failContract();
  }
  return value as AdminDashboardSectionAvailability;
}

export function parseAdminDashboardSummaryResponse(
  payload: unknown,
): AdminDashboardSummary {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const summary = asRecord(data?.summary);

  if (root?.status !== "success" || summary?.version !== 1) {
    return failContract();
  }

  const generatedAt = summary.generatedAt;
  if (
    typeof generatedAt !== "string" ||
    !generatedAt.trim() ||
    !ISO_DATE_TIME_PATTERN.test(generatedAt) ||
    !Number.isFinite(Date.parse(generatedAt))
  ) {
    return failContract();
  }

  const prioritiesRecord = asRecord(summary.priorities);
  const snapshotRecord = asRecord(summary.snapshot);
  if (!prioritiesRecord || !snapshotRecord) return failContract();

  const sellerReviews = parseMetric(
    prioritiesRecord.sellerReviews,
    "APPLICATION_STATUS",
  );
  const productReviews = parseMetric(
    prioritiesRecord.productReviews,
    "PRODUCT_STATUS",
  );
  const ordersNeedingAction = parseMetric(
    prioritiesRecord.ordersNeedingAction,
    "ORDER_STATUS",
  );
  const openSupportRequests = parseMetric(
    prioritiesRecord.openSupportRequests,
    "TICKET_STATUS",
  );
  const activeSellers = parseMetric(
    snapshotRecord.activeSellers,
    "APPLICATION_STATUS",
  );
  const publishedProducts = parseMetric(
    snapshotRecord.publishedProducts,
    "PRODUCT_STATUS",
  );
  const customers = parseMetric(snapshotRecord.customers, "ROLE");
  const openOrders = parseMetric(snapshotRecord.openOrders, "ORDER_STATUS");

  const priorities = [
    sellerReviews,
    productReviews,
    ordersNeedingAction,
    openSupportRequests,
  ] as const;
  const snapshot = [
    activeSellers,
    publishedProducts,
    customers,
    openOrders,
  ] as const;

  return {
    version: 1,
    generatedAt,
    priorities: {
      availability: parseSectionAvailability(
        prioritiesRecord.availability,
        priorities,
      ),
      sellerReviews,
      productReviews,
      ordersNeedingAction,
      openSupportRequests,
    },
    snapshot: {
      availability: parseSectionAvailability(
        snapshotRecord.availability,
        snapshot,
      ),
      activeSellers,
      publishedProducts,
      customers,
      openOrders,
    },
  };
}
