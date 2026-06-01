"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  FileBadge2,
  FileText,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AdminSellerActionButtons,
  DetailStatCard,
  DocumentCard,
  MetaRow,
  ReasonBanner,
  SellerIdentityBlock,
  SellerReviewActionDialog,
  SellerTypeBadge,
  StatusBadge,
  formatAdminDate,
  getApplicationPrimaryName,
  getStatusMeta,
  type VendorApplicationAdminAction,
} from "@/components/admin/sellers/VendorApplicationReviewUI";
import { adminHasPermission } from "@/services/admin/session";
import {
  approveVendorApplication,
  getVendorApplicationById,
  rejectVendorApplication,
  requestVendorApplicationInfo,
  restrictVendorApplication,
  suspendVendorApplication,
} from "@/services/admin/vendor-applications";
import type { VendorApplication } from "@/types/seller";

export default function AdminSellerReviewPage() {
  const params = useParams<{ id: string }>();
  const applicationId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [application, setApplication] = useState<VendorApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<VendorApplicationAdminAction | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const canApprove = adminHasPermission("approve_sellers");
  const canSuspend = adminHasPermission("suspend_sellers");

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

  function openAction(action: VendorApplicationAdminAction, nextApplication: VendorApplication) {
    setApplication(nextApplication);
    setActiveAction(action);
  }

  async function handleActionConfirm(payload: { reason?: string; adminNotes?: string }) {
    if (!application || !activeAction) return;

    try {
      setIsActionSubmitting(true);

      let updated: VendorApplication;
      if (activeAction === "approve-approved") {
        updated = await approveVendorApplication(application.id, {
          status: "APPROVED",
          adminNotes: payload.adminNotes,
        });
        toast.success("Seller approved.");
      } else if (activeAction === "approve-provisional") {
        updated = await approveVendorApplication(application.id, {
          status: "PROVISIONAL",
          adminNotes: payload.adminNotes,
        });
        toast.success("Seller approved as provisional.");
      } else if (activeAction === "needs-info") {
        updated = await requestVendorApplicationInfo(
          application.id,
          payload.reason ?? "",
          payload.adminNotes,
        );
        toast.success("Needs-info request sent.");
      } else if (activeAction === "reject") {
        updated = await rejectVendorApplication(
          application.id,
          payload.reason ?? "",
          payload.adminNotes,
        );
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

  if (loading) {
    return <div className="h-[38rem] animate-pulse rounded-[2rem] bg-zinc-200/80" />;
  }

  if (!application) {
    return (
      <div className="rounded-[2rem] border border-white/70 bg-white/80 p-8 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
        <p className="text-lg font-black text-zinc-950">Seller application unavailable.</p>
        <p className="mt-2 text-sm font-medium text-zinc-500">
          The seller application could not be loaded from the backend.
        </p>
        <Button asChild className="mt-5 rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
          <Link href="/admin/sellers">Back to seller queue</Link>
        </Button>
      </div>
    );
  }

  const statusMeta = getStatusMeta(application.status);

  return (
    <div className="mx-auto max-w-[96rem] animate-in space-y-6 pb-12 fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4">
        <Button
          asChild
          variant="outline"
          className="w-fit rounded-xl border-zinc-200 bg-white/80 font-black text-zinc-700 shadow-md shadow-zinc-900/5 backdrop-blur-xl hover:bg-white"
        >
          <Link href="/admin/sellers">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to seller queue
          </Link>
        </Button>

        <div className="relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.88),rgba(248,250,252,0.94))] p-6 shadow-[0_28px_72px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-emerald-300/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={application.status} />
                <SellerTypeBadge sellerType={application.sellerType} />
              </div>
              <h1 className="mt-4 text-[2rem] font-black leading-[0.94] tracking-[-0.05em] text-zinc-950 sm:text-[2.4rem]">
                {getApplicationPrimaryName(application)}
              </h1>
              <p className="mt-2 text-sm font-bold text-zinc-500 sm:text-base">
                {application.ownerFullName || "Seller owner unavailable"}
              </p>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-zinc-600">
                {statusMeta.summary}
              </p>
            </div>

            <div className="xl:max-w-[34rem]">
              <AdminSellerActionButtons
                application={application}
                onOpenAction={openAction}
                canApprove={canApprove}
                canSuspend={canSuspend}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DetailStatCard
          title="Submitted"
          value={formatAdminDate(application.submittedAt || application.createdAt)}
          note="When the queue review started"
        />
        <DetailStatCard
          title="Reviewed"
          value={formatAdminDate(application.reviewedAt)}
          note={application.reviewedBy ? `Reviewer ID: ${application.reviewedBy}` : "No reviewer recorded yet"}
        />
        <DetailStatCard
          title="Payout provider"
          value={application.payoutProvider || "Unavailable"}
          note={application.payoutPhone || "Payout phone not provided"}
        />
        <DetailStatCard
          title="Category coverage"
          value={String(application.productCategories.length)}
          note="Declared product categories"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          {application.needsInfoReason ? (
            <ReasonBanner title="Needs-info reason" body={application.needsInfoReason} />
          ) : null}
          {application.rejectionReason ? (
            <ReasonBanner title="Rejection reason" body={application.rejectionReason} tone="danger" />
          ) : null}
          {application.adminNotes ? (
            <ReasonBanner title="Admin notes" body={application.adminNotes} tone="neutral" />
          ) : null}

          <section className="rounded-[2rem] border border-white/70 bg-white/78 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-zinc-950 text-emerald-300 shadow-lg shadow-zinc-950/10">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-zinc-950">Owner and seller identity</h2>
                <p className="text-sm font-medium text-zinc-500">Core seller identity, contact, and payout metadata from the application record.</p>
              </div>
            </div>
            <div className="mt-5">
              <SellerIdentityBlock application={application} />
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/78 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-zinc-950 text-emerald-300 shadow-lg shadow-zinc-950/10">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-zinc-950">Store and business profile</h2>
                <p className="text-sm font-medium text-zinc-500">Seller type, operational identity, and business registration context.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetaRow icon={Store} label="Store name" value={application.storeName || "Unavailable"} />
              <MetaRow icon={Building2} label="Business name" value={application.legalBusinessName || application.businessName || "Unavailable"} />
              <MetaRow icon={FileBadge2} label="Seller type" value={application.sellerType} />
              <MetaRow icon={FileText} label="TPIN" value={application.tpin || "Unavailable"} />
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/78 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-zinc-950 text-emerald-300 shadow-lg shadow-zinc-950/10">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-[-0.03em] text-zinc-950">Documents and evidence</h2>
                <p className="text-sm font-medium text-zinc-500">Backend currently exposes URL fields only. Cloudinary upload workflow remains deferred.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DocumentCard label="NRC front" value={application.nrcFrontUrl || application.idDocument} />
              <DocumentCard label="NRC back" value={application.nrcBackUrl} />
              <DocumentCard label="Shop photo" value={application.shopPhotoUrl || application.userPic} />
              <DocumentCard label="PACRA document" value={application.pacraDocumentUrl} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetaRow icon={FileBadge2} label="NRC number" value={application.nrcNumber || "Unavailable"} />
              <MetaRow icon={Building2} label="PACRA number" value={application.pacraNumber || "Unavailable"} />
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <h2 className="text-lg font-black tracking-[-0.03em] text-zinc-950">Product categories</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500">What the seller declared during onboarding.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {application.productCategories.length > 0 ? (
                application.productCategories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full border border-emerald-200/70 bg-emerald-50/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.15em] text-emerald-700"
                  >
                    {category}
                  </span>
                ))
              ) : (
                <p className="rounded-[1.15rem] border border-dashed border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm font-bold text-zinc-400">
                  No product categories supplied yet.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-6">
            <h2 className="text-lg font-black tracking-[-0.03em] text-zinc-950">Review history fields</h2>
            <p className="mt-1 text-sm font-medium text-zinc-500">Only fields currently exposed by the backend are shown here. No fabricated audit timeline is added.</p>
            <div className="mt-4 space-y-3">
              <MetaRow icon={ShieldCheck} label="Created" value={formatAdminDate(application.createdAt)} />
              <MetaRow icon={ShieldCheck} label="Updated" value={formatAdminDate(application.updatedAt)} />
              <MetaRow icon={ShieldCheck} label="Submitted" value={formatAdminDate(application.submittedAt)} />
              <MetaRow icon={ShieldCheck} label="Reviewed" value={formatAdminDate(application.reviewedAt)} />
              <MetaRow icon={ShieldCheck} label="Reviewed by" value={application.reviewedBy || "Unavailable"} />
            </div>
          </section>
        </div>
      </div>

      <SellerReviewActionDialog
        open={Boolean(activeAction)}
        onOpenChange={(open) => {
          if (!open) setActiveAction(null);
        }}
        action={activeAction}
        application={application}
        submitting={isActionSubmitting}
        onConfirm={handleActionConfirm}
      />
    </div>
  );
}
