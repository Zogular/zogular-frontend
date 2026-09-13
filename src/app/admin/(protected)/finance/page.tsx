import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";

export default function AdminFinancePage() {
  return (
    <div className="mx-auto max-w-[96rem] animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Finance &amp; Payouts</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Treasury summary, payout queues, and transaction ledger.</p>
        </div>
      </div>
      <FeaturePendingNotice
        title="Finance Operations Pending"
        description="Live treasury and disbursement operations are scheduled for Package B11/F10 pending immutable money model approval."
      />
    </div>
  );
}
