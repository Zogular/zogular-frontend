"use client";

/**
 * @file use-sellers-list.ts
 * @module features/admin-sellers/hooks
 * @description
 * Custom React hook encapsulating state management, URL query parameter synchronization,
 * debounced search, action execution, and TanStack Query fetching for the Admin Seller Review Queue.
 * Receives real-time cache invalidations via the Admin Realtime SSE listener.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getApplicationPrimaryName } from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import {
  approveVendorApplication,
  getVendorApplications,
  getSellerReviewSafeError,
  rejectVendorApplication,
  requestVendorApplicationInfo,
  restrictVendorApplication,
  suspendVendorApplication,
  type AdminVendorApplicationSort,
  type AdminVendorApplicationSortDirection,
} from "@/services/admin/vendor-applications";
import {
  applySellerListUrlUpdates,
  getSellerListSafeError,
  parseSellerListQuery,
  sellerListQueryKey,
} from "@/features/admin-sellers/lib/seller-list-state";
import type { SellerApplicationStatus, SellerType, VendorApplication } from "@/types/seller";

export function useSellersList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const query = useMemo(
    () => parseSellerListQuery(new URLSearchParams(searchParamsKey)),
    [searchParamsKey],
  );
  const queryKey = sellerListQueryKey(query);
  const [searchQuery, setSearchQuery] = useState(query.search);
  const [prevUrlSearch, setPrevUrlSearch] = useState(query.search);

  if (query.search !== prevUrlSearch) {
    setPrevUrlSearch(query.search);
    setSearchQuery(query.search);
  }

  const [activeAction, setActiveAction] = useState<VendorApplicationAdminAction | null>(null);
  const [activeApplication, setActiveApplication] = useState<VendorApplication | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const identity = useAdminIdentity()!;
  const canApprove = adminIdentityHasPermission(identity, "manage_seller_status");
  const canSuspend = adminIdentityHasPermission(identity, "manage_seller_status");
  const canExport = adminIdentityHasPermission(identity, "export_reports");
  const canViewSensitiveFields = adminIdentityHasPermission(identity, "view_seller_sensitive_fields");

  const writeUrl = useCallback((
    updates: Partial<Record<keyof typeof query, string>>,
    history: "push" | "replace" = "push",
  ) => {
    const params = applySellerListUrlUpdates(new URLSearchParams(window.location.search), updates);
    const nextQuery = params.toString();
    const href = `${pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    if (history === "replace") router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    const normalized = searchQuery.trim().slice(0, 120);
    if (normalized === query.search) return;
    const timeout = window.setTimeout(() => {
      setPrevUrlSearch(normalized);
      writeUrl({ search: normalized, page: "" }, "replace");
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query.search, searchQuery, writeUrl]);

  const { data, error, isLoading: loading, isFetching: isRefreshing, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['seller-list', queryKey],
    queryFn: async ({ signal }) => {
      try {
        return await getVendorApplications({
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status,
          sellerType: query.sellerType,
          sort: query.sort,
          direction: query.direction,
          signal,
        });
      } catch (err) {
        throw getSellerListSafeError(err);
      }
    },
    placeholderData: keepPreviousData,
    // Architectural Note: Real-time SSE listener in AdminShell automatically invalidates ["seller-list"]
    // on "admin:seller:created" / "admin:seller:updated". Polling is relaxed to 60s as a fallback safety net.
    refetchInterval: 60000,
  });

  const setFilter = useCallback((updates: Partial<Record<keyof typeof query, string>>) => {
    writeUrl({ ...updates, page: "" });
  }, [writeUrl]);

  const setStatusFilter = useCallback((value: SellerApplicationStatus | "all") => {
    setFilter({ status: value === "all" ? "" : value });
  }, [setFilter]);

  const setSellerTypeFilter = useCallback((value: SellerType | "all") => {
    setFilter({ sellerType: value === "all" ? "" : value });
  }, [setFilter]);

  const setSort = useCallback((
    sort: AdminVendorApplicationSort,
    direction: AdminVendorApplicationSortDirection,
  ) => {
    setFilter({
      sort: sort === "submittedAt" ? "" : sort,
      direction: direction === "desc" ? "" : direction,
    });
  }, [setFilter]);

  const loadApplications = useCallback(() => {
    refetch();
  }, [refetch]);

  function openAction(action: VendorApplicationAdminAction, application: VendorApplication) {
    setActiveAction(action);
    setActiveApplication(application);
  }

  async function handleActionConfirm(payload: { reason?: string; adminNotes?: string }) {
    if (!activeAction || !activeApplication) return;

    try {
      setIsActionSubmitting(true);
      const expectedUpdatedAt = activeApplication.updatedAt;
      if (activeAction === "approve-approved") {
        await approveVendorApplication(activeApplication.id, { status: "APPROVED", expectedUpdatedAt, adminNotes: payload.adminNotes });
        toast.success("Seller approved.");
      } else if (activeAction === "approve-provisional") {
        await approveVendorApplication(activeApplication.id, { status: "PROVISIONAL", expectedUpdatedAt, adminNotes: payload.adminNotes });
        toast.success("Seller approved as provisional.");
      } else if (activeAction === "needs-info") {
        await requestVendorApplicationInfo(activeApplication.id, { reason: payload.reason ?? "", expectedUpdatedAt, adminNotes: payload.adminNotes });
        toast.success("Needs-info request sent.");
      } else if (activeAction === "reject") {
        await rejectVendorApplication(activeApplication.id, { reason: payload.reason ?? "", expectedUpdatedAt, adminNotes: payload.adminNotes });
        toast.success("Seller application rejected.");
      } else if (activeAction === "restrict") {
        await restrictVendorApplication(activeApplication.id, { adminNotes: payload.adminNotes ?? "", expectedUpdatedAt });
        toast.success("Seller restricted.");
      } else if (activeAction === "suspend") {
        await suspendVendorApplication(activeApplication.id, { adminNotes: payload.adminNotes ?? "", expectedUpdatedAt });
        toast.success("Seller suspended.");
      }

      setActiveAction(null);
      setActiveApplication(null);
      loadApplications();
    } catch (error) {
      const safeError = getSellerReviewSafeError(error);
      toast.error(safeError.message);
      if (safeError.kind === "conflict") loadApplications();
    } finally {
      setIsActionSubmitting(false);
    }
  }

  function handleExport() {
    if (!data) return;
    const header = ["id", "store_name", "owner_full_name", "seller_type", "status", ...(canViewSensitiveFields ? ["phone", "email"] : []), "district", "submitted_at", "reviewed_at"];
    const rows = data.applications.map((application) => [
      application.id,
      getApplicationPrimaryName(application),
      application.ownerFullName,
      application.sellerType,
      application.status,
      ...(canViewSensitiveFields ? [
        application.businessPhone || application.user?.telephone || "",
        application.businessEmail || application.user?.email || ""
      ] : []),
      application.district,
      application.submittedAt || "",
      application.reviewedAt || "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zogular-seller-applications-page-${data.pagination.page}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${data.applications.length} rows from the current page.`);
  }

  return {
    applications: data?.applications ?? [],
    pagination: data?.pagination ?? null,
    facets: data?.facets.byStatus ?? null,
    loading,
    isInitialLoading: loading && !data,
    isRefreshing,
    error: error as ReturnType<typeof getSellerListSafeError> | null,
    dataUpdatedAt,
    searchQuery,
    setSearchQuery,
    statusFilter: query.status,
    setStatusFilter,
    sellerTypeFilter: query.sellerType,
    setSellerTypeFilter,
    sort: query.sort,
    direction: query.direction,
    setSort,
    view: query.view,
    setView: (view: "list" | "grid") => setFilter({ view: view === "list" ? "" : view }),
    setPage: (page: number) => writeUrl({ page: page <= 1 ? "" : String(page) }),
    setLimit: (limit: number) => setFilter({ limit: limit === 20 ? "" : String(limit) }),
    activeAction,
    setActiveAction,
    activeApplication,
    setActiveApplication,
    isActionSubmitting,
    canApprove,
    canSuspend,
    canExport,
    canViewSensitiveFields,
    loadApplications,
    openAction,
    handleActionConfirm,
    handleExport,
  };
}
