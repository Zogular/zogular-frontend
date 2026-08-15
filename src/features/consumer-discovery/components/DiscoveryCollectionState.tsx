"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ListFilter, PackageSearch, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiscoveryCollectionUnavailable } from "@/features/consumer-discovery/types/discovery.types";
import { cn } from "@/lib/utils";

type DiscoveryCollectionStateProps<TError extends Error = Error> = {
  outcome: DiscoveryCollectionUnavailable<TError>;
  onClearFilters?: () => void;
  onEditFilters?: () => void;
  browseHref?: string;
  searchHref?: string;
  className?: string;
};

export function DiscoveryCollectionState<TError extends Error = Error>({
  outcome,
  onClearFilters,
  onEditFilters,
  browseHref = "/products",
  searchHref = "/search",
  className,
}: DiscoveryCollectionStateProps<TError>) {
  const [retryStatus, setRetryStatus] = useState<"idle" | "pending" | "failed">("idle");
  const retryInFlightRef = useRef(false);
  const isFailure = outcome.status === "failure";
  const isFilteredZero = outcome.status === "filtered-zero";
  const Icon = isFailure ? AlertCircle : isFilteredZero ? ListFilter : PackageSearch;
  const copy = isFailure
    ? {
        title: "Products are unavailable right now",
        description: "We could not retrieve products. Please retry when you are ready.",
      }
    : isFilteredZero
      ? {
          title: "No matches for these filters",
          description: "Try clearing or editing the current filters to see more products.",
        }
      : {
          title: "No products in this category yet",
          description: "No products are available in this category yet.",
        };

  async function handleRetry() {
    if (outcome.status !== "failure" || retryInFlightRef.current) return;

    retryInFlightRef.current = true;
    setRetryStatus("pending");
    try {
      await outcome.retry();
      setRetryStatus("idle");
    } catch {
      setRetryStatus("failed");
    } finally {
      retryInFlightRef.current = false;
    }
  }

  return (
    <section
      data-testid={`discovery-${outcome.status}`}
      role={isFailure ? "alert" : "status"}
      className={cn(
        "flex min-h-64 flex-col items-center justify-center rounded-2xl border px-5 py-10 text-center",
        isFailure ? "border-red-200 bg-red-50/70" : "border-zinc-200 bg-white",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          isFailure ? "bg-red-100 text-red-700" : "bg-emerald-50 text-[#007d3a]",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className={cn("mt-4 text-base font-black", isFailure ? "text-red-950" : "text-zinc-950")}>
        {copy.title}
      </h2>
      <p className={cn("mt-1 max-w-md text-sm leading-6", isFailure ? "text-red-800" : "text-zinc-600")}>
        {copy.description}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {outcome.status === "true-empty" ? (
          <>
            <Button asChild className="min-h-11 rounded-full bg-[#009E49] px-4 font-bold text-white hover:bg-[#007d3a]">
              <Link href={browseHref}>Browse all products</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 rounded-full px-4 font-bold">
              <Link href={searchHref}>
                <Search aria-hidden="true" />
                Search products
              </Link>
            </Button>
          </>
        ) : null}
        {outcome.status === "filtered-zero" ? (
          <>
            <Button
              type="button"
              onClick={onClearFilters}
              disabled={!onClearFilters}
              className="min-h-11 rounded-full bg-[#009E49] px-4 font-bold text-white hover:bg-[#007d3a]"
            >
              Clear filters
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onEditFilters}
              disabled={!onEditFilters}
              className="min-h-11 rounded-full px-4 font-bold"
            >
              Edit filters
            </Button>
          </>
        ) : null}
        {outcome.status === "failure" ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRetry()}
              disabled={retryStatus === "pending"}
              aria-describedby={retryStatus === "failed" ? "discovery-retry-feedback" : undefined}
              className="min-h-11 rounded-full border-red-300 px-4 font-bold text-red-800 hover:bg-red-100"
            >
              {retryStatus === "pending" ? "Retrying…" : retryStatus === "failed" ? "Retry again" : "Retry"}
            </Button>
            {retryStatus === "failed" ? (
              <p
                id="discovery-retry-feedback"
                data-testid="discovery-retry-failure"
                role="status"
                className="basis-full text-sm font-medium text-red-800"
              >
                We still could not retrieve products. Please try again.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
