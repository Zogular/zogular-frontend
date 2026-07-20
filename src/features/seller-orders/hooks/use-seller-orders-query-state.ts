"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CollectionViewMode } from "@/components/shared/CollectionViewToggle";
import type {
  SellerOrderQuery,
  SellerOrderSort,
  SellerOrderStatus,
} from "@/services/seller-orders";

const ALLOWED_LIMITS = [20, 40, 60] as const;
const ALLOWED_SORTS: readonly SellerOrderSort[] = [
  "newest",
  "oldest",
  "recently-updated",
  "order-number",
];
const ALLOWED_STATUSES: readonly SellerOrderStatus[] = [
  "new",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refund",
];

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function toStartIso(date: string) {
  return date ? `${date}T00:00:00.000Z` : undefined;
}

function toEndIso(date: string) {
  return date ? `${date}T23:59:59.999Z` : undefined;
}

export function useSellerOrdersQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const serverSearch = searchParams.get("search")?.trim() ?? "";
  const [search, setSearch] = useState(serverSearch);

  useEffect(() => {
    setSearch(serverSearch);
  }, [serverSearch]);

  const write = useCallback((updates: Record<string, string>, history: "push" | "replace" = "push") => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    const href = `${pathname}${query ? `?${query}` : ""}`;
    if (history === "replace") router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (search.trim() === serverSearch) return;
    const timeout = window.setTimeout(() => {
      write({ search: search.trim(), page: "" }, "replace");
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search, serverSearch, write]);

  const page = positiveInteger(searchParams.get("page"), 1);
  const requestedLimit = positiveInteger(searchParams.get("limit"), 20);
  const limit = ALLOWED_LIMITS.includes(requestedLimit as (typeof ALLOWED_LIMITS)[number])
    ? requestedLimit
    : 20;
  const requestedStatus = searchParams.get("status") as SellerOrderStatus | null;
  const status = requestedStatus && ALLOWED_STATUSES.includes(requestedStatus)
    ? requestedStatus
    : undefined;
  const requestedSort = searchParams.get("sort") as SellerOrderSort | null;
  const sort = requestedSort && ALLOWED_SORTS.includes(requestedSort)
    ? requestedSort
    : "newest";
  const view: CollectionViewMode = searchParams.get("view") === "grid" ? "grid" : "list";
  const createdFrom = normalizeDate(searchParams.get("createdFrom"));
  const createdTo = normalizeDate(searchParams.get("createdTo"));

  const apiQuery = useMemo<SellerOrderQuery>(() => ({
    page,
    limit,
    search: serverSearch || undefined,
    status: status as SellerOrderQuery["status"],
    createdFrom: toStartIso(createdFrom),
    createdTo: toEndIso(createdTo),
    sort,
  }), [createdFrom, createdTo, limit, page, serverSearch, sort, status]);

  const listUrl = `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ""}`;
  const updateFilter = useCallback((updates: Record<string, string>) => {
    write({ ...updates, page: "" });
  }, [write]);

  return {
    apiQuery,
    createdFrom,
    createdTo,
    limit,
    listUrl,
    page,
    search,
    setCreatedFrom: (value: string) => updateFilter({ createdFrom: value }),
    setCreatedTo: (value: string) => updateFilter({ createdTo: value }),
    setLimit: (value: number) => updateFilter({ limit: value === 20 ? "" : String(value) }),
    setPage: (value: number) => write({ page: value <= 1 ? "" : String(value) }),
    setSearch,
    setSort: (value: SellerOrderSort) => updateFilter({ sort: value === "newest" ? "" : value }),
    setStatus: (value: SellerOrderStatus | undefined) => updateFilter({ status: value ?? "" }),
    setView: (value: CollectionViewMode) => write({ view: value === "list" ? "" : value }),
    sort,
    status,
    view,
  };
}
