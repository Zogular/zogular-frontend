import { cn } from "@/lib/utils";

type DiscoveryProductSkeletonProps = {
  count?: number;
  layout?: "rail" | "grid";
  label?: string;
  className?: string;
};

function SkeletonCard() {
  return (
    <div
      data-testid="discovery-product-skeleton-card"
      className="overflow-hidden rounded-[20px] bg-white shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
    >
      <div data-testid="discovery-product-skeleton-media" className="aspect-[3/4] animate-pulse bg-zinc-100" />
      <div className="space-y-2 p-3" aria-hidden="true">
        <div className="h-3 w-2/5 animate-pulse rounded bg-zinc-100" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-100" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-100" />
        <div className="flex items-end justify-between pt-2">
          <div className="h-5 w-2/5 animate-pulse rounded bg-zinc-100" />
          <div className="h-11 w-11 animate-pulse rounded-full bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

export function DiscoveryProductSkeleton({
  count = 5,
  layout = "grid",
  label = "Loading products",
  className,
}: DiscoveryProductSkeletonProps) {
  const items = Array.from({ length: Math.max(1, count) }, (_, index) => (
    <li
      key={index}
      className={cn(
        "min-w-0",
        layout === "rail" && "w-[148px] min-w-[148px] snap-start md:w-[216px] md:min-w-[216px]",
      )}
    >
      <SkeletonCard />
    </li>
  ));

  return (
    <div role="status" aria-label={label} className={className} data-testid="discovery-product-skeleton">
      <ul
        aria-hidden="true"
        className={cn(
          layout === "rail"
            ? "flex snap-x snap-mandatory gap-3 overflow-hidden py-1 md:gap-4 md:px-1 lg:justify-center"
            : "grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        )}
      >
        {items}
      </ul>
      <span className="sr-only">{label}</span>
    </div>
  );
}
