import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  buildSellerAnalyticsCsv,
  fetchSellerAnalyticsData,
  getSellerMetricsErrorMessage,
  getSellerSnapshotPresentationState,
  type SellerAnalyticsCategoryFilter,
  type SellerAnalyticsData,
  type SellerAnalyticsTimeRange,
} from "@/services/seller-metrics";

export function useSellerAnalytics() {
  const [data, setData] = useState<SellerAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [range, setRange] = useState<SellerAnalyticsTimeRange>("30d");
  const [chartMetric, setChartMetric] = useState<"grossItemSales" | "orders">("grossItemSales");
  const [categoryFilter, setCategoryFilter] = useState<SellerAnalyticsCategoryFilter>("all");

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const result = await fetchSellerAnalyticsData(range);
      if (requestId === requestIdRef.current) setData(result);
    } catch (err) {
      if (requestId === requestIdRef.current) setError(getSellerMetricsErrorMessage(err));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
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

  const snapshotState = getSellerSnapshotPresentationState(
    range,
    data?.range ?? null,
    loading,
    error,
  );

  const handleExport = () => {
    if (!data || !snapshotState.canExport) return;
    const csv = buildSellerAnalyticsCsv(
      data,
      categoryFilter,
      filteredTopProducts,
      filteredLowPerformers,
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zogular-seller-snapshot-${data.range}-${new Date().toISOString().slice(0, 10)}.csv`;
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
    snapshotState,
    loadData,
    handleExport,
  };
}
