"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Download,
  Filter,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminMetricCard,
  AdminPageHeader,
  AdminToolbar,
  AdminEmptyState,
} from "@/components/admin/AdminPrimitives";
import {
  AdminSellerActionButtons,
  SellerReviewActionDialog,
  SellerTypeBadge,
  StatusBadge,
  formatAdminDate,
  getApplicationLocation,
  getApplicationPrimaryName,
  getSellerTypeLabel,
  matchesApplicationSearch,
  type VendorApplicationAdminAction,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
import { adminHasPermission } from "@/services/admin/session";
import {
  approveVendorApplication,
  getVendorApplications,
  rejectVendorApplication,
  requestVendorApplicationInfo,
  restrictVendorApplication,
  suspendVendorApplication,
} from "@/services/admin/vendor-applications";
import type { SellerApplicationStatus, SellerType, VendorApplication } from "@/types/seller";

const STATUS_FILTERS: Array<SellerApplicationStatus | "all"> = [
  "all",
  "DRAFT",
  "SUBMITTED",
  "NEEDS_INFO",
  "PROVISIONAL",
  "APPROVED",
  "RESTRICTED",
  "SUSPENDED",
  "REJECTED",
];

const SELLER_TYPE_FILTERS: Array<SellerType | "all"> = [
  "all",
  "INDIVIDUAL",
  "REGISTERED_BUSINESS",
];

export default function AdminSellersPage() {
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SellerApplicationStatus | "all">("all");
  const [sellerTypeFilter, setSellerTypeFilter] = useState<SellerType | "all">("all");
  const [activeAction, setActiveAction] = useState<VendorApplicationAdminAction | null>(null);
  const [activeApplication, setActiveApplication] = useState<VendorApplication | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const canApprove = adminHasPermission("approve_sellers");
  const canSuspend = adminHasPermission("suspend_sellers");
  const canExport = adminHasPermission("export_reports");

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getVendorApplications({
        status: statusFilter,
        sellerType: sellerTypeFilter,
        limit: 100,
      });
      setApplications(response.applications);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load seller applications.");
    } finally {
      setLoading(false);
    }
  }, [sellerTypeFilter, statusFilter]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const filteredApplications = useMemo(() => {
    return applications.filter((application) => matchesApplicationSearch(application, searchQuery));
  }, [applications, searchQuery]);

  const summary = useMemo(() => {
    return {
      submitted: applications.filter((application) => application.status === "SUBMITTED").length,
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

  return (
    <div className="mx-auto max-w-[92rem] animate-in space-y-6 pb-12 fade-in slide-in-from-bottom-4 duration-500">
      <AdminPageHeader
        title="Seller review workspace"
        description="Review seller onboarding applications against the real backend queue. Status moves here control capability, not just the VENDOR role."
        actions={
          canExport ? (
            <Button
              variant="outline"
              onClick={handleExport}
              className="h-10 rounded-xl border-emerald-200/70 bg-white/80 font-black text-emerald-800 shadow-md shadow-emerald-900/5 backdrop-blur-xl hover:bg-emerald-50"
            >
              <Download className="mr-2 h-4 w-4" />
              Export queue
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          title="Submitted"
          value={summary.submitted}
          note="Waiting for review"
          tone="amber"
          icon={<Store className="h-5 w-5" />}
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

      <AdminToolbar>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search store, owner, phone, or email"
            className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium shadow-inner transition-all hover:bg-white focus-visible:ring-zinc-900"
          />
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-2">
          <select
            aria-label="Seller application status filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as SellerApplicationStatus | "all")}
            className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none transition-all hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : status.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Seller type filter"
            value={sellerTypeFilter}
            onChange={(event) => setSellerTypeFilter(event.target.value as SellerType | "all")}
            className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none transition-all hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            {SELLER_TYPE_FILTERS.map((sellerType) => (
              <option key={sellerType} value={sellerType}>
                {sellerType === "all" ? "All seller types" : getSellerTypeLabel(sellerType)}
              </option>
            ))}
          </select>
        </div>
      </AdminToolbar>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`seller-loading-${index}`} className="h-72 animate-pulse rounded-[2rem] bg-zinc-200/80" />
          ))}
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/75 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
          <AdminEmptyState
            title="No seller applications match the current view."
            description="Try widening the filters or searching for a different store, owner, phone number, or email."
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredApplications.map((application) => (
            <article
              key={application.id}
              className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(240,253,244,0.72))] p-5 shadow-[0_22px_48px_rgba(15,23,42,0.08)] backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-300/12 blur-3xl" />
              <div className="relative flex flex-wrap items-center gap-2">
                <StatusBadge status={application.status} />
                <SellerTypeBadge sellerType={application.sellerType} />
              </div>

              <div className="relative mt-4 flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.15rem] bg-zinc-950 text-emerald-300 shadow-lg shadow-zinc-950/10">
                  <Store className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black tracking-[-0.03em] text-zinc-950">
                    {getApplicationPrimaryName(application)}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-zinc-500">{application.ownerFullName}</p>
                </div>
              </div>

              <div className="relative mt-5 grid gap-2.5">
                <InfoPill icon={Phone} value={application.businessPhone || application.user?.telephone || "No phone"} />
                <InfoPill icon={Mail} value={application.businessEmail || application.user?.email || "No email"} />
                <InfoPill icon={Building2} value={getApplicationLocation(application) || "Location unavailable"} />
              </div>

              <div className="relative mt-5 grid grid-cols-2 gap-3">
                <MiniMeta label="Submitted" value={formatAdminDate(application.submittedAt || application.createdAt)} />
                <MiniMeta label="Reviewed" value={formatAdminDate(application.reviewedAt)} />
              </div>

              <div className="relative mt-5 border-t border-white/60 pt-4">
                <AdminSellerActionButtons
                  application={application}
                  onOpenAction={openAction}
                  canApprove={canApprove}
                  canSuspend={canSuspend}
                  detailHref={`/admin/sellers/${application.id}`}
                />
                <Link
                  href={`/admin/sellers/${application.id}`}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-700 transition hover:text-emerald-800"
                >
                  Open full review
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}
        </div>
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

function InfoPill({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[1.1rem] border border-white/60 bg-white/75 px-3.5 py-3 backdrop-blur-xl">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <Icon className="h-4 w-4" />
      </div>
      <p className="truncate text-sm font-bold text-zinc-700">{value}</p>
    </div>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/65 bg-white/72 px-3.5 py-3 backdrop-blur-xl">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-black text-zinc-900">{value}</p>
    </div>
  );
}
