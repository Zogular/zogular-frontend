/**
 * @file AdminProductsWorkspace.tsx
 * @module features/admin-products/components
 * @description
 * Top-level client workspace for the bounded Admin Products Moderation queue (PM-F1 READ).
 *
 * Responsibilities:
 * - Coordinates `useAdminProductsList` (server-paged PR #80 reads, URL state, authority cache purge).
 * - Renders honest loading, empty, stale-refresh, terminal auth, and recoverable error states.
 * - Scopes bulk selection strictly to visible `PENDING_REVIEW` IDs on the current page, clearing
 *   on query or authority changes. Preserves existing `adminProductsApi.bulkReviewProducts` calls
 *   until PM-B2 is accepted.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, PackageSearch, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductContentPolicyFeedback } from "@/components/shared/ProductContentPolicyFeedback";
import { adminProductsApi } from "@/services/admin/products";
import type { ProductModerationAction } from "@/services/product-moderation";
import {
  isProductSnapshotConflict,
  parseProductContentPolicyError,
  type ProductContentPolicyIssue,
} from "@/services/product-content-policy";
import { useAdminProductsList } from "../hooks/use-admin-products-list";
import { ProductsListFilters } from "../sections/ProductsListFilters";
import { ProductsListCollection } from "../sections/ProductsListCollection";

export function AdminProductsWorkspace() {
  const {
    items,
    pagination,
    loading,
    isRefreshing,
    error,
    refreshError,
    isStale,
    searchQuery,
    setSearchQuery,
    serverSearch,
    statusFilter,
    setStatusFilter,
    sortBy,
    sortOrder,
    setSort,
    setPage,
    limit,
    setLimit,
    viewMode,
    setViewMode,
    refresh,
    canModerate,
    currentUrl,
    currentAuthorityKey,
    queryScopeKey,
    statusText,
  } = useAdminProductsList();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [contentPolicyIssues, setContentPolicyIssues] = useState<
    readonly ProductContentPolicyIssue[]
  >([]);
  const [hasSnapshotConflict, setHasSnapshotConflict] = useState(false);

  // Clear selection whenever the server query scope or operator authority changes
  const [prevScope, setPrevScope] = useState(`${currentAuthorityKey}|${queryScopeKey}`);
  const currentScope = `${currentAuthorityKey}|${queryScopeKey}`;
  if (currentScope !== prevScope) {
    setPrevScope(currentScope);
    setSelectedIds([]);
  }

  // Prune selection to only visible PENDING_REVIEW IDs on the current page
  const visiblePendingIds = useMemo(
    () => items.filter((item) => item.status === "PENDING_REVIEW").map((item) => item.id),
    [items],
  );

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => visiblePendingIds.includes(id)));
  }, [visiblePendingIds]);

  const toggleSelect = useCallback(
    (productId: string) => {
      if (!visiblePendingIds.includes(productId)) return;
      setSelectedIds((prev) =>
        prev.includes(productId)
          ? prev.filter((id) => id !== productId)
          : [...prev, productId],
      );
    },
    [visiblePendingIds],
  );

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        visiblePendingIds.length > 0 &&
        visiblePendingIds.every((id) => prev.includes(id));
      return allSelected ? [] : [...visiblePendingIds];
    });
  }, [visiblePendingIds]);

  const selectedVisibleEligibleIds = useMemo(
    () => selectedIds.filter((id) => visiblePendingIds.includes(id)),
    [selectedIds, visiblePendingIds],
  );

  async function handleBulkModeration(action: ProductModerationAction) {
    if (!canModerate) {
      toast.error("Unauthorized.");
      return;
    }
    if (selectedVisibleEligibleIds.length === 0) {
      toast.error("Select pending products on this page before running a bulk action.");
      return;
    }

    try {
      setIsSubmittingBulk(true);
      setContentPolicyIssues([]);
      setHasSnapshotConflict(false);

      const note =
        action === "approve"
          ? "Bulk approval by admin."
          : action === "request_changes"
            ? "Bulk changes request by admin."
            : "Bulk rejection by admin.";

      const result = await adminProductsApi.bulkReviewProducts(selectedVisibleEligibleIds, {
        action,
        note,
      });

      setSelectedIds([]);
      await refresh();
      toast.success(`${result.count} products updated.`);
    } catch (err) {
      const policyIssues = parseProductContentPolicyError(err);
      if (policyIssues) {
        setContentPolicyIssues(policyIssues);
        return;
      }
      if (isProductSnapshotConflict(err)) {
        setHasSnapshotConflict(true);
        return;
      }
      toast.error("Unable to run bulk moderation. Try again.");
    } finally {
      setIsSubmittingBulk(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-[88rem] space-y-5 pb-10">
      <header className="flex min-w-0 flex-col justify-between gap-2 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
            Product Moderation
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Review seller listings awaiting moderation or status inspection.
          </p>
        </div>
        {pagination ? (
          <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-zinc-200/80 bg-white/85 px-3 py-1.5 text-xs font-bold text-zinc-700 shadow-sm md:self-auto">
            <span>Total matching non-draft:</span>
            <span className="font-black text-zinc-950">{pagination.total}</span>
          </div>
        ) : null}
      </header>

      <ProductsListFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={setSort}
        limit={limit}
        onLimitChange={setLimit}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isRefreshing={isRefreshing}
        onRefresh={() => void refresh()}
        statusText={statusText}
      />

      {isStale && refreshError ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Showing last verified page. Refresh failed: {refreshError.message}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            className="h-8 rounded-lg border-amber-300 bg-white text-xs font-bold text-amber-900"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {hasSnapshotConflict ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900"
        >
          <span>
            One or more selected products changed since this page loaded. Refresh to load the
            latest state.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setHasSnapshotConflict(false);
              void refresh();
            }}
            className="h-8 rounded-lg border-amber-300 bg-white text-xs font-bold text-amber-900"
          >
            Reload page
          </Button>
        </div>
      ) : null}

      {contentPolicyIssues.length > 0 ? (
        <ProductContentPolicyFeedback issues={contentPolicyIssues} />
      ) : null}

      {canModerate && selectedVisibleEligibleIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/95 px-4 py-3 shadow-sm">
          <p className="text-xs font-bold text-zinc-700">
            <span className="font-black text-zinc-950">
              {selectedVisibleEligibleIds.length}
            </span>{" "}
            pending product{selectedVisibleEligibleIds.length === 1 ? "" : "s"} selected on this
            page
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isSubmittingBulk}
              onClick={() => void handleBulkModeration("approve")}
              className="h-9 rounded-xl bg-emerald-700 px-3.5 text-xs font-bold text-white hover:bg-emerald-800"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSubmittingBulk}
              onClick={() => void handleBulkModeration("request_changes")}
              className="h-9 rounded-xl border-orange-300 bg-orange-50 px-3.5 text-xs font-bold text-orange-900 hover:bg-orange-100"
            >
              Request Changes
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div
          data-testid="products-loading-skeleton"
          className="space-y-3 rounded-[1.5rem] border border-white/70 bg-white/70 p-4"
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-zinc-200/70"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          data-testid="products-error-state"
          className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-sm"
        >
          <ShieldAlert className="mx-auto mb-3 h-9 w-9 text-rose-500" />
          <h2 className="text-lg font-black text-zinc-950">
            {error.kind === "unauthenticated"
              ? "Admin session expired"
              : error.kind === "forbidden"
                ? "Product queue access restricted"
                : "Product moderation queue unavailable"}
          </h2>
          <p className="mt-2 text-sm font-medium text-zinc-600">{error.message}</p>
          <div className="mt-5 flex justify-center gap-2">
            {error.kind === "unauthenticated" ? (
              <Link
                href="/admin/login"
                className="inline-flex h-10 items-center rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-800"
              >
                Sign in again
              </Link>
            ) : error.kind !== "forbidden" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void refresh()}
                className="h-10 rounded-xl font-bold"
              >
                Retry products
              </Button>
            ) : null}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div
          data-testid="products-empty-state"
          className="mx-auto max-w-2xl rounded-3xl border border-zinc-200/80 bg-white/90 p-8 text-center shadow-sm"
        >
          <PackageSearch className="mx-auto mb-3 h-9 w-9 text-zinc-400" />
          <h2 className="text-lg font-black text-zinc-900">
            {serverSearch || statusFilter !== "all"
              ? "No products match the active filters"
              : "No non-draft products in queue"}
          </h2>
          <p className="mt-1.5 text-sm font-medium text-zinc-500">
            {serverSearch || statusFilter !== "all"
              ? "Adjust or reset your status filter and search query to inspect other listings."
              : "Submitted and reviewed seller listings will appear here."}
          </p>
          {serverSearch || statusFilter !== "all" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              className="mt-4 h-9 rounded-xl font-bold"
            >
              Reset filters
            </Button>
          ) : null}
        </div>
      ) : (
        <ProductsListCollection
          items={items}
          pagination={
            pagination ?? { total: items.length, page: 1, limit, pages: 1 }
          }
          viewMode={viewMode}
          canModerate={canModerate}
          selectedIds={selectedVisibleEligibleIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAllVisible={toggleSelectAllVisible}
          currentUrl={currentUrl}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
