"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import type { VendorApplication } from "@/types/seller";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  label: string;
  isComplete: boolean;
  href?: string;
};

export function GrowthChecklist({
  application,
  productProbe,
}: {
  application: VendorApplication;
  productProbe: "loading" | "has-products" | "empty" | "unavailable";
}) {
  const items: ChecklistItem[] = [
    {
      label: "Create your first product draft",
      isComplete: productProbe === "has-products",
      href: "/seller/products/new",
    },
    {
      label: "Payout details provided",
      isComplete: !!application.payoutProvider,
    },
    {
      label: "Wait for full admin approval",
      isComplete: application.status === "APPROVED",
      href: "/seller/status",
    },
  ];

  return (
    <div className="rounded-3xl border border-[#009E49]/20 bg-[#f4fbf6] p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-black text-zinc-900">Finish setting up your store</h2>
        <p className="mt-0.5 text-xs font-medium text-zinc-600">Complete the remaining steps below.</p>
        {productProbe === "unavailable" ? (
          <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            We could not confirm your product progress. Try again later; your existing products have not been removed.
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="group flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm border border-zinc-100">
            <div className="flex items-center gap-3">
              {item.isComplete ? (
                <CheckCircle2 className="h-5 w-5 text-[#009E49]" />
              ) : (
                <Circle className="h-5 w-5 text-zinc-300" />
              )}
              <span
                className={cn(
                  "text-sm font-bold",
                  item.isComplete ? "text-zinc-500 line-through" : "text-zinc-900"
                )}
              >
                {item.label}
              </span>
            </div>
            {item.href && !item.isComplete && (
              <Link href={item.href} className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-50 text-zinc-400 transition-colors hover:bg-[#009E49]/10 hover:text-[#009E49]">
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
