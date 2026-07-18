"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CollectionViewMode } from "@/components/shared/CollectionViewToggle";

interface UseCollectionQueryStateOptions<TTab extends string, TSort extends string> {
  defaultTab: TTab;
  isTab: (value: string | null) => value is TTab;
  defaultSort: TSort;
  isSort: (value: string | null) => value is TSort;
  defaultView?: CollectionViewMode;
  defaultLimit?: number;
  allowedLimits?: readonly number[];
  searchDebounceMs?: number;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function useCollectionQueryState<TTab extends string, TSort extends string>({
  defaultTab,
  isTab,
  defaultSort,
  isSort,
  defaultView = "list",
  defaultLimit = 20,
  allowedLimits = [20, 40, 60],
  searchDebounceMs = 250,
}: UseCollectionQueryStateOptions<TTab, TSort>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");
  const [activeTab, setActiveTabState] = useState<TTab>(() => {
    const value = searchParams.get("tab");
    return isTab(value) ? value : defaultTab;
  });
  const [categoryFilter, setCategoryFilterState] = useState(searchParams.get("category") ?? "all");
  const [view, setViewState] = useState<CollectionViewMode>(() => searchParams.get("view") === "grid" ? "grid" : defaultView);
  const lastWrittenQueryRef = useRef<string | null>(null);
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const requestedLimit = parsePositiveInteger(searchParams.get("limit"), defaultLimit);
  const limit = allowedLimits.includes(requestedLimit) ? requestedLimit : defaultLimit;
  const requestedSort = searchParams.get("sort");
  const sort = isSort(requestedSort) ? requestedSort : defaultSort;
  const serverSearch = searchParams.get("search") ?? "";

  const writeParams = useCallback((
    updates: ReadonlyArray<{ key: string; value: string; defaultValue: string }>,
    history: "push" | "replace",
  ) => {
    const params = new URLSearchParams(window.location.search);
    for (const { key, value, defaultValue } of updates) {
      if (!value || value === defaultValue) params.delete(key);
      else params.set(key, value);
    }

    const query = params.toString();
    lastWrittenQueryRef.current = query;
    const href = `${pathname}${query ? `?${query}` : ""}`;
    if (history === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (searchParamsKey === lastWrittenQueryRef.current) {
      lastWrittenQueryRef.current = null;
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const nextTab = searchParams.get("tab");
      setSearchQuery(searchParams.get("search") ?? "");
      setActiveTabState(isTab(nextTab) ? nextTab : defaultTab);
      setCategoryFilterState(searchParams.get("category") ?? "all");
      setViewState(searchParams.get("view") === "grid" ? "grid" : defaultView);
    });

    return () => {
      cancelled = true;
    };
  }, [defaultTab, defaultView, isTab, searchParams, searchParamsKey]);

  useEffect(() => {
    if (searchQuery === (searchParams.get("search") ?? "")) return;
    const timeoutId = window.setTimeout(() => {
      writeParams([
        { key: "search", value: searchQuery, defaultValue: "" },
        { key: "page", value: "1", defaultValue: "1" },
      ], "replace");
    }, searchDebounceMs);
    return () => window.clearTimeout(timeoutId);
  }, [searchDebounceMs, searchParams, searchQuery, writeParams]);

  const setActiveTab = useCallback((tab: TTab) => {
    setActiveTabState(tab);
    writeParams([
      { key: "tab", value: tab, defaultValue: defaultTab },
      { key: "page", value: "1", defaultValue: "1" },
    ], "push");
  }, [defaultTab, setActiveTabState, writeParams]);

  const setCategoryFilter = useCallback((category: string) => {
    setCategoryFilterState(category);
    writeParams([
      { key: "category", value: category, defaultValue: "all" },
      { key: "page", value: "1", defaultValue: "1" },
    ], "push");
  }, [setCategoryFilterState, writeParams]);

  const setView = useCallback((nextView: CollectionViewMode) => {
    setViewState(nextView);
    writeParams([{ key: "view", value: nextView, defaultValue: defaultView }], "push");
  }, [defaultView, setViewState, writeParams]);

  const setPage = useCallback((nextPage: number) => {
    writeParams([{ key: "page", value: String(Math.max(1, nextPage)), defaultValue: "1" }], "push");
  }, [writeParams]);

  const setLimit = useCallback((nextLimit: number) => {
    const normalizedLimit = allowedLimits.includes(nextLimit) ? nextLimit : defaultLimit;
    writeParams([
      { key: "limit", value: String(normalizedLimit), defaultValue: String(defaultLimit) },
      { key: "page", value: "1", defaultValue: "1" },
    ], "push");
  }, [allowedLimits, defaultLimit, writeParams]);

  const setSort = useCallback((nextSort: TSort) => {
    writeParams([
      { key: "sort", value: nextSort, defaultValue: defaultSort },
      { key: "page", value: "1", defaultValue: "1" },
    ], "push");
  }, [defaultSort, writeParams]);

  return {
    activeTab,
    categoryFilter,
    currentUrl: `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ""}`,
    limit,
    page,
    pathname,
    searchQuery,
    serverSearch,
    setActiveTab,
    setCategoryFilter,
    setLimit,
    setPage,
    setSearchQuery,
    setSort,
    setView,
    sort,
    view,
  };
}
