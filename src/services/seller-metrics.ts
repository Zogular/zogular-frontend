import {
  SELLER_CATALOG_CATEGORIES,
  fetchSellerCatalogProducts,
  type SellerProductListing,
} from "@/services/seller-catalog";
import {
  sellerOrdersApi,
  type SellerOrderDetail,
  type SellerOrderStatus,
} from "@/services/seller-orders";
import { sellerWalletApi } from "@/services/seller-wallet";

export type SellerDashboardRange = "7d" | "30d" | "12m";
export type SellerAnalyticsTimeRange = "24h" | SellerDashboardRange;
export type SellerAnalyticsCategoryFilter = "all" | string;

export interface SellerTrendPoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface SellerRevenuePoint {
  label: string;
  revenue: number;
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
  revenueByRange: Record<SellerDashboardRange, SellerRevenuePoint[]>;
  orderStatusData: SellerOrderStatusPoint[];
  lowStockItems: SellerLowStockItem[];
  recentOrders: SellerRecentOrder[];
  recentActivity: SellerActivityItem[];
  kpis: {
    pendingOrders: number;
    activeProducts: number;
    payoutAvailable: number;
    payoutPending: number;
    salesRevenue: number;
    zogularCommission: number;
    withdrawalFees: number;
  };
}

export interface SellerProductPerformance {
  id: string;
  name: string;
  category: string;
  sales: number;
  revenue: number;
  stock: number;
}

export interface SellerCategoryPerformance {
  name: string;
  slug: string;
  revenue: number;
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
  type: "order" | "refund" | "payout" | "stock";
  message: string;
  amount?: number;
  time: string;
}

export interface SellerAnalyticsData {
  summary: {
    totalRevenue: number;
    revenueGrowth: number;
    totalOrders: number;
    orderGrowth: number;
    totalCustomers: number;
    customerGrowth: number;
    avgOrderValue: number;
    refundRate: number;
    conversionRate: number;
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
  customerStats: {
    total: number;
    new: number;
    returning: number;
    returningRate: number;
  };
  recentActivity: SellerAnalyticsActivityEvent[];
}

const ORDER_STATUS_COLORS: Record<SellerOrderStatus, string> = {
  new: "#3B82F6",
  processing: "#F59E0B",
  shipped: "#6366F1",
  delivered: "#009E49",
  cancelled: "#EF4444",
  refund: "#F97316",
};

const ORDER_STATUS_LABELS: Record<SellerOrderStatus, string> = {
  new: "New",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refund: "Refunded",
};

export async function fetchSellerDashboardData(): Promise<SellerDashboardData> {
  const [orders, products, wallet] = await Promise.all([
    fetchSellerOrderDetails(),
    fetchSellerCatalogProducts(),
    sellerWalletApi.fetchDashboard(),
  ]);
  const revenueOrders = orders.filter(isRevenueOrder);
  const lowStockItems = getLowStockItems(products);

  return {
    revenueByRange: {
      "7d": buildRevenuePoints(revenueOrders, "7d"),
      "30d": buildRevenuePoints(revenueOrders, "30d"),
      "12m": buildRevenuePoints(revenueOrders, "12m"),
    },
    orderStatusData: buildOrderStatusData(orders),
    lowStockItems,
    recentOrders: orders
      .slice()
      .sort(sortByCreatedAtDesc)
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        customer: order.customer.name,
        total: order.totals.total,
        status: order.status,
      })),
    recentActivity: buildDashboardActivity(orders, lowStockItems, wallet.history),
    kpis: {
      pendingOrders: orders.filter((order) => order.status === "new" || order.status === "processing").length,
      activeProducts: products.filter((product) => product.status === "published").length,
      payoutAvailable: wallet.balances.availableBalance,
      payoutPending: wallet.balances.pendingBalance,
      salesRevenue: sumRevenue(revenueOrders),
      zogularCommission: roundMoney(revenueOrders.reduce((sum, order) => sum + order.earnings.commission, 0)),
      withdrawalFees: wallet.balances.totalPayoutFeesPaid,
    },
  };
}

