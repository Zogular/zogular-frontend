"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp, Users, Store, Activity, AlertCircle, 
  ArrowUpRight, ArrowDownRight, Wallet, ShieldCheck, Clock
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";

// ============================================================================
// 1. DATA CONTRACTS & MOCK API
// ============================================================================
type DashboardRange = "last_7_days" | "last_30_days" | "month_to_date" | "quarter_to_date";

type DashboardAlert = { id: string; type: "warning" | "info"; message: string };

type DashboardData = {
  kpis: {
    gmv: number;
    gmvGrowth: number;
    revenue: number;
    revenueGrowth: number;
    activeSellers: number;
    sellerGrowth: number;
    activeBuyers: number;
    buyerGrowth: number;
  };
  trends: { label: string; gmv: number }[];
  systemHealth: { escrowPending: number; disputesOpen: number; unverifiedSellers: number };
  recentAlerts: DashboardAlert[];
  marketplace: {
    averageOrderValue: number;
    takeRate: number;
    conversionRate: number;
    repeatPurchaseRate: number;
    deliverySla: number;
    refundRate: number;
    topCategories: { name: string; gmv: number; share: number }[];
  };
};

const DASHBOARD_DATA_BY_RANGE: Record<DashboardRange, DashboardData> = {
  last_7_days: {
    kpis: { gmv: 920000, gmvGrowth: 9.4, revenue: 28600, revenueGrowth: 7.8, activeSellers: 126, sellerGrowth: 2.2, activeBuyers: 3860, buyerGrowth: 11.6 },
    trends: [
      { label: "Mon", gmv: 98000 }, { label: "Tue", gmv: 112000 }, { label: "Wed", gmv: 121000 }, { label: "Thu", gmv: 138000 }, { label: "Fri", gmv: 151000 }, { label: "Sat", gmv: 164000 }, { label: "Sun", gmv: 136000 },
    ],
    systemHealth: { escrowPending: 214000, disputesOpen: 5, unverifiedSellers: 9 },
    recentAlerts: [
      { id: "7d-1", type: "warning", message: "Three high-value orders are still awaiting seller dispatch confirmation." },
      { id: "7d-2", type: "info", message: "Pickup station confirmations improved by 6.2% this week." },
    ],
    marketplace: { averageOrderValue: 238, takeRate: 6.8, conversionRate: 3.4, repeatPurchaseRate: 18.2, deliverySla: 91.4, refundRate: 1.8, topCategories: [{ name: "Electronics", gmv: 322000, share: 35 }, { name: "Home & Living", gmv: 214000, share: 23 }, { name: "Fashion", gmv: 171000, share: 19 }] },
  },
  last_30_days: {
    kpis: { gmv: 4250000, gmvGrowth: 18.2, revenue: 127500, revenueGrowth: 15.4, activeSellers: 342, sellerGrowth: 5.1, activeBuyers: 12450, buyerGrowth: 22.4 },
    trends: [
      { label: "W1", gmv: 850000 }, { label: "W2", gmv: 920000 }, { label: "W3", gmv: 1100000 }, { label: "W4", gmv: 1380000 },
    ],
    systemHealth: { escrowPending: 840000, disputesOpen: 14, unverifiedSellers: 28 },
    recentAlerts: [
      { id: "30d-1", type: "warning", message: "Spike in refunds requested for category 'Electronics'." },
      { id: "30d-2", type: "info", message: "Escrow release batch #8942 processed successfully." },
    ],
    marketplace: { averageOrderValue: 342, takeRate: 7.1, conversionRate: 3.9, repeatPurchaseRate: 21.7, deliverySla: 88.6, refundRate: 2.4, topCategories: [{ name: "Electronics", gmv: 1410000, share: 33 }, { name: "Fashion", gmv: 862000, share: 20 }, { name: "Home & Living", gmv: 744000, share: 18 }] },
  },
  month_to_date: {
    kpis: { gmv: 1615000, gmvGrowth: 12.7, revenue: 51200, revenueGrowth: 10.1, activeSellers: 218, sellerGrowth: 3.8, activeBuyers: 6180, buyerGrowth: 14.5 },
    trends: [
      { label: "1-3", gmv: 308000 }, { label: "4-6", gmv: 421000 }, { label: "7-9", gmv: 486000 }, { label: "10+", gmv: 400000 },
    ],
    systemHealth: { escrowPending: 362000, disputesOpen: 8, unverifiedSellers: 16 },
    recentAlerts: [
      { id: "mtd-1", type: "warning", message: "Seller approval SLA is drifting on new Lusaka onboarding requests." },
      { id: "mtd-2", type: "info", message: "Mobile Money checkout completion is above the previous month-to-date baseline." },
    ],
    marketplace: { averageOrderValue: 298, takeRate: 7.3, conversionRate: 4.1, repeatPurchaseRate: 19.6, deliverySla: 89.9, refundRate: 2.1, topCategories: [{ name: "Electronics", gmv: 522000, share: 32 }, { name: "Beauty & Health", gmv: 341000, share: 21 }, { name: "Fashion", gmv: 266000, share: 16 }] },
  },
  quarter_to_date: {
    kpis: { gmv: 11880000, gmvGrowth: 24.9, revenue: 381400, revenueGrowth: 21.2, activeSellers: 518, sellerGrowth: 12.4, activeBuyers: 28700, buyerGrowth: 31.8 },
    trends: [
      { label: "Apr", gmv: 3630000 }, { label: "May", gmv: 4250000 }, { label: "Jun", gmv: 4000000 },
    ],
    systemHealth: { escrowPending: 1320000, disputesOpen: 31, unverifiedSellers: 44 },
    recentAlerts: [
      { id: "qtd-1", type: "warning", message: "Quarterly dispute rate is concentrated in seller-arranged delivery." },
      { id: "qtd-2", type: "info", message: "Verified seller GMV share is trending up across the quarter." },
    ],
    marketplace: { averageOrderValue: 414, takeRate: 7.6, conversionRate: 4.4, repeatPurchaseRate: 24.3, deliverySla: 86.2, refundRate: 2.9, topCategories: [{ name: "Electronics", gmv: 3960000, share: 33 }, { name: "Home & Living", gmv: 2280000, share: 19 }, { name: "Fashion", gmv: 2140000, share: 18 }] },
  },
};

