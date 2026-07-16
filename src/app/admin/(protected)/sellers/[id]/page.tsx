"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SellerReviewActionDialog } from "@/components/admin/sellers/VendorApplicationReviewUI";
import { useSellerDetail } from "@/features/admin-sellers/hooks/use-seller-detail";
import {
  AdminFeedbackBanner,
  DocumentsSection,
  FuturePlaceholders,
  IdentityStoreSection,
  PayoutDetailsSection,
  SellerActionPanel,
  SellerOverviewSection,
  TimelineSection,
  TrustChecksSection,
} from "@/features/admin-sellers/sections";

export default function AdminSellerReviewPage() {
  const {
    application,
    loading,
    activeAction,
    isActionSubmitting,
    canApprove,
    canSuspend,
    openAction,
    closeAction,
    handleActionConfirm,
  } = useSellerDetail();

  if (loading) {
    return (
      <div className="mx-auto max-w-[96rem] space-y-5 pb-12">
        <div className="h-10 w-56 animate-pulse rounded-xl bg-stone-200/60" />
        <div className="h-56 animate-pulse rounded-[2rem] bg-stone-200/60" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-5">
            <div className="h-72 animate-pulse rounded-[1.75rem] bg-stone-200/60" />
            <div className="h-64 animate-pulse rounded-[1.75rem] bg-stone-200/60" />
          </div>
          <div className="space-y-5">
            <div className="h-52 animate-pulse rounded-[1.75rem] bg-stone-200/60" />
            <div className="h-44 animate-pulse rounded-[1.75rem] bg-stone-200/60" />
          </div>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="mx-auto max-w-[96rem] pb-12">
        <div className="rounded-[2rem] border border-stone-200/60 bg-white/90 p-8 shadow-sm">
          <p className="text-lg font-black text-stone-900">Seller application unavailable.</p>
          <p className="mt-2 text-sm font-medium text-stone-500">
            This application could not be loaded. It may have been removed or is inaccessible.
          </p>
          <Button asChild className="mt-5 rounded-xl bg-stone-900 font-black text-white hover:bg-stone-800">
            <Link href="/admin/sellers">Back to seller queue</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[96rem] animate-in space-y-4 pb-12 fade-in slide-in-from-bottom-4 duration-500">
      {/* Back nav */}
      <Button
        asChild
        variant="outline"
        className="w-fit rounded-xl border-stone-200 bg-white/80 font-black text-stone-700 shadow-sm hover:bg-white"
      >
        <Link href="/admin/sellers">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Seller applications
        </Link>
      </Button>

      {/* Overview hero */}
      <SellerOverviewSection application={application} />

      {/* Admin feedback banners */}
      <AdminFeedbackBanner application={application} />

      {/* Two-column layout */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        {/* Left: main content */}
        <div className="space-y-4">
          <IdentityStoreSection application={application} />
          <DocumentsSection application={application} />
          <PayoutDetailsSection application={application} />
        </div>

        {/* Right: operations sidebar */}
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <SellerActionPanel
            application={application}
            onAction={openAction}
            canApprove={canApprove}
            canSuspend={canSuspend}
          />
          <TrustChecksSection application={application} />
          <TimelineSection application={application} />
          <FuturePlaceholders />
        </div>
      </div>

      {/* Action dialog */}
      <SellerReviewActionDialog
        open={Boolean(activeAction)}
        onOpenChange={(open) => {
          if (!open) closeAction();
        }}
        action={activeAction}
        application={application}
        submitting={isActionSubmitting}
        onConfirm={handleActionConfirm}
      />
    </div>
  );
}
