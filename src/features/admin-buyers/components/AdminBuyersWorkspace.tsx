/**
 * @file AdminBuyersWorkspace.tsx
 * @module features/admin-buyers/components
 * @description
 * High-level workspace orchestrator component for Admin Customers (CM-F1).
 * Composes BuyersFilters, BuyersCollection, and header actions with container awareness.
 */

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import { useBuyersList } from "../hooks/use-buyers-list";
import { BuyersFilters } from "../sections/BuyersFilters";
import { BuyersCollection } from "../sections/BuyersCollection";

export function AdminBuyersWorkspace() {
  const {
    buyers,
    pagination,
    loading,
    isRefreshing,
    error,
    refreshError,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    sortBy,
    sortOrder,
    setSort,
    page,
    setPage,
    viewMode,
    setViewMode,
    refresh,
    canViewSensitiveFields,
    statusText,
  } = useBuyersList();

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams?.toString();
  const currentQueueUrl = currentQuery ? `${pathname}?${currentQuery}` : (pathname || "/admin/buyers");

  // Mandate: Preserve exact list scroll position on return navigation for inner admin scroll container
  useListScrollRestoration(currentQueueUrl, !loading);
  useListScrollRestoration("/admin/buyers", !loading);

  const hasActiveFilters = Boolean(
    searchQuery.trim().length > 0 ||
      activeFilter !== "all" ||
      sortBy !== "createdAt" ||
      sortOrder !== "desc",
  );

  const handleResetFilters = () => {
    setSearchQuery("");
    setActiveFilter("all");
    setSort("createdAt", "desc");
    setPage(1);
  };

  return (
    <div
      data-testid="admin-buyers-workspace"
      className="mx-auto max-w-[96rem] space-y-5 pb-12"
    >
      {/* Top Header */}
      <AdminPageHeader
        title="Customers"
        description="View registered customer accounts, verification badges, and account standing."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="text-xs font-medium text-zinc-500 hidden sm:inline-block"
              title="Refresh policy status"
            >
              {statusText}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isRefreshing}
              className="gap-1.5 shrink-0 text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <BuyersFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={setSort}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        canViewSensitiveFields={canViewSensitiveFields}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Collection Surface */}
      <BuyersCollection
        buyers={buyers}
        pagination={pagination}
        loading={loading}
        isRefreshing={isRefreshing}
        error={error}
        refreshError={refreshError}
        viewMode={viewMode}
        page={page}
        onPageChange={setPage}
        onRetry={refresh}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
}