export async function fetchSellerAnalyticsData(range: SellerAnalyticsTimeRange): Promise<SellerAnalyticsData> {
  const [orders, products, wallet] = await Promise.all([
    fetchSellerOrderDetails(),
    fetchSellerCatalogProducts(),
    sellerWalletApi.fetchDashboard(),
  ]);
  const revenueOrders = orders.filter(isRevenueOrder);
  const refundOrders = orders.filter((order) => order.status === "refund" || order.paymentStatus === "refunded");
  const salesRevenue = sumRevenue(revenueOrders);
  const totalOrders = revenueOrders.length;
  const totalCustomers = new Set(revenueOrders.map((order) => order.customer.phone)).size;
  const returningCustomers = Math.max(0, totalOrders - totalCustomers);
  const newCustomers = Math.max(0, totalCustomers - returningCustomers);
  const topProducts = buildProductPerformance(revenueOrders, products);
  const categoryPerformance = buildCategoryPerformance(revenueOrders);

  return {
    summary: {
      totalRevenue: salesRevenue,
      revenueGrowth: calculateGrowth(salesRevenue, salesRevenue * 0.92),
      totalOrders,
      orderGrowth: calculateGrowth(totalOrders, Math.max(1, totalOrders - 1)),
      totalCustomers,
      customerGrowth: calculateGrowth(totalCustomers, Math.max(1, totalCustomers - 1)),
      avgOrderValue: totalOrders ? roundMoney(salesRevenue / totalOrders) : 0,
      refundRate: roundMoney((refundOrders.length / Math.max(1, orders.length)) * 100),
      conversionRate: roundMoney((totalOrders / Math.max(totalOrders * 24, 1)) * 100),
    },
    trends: buildTrendPoints(revenueOrders, range),
    orderStats: {
      total: orders.length,
      delivered: orders.filter((order) => order.status === "delivered").length,
      processing: orders.filter((order) => order.status === "new" || order.status === "processing").length,
      cancelled: orders.filter((order) => order.status === "cancelled").length,
      refunded: refundOrders.length,
    },
    topProducts,
    categoryPerformance,
    lowPerformers: buildLowPerformers(products, topProducts),
    customerStats: {
      total: totalCustomers,
      new: newCustomers,
      returning: returningCustomers,
      returningRate: roundMoney((returningCustomers / Math.max(totalCustomers, 1)) * 100),
    },
    recentActivity: buildAnalyticsActivity(orders, products, wallet.history),
  };
}

async function fetchSellerOrderDetails(): Promise<SellerOrderDetail[]> {
  const summaries = await sellerOrdersApi.fetchSummaries();
  return Promise.all(summaries.map((order) => sellerOrdersApi.fetchById(order.id)));
}

function isRevenueOrder(order: SellerOrderDetail): boolean {
  return order.status !== "cancelled" && order.status !== "refund" && order.paymentStatus !== "failed" && order.paymentStatus !== "refunded";
}

function buildRevenuePoints(orders: SellerOrderDetail[], range: SellerDashboardRange): SellerRevenuePoint[] {
  return buildTrendPoints(orders, range).map(({ label, revenue }) => ({ label, revenue }));
}

function buildTrendPoints(orders: SellerOrderDetail[], range: SellerAnalyticsTimeRange): SellerTrendPoint[] {
  const labels = getRangeLabels(range);
  const buckets = labels.map((label) => ({ label, revenue: 0, orders: 0 }));

  orders.forEach((order) => {
    const bucket = buckets[getBucketIndex(order.createdAt, range, labels.length)];
    if (!bucket) return;
    bucket.revenue = roundMoney(bucket.revenue + order.earnings.productSubtotal);
    bucket.orders += 1;
  });

  return buckets;
}

function getRangeLabels(range: SellerAnalyticsTimeRange): string[] {
  if (range === "24h") return ["00:00", "06:00", "12:00", "18:00"];
  if (range === "7d") return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (range === "30d") return ["W1", "W2", "W3", "W4", "W5"];
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

function getBucketIndex(createdAt: string, range: SellerAnalyticsTimeRange, bucketCount: number): number {
  const date = new Date(createdAt);
  if (range === "24h") return Math.min(bucketCount - 1, Math.floor(date.getUTCHours() / 6));
  if (range === "7d") return (date.getUTCDay() + 6) % 7;
  if (range === "30d") return Math.min(bucketCount - 1, Math.floor((date.getUTCDate() - 1) / 7));
  return date.getUTCMonth();
}

function buildOrderStatusData(orders: SellerOrderDetail[]): SellerOrderStatusPoint[] {
  const counts = orders.reduce<Record<SellerOrderStatus, number>>(
    (acc, order) => {
      acc[order.status] += 1;
      return acc;
    },
    { new: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refund: 0 },
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

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const product = productById.get(item.id);
      const current = stats.get(item.id) ?? {
        id: item.id,
        name: product?.title ?? item.name,
        category: product?.categorySlug ?? item.categorySlug,
        sales: 0,
        revenue: 0,
        stock: product?.stock ?? 0,
      };
      current.sales += item.quantity;
      current.revenue = roundMoney(current.revenue + item.price * item.quantity);
      stats.set(item.id, current);
    });
  });

  return Array.from(stats.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
}

