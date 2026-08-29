export type AdminDashboardSectionAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "UNAVAILABLE";

export type AdminDashboardMetricUnavailableReason =
  | "PERMISSION_REQUIRED"
  | "DATA_SOURCE_UNAVAILABLE";

export type AdminDashboardMetricDimension =
  | "APPLICATION_STATUS"
  | "PRODUCT_STATUS"
  | "ORDER_STATUS"
  | "TICKET_STATUS"
  | "ROLE";

export interface AdminDashboardMetricDefinition {
  dimension: AdminDashboardMetricDimension;
  values: string[];
}

export interface AvailableAdminDashboardMetric {
  availability: "AVAILABLE";
  count: number;
  definition: AdminDashboardMetricDefinition;
}

export interface UnavailableAdminDashboardMetric {
  availability: "UNAVAILABLE";
  reason: AdminDashboardMetricUnavailableReason;
  definition: AdminDashboardMetricDefinition;
}

export type AdminDashboardMetric =
  | AvailableAdminDashboardMetric
  | UnavailableAdminDashboardMetric;

export interface AdminDashboardSummary {
  version: 1;
  generatedAt: string;
  priorities: {
    availability: AdminDashboardSectionAvailability;
    sellerReviews: AdminDashboardMetric;
    productReviews: AdminDashboardMetric;
    ordersNeedingAction: AdminDashboardMetric;
    openSupportRequests: AdminDashboardMetric;
  };
  snapshot: {
    availability: AdminDashboardSectionAvailability;
    activeSellers: AdminDashboardMetric;
    publishedProducts: AdminDashboardMetric;
    customers: AdminDashboardMetric;
    openOrders: AdminDashboardMetric;
  };
}

export type AdminDashboardPriorityKey = keyof Omit<
  AdminDashboardSummary["priorities"],
  "availability"
>;

export type AdminDashboardSnapshotKey = keyof Omit<
  AdminDashboardSummary["snapshot"],
  "availability"
>;
