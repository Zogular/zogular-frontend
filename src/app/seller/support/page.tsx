"use client";

import { MessageSquare } from "lucide-react";
import { BackendPendingBadge } from "@/components/shared/FeaturePendingNotice";

export default function SellerSupportPage() {
  return (
    <div className="mx-auto max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-24 md:pb-12 h-full flex flex-col">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Support Center</h1>
            <BackendPendingBadge />
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">Operations-only preview for seller support workflows.</p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-white py-24 text-center shadow-sm mt-8">
        <MessageSquare className="mb-4 h-12 w-12 text-zinc-300" />
        <h3 className="text-lg font-black text-zinc-900">Backend integration pending</h3>
        <p className="mt-2 text-sm text-zinc-500 max-w-md mx-auto">
          Seller support tools are not connected yet. During MVP, Zogular operations will handle seller support directly.
        </p>
      </div>
    </div>
  );
}
