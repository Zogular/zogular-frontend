export type AdminDashboardOverviewPeriod =
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "MONTH_TO_DATE"
  | "QUARTER_TO_DATE";

export type AdminDashboardOverviewComparison = "PREVIOUS_PERIOD";
export type AdminDashboardOverviewGroupBy = "DAY" | "WEEK";
export type AdminDashboardOverviewAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "UNAVAILABLE";
export type AdminDashboardOverviewUnavailableReason =
  | "PERMISSION_REQUIRED"
  | "DATA_SOURCE_UNAVAILABLE";
export type AdminDashboardOverviewPermissionMode = "ANY" | "ALL";

export interface AdminDashboardOverviewQueryInput {
  readonly period?: AdminDashboardOverviewPeriod;
  readonly comparison?: AdminDashboardOverviewComparison;
  readonly groupBy?: AdminDashboardOverviewGroupBy;
}

export interface AdminDashboardOverviewQuery {
  readonly period: AdminDashboardOverviewPeriod;
  readonly comparison: AdminDashboardOverviewComparison;
  readonly groupBy: AdminDashboardOverviewGroupBy;
}

export interface AdminDashboardOverviewMetricMetadata {
  readonly id: string;
  readonly label: string;
  readonly definition: string;
  readonly unit: "COUNT";
  readonly source: string;
  readonly requiredPermissions: readonly string[];
  readonly permissionMode: AdminDashboardOverviewPermissionMode;
}

export interface AdminDashboardOverviewUnavailableMetric
  extends AdminDashboardOverviewMetricMetadata {
  readonly availability: "UNAVAILABLE";
  readonly reason: AdminDashboardOverviewUnavailableReason;
}

export interface AdminDashboardOverviewAvailableCountMetric
  extends AdminDashboardOverviewMetricMetadata {
  readonly availability: "AVAILABLE";
  readonly value: number;
}

export type AdminDashboardOverviewCountMetric =
  | AdminDashboardOverviewAvailableCountMetric
  | AdminDashboardOverviewUnavailableMetric;

export interface AdminDashboardOverviewAvailableQueueMetric
  extends AdminDashboardOverviewMetricMetadata {
  readonly availability: "AVAILABLE";
  readonly value: number;
  readonly oldestItemAgeSeconds: number | null;
  readonly ageBasis: "SUBMITTED_AT" | "CREATED_AT" | "NOT_AVAILABLE";
}

export type AdminDashboardOverviewQueueMetric =
  | AdminDashboardOverviewAvailableQueueMetric
  | AdminDashboardOverviewUnavailableMetric;

export interface AdminDashboardOverviewAvailableFlowMetric
  extends AdminDashboardOverviewMetricMetadata {
  readonly availability: "AVAILABLE";
  readonly currentValue: number;
  readonly comparisonValue: number;
  readonly absoluteChange: number;
  readonly percentageChange: number | null;
}

export type AdminDashboardOverviewFlowMetric =
  | AdminDashboardOverviewAvailableFlowMetric
  | AdminDashboardOverviewUnavailableMetric;

export interface AdminDashboardOverviewActivityPoint {
  readonly bucketStart: string;
  readonly bucketEnd: string;
  readonly count: number;
  readonly comparisonBucketStart: string;
  readonly comparisonBucketEnd: string;
  readonly comparisonCount: number;
}

export interface AdminDashboardOverviewAvailableActivitySeries
  extends AdminDashboardOverviewMetricMetadata {
  readonly availability: "AVAILABLE";
  readonly points: readonly AdminDashboardOverviewActivityPoint[];
}

export type AdminDashboardOverviewActivitySeries =
  | AdminDashboardOverviewAvailableActivitySeries
  | AdminDashboardOverviewUnavailableMetric;

export interface AdminDashboardOverviewResolvedPeriod {
  readonly start: string;
  readonly end: string;
  readonly endExclusive: true;
}

export interface AdminDashboardOverview {
  readonly version: 1;
  readonly generatedAt: string;
  readonly timeZone: "Africa/Lusaka";
  readonly scope: "MARKETPLACE";
  readonly query: AdminDashboardOverviewQuery;
  readonly periods: {
    readonly current: AdminDashboardOverviewResolvedPeriod;
    readonly comparison: AdminDashboardOverviewResolvedPeriod;
  };
  readonly queues: {
    readonly availability: AdminDashboardOverviewAvailability;
    readonly permissionPolicy: "METRIC_LEVEL";
    readonly sellerReviews: AdminDashboardOverviewQueueMetric;
    readonly productReviews: AdminDashboardOverviewQueueMetric;
    readonly ordersNeedingAction: AdminDashboardOverviewQueueMetric;
    readonly openSupportRequests: AdminDashboardOverviewQueueMetric;
  };
  readonly snapshot: {
    readonly availability: AdminDashboardOverviewAvailability;
    readonly permissionPolicy: "METRIC_LEVEL";
    readonly activeSellers: AdminDashboardOverviewCountMetric;
    readonly publishedProducts: AdminDashboardOverviewCountMetric;
    readonly customers: AdminDashboardOverviewCountMetric;
    readonly openOrders: AdminDashboardOverviewCountMetric;
  };
  readonly periodFlows: {
    readonly availability: AdminDashboardOverviewAvailability;
    readonly permissionPolicy: "METRIC_LEVEL";
    readonly sellerApplicationsSubmitted: AdminDashboardOverviewFlowMetric;
    readonly productsCreated: AdminDashboardOverviewFlowMetric;
    readonly ordersCreated: AdminDashboardOverviewFlowMetric;
    readonly supportTicketsOpened: AdminDashboardOverviewFlowMetric;
  };
  readonly operationalActivity: {
    readonly id: "operationalWorkEntered";
    readonly label: "Operational work entered";
    readonly question: "How much new operational work entered Zogular during the selected period compared with the immediately preceding equivalent period?";
    readonly unit: "COUNT";
    readonly groupBy: AdminDashboardOverviewGroupBy;
    readonly availability: AdminDashboardOverviewAvailability;
    readonly permissionPolicy: "METRIC_LEVEL";
    readonly series: {
      readonly sellerApplicationsSubmitted: AdminDashboardOverviewActivitySeries;
      readonly productsCreated: AdminDashboardOverviewActivitySeries;
      readonly ordersCreated: AdminDashboardOverviewActivitySeries;
      readonly supportTicketsOpened: AdminDashboardOverviewActivitySeries;
    };
  };
}

export interface AdminDashboardOverviewResponse {
  readonly status: "success";
  readonly data: {
    readonly overview: AdminDashboardOverview;
  };
}
