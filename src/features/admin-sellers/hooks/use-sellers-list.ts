"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getApplicationPrimaryName } from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import {
  approveVendorApplication,
  getVendorApplications,
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
  INITIAL_SELLER_LIST_REQUEST_STATE,
  parseSellerListQuery,
  reduceSellerListRequestState,
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
  const [requestState, dispatch] = useReducer(
    reduceSellerListRequestState,
    INITIAL_SELLER_LIST_REQUEST_STATE,
  );
  const [activeAction, setActiveAction] = useState<VendorApplicationAdminAction | null>(null);
  const [activeApplication, setActiveApplication] = useState<VendorApplication | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestIdRef = useRef(0);

  const identity = useAdminIdentity()!;
  const canApprove = adminIdentityHasPermission(identity, "approve_sellers");
  const canSuspend = adminIdentityHasPermission(identity, "suspend_sellers");
  const canExport = adminIdentityHasPermission(identity, "export_reports");

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
    setSearchQuery(query.search);
  }, [query.search]);

  useEffect(() => {
    const normalized = searchQuery.trim().slice(0, 120);
    if (normalized === query.search) return;
    const timeout = window.setTimeout(() => {
      writeUrl({ search: normalized, page: "" }, "replace");
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [query.search, searchQuery, writeUrl]);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    dispatch({ type: "request-started", requestId, queryKey });

    void getVendorApplications({
      page: query.page,
      limit: query.limit,
      search: query.search || undefined,
      status: query.status,
      sellerType: query.sellerType,
      sort: query.sort,
      direction: query.direction,
      signal: controller.signal,
    }).then((data) => {
      dispatch({ type: "request-succeeded", requestId, queryKey, data });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      dispatch({
        type: "request-failed",
        requestId,
        queryKey,
        error: getSellerListSafeError(error),
      });
    });

    return () => controller.abort();
  }, [query.direction, query.limit, query.page, query.search, query.sellerType, query.sort, query.status, queryKey, refreshVersion]);

  const data = requestState.dataQueryKey === queryKey ? requestState.data : null;
  const error = requestState.requestedQueryKey === queryKey ? requestState.error : null;
  const loading = !data && !error;
  const isRefreshing = Boolean(data && requestState.isRefreshing);

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
    setRefreshVersion((version) => version + 1);
  }, []);

  function openAction(action: VendorApplicationAdminAction, application: VendorApplication) {
    setActiveAction(action);
    setActiveApplication(application);
  }

  async function handleActionConfirm(payload: { reason?: string; adminNotes?: string }) {
    if (!activeAction || !activeApplication) return;

    try {
      setIsActionSubmitting(true);
      if (activeAction === "approve-approved") {
        await approveVendorApplication(activeApplication.id, { status: "APPROVED", adminNotes: payload.adminNotes });
        toast.success("Seller approved.");
      } else if (activeAction === "approve-provisional") {
        await approveVendorApplication(activeApplication.id, { status: "PROVISIONAL", adminNotes: payload.adminNotes });
        toast.success("Seller approved as provisional.");
      } else if (activeAction === "needs-info") {
        await requestVendorApplicationInfo(activeApplication.id, payload.reason ?? "", payload.adminNotes);
        toast.success("Needs-info request sent.");
      } else if (activeAction === "reject") {
        await rejectVendorApplication(activeApplication.id, payload.reason ?? "", payload.adminNotes);
        toast.success("Seller application rejected.");
      } else if (activeAction === "restrict") {
        await restrictVendorApplication(activeApplication.id, payload.adminNotes);
        toast.success("Seller restricted.");
      } else if (activeAction === "suspend") {
        await suspendVendorApplication(activeApplication.id, payload.adminNotes);
        toast.success("Seller suspended.");
      }

      setActiveAction(null);
      setActiveApplication(null);
      loadApplications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update seller application.");
    } finally {
      setIsActionSubmitting(false);
    }
  }

  function handleExport() {
    if (!data) return;
    const header = ["id", "store_name", "owner_full_name", "seller_type", "status", "phone", "email", "district", "submitted_at", "reviewed_at"];
    const rows = data.applications.map((application) => [
      application.id,
      getApplicationPrimaryName(application),
      application.ownerFullName,
      application.sellerType,
      application.status,
      application.businessPhone || application.user?.telephone || "",
      application.businessEmail || application.user?.email || "",
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
    isRefreshing,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter: query.status,
    setStatusFilter,
    sellerTypeFilter: query.sellerType,
    setSellerTypeFilter,
    sort: query.sort,
    direction: query.direction,
    setSort,
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
    loadApplications,
    openAction,
    handleActionConfirm,
    handleExport,
  };
}
