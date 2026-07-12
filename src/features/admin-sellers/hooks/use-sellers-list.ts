import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type VendorApplicationAdminAction,
  matchesApplicationSearch,
  getApplicationPrimaryName,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import {
  approveVendorApplication,
  getVendorApplications,
  rejectVendorApplication,
  requestVendorApplicationInfo,
  restrictVendorApplication,
  suspendVendorApplication,
} from "@/services/admin/vendor-applications";
import type { SellerApplicationStatus, SellerType, VendorApplication } from "@/types/seller";

export function useSellersList() {
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SellerApplicationStatus | "all">("all");
  const [sellerTypeFilter, setSellerTypeFilter] = useState<SellerType | "all">("all");
  const [activeAction, setActiveAction] = useState<VendorApplicationAdminAction | null>(null);
  const [activeApplication, setActiveApplication] = useState<VendorApplication | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const identity = useAdminIdentity()!;
  const canApprove = adminIdentityHasPermission(identity, "approve_sellers");
  const canSuspend = adminIdentityHasPermission(identity, "suspend_sellers");
  const canExport = adminIdentityHasPermission(identity, "export_reports");

  const [visibleCount, setVisibleCount] = useState(20);

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getVendorApplications({
        status: statusFilter,
        sellerType: sellerTypeFilter,
        limit: 100,
      });
      setApplications(response.applications);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load seller applications.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [sellerTypeFilter, statusFilter]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, statusFilter, sellerTypeFilter]);

  const filteredApplications = useMemo(() => {
    return applications.filter((application) => matchesApplicationSearch(application, searchQuery));
  }, [applications, searchQuery]);

  const visibleApplications = useMemo(() => {
    return filteredApplications.slice(0, visibleCount);
  }, [filteredApplications, visibleCount]);

  const hasMore = visibleCount < filteredApplications.length;

  function loadMore() {
    setVisibleCount((prev) => prev + 20);
  }

  const summary = useMemo(() => {
    return {
      submitted: applications.filter((application) => application.status === "SUBMITTED").length,
      needsInfo: applications.filter((application) => application.status === "NEEDS_INFO").length,
      provisional: applications.filter((application) => application.status === "PROVISIONAL").length,
      approved: applications.filter((application) => application.status === "APPROVED").length,
      blocked: applications.filter((application) =>
        application.status === "RESTRICTED" ||
        application.status === "SUSPENDED" ||
        application.status === "REJECTED",
      ).length,
    };
  }, [applications]);

  function openAction(action: VendorApplicationAdminAction, application: VendorApplication) {
    setActiveAction(action);
    setActiveApplication(application);
  }

  async function handleActionConfirm(payload: { reason?: string; adminNotes?: string }) {
    if (!activeAction || !activeApplication) return;

    try {
      setIsActionSubmitting(true);

      if (activeAction === "approve-approved") {
        await approveVendorApplication(activeApplication.id, {
          status: "APPROVED",
          adminNotes: payload.adminNotes,
        });
        toast.success("Seller approved.");
      } else if (activeAction === "approve-provisional") {
        await approveVendorApplication(activeApplication.id, {
          status: "PROVISIONAL",
          adminNotes: payload.adminNotes,
        });
        toast.success("Seller approved as provisional.");
      } else if (activeAction === "needs-info") {
        await requestVendorApplicationInfo(
          activeApplication.id,
          payload.reason ?? "",
          payload.adminNotes,
        );
        toast.success("Needs-info request sent.");
      } else if (activeAction === "reject") {
        await rejectVendorApplication(
          activeApplication.id,
          payload.reason ?? "",
          payload.adminNotes,
        );
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
      await loadApplications();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update seller application.");
    } finally {
      setIsActionSubmitting(false);
    }
  }

  function handleExport() {
    const header = [
      "id",
      "store_name",
      "owner_full_name",
      "seller_type",
      "status",
      "phone",
      "email",
      "district",
      "submitted_at",
      "reviewed_at",
    ];
    const rows = filteredApplications.map((application) => [
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
    anchor.download = `zogular-seller-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredApplications.length} seller applications.`);
  }

  return {
    applications,
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
    filteredApplications,
    visibleApplications,
    hasMore,
    loadMore,
    summary,
    openAction,
    handleActionConfirm,
    handleExport,
  };
}
