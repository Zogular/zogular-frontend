import type { Permission } from "@/services/rbac";
import { adminIdentityHasPermission, type AdminIdentity } from "@/services/admin/session";
import type {
  AdminDashboardMetric,
  AdminDashboardPriorityKey,
  AdminDashboardSnapshotKey,
  AdminDashboardSummary,
} from "@/features/admin-overview/types/dashboard-summary";

export interface PriorityPresentation {
  key: AdminDashboardPriorityKey;
  label: string;
  detail: string;
  href: string;
  permission: Permission;
}

export interface SnapshotPresentation {
  key: AdminDashboardSnapshotKey;
  label: string;
}

export const PRIORITY_PRESENTATION: readonly PriorityPresentation[] = [
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

export interface AttentionItem extends PriorityPresentation {
  count: number;
}

export function getNeedsAttentionItems(
  summary: AdminDashboardSummary,
  identity: AdminIdentity,
): AttentionItem[] {
  return PRIORITY_PRESENTATION.flatMap((item) => {
    const metric = summary.priorities[item.key];
    if (
      metric.availability !== "AVAILABLE" ||
      metric.count === 0 ||
      !adminIdentityHasPermission(identity, item.permission)
    ) {
      return [];
    }
    return [{ ...item, count: metric.count }];
  }).sort((left, right) => right.count - left.count);
}

export function getUnavailableMetricCopy(metric: AdminDashboardMetric): string {
  if (metric.availability === "AVAILABLE") return "";
  return metric.reason === "PERMISSION_REQUIRED"
    ? "Not available for your role"
    : "Temporarily unavailable";
}

export function isAdminOverviewEmpty(summary: AdminDashboardSummary): boolean {
  const metrics = [
    ...PRIORITY_PRESENTATION.map((item) => summary.priorities[item.key]),
    ...SNAPSHOT_PRESENTATION.map((item) => summary.snapshot[item.key]),
  ];
  return (
    metrics.every((metric) => metric.availability === "AVAILABLE") &&
    metrics.every(
      (metric) => metric.availability !== "AVAILABLE" || metric.count === 0,
    )
  );
}
