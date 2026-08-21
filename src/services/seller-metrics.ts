import { ApiError } from "@/services/api";
import {
  SELLER_CATALOG_CATEGORIES,
  SellerCatalogCollectionError,
  fetchSellerCatalogProducts,
  type SellerProductListing,
} from "@/services/seller-catalog";
import {
  SellerOrderCollectionError,
  sellerOrdersApi,
  type SellerOrderDetail,
  type SellerOrderItem,
  type SellerOrderStatus,
} from "@/services/seller-orders";

export type SellerDashboardRange = "7d" | "30d" | "12m";
export type SellerAnalyticsTimeRange = "24h" | SellerDashboardRange;
export type SellerAnalyticsCategoryFilter = "all" | string;

export interface SellerMetricsUtcBounds {
  createdFrom: string;
  createdTo: string;
}

export interface SellerTrendPoint {
  label: string;
  grossItemSales: number;
  orders: number;
}

export interface SellerGrossSalesPoint {
  label: string;
  grossItemSales: number;
}

export interface SellerOrderStatusPoint {
  name: string;
  value: number;
  color: string;
}

export interface SellerLowStockItem {
  id: string;
  name: string;
  stock: number;
  threshold: number;
}

export interface SellerRecentOrder {
  id: string;
  customer: string;
  total: number;
  status: SellerOrderStatus;
}

export interface SellerActivityItem {
  id: string;
  text: string;
  time: string;
  tone: "info" | "warning" | "success";
}

export interface SellerDashboardData {
  range: SellerDashboardRange;
  bounds: SellerMetricsUtcBounds;
  grossItemSalesTrend: SellerGrossSalesPoint[];
  orderStatusData: SellerOrderStatusPoint[];
  lowStockItems: SellerLowStockItem[];
  recentOrders: SellerRecentOrder[];
  recentActivity: SellerActivityItem[];
  kpis: {
    pendingOrders: number;
    activeProducts: number;
    lowStockProducts: number;
    payoutAvailable: number;
    payoutPending: number;
  };
}

export interface SellerProductPerformance {
  id: string;
  name: string;
  category: string;
  sales: number;
  grossItemSales: number;
  stock: number;
}

export interface SellerCategoryPerformance {
  name: string;
  slug: string;
  grossItemSales: number;
  sales: number;
}

export interface SellerLowPerformer {
  id: string;
  name: string;
  category: string;
  issue: "zero-sales" | "low-sales" | "low-stock";
  stock: number;
}

export interface SellerAnalyticsActivityEvent {
  id: string;
  type: "order" | "refund" | "stock";
  message: string;
  amount?: number;
  time: string;
}

export interface SellerAnalyticsData {
  range: SellerAnalyticsTimeRange;
  bounds: SellerMetricsUtcBounds;
  summary: {
    grossItemSales: number;
    ordersWithGrossItemSales: number;
    averageGrossOrderSubtotal: number;
    deliveredOrders: number;
    buyerVisibleProducts: number;
    lowStockProducts: number;
  };
  trends: SellerTrendPoint[];
  orderStats: {
    total: number;
    delivered: number;
    processing: number;
    cancelled: number;
    refunded: number;
  };
  topProducts: SellerProductPerformance[];
  categoryPerformance: SellerCategoryPerformance[];
  lowPerformers: SellerLowPerformer[];
  recentActivity: SellerAnalyticsActivityEvent[];
}

export interface SellerSnapshotPresentationState {
  appliedRange: SellerAnalyticsTimeRange | null;
  isRangeTransition: boolean;
  isStale: boolean;
  canExport: boolean;
}

export class SellerMetricsIntegrityError extends Error {
  constructor() {
    super("Seller metrics could not be verified from the available order timestamps.");
    this.name = "SellerMetricsIntegrityError";
  }
}

const ORDER_STATUS_COLORS: Record<SellerOrderStatus, string> = {
  new: "#3B82F6",
  confirmed: "#4F46E5",
  processing: "#F59E0B",
  shipped: "#6366F1",
  delivered: "#009E49",
  cancelled: "#EF4444",
  refund: "#F97316",
  unknown: "#71717A",
};

const ORDER_STATUS_LABELS: Record<SellerOrderStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refund: "Refund Review",
  unknown: "Status unavailable",
};

