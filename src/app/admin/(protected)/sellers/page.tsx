"use client";

import { ChevronLeft, ChevronRight, Download, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SellerReviewActionDialog } from "@/components/admin/sellers/VendorApplicationReviewUI";
import { useSellersList } from "@/features/admin-sellers/hooks/use-sellers-list";
import { SellersListFilters, SellersListTable } from "@/features/admin-sellers/sections";

export default function AdminSellersPage() {
  const {
    applications,
    pagination,
    facets,
    loading,
    isRefreshing,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sellerTypeFilter,
    setSellerTypeFilter,
    sort,
    direction,
    setSort,
    setPage,
    setLimit,
    activeAction,
    setActiveAction,
    activeApplication,
    setActiveApplication,
    isActionSubmitting,
    canApprove,
    canSuspend,
    canExport,
    loadApplications,
    openAction,
    handleActionConfirm,
    handleExport,
  } = useSellersList();

  const hasActiveScope = Boolean(searchQuery.trim()) || statusFilter !== "all" || sellerTypeFilter !== "all";
  const currentPageRows = applications.length;

  return (
    <div className="mx-auto max-w-[92rem] space-y-4 pb-10">
      <header className="flex flex-col justify-between gap-3 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] pb-4 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-black uppercase text-[var(--admin-ember)]">Trust operations</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--admin-canopy-deep)] md:text-3xl">Seller Management</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[var(--admin-ink-soft)]">
            Review the authorized seller application queue and move each case through its documented status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={loadApplications}
            disabled={isRefreshing || loading}
            className="h-10 rounded-md border-[color-mix(in_srgb,var(--admin-canopy)_32%,transparent)] bg-[var(--admin-surface-mist)] font-black text-[var(--admin-canopy-deep)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_10%,var(--admin-surface-mist))]"
          >
            <RefreshCw className={`mr-2 size-4 ${isRefreshing ? "motion-safe:animate-spin" : ""}`} />
            Refresh
          </Button>
          {canExport ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={!pagination || currentPageRows === 0}
              className="h-10 rounded-md border-[color-mix(in_srgb,var(--admin-canopy)_32%,transparent)] bg-[var(--admin-canopy-deep)] font-black text-[var(--admin-surface-cream)] hover:bg-[var(--admin-canopy)]"
            >
              <Download className="mr-2 size-4" />
              Export current page ({currentPageRows})
            </Button>
          ) : null}
        </div>
      </header>

      <SellersListFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sellerTypeFilter={sellerTypeFilter}
        setSellerTypeFilter={setSellerTypeFilter}
        sort={sort}
        direction={direction}
        setSort={setSort}
        facets={facets}
      />

      <div aria-live="polite" className="sr-only">
        {isRefreshing ? "Refreshing seller queue." : error?.message ?? ""}
      </div>

      {error ? (
        <RequestError message={error.message} retry={loadApplications} compact={applications.length > 0} />
      ) : null}

      {loading ? (
        <SellerQueueLoadingBoard />
      ) : applications.length === 0 && !error ? (
        <SellerQueueEmpty hasActiveScope={hasActiveScope} />
      ) : applications.length > 0 ? (
        <>
          <SellersListTable
            applications={applications}
            onOpenAction={openAction}
            canApprove={canApprove}
            canSuspend={canSuspend}
            isRefreshing={isRefreshing}
          />
          {pagination ? (
            <SellerQueuePagination
              page={pagination.page}
              pages={pagination.pages}
              limit={pagination.limit}
              total={pagination.total}
              rowCount={currentPageRows}
              setPage={setPage}
              setLimit={setLimit}
            />
          ) : null}
        </>
      ) : null}

      <SellerReviewActionDialog
        open={Boolean(activeAction && activeApplication)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveAction(null);
            setActiveApplication(null);
          }
        }}
        action={activeAction}
        application={activeApplication}
        submitting={isActionSubmitting}
        onConfirm={handleActionConfirm}
      />
    </div>
  );
}

