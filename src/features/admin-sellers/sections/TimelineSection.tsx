import { formatAdminDate } from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { VendorApplication } from "@/types/seller";
import { SectionCard } from "./TrustChecksSection";

export function TimelineSection({
  application,
}: {
  application: VendorApplication;
}) {
  return (
    <SectionCard title="Application timeline" description="Key dates recorded for this seller.">
      <div className="space-y-2">
        <TimelineRow label="Created" value={formatAdminDate(application.createdAt)} />
        <TimelineRow label="Updated" value={formatAdminDate(application.updatedAt)} />
        <TimelineRow label="Submitted" value={formatAdminDate(application.submittedAt)} />
        <TimelineRow label="Last reviewed" value={formatAdminDate(application.reviewedAt)} />
        {application.reviewedBy ? (
          <TimelineRow label="Reviewed by" value={application.reviewedBy} />
        ) : null}
      </div>
    </SectionCard>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200/50 bg-stone-50/40 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">{label}</p>
      <p className="text-[11px] font-bold text-stone-800">{value}</p>
    </div>
  );
}