const RANGE_DURATION_MS: Partial<Record<SellerAnalyticsTimeRange, number>> = {
  "24h": 24 * 60 * 60 * 1_000,
  "7d": 7 * 24 * 60 * 60 * 1_000,
  "30d": 30 * 24 * 60 * 60 * 1_000,
};

const GROSS_ITEM_SALES_STATUSES = new Set<SellerOrderStatus>([
  "new",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
]);

export async function fetchSellerDashboardData(
  range: SellerDashboardRange = "7d",
  now: Date = new Date(),
): Promise<SellerDashboardData> {
  const bounds = getSellerMetricsUtcBounds(range, now);
  const [orders, products] = await Promise.all([
    fetchSellerOrdersForRange(bounds),
    fetchSellerCatalogProducts(),
  ]);
  const grossSalesOrders = orders.filter(isGrossItemSalesOrder);
  const lowStockItems = getLowStockItems(products);

  return {
    range,
    bounds,
    grossItemSalesTrend: buildTrendPoints(grossSalesOrders, range, bounds)
      .map(({ label, grossItemSales }) => ({ label, grossItemSales })),
    orderStatusData: buildOrderStatusData(orders),
    lowStockItems,
    recentOrders: orders
      .slice()
      .sort(sortByCreatedAtDesc)
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        customer: order.customer.name,
        total: order.totals.subtotal,
        status: order.status,
      })),
    recentActivity: buildDashboardActivity(orders, lowStockItems),
    kpis: {
      pendingOrders: orders.filter((order) => ["new", "confirmed", "processing"].includes(order.status)).length,
      activeProducts: products.filter((product) => isSellerProductBuyerVisibleStatus(product.status)).length,
      lowStockProducts: products.filter((product) => product.stock <= product.lowStockThreshold).length,
      payoutAvailable: 0,
      payoutPending: 0,
    },
  };
}

export async function fetchSellerAnalyticsData(
  range: SellerAnalyticsTimeRange,
  now: Date = new Date(),
): Promise<SellerAnalyticsData> {
  const bounds = getSellerMetricsUtcBounds(range, now);
  const [orders, products] = await Promise.all([
    fetchSellerOrdersForRange(bounds),
    fetchSellerCatalogProducts(),
  ]);
  const grossSalesOrders = orders.filter(isGrossItemSalesOrder);
  const grossItemSales = sumGrossItemSales(grossSalesOrders);
  const productPerformance = buildProductPerformance(grossSalesOrders, products);
  const buyerVisibleProducts = products.filter((product) => isSellerProductBuyerVisibleStatus(product.status)).length;
  const lowStockProducts = products.filter((product) => product.stock <= product.lowStockThreshold).length;
  const deliveredOrders = orders.filter((order) => order.status === "delivered").length;

  return {
    range,
    bounds,
    summary: {
      grossItemSales,
      ordersWithGrossItemSales: grossSalesOrders.length,
      averageGrossOrderSubtotal: grossSalesOrders.length
        ? roundMoney(grossItemSales / grossSalesOrders.length)
        : 0,
      deliveredOrders,
      buyerVisibleProducts,
      lowStockProducts,
    },
    trends: buildTrendPoints(grossSalesOrders, range, bounds),
    orderStats: {
      total: orders.length,
      delivered: deliveredOrders,
      processing: orders.filter((order) => ["new", "confirmed", "processing"].includes(order.status)).length,
      cancelled: orders.filter((order) => order.status === "cancelled").length,
      refunded: orders.filter((order) => order.status === "refund").length,
    },
    topProducts: productPerformance.slice(0, 6),
    categoryPerformance: buildCategoryPerformance(grossSalesOrders),
    lowPerformers: buildLowPerformers(products, productPerformance),
    recentActivity: buildAnalyticsActivity(orders, products),
  };
}

export function getSellerMetricsUtcBounds(
  range: SellerAnalyticsTimeRange,
  now: Date = new Date(),
): SellerMetricsUtcBounds {
  const endMs = now.getTime();
  if (!Number.isFinite(endMs)) throw new SellerMetricsIntegrityError();

  const end = new Date(endMs);
  const duration = RANGE_DURATION_MS[range];
  const start = duration === undefined
    ? addUtcMonths(end, -12)
    : new Date(endMs - duration);

  return {
    createdFrom: start.toISOString(),
    createdTo: end.toISOString(),
  };
}

