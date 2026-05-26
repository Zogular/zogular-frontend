"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Receipt,
  Target,
  Package,
  Download,
  AlertCircle,
  Filter,
  RefreshCcw,
  Box,
  Tag,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import {
  fetchSellerAnalyticsData,
  type SellerAnalyticsCategoryFilter,
  type SellerAnalyticsData,
  type SellerAnalyticsTimeRange,
} from "@/services/seller-metrics";

function formatCurrency(value: number) {
  return `K${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(Math.floor(value));
}

function widthClass(percent: number) {
  if (percent >= 95) return "w-full";
  if (percent >= 90) return "w-[90%]";
  if (percent >= 80) return "w-[80%]";
  if (percent >= 70) return "w-[70%]";
  if (percent >= 60) return "w-[60%]";
  if (percent >= 50) return "w-1/2";
  if (percent >= 40) return "w-[40%]";
  if (percent >= 30) return "w-[30%]";
  if (percent >= 20) return "w-[20%]";
  if (percent >= 10) return "w-[10%]";
  if (percent > 0) return "w-[5%]";
  return "w-0";
}

function StatCard({
  title,
  value,
  growth,
  icon: Icon,
  isCurrency = false,
  inverseGrowth = false,
  colorClass = "bg-white border-zinc-200/80 text-zinc-900",
}: {
  title: string;
  value: number;
  growth?: number;
  icon: React.ComponentType<{ className?: string }>;
  isCurrency?: boolean;
  inverseGrowth?: boolean;
  colorClass?: string;
}) {
  const isPositive = growth !== undefined && growth > 0;
  const isGood = inverseGrowth ? !isPositive : isPositive;

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md", colorClass)}>
      <div className="mb-2 flex items-center justify-between opacity-80">
        <p className="text-[10px] font-bold uppercase tracking-wider">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-xl font-black md:text-2xl">
        {isCurrency ? formatCurrency(value) : formatNumber(value)}
        {title.includes("Rate") ? "%" : ""}
      </h3>
      {growth !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          <span className={cn("flex items-center rounded-sm px-1 py-0.5 text-[10px] font-bold", isGood ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
            {isPositive ? <ArrowUpRight className="mr-0.5 h-3 w-3" /> : <ArrowDownRight className="mr-0.5 h-3 w-3" />}
            {Math.abs(Number(growth.toFixed(1)))}%
          </span>
          <span className="text-[9px] font-medium opacity-70">vs prev.</span>
        </div>
      )}
    </div>
  );
}

function ProgressBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-zinc-700">{label}</span>
        <span className="text-zinc-900">
          {formatNumber(value)} <span className="text-[10px] font-medium text-zinc-400">({percentage}%)</span>
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn("h-full rounded-full", colorClass, widthClass(percentage))} />
      </div>
    </div>
  );
}

export default function SellerAnalyticsPage() {
  const [data, setData] = useState<SellerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<SellerAnalyticsTimeRange>("30d");
  const [chartMetric, setChartMetric] = useState<"revenue" | "orders">("revenue");
  const [categoryFilter, setCategoryFilter] = useState<SellerAnalyticsCategoryFilter>("all");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchSellerAnalyticsData(range);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = () => {
    if (!data) return;
    // Export mirrors exactly what is rendered after category + range filtering.
    const reportRows = [
      ["Metric", "Value"],
      ["Range", range],
      ["Category Filter", categoryFilter],
      ["Total Revenue", String(Math.round(data.summary.totalRevenue))],
      ["Total Orders", String(data.summary.totalOrders)],
      ["Customers", String(data.summary.totalCustomers)],
      [""],
      ["Top Products", ""],
      ["Product", "Sales", "Revenue"],
      ...filteredTopProducts.map((product) => [
        product.name,
        String(product.sales),
        String(Math.round(product.revenue)),
      ]),
      [""],
      ["Low Performers", ""],
      ["Product", "Issue", "Stock"],
      ...filteredLowPerformers.map((item) => [item.name, item.issue, String(item.stock)]),
    ];

    const csv = reportRows
      .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zogular-analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Analytics report exported.");
  };

  const filteredTopProducts = useMemo(
    () => (categoryFilter === "all" ? data?.topProducts ?? [] : (data?.topProducts ?? []).filter((p) => p.category === categoryFilter)),
    [data, categoryFilter],
  );

  const filteredCategoryPerformance = useMemo(
    () =>
      categoryFilter === "all"
        ? data?.categoryPerformance ?? []
        : (data?.categoryPerformance ?? []).filter((c) => c.slug === categoryFilter),
    [data, categoryFilter],
  );

  const filteredLowPerformers = useMemo(
    () =>
      categoryFilter === "all"
        ? data?.lowPerformers ?? []
        : (data?.lowPerformers ?? []).filter((item) => item.category === categoryFilter),
    [data, categoryFilter],
  );

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
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Make data-driven decisions for your store.</p>
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
          <Button variant="outline" onClick={handleExport} className="h-10 rounded-xl border-zinc-200 bg-white px-4 font-bold text-zinc-700 shadow-sm hover:bg-zinc-50">
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Total Revenue" value={data.summary.totalRevenue} growth={data.summary.revenueGrowth} icon={TrendingUp} isCurrency colorClass="border-[#008f42] bg-linear-to-br from-[#009E49] to-[#007a38] text-white shadow-[0_8px_20px_rgba(0,158,73,0.2)]" />
        <StatCard title="Total Orders" value={data.summary.totalOrders} growth={data.summary.orderGrowth} icon={ShoppingCart} colorClass="bg-blue-50/50 border-blue-100 text-blue-950" />
        <StatCard title="Avg Order Value" value={data.summary.avgOrderValue} icon={Receipt} isCurrency colorClass="bg-purple-50/50 border-purple-100 text-purple-950" />
        <StatCard title="Customers" value={data.summary.totalCustomers} growth={data.summary.customerGrowth} icon={Users} colorClass="bg-indigo-50/50 border-indigo-100 text-indigo-950" />
        <StatCard title="Conversion Rate" value={data.summary.conversionRate} icon={Target} colorClass="bg-teal-50/50 border-teal-100 text-teal-950" />
        <StatCard title="Refund Rate" value={data.summary.refundRate} growth={0.5} icon={AlertTriangle} inverseGrowth colorClass="bg-red-50/50 border-red-100 text-red-950" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6 lg:col-span-2">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-black text-zinc-900">Performance Trends</h2>
              <p className="mt-1 text-xs font-medium text-zinc-500">Compare {chartMetric} over the selected time period.</p>
            </div>
            <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              <button onClick={() => setChartMetric("revenue")} className={cn("rounded-md px-4 py-1.5 text-xs font-bold transition-all", chartMetric === "revenue" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>
                Revenue
              </button>
              <button onClick={() => setChartMetric("orders")} className={cn("rounded-md px-4 py-1.5 text-xs font-bold transition-all", chartMetric === "orders" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>
                Orders
              </button>
            </div>
          </div>
          <div className="h-62.5 w-full min-w-0 flex-1 md:h-70">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends} margin={{ top: 10, right: 10, left: chartMetric === "revenue" ? 10 : -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartMetric === "revenue" ? "#009E49" : "#3B82F6"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={chartMetric === "revenue" ? "#009E49" : "#3B82F6"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f4f4f5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a1a1aa", fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a1a1aa", fontWeight: 600 }} tickFormatter={(value) => (chartMetric === "revenue" ? `K${Number(value) / 1000}k` : value)} />
                <Tooltip />
                <Area type="monotone" dataKey={chartMetric} stroke={chartMetric === "revenue" ? "#009E49" : "#3B82F6"} strokeWidth={3} fillOpacity={1} fill="url(#colorMetric)" animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex-1 rounded-3xl border border-indigo-100 bg-indigo-50/30 p-5 shadow-sm md:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-indigo-950">
              <Users className="h-4 w-4 text-indigo-400" />
              Customers
            </h2>
            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">New</p>
                <p className="text-xl font-black text-indigo-950">{formatNumber(data.customerStats.new)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Returning</p>
                <p className="text-xl font-black text-indigo-950">{formatNumber(data.customerStats.returning)}</p>
              </div>
            </div>
            <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Return Rate</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-black text-indigo-600">{data.customerStats.returningRate.toFixed(1)}%</span>
                <span className="mb-1 text-xs font-medium text-zinc-500">of total buyers</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className={cn("h-full rounded-full bg-indigo-500", widthClass(Math.round(data.customerStats.returningRate)))} />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wider text-zinc-900">Order Fulfillment</h2>
            <div className="space-y-3">
              <ProgressBar label="Delivered" value={data.orderStats.delivered} total={data.orderStats.total} colorClass="bg-[#009E49]" />
              <ProgressBar label="Processing" value={data.orderStats.processing} total={data.orderStats.total} colorClass="bg-blue-500" />
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
                  <th className="pb-3 text-right font-medium">Revenue</th>
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
                    <td className="py-3 text-right font-black text-[#009E49]">{formatCurrency(product.revenue)}</td>
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
              const percentage = Math.max(5, Math.round((cat.revenue / data.summary.totalRevenue) * 100));
              return (
                <div key={cat.slug} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between">
                      <span className="text-xs font-bold text-zinc-900">{cat.name}</span>
                      <span className="text-xs font-black text-zinc-900">{formatCurrency(cat.revenue)}</span>
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
                <div className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", activity.type === "order" ? "bg-[#009E49]/10 text-[#009E49]" : activity.type === "refund" ? "bg-red-100 text-red-600" : activity.type === "payout" ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600")}>
                  {activity.type === "order" && <ShoppingCart className="h-3 w-3" />}
                  {activity.type === "refund" && <RefreshCcw className="h-3 w-3" />}
                  {activity.type === "payout" && <Receipt className="h-3 w-3" />}
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
