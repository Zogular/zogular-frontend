"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownWideNarrow, Check, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiscoveryMobileFilterDialog } from "@/features/consumer-discovery/listing/DiscoveryMobileFilterDialog";
import {
  buildDiscoveryUrl,
  parseDiscoveryQuery,
  updateDiscoveryQuery,
} from "@/features/consumer-discovery/lib/discovery-query";
import type { DiscoveryQueryState, DiscoverySort } from "@/features/consumer-discovery/types/discovery.types";
import { cn } from "@/lib/utils";

export type DiscoveryFilterOption = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

const SORT_OPTIONS: ReadonlyArray<{ value: DiscoverySort; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

type DiscoveryListingControlsProps = {
  query: DiscoveryQueryState;
  basePath: string;
  filters: readonly DiscoveryFilterOption[];
  total?: number;
  startItem?: number;
  endItem?: number;
  filterMetadataAvailable?: boolean;
};

export function DiscoveryListingControls({
  query,
  basePath,
  filters,
  total,
  startItem,
  endItem,
  filterMetadataAvailable = true,
}: DiscoveryListingControlsProps) {
  const router = useRouter();
  const activeFilter = filters.find((filter) => filter.active) ?? filters[0];
  const clearFilter = filters.find((filter) => filter.key === "all") ?? filters[0];
  const [open, setOpen] = useState(false);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [draftFilterKey, setDraftFilterKey] = useState(activeFilter?.key ?? "all");
  const [draftSort, setDraftSort] = useState<DiscoverySort>(query.sort);

  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; href: string }> = [];
    if (activeFilter && activeFilter.key !== "all" && clearFilter) {
      chips.push({ key: "filter", label: activeFilter.label, href: clearFilter.href });
    }
    if (query.search) {
      chips.push({
        key: "search",
        label: `Search: ${query.search}`,
        href: buildDiscoveryUrl(basePath, updateDiscoveryQuery(query, { search: null })),
      });
    }
    if (query.sort !== "newest") {
      chips.push({
        key: "sort",
        label: SORT_OPTIONS.find((option) => option.value === query.sort)?.label ?? "Newest",
        href: buildDiscoveryUrl(basePath, updateDiscoveryQuery(query, { sort: "newest" })),
      });
    }
    return chips;
  }, [activeFilter, basePath, clearFilter, query]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDraftFilterKey(activeFilter?.key ?? "all");
      setDraftSort(query.sort);
    }
  }

  function applyDraft() {
    const selectedFilter = filters.find((filter) => filter.key === draftFilterKey) ?? clearFilter;
    const filterState = selectedFilter
      ? parseDiscoveryQuery(new URL(selectedFilter.href, "http://zogular.internal").searchParams)
      : query;
    const nextState = updateDiscoveryQuery(filterState, { sort: draftSort });
    const href = buildDiscoveryUrl(basePath, nextState);
    setOpen(false);
    if (href !== currentRelativeUrl()) router.push(href);
  }

  function clearDraft() {
    setDraftFilterKey(clearFilter?.key ?? "all");
  }

  function openSheet(event: React.MouseEvent<HTMLButtonElement>) {
    lastTriggerRef.current = event.currentTarget;
    setDraftFilterKey(activeFilter?.key ?? "all");
    setDraftSort(query.sort);
    setOpen(true);
  }

  const hasFilters = filterMetadataAvailable && filters.length > 1;

  return (
    <section aria-label="Product listing controls" className="space-y-3" data-testid="discovery-listing-controls">
      <div className="grid grid-cols-2 gap-2 lg:hidden">
        <Button type="button" variant="outline" className="h-11 justify-center rounded-xl bg-white font-bold" onClick={openSheet}>
          <SlidersHorizontal aria-hidden="true" />
          Filter
          {activeFilter && activeFilter.key !== "all" ? <span className="sr-only">: {activeFilter.label}</span> : null}
        </Button>
        <Button type="button" variant="outline" className="h-11 justify-center rounded-xl bg-white font-bold" onClick={openSheet}>
          <ArrowDownWideNarrow aria-hidden="true" />
          Sort
          <span className="sr-only">: {SORT_OPTIONS.find((option) => option.value === query.sort)?.label}</span>
        </Button>
      </div>

      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-y border-zinc-200 py-2.5" data-testid="listing-toolbar">
        <p className="text-sm font-semibold text-zinc-800" role="status" aria-live="polite" aria-atomic="true">
          {total === undefined
            ? "Product results"
            : total === 0
              ? "No products to display"
              : `Showing ${(startItem ?? 0).toLocaleString()}–${(endItem ?? 0).toLocaleString()} of ${total.toLocaleString()}`}
        </p>
        <label className="hidden items-center gap-2 text-xs font-bold text-zinc-600 lg:flex">
          <span>Sort</span>
          <select
            aria-label="Sort products"
            value={query.sort}
            onChange={(event) => {
              const sort = event.target.value as DiscoverySort;
              if (sort === query.sort) return;
              router.push(buildDiscoveryUrl(basePath, updateDiscoveryQuery(query, { sort })));
            }}
            className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus-visible:border-[#009E49] focus-visible:ring-2 focus-visible:ring-[#009E49]/25"
          >
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {activeChips.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Active filters" data-testid="active-filter-chips">
          {activeChips.map((chip) => (
            <Link key={chip.key} href={chip.href} prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 outline-none hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-[#009E49]">
              {chip.label}<X className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">Remove {chip.label}</span>
            </Link>
          ))}
        </div>
      ) : null}

      <DiscoveryMobileFilterDialog open={open} onOpenChange={handleOpenChange} restoreFocusRef={lastTriggerRef}>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
            <fieldset disabled={!hasFilters}>
              <legend className="mb-3 text-sm font-black text-zinc-900">Category</legend>
              {hasFilters ? (
                <div className="grid gap-2">
                  {filters.map((filter) => (
                    <button key={filter.key} type="button" aria-pressed={draftFilterKey === filter.key} onClick={() => setDraftFilterKey(filter.key)} className={cn("flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-left text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]", draftFilterKey === filter.key ? "border-[#009E49] bg-emerald-50 text-emerald-900" : "border-zinc-200 bg-white text-zinc-700")}>
                      {filter.label}{draftFilterKey === filter.key ? <Check aria-hidden="true" /> : null}
                    </button>
                  ))}
                </div>
              ) : <p className="text-sm text-zinc-500">{filterMetadataAvailable ? "No additional category filters are available here." : "Category filters are unavailable right now."}</p>}
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-sm font-black text-zinc-900">Sort products</legend>
              <div className="grid gap-2">
                {SORT_OPTIONS.map((option) => (
                  <button key={option.value} type="button" aria-pressed={draftSort === option.value} onClick={() => setDraftSort(option.value)} className={cn("flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-left text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]", draftSort === option.value ? "border-[#009E49] bg-emerald-50 text-emerald-900" : "border-zinc-200 bg-white text-zinc-700")}>
                    {option.label}{draftSort === option.value ? <Check aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div data-testid="mobile-filter-footer" className="shrink-0 grid grid-cols-2 gap-2 border-t border-zinc-200 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={clearDraft}>Clear</Button>
            <Button type="button" className="h-11 rounded-xl bg-[#009E49] text-white hover:bg-[#007d3a]" onClick={applyDraft}>Apply</Button>
          </div>
      </DiscoveryMobileFilterDialog>
    </section>
  );
}

function currentRelativeUrl() {
  return `${window.location.pathname}${window.location.search}`;
}
