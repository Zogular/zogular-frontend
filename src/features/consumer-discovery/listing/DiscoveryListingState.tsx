"use client";

import Link from "next/link";
import { AlertCircle, PackageSearch, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

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
};

export function DiscoveryListingState({ kind, query, clearHref = "/products" }: DiscoveryListingStateProps) {
  const isFailure = kind === "product-failure" || kind === "metadata-failure";
  const Icon = isFailure ? AlertCircle : kind.startsWith("search") ? SearchX : PackageSearch;
  const copy = getStateCopy(kind, query);

  return (
    <section
      data-testid={`listing-${kind}`}
      role={isFailure ? "alert" : "status"}
      className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-9 text-center"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${isFailure ? "bg-red-100 text-red-700" : "bg-emerald-50 text-[#007d3a]"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-black tracking-normal text-zinc-950">{copy.title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-zinc-600">{copy.description}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {isFailure ? (
          <Button type="button" onClick={() => window.location.reload()} variant="outline" className="min-h-11 rounded-full px-5 font-bold">
            Retry
          </Button>
        ) : kind === "search-idle" ? null : (
          <Button asChild className="min-h-11 rounded-full bg-[#009E49] px-5 font-bold text-white hover:bg-[#007d3a]">
            <Link href={clearHref}>{kind === "true-empty" ? "Browse all products" : "Clear search and filters"}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

function getStateCopy(kind: DiscoveryListingStateKind, query?: string) {
  switch (kind) {
    case "true-empty":
      return { title: "No approved products yet", description: "There are no approved public products available here right now." };
    case "filtered-zero":
      return { title: "No products match this view", description: "Clear the current category or search selection to see other products." };
    case "search-zero":
      return { title: `No products found${query ? ` for “${query}”` : ""}`, description: "Try a different product name, brand, or category." };
    case "search-idle":
      return { title: "Search Zogular products", description: "Enter a product name, brand, or category in the search field." };
    case "metadata-failure":
      return { title: "Category unavailable", description: "We could not retrieve this category. Retry to load its current information." };
    default:
      return { title: "Products unavailable", description: "We could not retrieve products. Your category and search context has been preserved." };
  }
}