export function getSellerMetricsErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Your seller session cannot access metrics right now. Sign in again or check your seller status.";
    }
    if (error.status === 408 || error.status === 503) {
      return "Seller metrics could not be refreshed. Check your connection and try again.";
    }
    return "Seller metrics are temporarily unavailable. Try again shortly.";
  }

  if (
    error instanceof SellerOrderCollectionError ||
    error instanceof SellerCatalogCollectionError ||
    error instanceof SellerMetricsIntegrityError
  ) {
    return "A complete seller metrics snapshot could not be verified. No partial totals are being shown.";
  }

  return "Seller metrics could not be loaded. Try again.";
}

export function getSellerSnapshotPresentationState(
  requestedRange: SellerAnalyticsTimeRange,
  appliedRange: SellerAnalyticsTimeRange | null,
  loading: boolean,
  error: string | null,
): SellerSnapshotPresentationState {
  const isRangeTransition = appliedRange !== null && appliedRange !== requestedRange;
  return {
    appliedRange,
    isRangeTransition,
    isStale: appliedRange !== null && (isRangeTransition || error !== null),
    canExport: appliedRange === requestedRange && !loading && error === null,
  };
}

export function buildSellerAnalyticsCsv(
  data: SellerAnalyticsData,
  categoryFilter: SellerAnalyticsCategoryFilter,
  products: SellerProductPerformance[] = data.topProducts,
  lowPerformers: SellerLowPerformer[] = data.lowPerformers,
): string {
  const reportRows = [
    ["Metric", "Value"],
    ["Snapshot Type", "Seller-visible order and catalog snapshot"],
    ["Range", data.range],
    ["Category Filter", categoryFilter],
    ["Gross item sales", String(Math.round(data.summary.grossItemSales))],
    ["Orders included in gross item sales", String(data.summary.ordersWithGrossItemSales)],
    ["Average seller-visible item subtotal", String(Math.round(data.summary.averageGrossOrderSubtotal))],
    ["Delivered Orders", String(data.summary.deliveredOrders)],
    ["Buyer-visible Products", String(data.summary.buyerVisibleProducts)],
    ["Low-stock Products", String(data.summary.lowStockProducts)],
    [""],
    ["Top Products", ""],
    ["Product", "Sales", "Gross item sales"],
    ...products.map((product) => [
      product.name,
      String(product.sales),
      String(Math.round(product.grossItemSales)),
    ]),
    [""],
    ["Low Performers", ""],
    ["Product", "Issue", "Stock"],
    ...lowPerformers.map((item) => [item.name, item.issue, String(item.stock)]),
  ];

  return reportRows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

async function fetchSellerOrdersForRange(bounds: SellerMetricsUtcBounds): Promise<SellerOrderDetail[]> {
  const orders = await sellerOrdersApi.fetchAllForMetrics(bounds);
  const fromMs = Date.parse(bounds.createdFrom);
  const toMs = Date.parse(bounds.createdTo);

  return orders.filter((order) => {
    const createdAtMs = Date.parse(order.createdAt);
    if (!Number.isFinite(createdAtMs)) throw new SellerMetricsIntegrityError();
    return createdAtMs >= fromMs && createdAtMs <= toMs;
  });
}

function isGrossItemSalesOrder(order: SellerOrderDetail): boolean {
  return order.items.some(isGrossItemSalesLine);
}

function isGrossItemSalesLine(item: SellerOrderItem): boolean {
  return GROSS_ITEM_SALES_STATUSES.has(item.vendorStatus);
}

function getOrderGrossItemSales(order: SellerOrderDetail): number {
  return roundMoney(order.items.reduce(
    (total, item) => isGrossItemSalesLine(item) ? total + item.price * item.quantity : total,
    0,
  ));
}

function buildTrendPoints(
  orders: SellerOrderDetail[],
  range: SellerAnalyticsTimeRange,
  bounds: SellerMetricsUtcBounds,
): SellerTrendPoint[] {
  const buckets = buildTimeBuckets(range, bounds);

  for (const order of orders) {
    const createdAtMs = Date.parse(order.createdAt);
    if (!Number.isFinite(createdAtMs)) throw new SellerMetricsIntegrityError();
    const bucket = buckets.find((candidate, index) => (
      createdAtMs >= candidate.startMs &&
      (index === buckets.length - 1 ? createdAtMs <= candidate.endMs : createdAtMs < candidate.endMs)
    ));
    if (!bucket) throw new SellerMetricsIntegrityError();
    bucket.grossItemSales = roundMoney(bucket.grossItemSales + getOrderGrossItemSales(order));
    bucket.orders += 1;
  }

  return buckets.map(({ label, grossItemSales, orders: count }) => ({
    label,
    grossItemSales,
    orders: count,
  }));
}

function buildTimeBuckets(range: SellerAnalyticsTimeRange, bounds: SellerMetricsUtcBounds) {
  const start = new Date(bounds.createdFrom);
  const end = new Date(bounds.createdTo);
  const bucketCount = range === "24h" ? 4 : range === "30d" ? 5 : range === "12m" ? 12 : 7;
  const totalMs = end.getTime() - start.getTime();

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = range === "12m"
      ? addUtcMonths(start, index)
      : new Date(start.getTime() + (totalMs / bucketCount) * index);
    const bucketEnd = range === "12m"
      ? index === bucketCount - 1 ? end : addUtcMonths(start, index + 1)
      : new Date(start.getTime() + (totalMs / bucketCount) * (index + 1));

    return {
      label: formatBucketLabel(bucketStart, range),
      startMs: bucketStart.getTime(),
      endMs: bucketEnd.getTime(),
      grossItemSales: 0,
      orders: 0,
    };
  });
}

