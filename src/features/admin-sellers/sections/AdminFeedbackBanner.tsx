import { FileWarning, MessageSquareWarning, StickyNote } from "lucide-react";
import type { SellerReviewApplication } from "../types/seller-review.types";

export function AdminFeedbackBanner({
  application,
}: {
  application: SellerReviewApplication;
}) {
  const hasNeedsInfo = application.status === "NEEDS_INFO" && application.needsInfoReason;
  const hasRejection = application.status === "REJECTED" && application.rejectionReason;
  const hasAdminNotes = Boolean(application.adminNotes);

  if (!hasNeedsInfo && !hasRejection && !hasAdminNotes) return null;

  return (
    <div className="space-y-3">
      {hasNeedsInfo ? (
        <BannerCard
          icon={MessageSquareWarning}
          eyebrow="Information requested"
          body={application.needsInfoReason!}
          toneClass="border-amber-200/70 bg-amber-50/80 text-amber-900"
          iconBg="bg-amber-100 text-amber-700"
        />
      ) : null}

      {hasRejection ? (
        <BannerCard
          icon={FileWarning}
          eyebrow="Rejection reason"
          body={application.rejectionReason!}
          toneClass="border-rose-200/70 bg-rose-50/80 text-rose-900"
          iconBg="bg-rose-100 text-rose-700"
        />
      ) : null}

      {hasAdminNotes ? (
        <BannerCard
          icon={StickyNote}
          eyebrow="Admin notes"
          body={application.adminNotes!}
          toneClass="border-stone-200/70 bg-stone-50/80 text-stone-900"
          iconBg="bg-stone-100 text-stone-600"
        />
      ) : null}
    </div>
  );
}

function BannerCard({
  icon: Icon,
  eyebrow,
  body,
  toneClass,
  iconBg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  body: string;
  toneClass: string;
  iconBg: string;
}) {
  return (
    <div className={`flex gap-3 rounded-2xl border p-3.5 ${toneClass}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{eyebrow}</p>
        <p className="mt-1 text-sm font-semibold leading-6">{body}</p>
      </div>
    </div>
  );
}
