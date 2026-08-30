"use client";

import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  approveVendorApplication,
  getSellerReviewSafeError,
  getVendorApplicationById,
  rejectVendorApplication,
  requestVendorApplicationInfo,
  restrictVendorApplication,
  shouldRetrySellerReviewQuery,
  suspendVendorApplication,
} from "@/services/admin/vendor-applications";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";
import type {
  SellerReviewDetail,
  SellerReviewSafeError,
} from "../types/seller-review.types";

export const ADMIN_SELLER_LIST_QUERY_KEY = [
  "admin",
  "seller-applications",
  "list",
] as const;

export function adminSellerReviewQueryKey(applicationId: string) {
  return ["admin", "seller-applications", "detail", applicationId] as const;
}

export function sellerReviewMutationScope(applicationId: string): string {
  return `admin-seller-review:${applicationId}`;
}

interface SellerReviewActionPayload {
  reason?: string;
  adminNotes?: string;
}

interface SellerReviewMutationInput extends SellerReviewActionPayload {
  action: VendorApplicationAdminAction;
  applicationId: string;
  expectedUpdatedAt: string;
}

export async function performSellerReviewAction(
  input: SellerReviewMutationInput,
): Promise<SellerReviewDetail> {
  const shared = {
    expectedUpdatedAt: input.expectedUpdatedAt,
    adminNotes: input.adminNotes,
  };

  switch (input.action) {
    case "approve-approved":
      return approveVendorApplication(input.applicationId, {
        ...shared,
        status: "APPROVED",
      });
    case "approve-provisional":
      return approveVendorApplication(input.applicationId, {
        ...shared,
        status: "PROVISIONAL",
      });
    case "needs-info":
      return requestVendorApplicationInfo(input.applicationId, {
        ...shared,
        reason: input.reason ?? "",
      });
    case "reject":
      return rejectVendorApplication(input.applicationId, {
        ...shared,
        reason: input.reason ?? "",
      });
    case "restrict":
      return restrictVendorApplication(input.applicationId, {
        expectedUpdatedAt: input.expectedUpdatedAt,
        adminNotes: input.adminNotes ?? "",
      });
    case "suspend":
      return suspendVendorApplication(input.applicationId, {
        expectedUpdatedAt: input.expectedUpdatedAt,
        adminNotes: input.adminNotes ?? "",
      });
  }
}

const ACTION_SUCCESS_COPY: Record<VendorApplicationAdminAction, string> = {
  "approve-approved": "Seller approved.",
  "approve-provisional": "Provisional access granted.",
  "needs-info": "Information request sent.",
  reject: "Seller application rejected.",
  restrict: "Seller restricted.",
  suspend: "Seller suspended.",
};

export function useSellerDetail() {
  const params = useParams<{ id: string }>();
  const applicationId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = adminSellerReviewQueryKey(applicationId);
  const [activeAction, setActiveAction] = useState<VendorApplicationAdminAction | null>(null);
  const [actionError, setActionError] = useState<SellerReviewSafeError | null>(null);
  const [conflictError, setConflictError] = useState<SellerReviewSafeError | null>(null);
  const submissionLockedRef = useRef(false);

  const reviewQuery = useQuery({
    queryKey,
    enabled: Boolean(applicationId),
    queryFn: ({ signal }) => getVendorApplicationById(applicationId, signal),
    retry: shouldRetrySellerReviewQuery,
    staleTime: 30_000,
  });

  const decisionMutation = useMutation({
    mutationKey: ["admin", "seller-applications", "decision", applicationId],
    mutationFn: performSellerReviewAction,
    scope: { id: sellerReviewMutationScope(applicationId) },
    retry: false,
    onSuccess: async (updated, variables) => {
      queryClient.setQueryData(queryKey, updated);
      await queryClient.invalidateQueries({ queryKey: ADMIN_SELLER_LIST_QUERY_KEY });
      setActiveAction(null);
      setActionError(null);
      setConflictError(null);
      toast.success(ACTION_SUCCESS_COPY[variables.action]);
    },
    onError: (error) => {
      const safeError = getSellerReviewSafeError(error);
      setActionError(safeError);
      if (safeError.kind === "conflict") {
        setActiveAction(null);
        setConflictError(safeError);
        void queryClient.invalidateQueries({ queryKey, exact: true });
      }
    },
    onSettled: () => {
      submissionLockedRef.current = false;
    },
  });

  const actionPending = decisionMutation.isPending;
  const mutateDecision = decisionMutation.mutateAsync;
  const refetchReview = reviewQuery.refetch;

  const openAction = useCallback((action: VendorApplicationAdminAction) => {
    if (conflictError || actionPending) return;
    setActionError(null);
    setActiveAction(action);
  }, [actionPending, conflictError]);

  const closeAction = useCallback(() => {
    if (actionPending) return;
    setActiveAction(null);
  }, [actionPending]);

  const handleActionConfirm = useCallback(async (payload: SellerReviewActionPayload) => {
    const application = reviewQuery.data?.application;
    if (!application || !activeAction || conflictError || submissionLockedRef.current) return;
    submissionLockedRef.current = true;
    await mutateDecision({
      ...payload,
      action: activeAction,
      applicationId: application.id,
      expectedUpdatedAt: application.updatedAt,
    }).catch(() => undefined);
  }, [activeAction, conflictError, mutateDecision, reviewQuery.data?.application]);

  const refreshConflict = useCallback(async () => {
    const result = await refetchReview();
    if (result.status === "success" && !result.error) {
      setConflictError(null);
      setActionError(null);
    }
  }, [refetchReview]);

  const detail = reviewQuery.data ?? null;
  const loadError = !detail && reviewQuery.error
    ? getSellerReviewSafeError(reviewQuery.error)
    : null;
  const refreshError = detail && reviewQuery.error
    ? getSellerReviewSafeError(reviewQuery.error)
    : null;

  return {
    applicationId,
    detail,
    application: detail?.application ?? null,
    loading: !detail && reviewQuery.isPending,
    isRefreshing: Boolean(detail && reviewQuery.isFetching),
    loadError,
    refreshError,
    actionError,
    conflictError,
    activeAction,
    isActionSubmitting: actionPending,
    actionsDisabled: Boolean(conflictError || actionPending || reviewQuery.isFetching),
    openAction,
    closeAction,
    handleActionConfirm,
    retryLoad: refetchReview,
    refreshReview: refetchReview,
    refreshConflict,
  };
}