function RequestError({ message, retry, compact }: { message: string; retry: () => void; compact: boolean }) {
  return (
    <section
      role="alert"
      className={`flex flex-col gap-3 border border-[color-mix(in_srgb,var(--admin-escalation)_38%,transparent)] bg-[color-mix(in_srgb,var(--admin-escalation)_7%,var(--admin-surface-cream))] ${compact ? "rounded-md p-3 sm:flex-row sm:items-center sm:justify-between" : "rounded-lg p-6"}`}
    >
      <div>
        <h2 className="text-sm font-black text-[var(--admin-escalation)]">Could not verify the seller queue</h2>
        <p className="mt-1 text-sm font-semibold text-[var(--admin-ink-soft)]">{message}</p>
      </div>
      <Button type="button" variant="outline" onClick={retry} className="h-10 self-start rounded-md border-[var(--admin-escalation)] bg-[var(--admin-surface-cream)] font-black text-[var(--admin-escalation)]">
        <RotateCcw className="mr-2 size-4" />
        Try again
      </Button>
    </section>
  );
}

function SellerQueueLoadingBoard() {
  return (
    <section aria-busy="true" aria-label="Loading seller queue" className="overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)]">
      <div className="flex items-center justify-between bg-[var(--admin-canopy-deep)] px-4 py-3 text-[var(--admin-surface-cream)]">
        <div>
          <h2 className="text-sm font-black">Seller review board</h2>
          <p className="mt-0.5 text-xs font-semibold text-[var(--admin-surface-mist)]">Loading current seller applications</p>
        </div>
        <RefreshCw className="size-4 motion-safe:animate-spin" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr] gap-3 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)] bg-[var(--admin-surface-mist)] px-4 py-3 text-[9px] font-black uppercase text-[var(--admin-ink-soft)]">
        <span>Seller</span><span>Type</span><span>Contact</span><span>Submitted</span><span>Status</span>
      </div>
      <div className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid min-h-14 grid-cols-[2fr_1fr_1.4fr_1fr_1fr] items-center gap-3 px-4 py-3">
            <span className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--admin-canopy)_20%,transparent)]" />
            <span className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)]" />
            <span className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)]" />
            <span className="h-1.5 rounded-full bg-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)]" />
            <span className="h-5 rounded-md border border-[color-mix(in_srgb,var(--admin-ember)_24%,transparent)] bg-[color-mix(in_srgb,var(--admin-ember)_8%,transparent)]" />
          </div>
        ))}
      </div>
    </section>
  );
}

function SellerQueueEmpty({ hasActiveScope }: { hasActiveScope: boolean }) {
  return (
    <section className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--admin-copper-muted)_58%,transparent)] bg-[var(--admin-surface-mist)] px-5 py-12 text-center">
      <h2 className="text-base font-black text-[var(--admin-canopy-deep)]">
        {hasActiveScope ? "No seller applications match this view" : "The seller queue is empty"}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm font-semibold text-[var(--admin-ink-soft)]">
        {hasActiveScope
          ? "Adjust the search, status, or seller type to inspect a different part of the queue."
          : "There are no seller applications in the authorized queue yet."}
      </p>
    </section>
  );
}

function SellerQueuePagination({
  page,
  pages,
  limit,
  total,
  rowCount,
  setPage,
  setLimit,
}: {
  page: number;
  pages: number;
  limit: number;
  total: number;
  rowCount: number;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
}) {
  const start = rowCount > 0 ? (page - 1) * limit + 1 : 0;
  const end = rowCount > 0 ? start + rowCount - 1 : 0;

  return (
    <nav aria-label="Seller queue pagination" className="flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_38%,transparent)] pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 font-semibold text-[var(--admin-ink-soft)]">
        <span>{start}-{end} of {total} results</span>
        <label className="flex items-center gap-2 text-xs font-black">
          Rows
          <select
            aria-label="Rows per page"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="h-9 rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_40%,transparent)] bg-[var(--admin-surface-cream)] px-2 text-[var(--admin-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)]"
          >
            <option value={20}>20</option>
            <option value={40}>40</option>
            <option value={60}>60</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span className="mr-1 text-xs font-black text-[var(--admin-ink-soft)]">Page {page} of {Math.max(pages, 1)}</span>
        <Button type="button" variant="outline" size="icon" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous seller page" className="size-10 rounded-md border-[color-mix(in_srgb,var(--admin-canopy)_30%,transparent)] bg-[var(--admin-surface-cream)] text-[var(--admin-canopy-deep)]">
          <ChevronLeft className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => setPage(page + 1)} disabled={pages === 0 || page >= pages} aria-label="Next seller page" className="size-10 rounded-md border-[color-mix(in_srgb,var(--admin-canopy)_30%,transparent)] bg-[var(--admin-surface-cream)] text-[var(--admin-canopy-deep)]">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