const rangeLabels: Record<DashboardRange, string> = {
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  month_to_date: "Month to date",
  quarter_to_date: "Quarter to date",
};

// ============================================================================
// 2. SUBCOMPONENTS
// ============================================================================
type KpiTone = "emerald" | "amber" | "indigo" | "zinc";

const KPI_TONES: Record<KpiTone, { card: string; icon: string; glow: string; accent: string }> = {
  emerald: {
    card: "border-emerald-200/70 bg-linear-to-br from-white via-emerald-50/70 to-emerald-100/60",
    icon: "bg-emerald-500 text-white",
    glow: "shadow-emerald-900/10",
    accent: "text-emerald-700 bg-emerald-100 border-emerald-200",
  },
  amber: {
    card: "border-amber-200/70 bg-linear-to-br from-white via-amber-50/70 to-orange-100/60",
    icon: "bg-amber-500 text-white",
    glow: "shadow-amber-900/10",
    accent: "text-amber-800 bg-amber-100 border-amber-200",
  },
  indigo: {
    card: "border-indigo-200/70 bg-linear-to-br from-white via-indigo-50/70 to-sky-100/60",
    icon: "bg-indigo-500 text-white",
    glow: "shadow-indigo-900/10",
    accent: "text-indigo-700 bg-indigo-100 border-indigo-200",
  },
  zinc: {
    card: "border-zinc-200/70 bg-linear-to-br from-white via-zinc-50 to-zinc-100/80",
    icon: "bg-zinc-900 text-white",
    glow: "shadow-zinc-900/10",
    accent: "text-zinc-700 bg-zinc-100 border-zinc-200",
  },
};

function KPICard({ title, value, growth, icon: Icon, isCurrency = false, tone = "zinc", comparisonLabel }: { title: string; value: number; growth: number; icon: React.ComponentType<{ className?: string }>; isCurrency?: boolean; tone?: KpiTone; comparisonLabel: string }) {
  const isPositive = growth > 0;
  const toneClasses = KPI_TONES[tone];
  return (
    <div className={cn("group relative overflow-hidden rounded-3xl border p-5 shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg", toneClasses.card, toneClasses.glow)}>
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/45 blur-2xl" />
      <div className="relative mb-4 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{title}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-2xl shadow-lg", toneClasses.icon, toneClasses.glow)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <h3 className="relative text-2xl font-black text-zinc-950">{isCurrency ? `K${(value/1000).toFixed(1)}k` : new Intl.NumberFormat().format(value)}</h3>
      <div className="relative mt-3 flex items-center gap-1.5">
        <span className={cn("flex items-center rounded-lg border px-1.5 py-0.5 text-[10px] font-black", isPositive ? toneClasses.accent : "border-rose-200 bg-rose-100 text-rose-700")}>
          {isPositive ? <ArrowUpRight className="mr-0.5 h-3 w-3" /> : <ArrowDownRight className="mr-0.5 h-3 w-3" />}
          {Math.abs(growth)}%
        </span>
        <span className="text-[9px] font-bold text-zinc-500">{comparisonLabel}</span>
      </div>
    </div>
  );
}

