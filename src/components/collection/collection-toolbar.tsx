import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CollectionToolbarProps {
  className?: string;
  search: ReactNode;
  resultContext?: ReactNode;
  desktopControls?: ReactNode;
  mobileFilters?: ReactNode;
  sortControl?: ReactNode;
  viewControl: ReactNode;
}

export function CollectionToolbar({
  className,
  search,
  resultContext,
  desktopControls,
  mobileFilters,
  sortControl,
  viewControl,
}: CollectionToolbarProps) {
  return (
    <section
      aria-label="Collection controls"
      className={cn("rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm", className)}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">{search}</div>
        <div className="xl:hidden">{mobileFilters}</div>
        <div className="shrink-0">{viewControl}</div>
      </div>

      <div className="mt-2 flex min-h-8 items-center justify-between gap-3 border-t border-zinc-100 pt-2">
        <div className="min-w-0 flex-1">{resultContext}</div>
        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          {desktopControls}
          {sortControl}
        </div>
      </div>
    </section>
  );
}

interface CollectionResultCountProps {
  count: number;
  total: number;
  label?: string;
}

export function CollectionResultCount({ count, total, label = "products" }: CollectionResultCountProps) {
  return (
    <p className="truncate text-xs font-semibold text-zinc-500" aria-live="polite">
      <span className="font-black text-zinc-900">{count}</span> of {total} {label}
    </p>
  );
}
