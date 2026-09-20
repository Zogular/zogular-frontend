import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";

export default function AdminDisputesPage() {
  return (
    <div className="mx-auto max-w-[96rem] animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Disputes &amp; Claims</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Order disputes, buyer and seller evidence, and arbitration workflows.</p>
        </div>
      </div>
      <FeaturePendingNotice
        title="Disputes Workspace Pending"
        description="Dispute cases and arbitration workflows are scheduled for Package B10 pending dedicated schema migrations."
      />
    </div>
  );
}
