import type { Permission } from "@/services/rbac";
import {
  adminIdentityHasPermission,
  type AdminIdentity,
} from "@/services/admin/session";
import type {
  AdminDashboardOverview,
  AdminDashboardOverviewGroupBy,
  AdminDashboardOverviewPeriod,
} from "@/features/admin-overview/types/dashboard-overview";

export type QueueKey =
  | "sellerReviews"
  | "productReviews"
  | "ordersNeedingAction"
  | "openSupportRequests";

export type SnapshotKey =
  | "activeSellers"
  | "publishedProducts"
  | "customers"
  | "openOrders";

export type FlowKey =
  | "sellerApplicationsSubmitted"
  | "productsCreated"
  | "ordersCreated"
  | "supportTicketsOpened";

export interface QueuePresentation {
  key: QueueKey;
  label: string;
  detail: string;
  href: string;
  permission: Permission;
}

export interface SnapshotPresentation {
  key: SnapshotKey;
  label: string;
}

export interface FlowPresentation {
  key: FlowKey;
  label: string;
  shortLabel: string;
}

export const QUEUE_PRESENTATION: readonly QueuePresentation[] = [
  {
    key: "sellerReviews",
    label: "Seller reviews",
    detail: "Applications waiting for review",
    href: "/admin/sellers",
    permission: "view_sellers",
  },
  {
    key: "productReviews",
    label: "Product reviews",
    detail: "Listings waiting for review",
    href: "/admin/products",
    permission: "view_products",
  },
  {
    key: "ordersNeedingAction",
    label: "Orders needing action",
    detail: "Open orders in progress",
    href: "/admin/orders",
    permission: "view_orders",
  },
  {
    key: "openSupportRequests",
    label: "Open support requests",
    detail: "Requests waiting for support",
    href: "/admin/support",
    permission: "view_support_tickets",
  },
];

export const SNAPSHOT_PRESENTATION: readonly SnapshotPresentation[] = [
  { key: "activeSellers", label: "Active sellers" },
  { key: "publishedProducts", label: "Published products" },
  { key: "customers", label: "Customers" },
  { key: "openOrders", label: "Open orders" },
];

export const FLOW_PRESENTATION: readonly FlowPresentation[] = [
  {
    key: "sellerApplicationsSubmitted",
    label: "Seller applications submitted",
    shortLabel: "Seller applications",
  },
  { key: "productsCreated", label: "Products created", shortLabel: "Products" },
  { key: "ordersCreated", label: "Orders created", shortLabel: "Orders" },
  {
    key: "supportTicketsOpened",
    label: "Support tickets opened",
    shortLabel: "Support tickets",
  },
];

export const PERIOD_OPTIONS: readonly {
  value: AdminDashboardOverviewPeriod;
  label: string;
  shortLabel: string;
}[] = [
  { value: "LAST_7_DAYS", label: "Last 7 days", shortLabel: "7 days" },
  { value: "LAST_30_DAYS", label: "Last 30 days", shortLabel: "30 days" },
  { value: "MONTH_TO_DATE", label: "Month to date", shortLabel: "Month" },
  { value: "QUARTER_TO_DATE", label: "Quarter to date", shortLabel: "Quarter" },
];

export const GROUP_BY_OPTIONS: Readonly<
  Record<AdminDashboardOverviewPeriod, readonly AdminDashboardOverviewGroupBy[]>
> = {
  LAST_7_DAYS: ["DAY"],
  LAST_30_DAYS: ["DAY", "WEEK"],
  MONTH_TO_DATE: ["DAY", "WEEK"],
  QUARTER_TO_DATE: ["WEEK"],
};

export interface AttentionItem extends Omit<QueuePresentation, "href"> {
  count: number;
  href: string | null;
  oldestWaitingLabel: string | null;
}

export interface UnavailableActivitySeriesItem {
  key: FlowKey;
  label: string;
  reason: "PERMISSION_REQUIRED" | "DATA_SOURCE_UNAVAILABLE";
  message: string;
}

