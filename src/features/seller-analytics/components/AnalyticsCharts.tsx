import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { SellerTrendPoint } from "@/services/seller-metrics";

export function AnalyticsCharts({
  data,
  chartMetric,
  setChartMetric,
}: {
  data: SellerTrendPoint[];
  chartMetric: "grossItemSales" | "orders";
  setChartMetric: (metric: "grossItemSales" | "orders") => void;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6 lg:col-span-2">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-black text-zinc-900">Performance Trends</h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">Compare {chartMetric === "grossItemSales" ? "gross item sales" : "orders"} over the selected UTC period.</p>
        </div>
        <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          <button onClick={() => setChartMetric("grossItemSales")} className={cn("rounded-md px-4 py-1.5 text-xs font-bold transition-all", chartMetric === "grossItemSales" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>
            Gross item sales
          </button>
          <button onClick={() => setChartMetric("orders")} className={cn("rounded-md px-4 py-1.5 text-xs font-bold transition-all", chartMetric === "orders" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700")}>
            Orders
          </button>
        </div>
      </div>
      <div className="h-62.5 w-full min-w-0 flex-1 md:h-70">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: chartMetric === "grossItemSales" ? 10 : -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartMetric === "grossItemSales" ? "#009E49" : "#3B82F6"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartMetric === "grossItemSales" ? "#009E49" : "#3B82F6"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f4f4f5" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a1a1aa", fontWeight: 600 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#a1a1aa", fontWeight: 600 }} tickFormatter={(value) => (chartMetric === "grossItemSales" ? `K${Number(value).toLocaleString()}` : value)} />
            <Tooltip formatter={(value) => [chartMetric === "grossItemSales" ? `K${Number(value).toLocaleString()}` : Number(value), chartMetric === "grossItemSales" ? "Gross item sales" : "Orders"]} />
            <Area type="monotone" dataKey={chartMetric} stroke={chartMetric === "grossItemSales" ? "#009E49" : "#3B82F6"} strokeWidth={3} fillOpacity={1} fill="url(#colorMetric)" animationDuration={1000} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
