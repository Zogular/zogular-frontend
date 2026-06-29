import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  fetchSellerAnalyticsData,
  type SellerAnalyticsCategoryFilter,
  type SellerAnalyticsData,
  type SellerAnalyticsTimeRange,
} from "@/services/seller-metrics";

export function useSellerAnalytics() {
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

  const handleExport = () => {
    if (!data) return;
    const reportRows = [
      ["Metric", "Value"],
      ["Snapshot Type", "Seller-visible order and catalog snapshot"],
      ["Range", range],
      ["Category Filter", categoryFilter],
      ["Seller-visible Revenue", String(Math.round(data.summary.sellerVisibleRevenue))],
      ["Seller-visible Orders", String(data.summary.sellerVisibleOrders)],
      ["Average Visible Order Value", String(Math.round(data.summary.avgOrderValue))],
      ["Delivered Orders", String(data.summary.deliveredOrders)],
      ["Buyer-visible Products", String(data.summary.buyerVisibleProducts)],
      ["Low-stock Products", String(data.summary.lowStockProducts)],
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
    link.download = `zogular-seller-snapshot-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Seller snapshot exported.");
  };

  return {
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
    loadData,
    handleExport,
  };
}