function formatBucketLabel(date: Date, range: SellerAnalyticsTimeRange): string {
  if (range === "24h") {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }).format(date);
  }
  if (range === "7d") {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      timeZone: "UTC",
    }).format(date);
  }
  if (range === "30d") {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function addUtcMonths(date: Date, months: number): Date {
  const absoluteMonth = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(absoluteMonth / 12);
  const month = ((absoluteMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year,
    month,
    Math.min(date.getUTCDate(), lastDay),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ));
}

function buildOrderStatusData(orders: SellerOrderDetail[]): SellerOrderStatusPoint[] {
  const counts = orders.reduce<Record<SellerOrderStatus, number>>(
    (acc, order) => {
      acc[order.status] += 1;
      return acc;
    },
    { new: 0, confirmed: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refund: 0, unknown: 0 },
  );

  return (Object.keys(counts) as SellerOrderStatus[])
    .filter((status) => counts[status] > 0)
    .map((status) => ({
      name: ORDER_STATUS_LABELS[status],
      value: counts[status],
      color: ORDER_STATUS_COLORS[status],
    }));
}

function getLowStockItems(products: SellerProductListing[]): SellerLowStockItem[] {
  return products
    .filter((product) => product.stock <= product.lowStockThreshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 5)
    .map((product) => ({
      id: product.id,
      name: product.title,
      stock: product.stock,
      threshold: product.lowStockThreshold,
    }));
}

function buildProductPerformance(
  orders: SellerOrderDetail[],
  products: SellerProductListing[],
): SellerProductPerformance[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const stats = new Map<string, SellerProductPerformance>();

  for (const order of orders) {
    for (const item of order.items) {
      if (!isGrossItemSalesLine(item)) continue;
      const product = productById.get(item.productId);
      const current = stats.get(item.productId) ?? {
        id: item.productId,
        name: product?.title ?? item.name,
        category: product?.categorySlug ?? item.categorySlug,
        sales: 0,
        grossItemSales: 0,
        stock: product?.stock ?? 0,
      };
      current.sales += item.quantity;
      current.grossItemSales = roundMoney(current.grossItemSales + item.price * item.quantity);
      stats.set(item.productId, current);
    }
  }

  return Array.from(stats.values()).sort((left, right) => right.grossItemSales - left.grossItemSales);
}

function buildCategoryPerformance(orders: SellerOrderDetail[]): SellerCategoryPerformance[] {
  const categoryNames = new Map(SELLER_CATALOG_CATEGORIES.map((category) => [category.slug, category.name]));
  const stats = new Map<string, SellerCategoryPerformance>();

  for (const order of orders) {
    for (const item of order.items) {
      if (!isGrossItemSalesLine(item)) continue;
      const current = stats.get(item.categorySlug) ?? {
        name: categoryNames.get(item.categorySlug) ?? toTitleCase(item.categorySlug),
        slug: item.categorySlug,
        grossItemSales: 0,
        sales: 0,
      };
      current.grossItemSales = roundMoney(current.grossItemSales + item.price * item.quantity);
      current.sales += item.quantity;
      stats.set(item.categorySlug, current);
    }
  }

  return Array.from(stats.values()).sort((left, right) => right.grossItemSales - left.grossItemSales);
}

function buildLowPerformers(
  products: SellerProductListing[],
  performance: SellerProductPerformance[],
): SellerLowPerformer[] {
  const soldProductIds = new Set(performance.map((product) => product.id));
  const rows: SellerLowPerformer[] = [];

  for (const product of products) {
    if (product.stock <= product.lowStockThreshold) {
      rows.push({
        id: product.id,
        name: product.title,
        category: product.categorySlug,
        issue: "low-stock",
        stock: product.stock,
      });
    } else if (isSellerProductBuyerVisibleStatus(product.status) && !soldProductIds.has(product.id)) {
      rows.push({
        id: product.id,
        name: product.title,
        category: product.categorySlug,
        issue: "zero-sales",
        stock: product.stock,
      });
    }
  }

  return rows.slice(0, 6);
}

function buildDashboardActivity(
  orders: SellerOrderDetail[],
  lowStockItems: SellerLowStockItem[],
): SellerActivityItem[] {
  const recentOrder = orders.slice().sort(sortByCreatedAtDesc)[0];
  const activity: SellerActivityItem[] = [];

  if (recentOrder) {
    const refundReview = recentOrder.status === "refund";
    activity.push({
      id: `order-${recentOrder.id}`,
      text: refundReview
        ? `Order ${recentOrder.id} is in refund review.`
        : `Order activity from ${recentOrder.customer.name}.`,
      time: formatRelativeTime(recentOrder.createdAt),
      tone: refundReview ? "warning" : "info",
    });
  }

  for (const item of lowStockItems.slice(0, 2)) {
    activity.push({
      id: `stock-${item.id}`,
      text: item.stock === 0 ? `${item.name} is out of stock.` : `${item.name} is below its restock threshold.`,
      time: "Needs attention",
      tone: "warning",
    });
  }

  return activity.slice(0, 5);
}

function buildAnalyticsActivity(
  orders: SellerOrderDetail[],
  products: SellerProductListing[],
): SellerAnalyticsActivityEvent[] {
  const events: SellerAnalyticsActivityEvent[] = [];

  for (const order of orders.slice().sort(sortByCreatedAtDesc).slice(0, 3)) {
    const refundReview = order.status === "refund";
    events.push({
      id: `order-${order.id}`,
      type: refundReview ? "refund" : "order",
      message: refundReview
        ? `Order ${order.id} moved into refund review status.`
        : `Order ${order.id} placed by ${order.customer.name}`,
      amount: isGrossItemSalesOrder(order) ? getOrderGrossItemSales(order) : undefined,
      time: formatRelativeTime(order.createdAt),
    });
  }

  for (const product of products
    .filter((item) => item.stock <= item.lowStockThreshold)
    .slice(0, 2)) {
    events.push({
      id: `stock-${product.id}`,
      type: "stock",
      message: product.stock === 0 ? `${product.title} is out of stock` : `${product.title} needs restock`,
      time: "Needs attention",
    });
  }

  return events.slice(0, 7);
}

function sumGrossItemSales(orders: SellerOrderDetail[]): number {
  return roundMoney(orders.reduce((sum, order) => sum + getOrderGrossItemSales(order), 0));
}

function sortByCreatedAtDesc(left: SellerOrderDetail, right: SellerOrderDetail): number {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - Date.parse(isoDate);
  const diffHours = Math.max(0, Math.floor(diffMs / 36e5));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function toTitleCase(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isSellerProductBuyerVisibleStatus(status: string): boolean {
  return status === "approved" || status === "published";
}
