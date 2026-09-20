"use client";

/**
 * @file page.tsx
 * @description
 * Thin route orchestrator for Admin Product Moderation and Inventory Oversight.
 * Connects useAdminProducts hook, renders modular presentation sections with warm tactile admin palette,
 * and maintains container scroll position on return navigation via useListScrollRestoration.
 */

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import { ProductContentPolicyFeedback } from "@/components/shared/ProductContentPolicyFeedback";
import {
  useAdminProducts,
  ProductSummaryCards,
  ProductsListFilters,
  ProductsListTable,
  ProductsListGrid,
  ProductModerationDialog,
  ProductQueueFreshness,
} from "@/features/admin-products";

export default function AdminProductsPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = useMemo(
    () => `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`,
    [pathname, searchParams],
  );

  const identity = useAdminIdentity()!;
  const canModerate = adminIdentityHasPermission(identity, "approve_products");

  const state = useAdminProducts(canModerate);

  // Preserve and restore container scroll position upon return navigation
  useListScrollRestoration(currentUrl, !state.isLoading && state.products.length > 0);

  return (
    <div className="mx-auto max-w-[96rem] space-y-4 pb-10">
      {/* Header bar with title, description, and real-time SSE freshness badge */}
      <header className="flex flex-col justify-between gap-3 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] pb-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-xl font-black text-[var(--admin-ink)] sm:text-2xl">
            Product Moderation & Inventory Oversight
          </h1>
          <p className="mt-1 text-xs font-semibold text-[var(--admin-ink-soft)] sm:text-sm">
            Review vendor listing submissions, enforce marketplace catalog standards, and manage product lifecycles.
          </p>
        </div>
        <ProductQueueFreshness
          dataUpdatedAt={state.dataUpdatedAt}
          isRefreshing={state.isFetching}
          onRefresh={state.refetch}
        />
      </header>

      {/* Summary KPI Cards */}
      <ProductSummaryCards summary={state.summary} isLoading={state.isLoading} />

      {/* Filter tabs, search, category select, and bulk actions toolbar */}
      <ProductsListFilters
        searchQuery={state.searchQuery}
        setSearchQuery={state.setSearchQuery}
        statusFilter={state.statusFilter}
        setStatusFilter={state.setStatusFilter}
        categoryFilter={state.categoryFilter}
        setCategoryFilter={state.setCategoryFilter}
        categories={state.categories}
        selectedCount={state.selectedProductIds.length}
        selectedPendingCount={state.selectedPendingCount}
        isAllSelected={state.isAllSelected}
        onSelectAll={state.selectAllFiltered}
        onBulkApprove={state.handleBulkApprove}
        onOpenBulkDialog={(action) => state.openModerationDialog(action, state.selectedProductIds)}
        canModerate={canModerate}
        isSubmitting={state.isSubmitting}
        totalFilteredCount={state.products.length}
      />

      {/* Content policy feedback banner if violations or snapshot conflict occurred */}
      <ProductContentPolicyFeedback
        issues={state.contentPolicyIssues}
        hasSnapshotConflict={state.hasSnapshotConflict}
        productHref={(productId) => `/admin/products/${encodeURIComponent(productId)}`}
      />

      {/* Product List Header: Item Count & Relocated List/Grid Segmented Toggle */}
      <div className="flex items-center justify-between gap-3 px-1 pt-1">
        <p className="text-xs font-bold text-[var(--admin-ink-soft)]">
          Total <span className="font-black text-[var(--admin-ink)]">{state.products.length}</span> product{state.products.length === 1 ? "" : "s"}
        </p>

        <div
          className="flex items-center rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-mist)] p-0.5 shadow-xs"
          role="group"
          aria-label="Toggle product view mode"
        >
          <button
            type="button"
            aria-label="List view"
            aria-pressed={state.view === "list"}
            onClick={() => state.setView("list")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
              state.view === "list"
                ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] shadow-xs"
                : "text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <List className="size-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={state.view === "grid"}
            onClick={() => state.setView("grid")}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
              state.view === "grid"
                ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)] shadow-xs"
                : "text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>
        </div>
      </div>

      {/* Product List: Table or Grid */}
      {state.view === "list" ? (
        <ProductsListTable
          products={state.products}
          selectedProductIds={state.selectedProductIds}
          onToggleSelect={state.toggleProductSelection}
          onQuickApprove={state.handleQuickApprove}
          onOpenDialog={(action, product) =>
            state.openModerationDialog(action, [product.sellerProductId], product.name)
          }
          canModerate={canModerate}
          isSubmitting={state.isSubmitting}
          isLoading={state.isLoading}
        />
      ) : (
        <ProductsListGrid
          products={state.products}
          selectedProductIds={state.selectedProductIds}
          onToggleSelect={state.toggleProductSelection}
          onQuickApprove={state.handleQuickApprove}
          onOpenDialog={(action, product) =>
            state.openModerationDialog(action, [product.sellerProductId], product.name)
          }
          canModerate={canModerate}
          isSubmitting={state.isSubmitting}
          isLoading={state.isLoading}
        />
      )}

      {/* Rejection / Request Changes Modal Dialog */}
      <ProductModerationDialog
        dialogState={state.dialogState}
        onClose={state.closeModerationDialog}
        onReasonCodeChange={state.setDialogReasonCode}
        onNoteChange={state.setDialogNote}
        onSubmit={state.handleSubmitDialogDecision}
        isSubmitting={state.isSubmitting}
      />
    </div>
  );
}
