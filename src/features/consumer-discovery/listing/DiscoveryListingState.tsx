"use client";

import Link from "next/link";
import { ListFilter, PackageOpen, Search, SearchX, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OPEN_DISCOVERY_FILTERS_EVENT } from "@/features/consumer-discovery/listing/DiscoveryListingControls";
import { cn } from "@/lib/utils";

export type DiscoveryListingStateKind =
  | "true-empty"
  | "filtered-zero"
  | "search-zero"
  | "search-idle"
  | "product-failure"
  | "metadata-failure";

type DiscoveryListingStateProps = {
  kind: DiscoveryListingStateKind;
  query?: string;
  clearHref?: string;
  trueEmptyScope?: "category" | "catalog";
};

export function DiscoveryListingState({ kind, query, clearHref = "/products", trueEmptyScope = "category" }: DiscoveryListingStateProps) {
  const isFailure = kind === "product-failure" || kind === "metadata-failure";
  const Icon = isFailure ? WifiOff : kind === "filtered-zero" ? ListFilter : kind.startsWith("search") ? SearchX : PackageOpen;
  const copy = getStateCopy(kind, query, trueEmptyScope);

  function editFilters(restoreFocusTo: HTMLButtonElement) {
    const mobileTrigger = document.querySelector<HTMLButtonElement>("[data-testid='mobile-filter-trigger']");
    if (mobileTrigger?.offsetParent) {
      window.dispatchEvent(new CustomEvent(OPEN_DISCOVERY_FILTERS_EVENT, { detail: { restoreFocusTo } }));
      return;
    }
    const rail = document.querySelector<HTMLElement>("[data-testid='desktop-filter-rail']");
    rail?.scrollIntoView({ block: "nearest" });
    rail?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
  }

  return (
    <section
      data-testid={`listing-${kind}`}
      role={isFailure ? "alert" : "status"}
      className="flex min-h-52 flex-col items-center justify-center border-y border-zinc-200 bg-white px-4 py-8 text-center sm:px-6"
    >
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", isFailure ? "bg-red-50 text-red-700" : "bg-emerald-50 text-[#007d3a]")}>
        <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
      </span>
      <h2 className="mt-3 text-lg font-black tracking-normal text-zinc-950">{copy.title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-5 text-zinc-600">{copy.description}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {isFailure ? (
          <Button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#007d3a]">
            Retry
          </Button>
        ) : kind === "true-empty" ? <>
          <Button asChild className="min-h-11 rounded-xl bg-[#009E49] px-4 font-bold text-white hover:bg-[#007d3a]">
            <Link href="/products" prefetch={false}>Browse all products</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-xl px-4 font-bold">
            <Link href="/search" prefetch={false}><Search aria-hidden="true" />Search</Link>
          </Button>
        </> : kind === "filtered-zero" ? <>
          <Button asChild className="min-h-11 rounded-xl bg-[#009E49] px-4 font-bold text-white hover:bg-[#007d3a]">
            <Link href={clearHref} prefetch={false}>Clear filters</Link>
          </Button>
          <Button type="button" variant="outline" className="min-h-11 rounded-xl px-4 font-bold" onClick={(event) => editFilters(event.currentTarget)}>Edit filters</Button>
        </> : kind === "search-idle" ? null : (
          <Button asChild className="min-h-11 rounded-xl bg-[#009E49] px-5 font-bold text-white hover:bg-[#007d3a]">
            <Link href={clearHref} prefetch={false}>Clear search</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

function getStateCopy(kind: DiscoveryListingStateKind, query?: string, trueEmptyScope: "category" | "catalog" = "category") {
  switch (kind) {
    case "true-empty":
      return trueEmptyScope === "catalog"
        ? { title: "No products are available yet", description: "Check back later or search for a specific product." }
        : { title: "No products in this category yet", description: "Try another category or search all products." };
    case "filtered-zero":
      return { title: "No matches for these filters", description: "Change a filter to see more products." };
    case "search-zero":
      return { title: `No products found${query ? ` for “${query}”` : ""}`, description: "Try a different product name, brand, or category." };
    case "search-idle":
      return { title: "Search Zogular products", description: "Enter a product name, brand, or category in the search field." };
    case "metadata-failure":
      return { title: "Products could not load", description: "Check your connection and try again." };
    default:
      return { title: "Products could not load", description: "Check your connection and try again." };
  }
}
