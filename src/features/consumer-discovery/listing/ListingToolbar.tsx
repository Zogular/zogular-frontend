import type { DiscoverySort } from "@/features/consumer-discovery/types/discovery.types";

const SORT_LABELS: Record<DiscoverySort, string> = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  popular: "Most Viewed",
};

type ListingToolbarProps = {
  total: number;
  startItem: number;
  endItem: number;
  sort: DiscoverySort;
};

export function ListingToolbar({ total, startItem, endItem, sort }: ListingToolbarProps) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-y border-zinc-200 py-2.5" data-testid="listing-toolbar">
      <p className="text-sm font-semibold text-zinc-800" role="status" aria-live="polite" aria-atomic="true">
        {total === 0 ? "No products to display" : `Showing ${startItem.toLocaleString()}–${endItem.toLocaleString()} of ${total.toLocaleString()}`}
      </p>
      <p className="text-xs font-semibold text-zinc-500">Order: {SORT_LABELS[sort]}</p>
    </div>
  );
}
