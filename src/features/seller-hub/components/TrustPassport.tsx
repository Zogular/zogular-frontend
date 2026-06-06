"use client";

import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import type { VendorApplication } from "@/types/seller";
import { cn } from "@/lib/utils";

type TrustItem = {
  label: string;
  status: "complete" | "pending" | "review";
};

export function TrustPassport({ application }: { application: VendorApplication }) {
  const items: TrustItem[] = [
    { label: "Email verified", status: application.businessEmail ? "complete" : "pending" },
    { label: "Phone verified", status: application.businessPhone ? "complete" : "pending" },
    { label: "Identity (NRC) uploaded", status: application.nrcFrontUrl ? "complete" : "pending" },
    { label: "Shop photo uploaded", status: application.shopPhotoUrl ? "complete" : "pending" },
    { label: "Payout info present", status: application.payoutProvider ? "complete" : "pending" },
    {
      label: "Admin approval status",
      status: application.status === "APPROVED" ? "complete" : application.status === "PROVISIONAL" ? "complete" : application.status === "SUBMITTED" ? "review" : "pending",
    },
  ];

  return (
    <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-black text-zinc-900">Trust Passport</h2>
        <p className="mt-0.5 text-xs font-medium text-zinc-500">Your verification status</p>
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