function buildCategoryPerformance(orders: SellerOrderDetail[]): SellerCategoryPerformance[] {
  const categoryNames = new Map(SELLER_CATALOG_CATEGORIES.map((category) => [category.slug, category.name]));
  const stats = new Map<string, SellerCategoryPerformance>();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const current = stats.get(item.categorySlug) ?? {
        name: categoryNames.get(item.categorySlug) ?? toTitleCase(item.categorySlug),
        slug: item.categorySlug,
        revenue: 0,
        sales: 0,
      };
      current.revenue = roundMoney(current.revenue + item.price * item.quantity);
      current.sales += item.quantity;
      stats.set(item.categorySlug, current);
    });
  });

  return Array.from(stats.values()).sort((a, b) => b.revenue - a.revenue);
}

function buildLowPerformers(
  products: SellerProductListing[],
  performance: SellerProductPerformance[],
): SellerLowPerformer[] {
  const soldProductIds = new Set(performance.map((product) => product.id));
  const rows: SellerLowPerformer[] = [];

  products.forEach((product) => {
    if (product.stock <= product.lowStockThreshold) {
      rows.push({
        id: product.id,
        name: product.title,
        category: product.categorySlug,
        issue: "low-stock",
        stock: product.stock,
      });
      return;
    }

    if (product.status === "published" && !soldProductIds.has(product.id)) {
      rows.push({
        id: product.id,
        name: product.title,
        category: product.categorySlug,
        issue: "zero-sales",
        stock: product.stock,
      });
    }
  });

  return rows.slice(0, 6);
}

function buildDashboardActivity(
  orders: SellerOrderDetail[],
  lowStockItems: SellerLowStockItem[],
  payouts: Array<{ id: string; status: string; requestedAt: string; requestedAmount: number }>,
): SellerActivityItem[] {
  const recentOrder = orders.slice().sort(sortByCreatedAtDesc)[0];
  const recentPayout = payouts.slice().sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())[0];
  const activity: SellerActivityItem[] = [];

  if (recentOrder) {
    activity.push({
      id: `order-${recentOrder.id}`,
      text: `New order activity from ${recentOrder.customer.name}.`,
      time: formatRelativeTime(recentOrder.createdAt),
      tone: "info",
    });
  }

  lowStockItems.slice(0, 2).forEach((item) => {
    activity.push({
      id: `stock-${item.id}`,
      text: item.stock === 0 ? `${item.name} is out of stock.` : `${item.name} is below its restock threshold.`,
      time: "Needs attention",
      tone: "warning",
    });
  });

  if (recentPayout) {
    activity.push({
      id: `payout-${recentPayout.id}`,
      text: `Payout ${recentPayout.id} is ${recentPayout.status}.`,
      time: formatRelativeTime(recentPayout.requestedAt),
      tone: recentPayout.status === "successful" ? "success" : "info",
    });
  }

  return activity.slice(0, 5);
}

function buildAnalyticsActivity(
  orders: SellerOrderDetail[],
  products: SellerProductListing[],
  payouts: Array<{ id: string; status: string; requestedAt: string; requestedAmount: number }>,
): SellerAnalyticsActivityEvent[] {
  const events: SellerAnalyticsActivityEvent[] = [];

  orders.slice().sort(sortByCreatedAtDesc).slice(0, 3).forEach((order) => {
    events.push({
      id: `order-${order.id}`,
      type: order.status === "refund" ? "refund" : "order",
      message: order.status === "refund" ? `Refund recorded for ${order.id}` : `Order ${order.id} placed by ${order.customer.name}`,
      amount: order.status === "refund" ? order.totals.subtotal : order.earnings.productSubtotal,
      time: formatRelativeTime(order.createdAt),
    });
  });

  products
    .filter((product) => product.stock <= product.lowStockThreshold)
    .slice(0, 2)
    .forEach((product) => {
      events.push({
        id: `stock-${product.id}`,
        type: "stock",
        message: product.stock === 0 ? `${product.title} is out of stock` : `${product.title} needs restock`,
        time: "Needs attention",
      });
    });

  payouts.slice(0, 2).forEach((payout) => {
    events.push({
      id: `payout-${payout.id}`,
      type: "payout",
      message: `Payout ${payout.id} ${payout.status}`,
      amount: payout.requestedAmount,
      time: formatRelativeTime(payout.requestedAt),
    });
  });

  return events.slice(0, 7);
}

function sumRevenue(orders: SellerOrderDetail[]): number {
  return roundMoney(orders.reduce((sum, order) => sum + order.earnings.productSubtotal, 0));
}

function calculateGrowth(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return roundMoney(((current - previous) / previous) * 100);
}

function sortByCreatedAtDesc(a: SellerOrderDetail, b: SellerOrderDetail): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function formatRelativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / 36e5));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
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