// ============================================================================
// 3. MAIN PAGE EXPORT
// ============================================================================
export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DashboardRange>("last_30_days");
  const data = DASHBOARD_DATA_BY_RANGE[dateRange];
  const dateRangeLabel = rangeLabels[dateRange];
  const comparisonLabel = `vs previous ${dateRangeLabel.toLowerCase()}`;

  useEffect(() => {
    // Simulate API Load
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const identity = useAdminIdentity()!;
  const canSeeFinancials = adminIdentityHasPermission(identity, "view_financial_reports");

  if (loading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-64 rounded-xl bg-zinc-200" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4"><div className="h-32 rounded-3xl bg-zinc-200" /><div className="h-32 rounded-3xl bg-zinc-200" /><div className="h-32 rounded-3xl bg-zinc-200" /><div className="h-32 rounded-3xl bg-zinc-200" /></div>
      <div className="h-100 rounded-3xl bg-zinc-200" />
    </div>
  );

  return (
    <div className="mx-auto max-w-400 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-12">
      
      {/* 1. HEADER */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Platform Overview</h1>
        <p className="mt-1 text-sm font-medium text-zinc-500">Real-time platform performance and system health.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-md shadow-zinc-900/5 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Executive range</p>
          <p className="text-sm font-bold text-zinc-700">Selected period: {dateRangeLabel}. Backend metrics can bind to this range without changing page structure.</p>
        </div>
        <select value={dateRange} onChange={(event) => setDateRange(event.target.value as DashboardRange)} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="month_to_date">Month to date</option>
          <option value="quarter_to_date">Quarter to date</option>
        </select>
      </div>

      {/* 2. KPI GRID */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {canSeeFinancials ? (
          <>
            <KPICard title="Gross Merchandise Value" value={data.kpis.gmv} growth={data.kpis.gmvGrowth} icon={TrendingUp} isCurrency tone="emerald" comparisonLabel={comparisonLabel} />
            <KPICard title="Platform Revenue (Net)" value={data.kpis.revenue} growth={data.kpis.revenueGrowth} icon={Wallet} isCurrency tone="emerald" comparisonLabel={comparisonLabel} />
          </>
        ) : (
          <div className="col-span-2 flex items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white/70 p-5 text-center shadow-md backdrop-blur-xl">
            <p className="text-xs font-bold text-zinc-500"><ShieldCheck className="mx-auto mb-2 h-5 w-5 opacity-50" /> Financial metrics restricted by your role.</p>
          </div>
        )}
        <KPICard title="Active Sellers" value={data.kpis.activeSellers} growth={data.kpis.sellerGrowth} icon={Store} tone="amber" comparisonLabel={comparisonLabel} />
        <KPICard title="Active Buyers" value={data.kpis.activeBuyers} growth={data.kpis.buyerGrowth} icon={Users} tone="indigo" comparisonLabel={comparisonLabel} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* 3. TREND CHART */}
        <div className="flex min-w-0 flex-col rounded-3xl border border-white/70 bg-white/75 p-4 shadow-md shadow-zinc-900/5 backdrop-blur-xl transition-all hover:shadow-lg md:p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-zinc-900">GMV Growth</h2>
              <p className="mt-1 text-xs font-medium text-zinc-500">Selected range: {dateRangeLabel}</p>
            </div>
          </div>
          <div className="min-h-[248px] w-full min-w-0 md:min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trends} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18181b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f4f4f5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a1a1aa", fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a1a1aa", fontWeight: 600 }} tickFormatter={(val) => `K${val/1000}k`} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontWeight: "bold" }} formatter={(value) => {
                  const amount = Array.isArray(value) ? Number(value[0]) : Number(value ?? 0);
                  return [`K${new Intl.NumberFormat().format(amount)}`, "GMV"];
                }} />
                <Area type="monotone" dataKey="gmv" stroke="#18181b" strokeWidth={3} fillOpacity={1} fill="url(#colorGmv)" animationDuration={1000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. SYSTEM HEALTH */}
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-md shadow-zinc-900/5 backdrop-blur-xl transition-all hover:shadow-lg md:p-6 flex-1">
            <h2 className="mb-5 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-zinc-900"><Activity className="h-4 w-4 text-zinc-400" /> Operational Health</h2>
            <div className="space-y-4">
              {canSeeFinancials && (
                <div className="flex items-center justify-between rounded-2xl bg-linear-to-r from-amber-50 to-orange-50 p-3 border border-amber-200 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-900">Funds in Escrow</span>
                  </div>
                  <span className="text-sm font-black text-amber-700">K{(data.systemHealth.escrowPending / 1000).toFixed(1)}k</span>
                </div>
              )}
              <div className="flex items-center justify-between rounded-2xl bg-linear-to-r from-rose-50 to-red-50 p-3 border border-rose-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-bold text-red-900">Open Disputes</span>
                </div>
                <span className="text-sm font-black text-red-700">{data.systemHealth.disputesOpen} Active</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-linear-to-r from-indigo-50 to-sky-50 p-3 border border-indigo-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-bold text-blue-900">Pending Approvals</span>
                </div>
                <span className="text-sm font-black text-blue-700">{data.systemHealth.unverifiedSellers} Sellers</span>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-md shadow-zinc-900/5 backdrop-blur-xl transition-all hover:shadow-lg md:p-6">
            <h2 className="mb-4 text-sm font-black uppercase tracking-wider text-zinc-900">Alert Center</h2>
            <div className="space-y-3">
              {data.recentAlerts.map((alert) => (
                <div key={alert.id} className={cn("rounded-2xl border p-3 text-xs font-bold", alert.type === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-indigo-200 bg-indigo-50 text-indigo-800")}>
                  {alert.message}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <PlatformSignal label="AOV" value={`K${data.marketplace.averageOrderValue.toLocaleString()}`} note="Average order value" tone="emerald" />
        <PlatformSignal label="Take rate" value={`${data.marketplace.takeRate}%`} note="Commission capture" tone="indigo" />
        <PlatformSignal label="Conversion" value={`${data.marketplace.conversionRate}%`} note="Visit to order" tone="amber" />
        <PlatformSignal label="Repeat rate" value={`${data.marketplace.repeatPurchaseRate}%`} note="Buyer retention" tone="sky" />
        <PlatformSignal label="Delivery SLA" value={`${data.marketplace.deliverySla}%`} note="On-time fulfilment" tone="emerald" />
        <PlatformSignal label="Refund rate" value={`${data.marketplace.refundRate}%`} note="Trust pressure" tone="rose" />
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-base font-black text-zinc-900">Platform mix</h2>
            <p className="mt-1 text-xs font-bold text-zinc-500">Top categories for {dateRangeLabel.toLowerCase()}, capped to avoid endless dashboard growth.</p>
          </div>
          <Button asChild variant="outline" className="rounded-xl font-black"><Link href="/admin/reports">Open full category report</Link></Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {data.marketplace.topCategories.map((category) => (
            <div key={`${dateRange}-${category.name}`} className="rounded-2xl border border-zinc-100 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-black text-zinc-950">{category.name}</p>
                <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">{category.share}%</span>
              </div>
              <p className="mt-2 text-2xl font-black text-zinc-950">K{(category.gmv / 1000).toFixed(1)}k</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-base font-black text-zinc-900">Quick actions and drilldowns</h2>
            <p className="mt-1 text-xs font-bold text-zinc-500">Directly open launch-critical operating queues from the executive dashboard.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl font-black"><Link href="/admin/orders">Review orders</Link></Button>
            <Button asChild variant="outline" className="rounded-xl font-black"><Link href="/admin/sellers">Seller approvals</Link></Button>
            <Button asChild variant="outline" className="rounded-xl font-black"><Link href="/admin/disputes">Open disputes</Link></Button>
            {canSeeFinancials ? <Button asChild className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800"><Link href="/admin/reports">Executive reports</Link></Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformSignal({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "emerald" | "amber" | "indigo" | "rose" | "sky";
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return (
    <div className={cn("rounded-3xl border p-4 shadow-md shadow-zinc-900/5", toneClasses[tone])}>
      <p className="text-[10px] font-black uppercase tracking-wider opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-black text-zinc-950">{value}</p>
      <p className="mt-1 text-xs font-bold">{note}</p>
    </div>
  );
}
