"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SellerReviewActionDialog } from "@/components/admin/sellers/VendorApplicationReviewUI";
import { useSellerDetail } from "@/features/admin-sellers/hooks/use-seller-detail";
import {
  ADMIN_SELLER_QUEUE_PATH,
  canReturnToAdminSellerQueue,
} from "@/features/admin-sellers/lib/seller-review-navigation";
import {
  AdminFeedbackBanner,
  DecisionHistorySection,
  DocumentsSection,
  EvidenceSection,
  IdentityStoreSection,
  PayoutDetailsSection,
  SellerActionPanel,
  SellerOverviewSection,
  SellerReviewErrorState,
  SellerReviewInlineNotice,
  SellerReviewLoadingState,
} from "@/features/admin-sellers/sections";

export default function AdminSellerReviewPage() {
  const router = useRouter();
  const review = useSellerDetail();

  function returnToSellerQueue() {
    if (
      canReturnToAdminSellerQueue(
        document.referrer,
        window.location.origin,
        window.history.length,
      )
    ) {
      router.back();
      return;
    }

    router.push(ADMIN_SELLER_QUEUE_PATH);
  }

  if (review.loading) return <SellerReviewLoadingState />;
  if (!review.detail) {
    return review.loadError
      ? <SellerReviewErrorState error={review.loadError} onRetry={() => void review.retryLoad()} />
      : null;
  }

  const { application } = review.detail;
  const actionPanel = (
    <SellerActionPanel
      capabilities={review.detail.review.capabilities}
      disabled={review.actionsDisabled}
      onAction={review.openAction}
    />
  );

  return (
    <div className="mx-auto max-w-[96rem] space-y-4 pb-24 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 xl:pb-8">
      <Button type="button" variant="outline" onClick={returnToSellerQueue} className="min-h-11 border-[color:rgba(184,135,70,0.3)] bg-[var(--admin-surface-cream)] text-[var(--admin-ink)] hover:bg-[var(--admin-surface-mist)]">
        <ArrowLeft />Seller applications
      </Button>

      <SellerOverviewSection application={application} isRefreshing={review.isRefreshing} onRefresh={() => void review.refreshReview()} />
      {review.refreshError ? <SellerReviewInlineNotice error={review.refreshError} onRefresh={() => void review.refreshReview()} /> : null}
      {review.conflictError ? <SellerReviewInlineNotice error={review.conflictError} onRefresh={() => void review.refreshConflict()} /> : null}
      {review.actionError && !review.conflictError ? <SellerReviewInlineNotice error={review.actionError} /> : null}
      <AdminFeedbackBanner application={application} />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-4">
          <EvidenceSection detail={review.detail} />
          <IdentityStoreSection application={application} />
          <DocumentsSection detail={review.detail} />
          <PayoutDetailsSection detail={review.detail} />
          <DecisionHistorySection history={review.detail.review.history} />
        </div>
        <aside className="hidden xl:block"><div className="sticky top-0">{actionPanel}</div></aside>
      </div>

      <div className="fixed inset-x-4 bottom-3 z-20 xl:hidden">
        <SellerActionPanel capabilities={review.detail.review.capabilities} disabled={review.actionsDisabled} compact onAction={review.openAction} />
      </div>

      <SellerReviewActionDialog
        open={Boolean(review.activeAction)}
        onOpenChange={(open) => { if (!open) review.closeAction(); }}
        action={review.activeAction}
        application={application}
        submitting={review.isActionSubmitting}
        onConfirm={review.handleActionConfirm}
      />
    </div>
  );
}
