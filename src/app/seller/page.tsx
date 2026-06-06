"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  AlertCircle, ArrowUpRight, Box, Clock3,
  Package, Plus, ShoppingCart, TrendingUp, Wallet, Bell, Eye,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import { useSellerApplication } from "@/components/seller/SellerApplicationContext";
import { SellerOperatingHub } from "@/features/seller-hub/sections/SellerOperatingHub";
import {
  fetchSellerDashboardData,
  type SellerActivityItem,
  type SellerDashboardData,
  type SellerDashboardRange,
  type SellerOrderStatusPoint,
  type SellerRecentOrder,
} from "@/services/seller-metrics";
import { hasSellerCapability } from "@/services/vendor-application";

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("en-ZM", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function getStatusPillClass(status: SellerRecentOrder["status"]) {
  if (status === "new") return "bg-blue-50 text-blue-600 border-blue-200";
  if (status === "processing") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "shipped") return "bg-purple-50 text-purple-700 border-purple-200";
  if (status === "delivered") return "bg-[#009E49]/10 text-[#009E49] border-[#009E49]/20";
  if (status === "refund") return "bg-orange-50 text-orange-700 border-orange-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function getActivityDotClass(tone: SellerActivityItem["tone"]) {
  if (tone === "warning") return "bg-[#FF6B00]";
  if (tone === "success") return "bg-[#009E49]";
  return "bg-blue-500";
}

function getOrderStatusDotClass(name: SellerOrderStatusPoint["name"]) {
  if (name === "New") return "bg-blue-500";
  if (name === "Processing") return "bg-amber-500";
  if (name === "Shipped") return "bg-indigo-500";
  if (name === "Delivered") return "bg-[#009E49]";
  if (name === "Refunded") return "bg-orange-500";
  return "bg-red-500";
}

function QuickActionCard({ href, icon: Icon, title, description }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#009E49]/10 text-[#009E49]">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-black text-zinc-900">{title}</p>
      <p className="mt-1 text-xs font-medium text-zinc-500">{description}</p>
    </Link>
  );
}

