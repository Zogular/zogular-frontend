"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  approveVendorApplication,
  getVendorApplicationById,
  rejectVendorApplication,
  requestVendorApplicationInfo,
  restrictVendorApplication,
  suspendVendorApplication,
} from "@/services/admin/vendor-applications";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import type { VendorApplication } from "@/types/seller";
import type { VendorApplicationAdminAction } from "../types/admin-seller.types";

export function useSellerDetail() {
  const params = useParams<{ id: string }>();
  const applicationId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [application, setApplication] = useState<VendorApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<VendorApplicationAdminAction | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const identity = useAdminIdentity()!;
  const canApprove = adminIdentityHasPermission(identity, "approve_sellers");
  const canSuspend = adminIdentityHasPermission(identity, "suspend_sellers");

  const loadApplication = useCallback(async () => {
    if (!applicationId) return;
    try {
      setLoading(true);
      const response = await getVendorApplicationById(applicationId);
      setApplication(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load seller application.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  function openAction(action: VendorApplicationAdminAction) {
    setActiveAction(action);
  }

  function closeAction() {
    setActiveAction(null);
  }

  async function handleActionConfirm(payload: { reason?: string; adminNotes?: string }) {
    if (!application || !activeAction) return;
    try {
      setIsActionSubmitting(true);
      let updated: VendorApplication;

      if (activeAction === "approve-approved") {
        updated = await approveVendorApplication(application.id, { status: "APPROVED", adminNotes: payload.adminNotes });
        toast.success("Seller approved.");
      } else if (activeAction === "approve-provisional") {
        updated = await approveVendorApplication(application.id, { status: "PROVISIONAL", adminNotes: payload.adminNotes });
        toast.success("Seller approved as provisional.");
      } else if (activeAction === "needs-info") {
        updated = await requestVendorApplicationInfo(application.id, payload.reason ?? "", payload.adminNotes);
        toast.success("More information requested.");
      } else if (activeAction === "reject") {
        updated = await rejectVendorApplication(application.id, payload.reason ?? "", payload.adminNotes);
        toast.success("Seller application rejected.");
      } else if (activeAction === "restrict") {
        updated = await restrictVendorApplication(application.id, payload.adminNotes);
        toast.success("Seller restricted.");
      } else {
        updated = await suspendVendorApplication(application.id, payload.adminNotes);
        toast.success("Seller suspended.");
      }

      setApplication(updated);
      setActiveAction(null);
      await loadApplication();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update seller application.");
    } finally {
      setIsActionSubmitting(false);
    }
  }

  return {
    application,
    loading,
    activeAction,
    isActionSubmitting,
    canApprove,
    canSuspend,
    openAction,
    closeAction,
    handleActionConfirm,
    loadApplication,
  };
}
