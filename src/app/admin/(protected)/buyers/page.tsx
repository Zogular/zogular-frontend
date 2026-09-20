"use client";

/**
 * @file page.tsx
 * @description
 * Admin Buyers CRM entry page orchestrator.
 * Connects the custom hooks and modular presentation sections for customer account management
 * using the Zogular warm admin aesthetic palette.
 * Integrates container-aware scroll restoration so operators navigating back or returning to
 * the customer directory resume at their exact prior scroll position.
 */

import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminBuyersApi } from "@/services/admin/buyers";
import { useBuyersList } from "@/features/admin-buyers/hooks/use-buyers-list";
import { useBuyerDetail } from "@/features/admin-buyers/hooks/use-buyer-detail";
import {
  BuyersListFilters,
  BuyersListTable,
  BuyersListGrid,
  BuyerDetailSheet,
  BuyerStatusDialog,
  BuyerQueueFreshness,
} from "@/features/admin-buyers/sections";
import type {
  AdminBuyerRecord,
  BuyerStatusDialogState,
} from "@/features/admin-buyers/types/admin-buyer.types";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";

export default function AdminBuyersPage() {
  const queryClient = useQueryClient();
  const {
    buyers,
    pagination,
    isInitialLoading,
    isFetching,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    view,
    setView,
    refetch,
    dataUpdatedAt,
  } = useBuyersList();

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = useMemo(
    () => `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`,
    [pathname, searchParams],
  );

  // Preserve and restore exact container scroll position upon return navigation
  useListScrollRestoration(currentUrl, !isInitialLoading && buyers.length > 0);

  const [selectedBuyer, setSelectedBuyer] = useState<AdminBuyerRecord | null>(null);
  const [statusDialogState, setStatusDialogState] = useState<BuyerStatusDialogState>({
    isOpen: false,
    buyer: null,
    nextStatus: false,
  });

  // Query single buyer detail with linked context when sheet opens
  const { data: buyerDetailData, isLoading: isLoadingDetail } = useBuyerDetail(selectedBuyer?.id ?? null);

  const handleOpenStatusDialog = (buyer: AdminBuyerRecord, nextStatus: boolean) => {
    setStatusDialogState({
      isOpen: true,
      buyer,
      nextStatus,
    });
  };

  const handleCloseStatusDialog = () => {
    setStatusDialogState({
      isOpen: false,
      buyer: null,
      nextStatus: false,
    });
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const blob = await adminBuyersApi.exportCustomersCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `zogular-customers-${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Customer records exported to CSV successfully.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to export customer records.";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleStatusMutationSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "buyers"] });
    if (selectedBuyer) {
      void queryClient.invalidateQueries({ queryKey: ["admin", "buyer", selectedBuyer.id] });
    }
  };

  return (
    <div className="mx-auto max-w-[96rem] space-y-4 pb-10">
      <header className="flex flex-col justify-between gap-3 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] pb-4 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-black uppercase text-[var(--admin-ember)]">Customer Operations</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--admin-canopy-deep)] md:text-3xl">Customers</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-[var(--admin-ink-soft)]">
            Buyer Directory &amp; Customer Operations · View verified accounts, purchase context, and platform lifecycle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting || isInitialLoading}
            className="h-9 rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_40%,transparent)] bg-[var(--admin-surface-cream)] px-3 text-xs font-black text-[var(--admin-canopy-deep)] shadow-sm hover:bg-[var(--admin-surface-mist)] transition-colors"
          >
            {isExporting ? (
              <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 size-3.5 text-[var(--admin-ember)]" />
            )}
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
          <BuyerQueueFreshness
            dataUpdatedAt={dataUpdatedAt}
            isRefreshing={isFetching}
            onRefresh={() => void refetch()}
          />
        </div>
      </header>

      {error ? (
        <section
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-escalation)_38%,transparent)] bg-[color-mix(in_srgb,var(--admin-escalation)_7%,var(--admin-surface-cream))] p-4 text-[var(--admin-escalation)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h2 className="text-sm font-black text-[var(--admin-escalation)]">Could not verify customer accounts</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--admin-ink-soft)]">{error.message}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="h-9 self-start rounded-md border border-[var(--admin-escalation)] bg-[var(--admin-surface-cream)] font-black text-[var(--admin-escalation)] hover:bg-[var(--admin-surface-mist)] sm:self-auto"
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Try again
          </Button>
        </section>
      ) : null}

      <BuyersListFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        totalCount={pagination.total}
        view={view}
        setView={setView}
        isLoading={isInitialLoading}
      />

      {isInitialLoading ? (
        <BuyerQueueLoadingBoard />
      ) : view === "list" ? (
        <BuyersListTable buyers={buyers} onSelectBuyer={setSelectedBuyer} isFetching={isFetching} />
      ) : (
        <BuyersListGrid buyers={buyers} onSelectBuyer={setSelectedBuyer} isFetching={isFetching} />
      )}

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_38%,transparent)] pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-[var(--admin-ink-soft)]">
            Page {page} of {pagination.pages} &middot; Total {pagination.total} customers
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage(page - 1)}
              className="rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-mist)] text-xs font-bold text-[var(--admin-ink)] hover:bg-[var(--admin-surface-cream)] disabled:opacity-50"
            >
              <ChevronLeft className="mr-1 size-3.5" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages || isFetching}
              onClick={() => setPage(page + 1)}
              className="rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-mist)] text-xs font-bold text-[var(--admin-ink)] hover:bg-[var(--admin-surface-cream)] disabled:opacity-50"
            >
              Next
              <ChevronRight className="ml-1 size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Slide-Over Drawer Detail */}
      <BuyerDetailSheet
        buyer={buyerDetailData?.user ?? selectedBuyer}
        context={buyerDetailData?.context}
        isLoadingContext={isLoadingDetail}
        isOpen={selectedBuyer !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedBuyer(null);
        }}
        onOpenStatusDialog={handleOpenStatusDialog}
      />

      {/* Governance Confirmation Modal */}
      <BuyerStatusDialog
        dialogState={statusDialogState}
        onClose={handleCloseStatusDialog}
        onSuccess={handleStatusMutationSuccess}
      />
    </div>
  );
}

function BuyerQueueLoadingBoard() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading customer directory"
      className="overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)]"
    >
      <div className="flex items-center justify-between bg-[var(--admin-canopy-deep)] px-4 py-3 text-[var(--admin-surface-cream)]">
        <div>
          <h2 className="text-sm font-black">Customer Directory</h2>
          <p className="mt-0.5 text-xs font-semibold text-[var(--admin-surface-mist)]">Loading customer accounts...</p>
        </div>
        <RefreshCw className="size-4 motion-safe:animate-spin" aria-hidden="true" />
      </div>
      <div className="hidden grid-cols-[2fr_1.5fr_1.2fr_1fr_1fr_1fr] gap-3 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)] bg-[var(--admin-surface-mist)] px-4 py-3 text-[9px] font-black uppercase text-[var(--admin-ink-soft)] md:grid">
        <span>Customer</span>
        <span>Email</span>
        <span>Verifications</span>
        <span>Status</span>
        <span>Joined</span>
        <span className="text-right">Action</span>
      </div>
      <div className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid min-h-14 grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[2fr_1.5fr_1.2fr_1fr_1fr_1fr]"
          >
            <span className="h-3 w-32 rounded-full bg-[color-mix(in_srgb,var(--admin-canopy)_20%,transparent)]" />
            <span className="h-3 w-28 rounded-full bg-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)]" />
            <span className="h-3 w-20 rounded-full bg-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)]" />
            <span className="h-5 w-16 rounded-md border border-[color-mix(in_srgb,var(--admin-canopy)_24%,transparent)] bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)]" />
            <span className="h-3 w-16 rounded-full bg-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)]" />
            <span className="h-8 w-20 justify-self-end rounded-md bg-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)]" />
          </div>
        ))}
      </div>
    </section>
  );
}