export default function SellerDashboard() {
  const { application } = useSellerApplication();
  const [data, setData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [range, setRange] = useState<SellerDashboardRange>("7d");

  const sellerStatus = application?.status ?? null;
  const canReceiveOrders = hasSellerCapability(sellerStatus, "canReceiveOrders");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchSellerDashboardData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canReceiveOrders) {
      setLoading(false);
      return;
    }
    loadData();
  }, [canReceiveOrders, loadData]);

  const revenueData = useMemo(() => {
    return data?.revenueByRange[range] || [];
  }, [data, range]);

  const totalRevenue = useMemo(() => {
    return revenueData.reduce((sum, item) => sum + item.revenue, 0);
  }, [revenueData]);
  
  const totalOrders = useMemo(() => {
    return data?.orderStatusData.reduce((sum, item) => sum + item.value, 0) || 0;
  }, [data]);
  
  const rangeGrowthLabel = useMemo(() => {
    if (range === "7d") return "+14.5% vs previous 7 days";
    if (range === "30d") return "+9.2% vs previous 30 days";
    return "+18.1% vs previous period";
  }, [range]);

  // --- SYSTEM STATES ---
  if (loading) return <SellerPageLoading variant="dashboard" />;

  if (!application) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white/90 p-8 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-zinc-950">Seller onboarding required</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-zinc-600">
          Start your seller application before the dashboard becomes available.
        </p>
        <div className="mt-5">
          <Link href="/seller/onboarding?start=1">
            <Button className="h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#00853d]">
              Start seller onboarding
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!canReceiveOrders) {
    return (
      <div className="py-6">
        <SellerOperatingHub application={application} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-base font-bold text-red-900">Failed to load dashboard</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <Button onClick={loadData} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
          Try Again
        </Button>
      </div>
    );
  }

  // --- MAIN UI ---
  return (
    <div className="mx-auto max-w-350 animate-in space-y-8 fade-in slide-in-from-bottom-4 duration-500 min-w-0">
      
      <SellerOperatingHub application={application} />

      <div className="pt-4 border-t border-zinc-200">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-black tracking-tight text-zinc-900">Performance Analytics</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500">Track sales, orders, and stock.</p>
          </div>
          <div className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 self-start md:self-auto">
            Today: {getTodayLabel()}
          </div>
        </div>
      </div>

      {/* KPI HERO CARDS */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        
        {/* Total Revenue (Zogular Gradient v4) */}
        <div className="relative overflow-hidden rounded-3xl border border-[#008f42] bg-linear-to-br from-[#009E49] to-[#007a38] p-4 text-white shadow-[0_8px_20px_rgba(0,158,73,0.2)] md:p-5">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-xl" />
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <span className="flex items-center rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm">
              <ArrowUpRight className="mr-0.5 h-3 w-3" /> +14.5%
            </span>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#99e6bc]">Total Revenue</p>
          <h3 className="mt-0.5 text-xl font-black md:text-2xl">{formatCurrency(totalRevenue)}</h3>
          <p className="mt-1 text-[10px] md:text-[11px] font-semibold text-white/80">{rangeGrowthLabel}</p>
        </div>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Pending Orders</p>
          <h3 className="mt-0.5 text-xl font-black text-zinc-900 md:text-2xl">{data.kpis.pendingOrders}</h3>
        </div>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Active Products</p>
          <h3 className="mt-0.5 text-xl font-black text-zinc-900 md:text-2xl">{data.kpis.activeProducts}</h3>
        </div>

        <div className="rounded-3xl border border-red-100 bg-red-50/50 p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-red-500">Low Stock</p>
          <h3 className="mt-0.5 text-xl font-black text-red-700 md:text-2xl">{data.lowStockItems.length} Items</h3>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <QuickActionCard href="/seller/products/new" icon={Plus} title="Add Product" description="Create a new listing fast." />
        <QuickActionCard href="/seller/orders" icon={ShoppingCart} title="View Orders" description="Manage pending and active orders." />
        <QuickActionCard href="/seller/inventory" icon={Box} title="Manage Inventory" description="Update stock and alerts." />
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        
        {/* Revenue Graph */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5 flex flex-col min-w-0">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-zinc-900">Revenue Overview</h2>
              <p className="mt-1 text-xs font-medium text-zinc-500">{formatCurrency(totalRevenue)} in the selected period</p>
            </div>
            
            <select
              aria-label="Dashboard date range"
              value={range}
              onChange={(e) => setRange(e.target.value as SellerDashboardRange)}
              className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold text-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] w-full sm:w-auto appearance-none cursor-pointer"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="12m">Last 12 Months</option>
            </select>
          </div>

          <div className="flex-1 min-h-55 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#009E49" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#009E49" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#a1a1aa", fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#a1a1aa", fontWeight: 600 }} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e4e4e7", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontWeight: "bold" }}
                  itemStyle={{ color: "#009E49" }}
                  formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#009E49" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Status & Restock */}
        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-zinc-900">Order Status</h2>
                <p className="mt-1 text-xs font-medium text-zinc-500">{totalOrders} total orders</p>
              </div>
              <Link href="/seller/orders" className="text-[11px] font-bold text-[#009E49] hover:underline">View Orders</Link>
            </div>

            <div className="relative h-37.5 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.orderStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={3} dataKey="value" stroke="none">
                    {data.orderStatusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} itemStyle={{ fontWeight: "bold", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-zinc-900">{totalOrders}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Orders</span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              {data.orderStatusData.map((status) => (
                <div key={status.name} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${getOrderStatusDotClass(status.name)}`} />
                  <span className="text-[10px] font-bold text-zinc-500">{status.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-black text-zinc-900"><Box className="h-4 w-4 text-red-500" /> Needs Restock</h2>
              <Link href="/seller/inventory" className="text-[11px] font-bold text-[#009E49] hover:underline">Inventory</Link>
            </div>
            <div className="space-y-2">
              {data.lowStockItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-zinc-900">{item.name}</p>
                    <p className="mt-1 text-[10px] font-medium text-zinc-500">Threshold: {item.threshold}</p>
                  </div>
                  <div className={`flex h-7 items-center justify-center rounded-lg px-2.5 text-[10px] font-black ${item.stock === 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                    {item.stock} Left
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        
        {/* Recent Orders */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5 min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black text-zinc-900">Recent Orders</h2>
            <Link href="/seller/orders" className="text-[11px] font-bold text-[#009E49] hover:underline">View All</Link>
          </div>
          <div className="space-y-2">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-zinc-900">{order.id}</p>
                  <p className="truncate text-xs font-medium text-zinc-500">{order.customer}</p>
                </div>
                <span className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getStatusPillClass(order.status)}`}>
                  {order.status}
                </span>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-zinc-900">{formatCurrency(order.total)}</p>
                  <Link href={`/seller/orders/${order.id}`}>
                    <Button variant="ghost" size="icon" title={`View order ${order.id}`} aria-label={`View order ${order.id}`} className="h-8 w-8 rounded-xl text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity & Payouts */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-base font-black text-zinc-900"><Bell className="h-4 w-4 text-[#009E49]" /> Recent Activity</h2>
            <Link href="/seller/notifications" className="text-[11px] font-bold text-[#009E49] hover:underline">See All</Link>
          </div>
          
          <div className="space-y-3">
            {data.recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${getActivityDotClass(item.tone)}`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-zinc-800">{item.text}</p>
                  <div className="mt-1 flex items-center text-[10px] font-medium text-zinc-500">
                    <Clock3 className="mr-1 h-3 w-3" /> {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[#009E49]/20 bg-[#009E49]/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#009E49]" />
              <p className="text-xs font-black text-zinc-900">Payout Snapshot</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white p-3 border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Available</p>
                <p className="mt-1 text-sm font-black text-zinc-900">{formatCurrency(data.kpis.payoutAvailable)}</p>
              </div>
              <div className="rounded-xl bg-white p-3 border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Pending</p>
                <p className="mt-1 text-sm font-black text-zinc-900">{formatCurrency(data.kpis.payoutPending)}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
