"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CollectionViewMode } from "@/components/shared/CollectionViewToggle";

interface UseCollectionQueryStateOptions<TTab extends string> {
  defaultTab: TTab;
  isTab: (value: string | null) => value is TTab;
  defaultView?: CollectionViewMode;
  searchDebounceMs?: number;
}

export function useCollectionQueryState<TTab extends string>({
  defaultTab,
  isTab,
  defaultView = "list",
  searchDebounceMs = 250,
}: UseCollectionQueryStateOptions<TTab>) {
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

  const writeParam = useCallback((
    key: string,
    value: string,
    defaultValue: string,
    history: "push" | "replace",
  ) => {
    const params = new URLSearchParams(window.location.search);
    if (!value || value === defaultValue) params.delete(key);
    else params.set(key, value);

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
      writeParam("search", searchQuery, "", "replace");
    }, searchDebounceMs);
    return () => window.clearTimeout(timeoutId);
  }, [searchDebounceMs, searchParams, searchQuery, writeParam]);

  const setActiveTab = useCallback((tab: TTab) => {
    setActiveTabState(tab);
    writeParam("tab", tab, defaultTab, "push");
  }, [defaultTab, writeParam]);

  const setCategoryFilter = useCallback((category: string) => {
    setCategoryFilterState(category);
    writeParam("category", category, "all", "push");
  }, [writeParam]);

  const setView = useCallback((nextView: CollectionViewMode) => {
    setViewState(nextView);
    writeParam("view", nextView, defaultView, "push");
  }, [defaultView, writeParam]);

  return {
    activeTab,
    categoryFilter,
    currentUrl: `${pathname}${searchParamsKey ? `?${searchParamsKey}` : ""}`,
    pathname,
    searchQuery,
    setActiveTab,
    setCategoryFilter,
    setSearchQuery,
    setView,
    view,
  };
}
