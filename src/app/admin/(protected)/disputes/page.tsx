"use client";

import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";

export default function AdminDisputesPage() {
  return (
    <div className="mx-auto max-w-400 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Dispute Queue</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage buyer and seller disputes.</p>
        </div>
      </div>
      <FeaturePendingNotice
        title="Feature Disabled"
        description="Dispute management operations are not currently supported in this environment."
      />
    </div>
  );
}
