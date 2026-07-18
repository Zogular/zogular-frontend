"use client";

export type SellerProductTab =
  | "all"
  | "published"
  | "draft"
  | "pending_review"
  | "approved"
  | "needs_changes"
  | "paused"
  | "suspended"
  | "low-stock"
  | "out-of-stock";

export const SELLER_PRODUCT_TABS: ReadonlyArray<{ id: SellerProductTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Draft" },
  { id: "pending_review", label: "Pending Review" },
  { id: "approved", label: "Approved" },
  { id: "needs_changes", label: "Needs Changes" },
  { id: "paused", label: "Paused" },
  { id: "suspended", label: "Suspended" },
  { id: "low-stock", label: "Low Stock" },
  { id: "out-of-stock", label: "Out of Stock" },
];

export function isSellerProductTab(value: string | null): value is SellerProductTab {
  return SELLER_PRODUCT_TABS.some((tab) => tab.id === value);
}

interface SellerProductsTabsProps {
  activeTab: SellerProductTab;
  counts: Record<SellerProductTab, number>;
  onChange: (tab: SellerProductTab) => void;
}

export function SellerProductsTabs({ activeTab, counts, onChange }: SellerProductsTabsProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-1.5" role="tablist" aria-label="Product status filters">
        {SELLER_PRODUCT_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`h-9 whitespace-nowrap rounded-lg border px-3 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 ${isActive ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"}`}
            >
              {tab.label} <span className={isActive ? "text-zinc-300" : "text-zinc-400"}>{counts[tab.id]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
