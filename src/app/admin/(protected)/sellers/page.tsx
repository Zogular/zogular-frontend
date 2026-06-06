"use client";

import {
  Building2,
  Download,
  Filter,
  ShieldCheck,
  Store,
  FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AdminMetricCard,
  AdminPageHeader,
  AdminEmptyState,
} from "@/components/admin/AdminPrimitives";
import { SellerReviewActionDialog } from "@/components/admin/sellers/VendorApplicationReviewUI";
import { useSellersList } from "@/features/admin-sellers/hooks/use-sellers-list";
import { SellersListFilters, SellersListTable } from "@/features/admin-sellers/sections";

export default function AdminSellersPage() {
    const {
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sellerTypeFilter,
    setSellerTypeFilter,
    activeAction,
    setActiveAction,
    activeApplication,
    setActiveApplication,
    isActionSubmitting,
    canApprove,
    canSuspend,
    canExport,
    loadApplications,
    visibleApplications,
    hasMore,
    loadMore,
    summary,
    openAction,
    handleActionConfirm,
    handleExport,
  } = useSellersList();

  return (
    <div className="mx-auto max-w-[92rem] animate-in space-y-6 pb-12 fade-in slide-in-from-bottom-4 duration-500">
      <AdminPageHeader
        title="Seller applications"
        description="Review and manage seller onboarding applications. Use status filters and search to navigate the queue."
        actions={
          canExport ? (
            <Button
              variant="outline"
              onClick={handleExport}
              className="h-10 rounded-xl border-stone-200 bg-white/80 font-black text-stone-700 shadow-md shadow-stone-900/5 backdrop-blur-xl hover:bg-stone-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Export queue
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <AdminMetricCard
          title="Submitted"
          value={summary.submitted}
          note="Waiting for review"
          tone="amber"
          icon={<Store className="h-5 w-5" />}
        />
        <AdminMetricCard
          title="Needs info"
          value={summary.needsInfo}
          note="Pending seller update"
          tone="orange"
          icon={<FileWarning className="h-5 w-5" />}
        />
        <AdminMetricCard
          title="Provisional"
          value={summary.provisional}
          note="Draft-capable sellers"
          tone="sky"
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <AdminMetricCard
          title="Approved"
          value={summary.approved}
          note="Fully enabled sellers"
          tone="emerald"
          icon={<Building2 className="h-5 w-5" />}
        />
        <AdminMetricCard
          title="Restricted / blocked"
          value={summary.blocked}
          note="Restricted, suspended, or rejected"
          tone="rose"
          icon={<Filter className="h-5 w-5" />}
        />
      </div>

      <div className="sticky top-4 z-40 transition-shadow">
        <SellersListFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sellerTypeFilter={sellerTypeFilter}
          setSellerTypeFilter={setSellerTypeFilter}
        />
      </div>

      {loading ? (
        <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white/70 p-4 shadow-[0_8px_32px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`loading-row-${index}`} className="h-16 animate-pulse rounded-xl bg-stone-200/60" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="overflow-hidden rounded-[2rem] border border-rose-100 bg-rose-50/80 p-8 shadow-sm">
          <p className="text-sm font-black text-rose-700">Could not load seller applications</p>
          <p className="mt-1 text-xs font-medium text-rose-500">{error}</p>
          <Button
            variant="outline"
            onClick={loadApplications}
            className="mt-4 rounded-xl border-rose-200 bg-white font-black text-rose-700 hover:bg-rose-50"
          >
            Try again
          </Button>
        </div>
      ) : visibleApplications.length === 0 ? (
        <div className="overflow-hidden rounded-[2rem] border border-stone-200/60 bg-stone-50/80 shadow-sm backdrop-blur-xl">
          <AdminEmptyState
            title={searchQuery ? "No seller applications match your search." : "No seller applications in this view."}
            description={searchQuery ? "Try adjusting your search term or clearing the filters." : "Try selecting a different status or seller type filter."}
          />
        </div>
      ) : (
        <SellersListTable
          applications={visibleApplications}
          onOpenAction={openAction}
          canApprove={canApprove}
          canSuspend={canSuspend}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      )}

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
