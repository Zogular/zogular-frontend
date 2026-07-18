"use client";

import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import type { VendorApplication } from "@/types/seller";
import { cn } from "@/lib/utils";

type TrustItem = {
  label: string;
  status: "complete" | "pending" | "review";
};

export function TrustPassport({ application }: { application: VendorApplication }) {
  const isApproved = application.status === "APPROVED";

  const items: TrustItem[] = [
    { label: "Email on file", status: application.businessEmail ? "complete" : "pending" },
    { label: "Phone on file", status: application.businessPhone ? "complete" : "pending" },
    { label: "Identity document", status: application.nrcFrontUrl ? (isApproved ? "complete" : "review") : "pending" },
    { label: "Shop/business photo", status: application.shopPhotoUrl ? (isApproved ? "complete" : "review") : "pending" },
    { label: "Payout details provided", status: application.payoutProvider ? "complete" : "pending" },
    {
      label: "Seller account approval",
      status:
        isApproved
          ? "complete"
          : application.status === "PROVISIONAL" || application.status === "SUBMITTED"
            ? "review"
            : "pending",
    },
  ];

  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-black text-zinc-900">Verification progress</h2>
        <p className="mt-0.5 text-xs font-medium text-zinc-500">Items still needed for your seller account.</p>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-3">
            {item.status === "complete" ? (
              <CheckCircle2 className="h-5 w-5 text-[#009E49]" />
            ) : item.status === "review" ? (
              <Clock3 className="h-5 w-5 text-amber-500" />
            ) : (
              <Circle className="h-5 w-5 text-zinc-300" />
            )}
            <span
              className={cn(
                "text-sm font-semibold",
                item.status === "complete" ? "text-zinc-900" : item.status === "review" ? "text-amber-700" : "text-zinc-400"
              )}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
