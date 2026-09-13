"use client";

/**
 * @file BuyersListFilters.tsx
 * @module features/admin-buyers/sections
 * @description
 * Search input, lifecycle status filter tabs, and list/grid layout switcher controls
 * for the Admin Buyers CRM interface, styled with the Zogular warm admin aesthetic palette.
 */

import { Search, X, List, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toTitleCase } from "@/lib/admin-format";
import type { BuyerListViewMode, BuyerStatusFilter } from "../types/admin-buyer.types";

export interface BuyersListFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: BuyerStatusFilter;
  setStatusFilter: (value: BuyerStatusFilter) => void;
  totalCount: number;
  view: BuyerListViewMode;
  setView: (view: BuyerListViewMode) => void;
  isLoading: boolean;
}

export function BuyersListFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  totalCount,
  view,
  setView,
  isLoading,
}: BuyersListFiltersProps) {
  return (
    <section
      aria-label="Buyer directory controls"
      className="overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] shadow-[0_14px_30px_rgb(6_59_41_/_7%)]"
    >
      <div className="p-3 sm:p-4">
        <div className="mb-2">
          <label htmlFor="buyer-search-input" className="text-[11px] font-black uppercase text-[var(--admin-ink-soft)]">
            Search customer directory
          </label>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-ink-soft)]" />
          <Input
            id="buyer-search-input"
            aria-label="Search customers"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customers by name, email, or phone..."
            className="h-11 rounded-md border-[color-mix(in_srgb,var(--admin-copper-muted)_42%,transparent)] bg-[var(--admin-surface-mist)] pl-10 pr-10 text-sm font-semibold text-[var(--admin-ink)] placeholder:text-[var(--admin-ink-soft)] focus-visible:ring-[var(--admin-canopy)]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear customer search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)] bg-[var(--admin-surface-mist)] p-2">
        {/* Status Pills */}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label="Filter customers by status"
        >
          {(
            [
              { key: "all", label: "All" },
              { key: "active", label: "Active" },
              { key: "inactive", label: "Inactive" },
            ] as const
          ).map(({ key, label }) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-black transition-colors ${
                  active
                    ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] shadow-sm"
                    : "text-[var(--admin-ink-soft)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)] hover:text-[var(--admin-canopy-deep)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* List / Grid Segmented Toggle */}
        <div
          className="flex items-center rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-mist)] p-0.5"
          role="group"
          aria-label="Toggle customer view mode"
        >
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold transition-colors ${
              view === "list"
                ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] shadow-sm"
                : "text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <List className="size-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-bold transition-colors ${
              view === "grid"
                ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] shadow-sm"
                : "text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            <span>Grid</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] px-4 py-2.5 text-xs font-bold text-[var(--admin-ink-soft)]">
        <span>{isLoading ? "Updating count..." : `Total ${totalCount} customer accounts`}</span>
        {statusFilter !== "all" && (
          <span className="rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-mist)] px-2 py-0.5 text-[11px] font-bold text-[var(--admin-ink)]">
            Filtered by: {toTitleCase(statusFilter)}
          </span>
        )}
      </div>
    </section>
  );
}
