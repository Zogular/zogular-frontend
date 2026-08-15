"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiscoveryFilterOption } from "@/features/consumer-discovery/listing/DiscoveryListingControls";
import { useDiscoveryListingTransition } from "@/features/consumer-discovery/listing/DiscoveryListingTransition";
import { cn } from "@/lib/utils";

type DesktopSubcategoryFilterRailProps = {
  filters: readonly DiscoveryFilterOption[];
  filterMetadataAvailable: boolean;
};

export function DesktopSubcategoryFilterRail({ filters, filterMetadataAvailable }: DesktopSubcategoryFilterRailProps) {
  const { isPending, navigate } = useDiscoveryListingTransition();
  const activeFilter = filters.find((filter) => filter.active) ?? filters[0];
  const clearFilter = filters.find((filter) => filter.key === "all") ?? filters[0];
  const [draftKey, setDraftKey] = useState(activeFilter?.key ?? "all");
  const hasFilters = filterMetadataAvailable && filters.length > 1;

  function applyDraft() {
    const selected = filters.find((filter) => filter.key === draftKey) ?? clearFilter;
    if (selected && !selected.active) navigate(selected.href);
  }

  return (
    <aside className="hidden lg:block" aria-label="Product filters">
      <div className="sticky top-32 border-y border-zinc-200 bg-white py-4" data-testid="desktop-filter-rail">
        <h2 className="px-1 text-sm font-black text-zinc-950">Filters</h2>
        <p className="mt-1 px-1 text-xs text-zinc-500">Category</p>
        {hasFilters ? (
          <fieldset className="mt-3 space-y-1.5">
            <legend className="sr-only">Choose a category</legend>
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                disabled={isPending}
                aria-pressed={draftKey === filter.key}
                onClick={() => setDraftKey(filter.key)}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-lg px-2.5 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]",
                  draftKey === filter.key ? "bg-emerald-50 text-emerald-950" : "text-zinc-700 hover:bg-zinc-50",
                )}
              >
                <span>{filter.label}</span>
                {draftKey === filter.key ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
              </button>
            ))}
          </fieldset>
        ) : (
          <p className="px-1 py-3 text-xs leading-5 text-zinc-500">
            {filterMetadataAvailable ? "No additional filters are available." : "Category filters are unavailable right now."}
          </p>
        )}
        {hasFilters ? (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-3">
            <Button type="button" variant="outline" className="h-11 rounded-lg" disabled={isPending} onClick={() => setDraftKey(clearFilter?.key ?? "all")}>Clear</Button>
            <Button type="button" className="h-11 rounded-lg bg-[#009E49] text-white hover:bg-[#007d3a]" disabled={isPending} onClick={applyDraft}>Apply</Button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
