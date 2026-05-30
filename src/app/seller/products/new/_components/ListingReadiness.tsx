"use client";

import { BadgeCheck } from "lucide-react";

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
      <section className="lg:hidden">
        <div aria-hidden className="h-19" />
        <div className="fixed left-4 right-4 top-37 z-40 overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-[0_14px_36px_rgba(15,23,42,0.16)] ring-1 ring-zinc-900/3 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3 bg-linear-to-r from-zinc-950 via-zinc-900 to-emerald-950 px-3.5 py-2.5 text-white">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">Listing readiness</p>
              <h2 className="mt-0.5 truncate text-xs font-black">{nextItem ? `Next: ${nextItem.label}` : "Ready for review"}</h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-black text-white">{completeCount}/{items.length}</span>
              <BadgeCheck className="h-4 w-4 text-emerald-300" />
            </div>
          </div>
          <div className="h-1 bg-zinc-200/80">
            <div className="h-full rounded-r-full bg-linear-to-r from-[#009E49] to-emerald-300 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex items-center gap-1.5">
              {items.map((item) => (
                <span
                  key={item.label}
                  aria-label={`${item.label}: ${item.detail}`}
                  className={`h-2.5 w-2.5 rounded-full ${item.done ? "bg-[#009E49] shadow-[0_0_10px_rgba(0,158,73,0.45)]" : "bg-amber-400"}`}
                />
              ))}
            </div>
            <span className="truncate text-[10px] font-black uppercase tracking-wider text-zinc-500">{progress}% complete</span>
          </div>
        </div>
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
