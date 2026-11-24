/**
 * @file BuyersFilters.tsx
 * @module features/admin-buyers/sections
 * @description
 * Search, status filtering, sorting, and view-mode controls for the Customers workspace.
 *
 * Requirements:
 * - Honest search placeholder based on actor's `view_user_sensitive_fields` permission.
 * - Active / Inactive / All status filtering.
 * - Sort selection (createdAt, updatedAt, firstName, email, isActive).
 * - CollectionViewToggle for list vs grid presentation.
 * - Accessible controls with clear touch targets and keyboard focus indicators.
 */

"use client";

import { useId } from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CollectionViewToggle } from "@/components/shared/CollectionViewToggle";
import type {
  AdminBuyerActiveFilter,
  AdminBuyerSortBy,
  AdminBuyerSortOrder,
  AdminBuyerViewMode,
} from "../types/admin-buyer.types";

interface BuyersFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  activeFilter: AdminBuyerActiveFilter;
  onActiveFilterChange: (value: AdminBuyerActiveFilter) => void;
  sortBy: AdminBuyerSortBy;
  sortOrder: AdminBuyerSortOrder;
  onSortChange: (sortBy: AdminBuyerSortBy, sortOrder: AdminBuyerSortOrder) => void;
  viewMode: AdminBuyerViewMode;
  onViewModeChange: (view: AdminBuyerViewMode) => void;
  canViewSensitiveFields: boolean;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

export function BuyersFilters({
  searchQuery,
  onSearchChange,
  activeFilter,
  onActiveFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  canViewSensitiveFields,
  onResetFilters,
  hasActiveFilters,
}: BuyersFiltersProps) {
  const searchInputId = useId();
  const sortSelectId = useId();

  const searchPlaceholder = canViewSensitiveFields
    ? "Search by name, email, or customer ID..."
    : "Search by customer ID...";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/80 p-3 shadow-md shadow-zinc-900/5 backdrop-blur-xl sm:p-4">
      {/* Top row: Search input + View toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <label htmlFor={searchInputId} className="sr-only">
            {searchPlaceholder}
          </label>
          <Search
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <Input
            id={searchInputId}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-xl border-zinc-200 bg-zinc-50/80 pl-9 pr-9 text-sm font-medium transition-colors hover:bg-white focus-visible:ring-zinc-900"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search query"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <CollectionViewToggle
            value={viewMode}
            onChange={onViewModeChange}
            variant="icon"
          />
        </div>
      </div>

      {/* Bottom row: Filter chips, sort controls, and reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
        {/* Status filter tabs */}
        <div
          role="group"
          aria-label="Filter customers by status"
          className="inline-flex rounded-xl border border-zinc-200 bg-zinc-100/80 p-0.5 text-xs font-semibold"
        >
          <button
            type="button"
            aria-pressed={activeFilter === "all"}
            onClick={() => onActiveFilterChange("all")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              activeFilter === "all"
                ? "bg-white font-bold text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            All Status
          </button>
          <button
            type="button"
            aria-pressed={activeFilter === "active"}
            onClick={() => onActiveFilterChange("active")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              activeFilter === "active"
                ? "bg-white font-bold text-emerald-800 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            aria-pressed={activeFilter === "inactive"}
            onClick={() => onActiveFilterChange("inactive")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              activeFilter === "inactive"
                ? "bg-white font-bold text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Inactive
          </button>
        </div>

        {/* Sort and Reset */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor={sortSelectId} className="text-xs font-medium text-zinc-500">
              Sort:
            </label>
            <select
              id={sortSelectId}
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split(":") as [
                  AdminBuyerSortBy,
                  AdminBuyerSortOrder,
                ];
                onSortChange(newSortBy, newSortOrder);
              }}
              className="h-8 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 transition-colors hover:border-zinc-300 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            >
              <option value="createdAt:desc">Joined: Newest</option>
              <option value="createdAt:asc">Joined: Oldest</option>
              <option value="updatedAt:desc">Updated: Recent</option>
              {canViewSensitiveFields ? (
                <>
                  <option value="firstName:asc">Name: A to Z</option>
                  <option value="firstName:desc">Name: Z to A</option>
                  <option value="email:asc">Email: A to Z</option>
                </>
              ) : null}
              <option value="isActive:desc">Status: Active first</option>
              <option value="isActive:asc">Status: Inactive first</option>
            </select>
          </div>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-8 gap-1.5 px-2.5 text-xs text-zinc-500 hover:text-zinc-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
