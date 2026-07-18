import type { CollectionViewMode } from "@/components/shared/CollectionViewToggle";
import { DENSE_COLLECTION_GRID_CLASS } from "@/components/collection/collection-grid-density";
import { cn } from "@/lib/utils";

interface CollectionSkeletonProps {
  view: CollectionViewMode;
  count?: number;
  className?: string;
  label?: string;
  variant?: "product" | "inventory";
}

export function CollectionSkeleton({
  view,
  count = 8,
  className,
  label = "Loading collection",
  variant = "product",
}: CollectionSkeletonProps) {
  if (view === "grid") {
    return (
      <div
        className={cn(
          DENSE_COLLECTION_GRID_CLASS,
          className,
        )}
        aria-label={label}
        role="status"
      >
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="aspect-[3/4] animate-pulse bg-zinc-100" />
            <div className="space-y-1.5 p-2">
              <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-100" />
              <div className="flex items-center justify-between gap-2">
                <div className="h-4 w-2/5 animate-pulse rounded bg-zinc-100" />
                {variant === "inventory" ? (
                  <div className="h-4 w-2/5 animate-pulse rounded bg-zinc-100" />
                ) : null}
              </div>
              {variant === "inventory" ? (
                <div className="flex gap-1 pt-0.5">
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-zinc-100" />
                  <div className="h-8 min-w-0 flex-1 animate-pulse rounded-lg bg-zinc-100" />
                  <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-zinc-100" />
                </div>
              ) : (
                <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
              )}
            </div>
          </div>
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-zinc-200 bg-white", className)} aria-label={label} role="status">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex min-h-24 items-center gap-3 border-b border-zinc-100 p-2 last:border-b-0 md:px-4">
          <div className="h-20 w-15 shrink-0 animate-pulse rounded-lg bg-zinc-100 md:h-16 md:w-12" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="h-8 w-8 animate-pulse rounded-lg bg-zinc-100" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
