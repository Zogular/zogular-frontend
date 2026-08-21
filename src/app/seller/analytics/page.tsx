"use client";

import Link from "next/link";
import {
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Receipt,
  Package,
  Download,
  AlertCircle,
  Filter,
  RefreshCcw,
  Box,
  Tag,
  ShieldAlert,
  Eye,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import {
  BackendPendingBadge,
  FeaturePendingNotice,
} from "@/components/shared/FeaturePendingNotice";

import { useSellerAnalytics } from "@/features/seller-analytics/hooks/useSellerAnalytics";
import { StatCard, ProgressBar } from "@/features/seller-analytics/components/AnalyticsSummaryCards";
import { AnalyticsCharts } from "@/features/seller-analytics/components/AnalyticsCharts";
import { formatCurrency, formatNumber, widthClass } from "@/features/seller-analytics/utils/analytics-utils";
import type { SellerAnalyticsCategoryFilter, SellerAnalyticsTimeRange } from "@/services/seller-metrics";

export default function SellerAnalyticsPage() {
  const {
    data,
    loading,
    error,
    range,
    setRange,
    chartMetric,
    setChartMetric,
    categoryFilter,
    setCategoryFilter,
    filteredTopProducts,
    filteredCategoryPerformance,
    filteredLowPerformers,
    snapshotState,
    loadData,
    handleExport,
  } = useSellerAnalytics();

  if (loading && !data) return <SellerPageLoading variant="dashboard" />;

  if (error && !data) {
    return (
      <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-base font-bold text-red-900">Data Compilation Failed</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <Button onClick={loadData} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
          Try Again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto min-w-0 max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 pb-24 md:pb-12">
      <div className="shrink-0 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Analytics</h1>
            <BackendPendingBadge />
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">Review available order and catalog activity. Finance, customer, and conversion reports are not available yet.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
            <Filter className="ml-2 h-4 w-4 text-zinc-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as SellerAnalyticsCategoryFilter)}
              className="h-8 cursor-pointer appearance-none bg-transparent px-3 text-xs font-bold text-zinc-700 outline-none"
              aria-label="Filter analytics by category"
            >
              <option value="all">All Categories</option>
              {data.categoryPerformance.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as SellerAnalyticsTimeRange)}
            className="h-10 cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-white px-4 pr-8 text-sm font-bold text-zinc-700 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
            aria-label="Filter analytics by time range"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <Button variant="outline" onClick={handleExport} disabled={!snapshotState.canExport} className="h-10 rounded-xl border-zinc-200 bg-white px-4 font-bold text-zinc-700 shadow-sm hover:bg-zinc-50">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export Snapshot</span>
          </Button>
        </div>
      </div>

      <FeaturePendingNotice
        compact
        title="Only seller-visible order and catalog data are shown"
        description="Commission, payout, settlement, repeat-customer, and conversion reports are not available yet."
      />

      {snapshotState.isRangeTransition && loading && (
        <div role="status" className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-950">
          Loading the requested {range} range. The figures below still show the applied {data.range} snapshot, and export is disabled until refresh completes.
        </div>
      )}

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold">
            The requested {range} range was not applied. Showing the last successful {data.range} snapshot. {error}
          </p>
          <Button onClick={loadData} disabled={loading} variant="outline" className="h-9 shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Retry refresh
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Gross Item Sales" value={data.summary.grossItemSales} icon={TrendingUp} isCurrency colorClass="border-[#008f42] bg-linear-to-br from-[#009E49] to-[#007a38] text-white shadow-[0_8px_20px_rgba(0,158,73,0.2)]" />
        <StatCard title="Included Orders" value={data.summary.ordersWithGrossItemSales} icon={ShoppingCart} colorClass="bg-blue-50/50 border-blue-100 text-blue-950" />
        <StatCard title="Avg Item Subtotal" value={data.summary.averageGrossOrderSubtotal} icon={Receipt} isCurrency colorClass="bg-purple-50/50 border-purple-100 text-purple-950" />
        <StatCard title="Delivered Orders" value={data.summary.deliveredOrders} icon={Truck} colorClass="bg-teal-50/50 border-teal-100 text-teal-950" />
        <StatCard title="Buyer Visible Products" value={data.summary.buyerVisibleProducts} icon={Eye} colorClass="bg-indigo-50/50 border-indigo-100 text-indigo-950" />
        <StatCard title="Low Stock Products" value={data.summary.lowStockProducts} icon={AlertTriangle} colorClass="bg-red-50/50 border-red-100 text-red-950" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AnalyticsCharts data={data.trends} chartMetric={chartMetric} setChartMetric={setChartMetric} />

        <div className="flex flex-col gap-6">
          <div className="flex-1 rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-amber-950">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Analytics Still Pending
            </h2>
            <div className="space-y-3 text-sm">
              <p className="font-bold text-amber-950">Customer cohorts, conversion, commission, and payout analytics are not shown yet.</p>
              <p className="font-medium leading-relaxed text-amber-900/80">
                This page currently shows seller-visible order item subtotals, product statuses, and stock signals.
              </p>
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-xs font-bold text-amber-900 shadow-sm">
                Treat this as an operational snapshot, not a finance or growth report.
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-zinc-900">Order Fulfillment</h2>
            <div className="space-y-3">
              <ProgressBar label="Delivered" value={data.orderStats.delivered} total={data.orderStats.total} colorClass="bg-[#009E49]" />
              <ProgressBar label="Processing" value={data.orderStats.processing} total={data.orderStats.total} colorClass="bg-blue-500" />
              <ProgressBar label="Refund Status" value={data.orderStats.refunded} total={data.orderStats.total} colorClass="bg-amber-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
              <Package className="h-4 w-4 text-zinc-400" />
              Top Products
            </h2>
            <Link href="/seller/products" className="h-8 px-2 text-[10px] font-bold text-[#009E49] hover:underline">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto hide-scrollbar">
            <table className="min-w-100 w-full text-left text-sm">
              <thead className="border-b border-zinc-100 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 text-right font-medium">Sales</th>
                  <th className="pb-3 text-right font-medium">Gross Item Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredTopProducts.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="py-3">
                      <p className="max-w-45 truncate font-bold text-zinc-900">{product.name}</p>
                      <p className="text-[10px] text-zinc-400">{product.id}</p>
                    </td>
                    <td className="py-3 text-right font-bold text-zinc-700">{formatNumber(product.sales)}</td>
                    <td className="py-3 text-right font-black text-[#009E49]">{formatCurrency(product.grossItemSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
            <Tag className="h-4 w-4 text-zinc-400" />
            Category Performance
          </h2>
          <div className="space-y-4">
            {filteredCategoryPerformance.map((cat) => {
              const percentage = Math.max(5, Math.round((cat.grossItemSales / Math.max(data.summary.grossItemSales, 1)) * 100));
              return (
                <div key={cat.slug} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between">
                      <span className="text-xs font-bold text-zinc-900">{cat.name}</span>
                      <span className="text-xs font-black text-zinc-900">{formatCurrency(cat.grossItemSales)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div className={cn("h-full rounded-full bg-zinc-800", widthClass(percentage))} />
                      </div>
                      <span className="w-12 text-right text-[10px] font-bold text-zinc-400">{formatNumber(cat.sales)} sales</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-red-100 bg-red-50/30 p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-red-900">
            <AlertCircle className="h-4 w-4 text-red-500" />
            Requires Attention
          </h2>
          <div className="space-y-3">
            {filteredLowPerformers.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-xl border border-red-100 bg-white p-3 shadow-sm">
                <div>
                  <p className="max-w-50 truncate text-xs font-bold text-zinc-900">{item.name}</p>
                  <p className={cn("mt-0.5 text-[10px] font-bold uppercase tracking-wider", item.issue === "zero-sales" ? "text-red-500" : item.issue === "low-stock" ? "text-amber-500" : "text-orange-500")}>
                    {item.issue.replace("-", " ")}
                  </p>
                </div>
                <Link href="/seller/inventory">
                  <Button variant="outline" size="sm" className="h-8 border-zinc-200 text-[10px] font-bold">
                    Manage
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900">
            <RefreshCcw className="h-4 w-4 text-zinc-400" />
            Recent Activity
          </h2>
          <div className="space-y-4">
            {data.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", activity.type === "order" ? "bg-[#009E49]/10 text-[#009E49]" : activity.type === "refund" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600")}>
                  {activity.type === "order" && <ShoppingCart className="h-3 w-3" />}
                  {activity.type === "refund" && <RefreshCcw className="h-3 w-3" />}
                  {activity.type === "stock" && <Box className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold leading-snug text-zinc-800">{activity.message}</p>
                  <div className="mt-1 flex items-center gap-2">
                     <span className="text-[10px] font-medium text-zinc-400">{activity.time}</span>
                    {activity.amount && <span className="text-[10px] font-black text-zinc-700">• {formatCurrency(activity.amount)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
