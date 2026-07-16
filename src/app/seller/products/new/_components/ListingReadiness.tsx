"use client";

import { BadgeCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type ListingReadinessItem = {
  label: string;
  done: boolean;
  detail: string;
};

type ListingReadinessProps = {
  items: ListingReadinessItem[];
  variant: "mobile" | "desktop";
};

export function ListingReadiness({ items, variant }: ListingReadinessProps) {
  const completeCount = items.filter((item) => item.done).length;
  const progress = Math.round((completeCount / items.length) * 100);
  const nextItem = items.find((item) => !item.done);

  if (variant === "mobile") {
    return (
      <section className="bg-white/95 backdrop-blur-xl border-b border-zinc-200/80 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5">Listing readiness</p>
            <h2 className="truncate text-xs font-black text-zinc-900">{nextItem ? `Next: ${nextItem.label}` : "Ready for review"}</h2>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black text-zinc-800">{completeCount}/{items.length}</span>
              {completeCount === items.length ? <BadgeCheck className="h-3.5 w-3.5 text-[#009E49]" /> : null}
            </div>
            <span className="text-[10px] font-bold text-zinc-500">{progress}%</span>
          </div>
        </div>
        <Progress value={progress} className="h-1.5 bg-zinc-200/80 [&>div]:bg-emerald-500" />
      </section>
    );
  }

  return (
    <div className="hidden rounded-3xl border border-white/70 bg-linear-to-br from-zinc-950 via-zinc-900 to-emerald-950 p-4 text-white shadow-[0_22px_55px_rgba(15,23,42,0.24)] lg:block">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">Listing readiness</p>
          <h2 className="mt-1 text-lg font-black">Launch checks</h2>
        </div>
        <BadgeCheck className="h-8 w-8 text-emerald-300" />
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur">
            <span className="flex items-center gap-2 text-xs font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${item.done ? "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" : "bg-amber-300"}`} />
              {item.label}
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-white/65">{item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
