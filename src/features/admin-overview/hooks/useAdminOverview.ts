"use client";

import { useCallback, useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shouldHideOverviewAfterRefreshError } from "@/features/admin-overview/components/OverviewStates";
import {
  ADMIN_DASHBOARD_OVERVIEW_PERIODS,
  ADMIN_DASHBOARD_OVERVIEW_GROUPINGS,
  ALLOWED_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY,
  DEFAULT_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY,
  DEFAULT_ADMIN_DASHBOARD_OVERVIEW_QUERY,
} from "@/features/admin-overview/lib/dashboard-overview-contract";
import type {
  AdminDashboardOverviewGroupBy,
  AdminDashboardOverviewPeriod,
  AdminDashboardOverviewQuery,
} from "@/features/admin-overview/types/dashboard-overview";
import {
  fetchAdminDashboardOverview,
  getAdminOverviewSafeError,
} from "@/services/admin/dashboard";

export const ADMIN_OVERVIEW_REFETCH_INTERVAL_MS = 60_000;
export const ADMIN_OVERVIEW_QUERY_KEY = "admin-dashboard-overview" as const;

export type AdminOverviewFreshness = "fresh" | "stale" | "degraded";

function isPeriod(value: string | null): value is AdminDashboardOverviewPeriod {
  return ADMIN_DASHBOARD_OVERVIEW_PERIODS.some((period) => period === value);
}

function isGroupBy(value: string | null): value is AdminDashboardOverviewGroupBy {
  return ADMIN_DASHBOARD_OVERVIEW_GROUPINGS.some((groupBy) => groupBy === value);
}

function isGroupByAllowedForPeriod(
  period: AdminDashboardOverviewPeriod,
  groupBy: AdminDashboardOverviewGroupBy,
): boolean {
  return ALLOWED_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY[period].some(
    (allowedGroupBy) => allowedGroupBy === groupBy,
  );
}

export function parseAdminOverviewSearchParams(
  params: URLSearchParams,
): AdminDashboardOverviewQuery {
  const requestedPeriod = params.get("period");
  const period = isPeriod(requestedPeriod)
    ? requestedPeriod
    : DEFAULT_ADMIN_DASHBOARD_OVERVIEW_QUERY.period;
  const requestedGroupBy = params.get("groupBy");
  const groupBy =
    isGroupBy(requestedGroupBy) &&
    isGroupByAllowedForPeriod(period, requestedGroupBy)
      ? requestedGroupBy
      : DEFAULT_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY[period];

  return {
    period,
    comparison: "PREVIOUS_PERIOD",
    groupBy,
  };
}

export function applyAdminOverviewQueryToSearchParams(
  current: URLSearchParams,
  query: AdminDashboardOverviewQuery,
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.delete("comparison");

  if (query.period === DEFAULT_ADMIN_DASHBOARD_OVERVIEW_QUERY.period) {
    next.delete("period");
  } else {
    next.set("period", query.period);
  }

  if (query.groupBy === DEFAULT_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY[query.period]) {
    next.delete("groupBy");
  } else {
    next.set("groupBy", query.groupBy);
  }

  return next;
}

export function adminOverviewQueryKey(query: AdminDashboardOverviewQuery) {
  return [
    ADMIN_OVERVIEW_QUERY_KEY,
    query.period,
    query.comparison,
    query.groupBy,
  ] as const;
}

export function useAdminOverview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const query = useMemo(
    () => parseAdminOverviewSearchParams(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );

  const writeQuery = useCallback(
    (nextQuery: AdminDashboardOverviewQuery, history: "push" | "replace") => {
      const params = applyAdminOverviewQueryToSearchParams(
        new URLSearchParams(window.location.search),
        nextQuery,
      );
      const serialized = params.toString();
      const href = `${pathname}${serialized ? `?${serialized}` : ""}`;
      if (history === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router],
  );

  useEffect(() => {
    const current = new URLSearchParams(searchParamsKey);
    const normalized = applyAdminOverviewQueryToSearchParams(current, query);
    if (normalized.toString() !== searchParamsKey) {
      writeQuery(query, "replace");
    }
  }, [query, searchParamsKey, writeQuery]);

  const result = useQuery({
    queryKey: adminOverviewQueryKey(query),
    queryFn: ({ signal }) => fetchAdminDashboardOverview({ ...query, signal }),
    placeholderData: keepPreviousData,
    staleTime: ADMIN_OVERVIEW_REFETCH_INTERVAL_MS,
    refetchInterval: ADMIN_OVERVIEW_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });

  const error = result.error ? getAdminOverviewSafeError(result.error) : null;
  const failClosed = Boolean(
    error &&
      (shouldHideOverviewAfterRefreshError(error) ||
        error.kind === "unauthenticated"),
  );
  const data = failClosed ? null : (result.data ?? null);
  const freshness: AdminOverviewFreshness = error && data
    ? "degraded"
    : result.isStale || result.isPlaceholderData
      ? "stale"
      : "fresh";
  const isInitialLoading = result.isPending && !data;
  const isRefreshing = result.isFetching && !result.isPending;

  const setPeriod = useCallback(
    (period: AdminDashboardOverviewPeriod) => {
      const groupBy = isGroupByAllowedForPeriod(period, query.groupBy)
        ? query.groupBy
        : DEFAULT_ADMIN_DASHBOARD_OVERVIEW_GROUP_BY[period];
      writeQuery({ ...query, period, groupBy }, "push");
    },
    [query, writeQuery],
  );

  const setGroupBy = useCallback(
    (groupBy: AdminDashboardOverviewGroupBy) => {
      if (!isGroupByAllowedForPeriod(query.period, groupBy)) {
        return;
      }
      writeQuery({ ...query, groupBy }, "push");
    },
    [query, writeQuery],
  );

  const refresh = useCallback(
    () => result.refetch({ cancelRefetch: false }),
    [result],
  );

  const liveMessage = isRefreshing
    ? "Refreshing overview."
    : error
      ? error.message
      : data
        ? "Overview updated."
        : "";

  return {
    data,
    error,
    failClosed,
    freshness,
    isInitialLoading,
    isRefreshing,
    liveMessage,
    query,
    refresh,
    setGroupBy,
    setPeriod,
  };
}