type UnavailableMetric = {
  availability: "UNAVAILABLE";
  reason: "PERMISSION_REQUIRED" | "DATA_SOURCE_UNAVAILABLE";
};

export function formatQueueWaitingAge(seconds: number): string {
  if (seconds < 60) return "Oldest waiting less than a minute";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Oldest waiting ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Oldest waiting ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const days = Math.floor(hours / 24);
  return `Oldest waiting ${days} ${days === 1 ? "day" : "days"}`;
}

export function getNeedsAttentionItems(
  overview: AdminDashboardOverview,
  identity: AdminIdentity,
): AttentionItem[] {
  return QUEUE_PRESENTATION.flatMap((item) => {
    const metric = overview.queues[item.key];
    if (metric.availability !== "AVAILABLE" || metric.value === 0) {
      return [];
    }
    return [
      {
        ...item,
        count: metric.value,
        href: adminIdentityHasPermission(identity, item.permission)
          ? item.href
          : null,
        oldestWaitingLabel:
          metric.oldestItemAgeSeconds === null
            ? null
            : formatQueueWaitingAge(metric.oldestItemAgeSeconds),
      },
    ];
  }).sort((left, right) => right.count - left.count);
}

export function getUnavailableMetricCopy(metric: UnavailableMetric): string {
  return metric.reason === "PERMISSION_REQUIRED"
    ? "Not available for your role"
    : "Temporarily unavailable";
}

export function getUnavailableActivitySeriesItems(
  overview: AdminDashboardOverview,
): UnavailableActivitySeriesItem[] {
  return FLOW_PRESENTATION.flatMap((item) => {
    const series = overview.operationalActivity.series[item.key];
    if (series.availability === "AVAILABLE") return [];
    return [
      {
        key: item.key,
        label: item.label,
        reason: series.reason,
        message: getUnavailableMetricCopy(series),
      },
    ];
  });
}

export function getSectionUnavailableCopy(
  availability: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE",
  metrics: readonly ({ availability: "AVAILABLE" } | UnavailableMetric)[],
  label: string,
): string | null {
  if (availability === "AVAILABLE") return null;
  if (availability === "PARTIAL") {
    return `Some ${label} are temporarily unavailable or restricted.`;
  }
  const permissionOnly = metrics.every(
    (metric) =>
      metric.availability === "UNAVAILABLE" &&
      metric.reason === "PERMISSION_REQUIRED",
  );
  return permissionOnly
    ? `${label[0].toUpperCase()}${label.slice(1)} are not available for your role.`
    : `${label[0].toUpperCase()}${label.slice(1)} are temporarily unavailable.`;
}

export function formatSignedCount(value: number): string {
  if (value === 0) return "No change";
  const amount = Math.abs(value).toLocaleString("en-ZM");
  return value > 0
    ? `${amount} more than the previous period`
    : `${amount} fewer than the previous period`;
}

export function formatPercentageChange(value: number | null): string {
  if (value === null) {
    return "Percentage unavailable because the previous period was zero";
  }
  if (value === 0) return "0% change";
  return `${Math.abs(value).toLocaleString("en-ZM", {
    maximumFractionDigits: 1,
  })}% ${value > 0 ? "increase" : "decrease"}`;
}

export function isAdminOverviewEmpty(overview: AdminDashboardOverview): boolean {
  const metrics = [
    ...QUEUE_PRESENTATION.map((item) => overview.queues[item.key]),
    ...SNAPSHOT_PRESENTATION.map((item) => overview.snapshot[item.key]),
    ...FLOW_PRESENTATION.map((item) => overview.periodFlows[item.key]),
  ];
  return metrics.every((metric) => {
    if (metric.availability !== "AVAILABLE") return false;
    return "value" in metric ? metric.value === 0 : metric.currentValue === 0;
  });
}
