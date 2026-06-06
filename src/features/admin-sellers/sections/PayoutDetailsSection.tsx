import { HandCoins } from "lucide-react";
import type { VendorApplication } from "@/types/seller";
import { SectionCard } from "./TrustChecksSection";

export function PayoutDetailsSection({
  application,
}: {
  application: VendorApplication;
}) {
  return (
    <SectionCard
      title="Payout details"
      description="Where seller payments should be settled."
      icon={HandCoins}
    >
      <div className="overflow-hidden rounded-2xl border border-stone-200/60 bg-white/50">
        <dl className="divide-y divide-stone-200/50">
          <PayoutRow label="Provider" value={application.payoutProvider || "Not set"} />
          <PayoutRow label="Phone" value={application.payoutPhone || "Not set"} />
          {application.payoutAccountName ? (
            <PayoutRow label="Account name" value={application.payoutAccountName} />
          ) : null}
          {application.tpin ? (
            <PayoutRow label="TPIN" value={application.tpin} />
          ) : null}
        </dl>
      </div>
    </SectionCard>
  );
}

function PayoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-stone-50/50 sm:items-center">
      <dt className="shrink-0 pt-0.5 text-xs font-bold text-stone-600 sm:pt-0">{label}</dt>
      <dd className="break-words text-right text-sm font-black text-stone-950">{value}</dd>
    </div>
  );
}
