import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSellerTypeLabel } from "@/components/admin/sellers/VendorApplicationReviewUI";
import type {
  AdminVendorApplicationSort,
  AdminVendorApplicationSortDirection,
  AdminVendorApplicationStatusFacets,
} from "@/services/admin/vendor-applications";
import { SELLER_LIST_STATUSES } from "@/features/admin-sellers/lib/seller-list-state";
import type { SellerApplicationStatus, SellerType } from "@/types/seller";

const STATUS_LABELS: Record<SellerApplicationStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  NEEDS_INFO: "Needs info",
  PROVISIONAL: "Provisional",
  APPROVED: "Approved",
  RESTRICTED: "Restricted",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
};

const SORT_OPTIONS: Array<{
  value: `${AdminVendorApplicationSort}:${AdminVendorApplicationSortDirection}`;
  label: string;
}> = [
  { value: "submittedAt:desc", label: "Submitted: newest" },
  { value: "submittedAt:asc", label: "Submitted: oldest" },
  { value: "createdAt:desc", label: "Created: newest" },
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "storeName:asc", label: "Store name: A-Z" },
  { value: "storeName:desc", label: "Store name: Z-A" },
];

interface SellersListFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: SellerApplicationStatus | "all";
  setStatusFilter: (value: SellerApplicationStatus | "all") => void;
  sellerTypeFilter: SellerType | "all";
  setSellerTypeFilter: (value: SellerType | "all") => void;
  sort: AdminVendorApplicationSort;
  direction: AdminVendorApplicationSortDirection;
  setSort: (sort: AdminVendorApplicationSort, direction: AdminVendorApplicationSortDirection) => void;
  facets: AdminVendorApplicationStatusFacets | null;
}

export function SellersListFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sellerTypeFilter,
  setSellerTypeFilter,
  sort,
  direction,
  setSort,
  facets,
}: SellersListFiltersProps) {
  const allCount = facets
    ? SELLER_LIST_STATUSES.reduce((total, status) => total + facets[status], 0)
    : null;

  return (
    <section
      aria-label="Seller queue controls"
      className="overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] shadow-[0_14px_30px_rgb(6_59_41_/_7%)]"
    >
      <div className="p-3 sm:p-4">
        <label htmlFor="seller-queue-search" className="text-[11px] font-black uppercase text-[var(--admin-ink-soft)]">
          Search seller queue
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--admin-ink-soft)]" />
          <Input
            id="seller-queue-search"
            aria-describedby="seller-queue-search-scope"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            maxLength={120}
            placeholder="Search seller records"
            className="h-11 rounded-md border-[color-mix(in_srgb,var(--admin-copper-muted)_42%,transparent)] bg-[var(--admin-surface-mist)] pl-9 pr-11 text-sm font-semibold text-[var(--admin-ink)] placeholder:text-[var(--admin-ink-soft)] focus-visible:ring-[var(--admin-canopy)]"
          />
          {searchQuery ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery("")}
              aria-label="Clear seller search"
              title="Clear search"
              className="absolute right-0 top-0 size-11 rounded-md text-[var(--admin-ink-soft)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)] hover:text-[var(--admin-canopy-deep)]"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
        <p id="seller-queue-search-scope" className="mt-2 text-xs font-semibold leading-5 text-[var(--admin-ink-soft)]">
          Store, owner, email, phone, or application ID.
        </p>
      </div>

      <div className="border-y border-[color-mix(in_srgb,var(--admin-copper-muted)_28%,transparent)] bg-[var(--admin-surface-mist)] px-2 py-2">
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter seller queue by status">
          <StatusFilterButton
            active={statusFilter === "all"}
            label="All"
            count={allCount}
            onClick={() => setStatusFilter("all")}
          />
          {SELLER_LIST_STATUSES.map((status) => (
            <StatusFilterButton
              key={status}
              active={statusFilter === status}
              label={STATUS_LABELS[status]}
              count={facets?.[status] ?? null}
              onClick={() => setStatusFilter(status)}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
        <label className="grid gap-1 text-[10px] font-black uppercase text-[var(--admin-ink-soft)]">
          Seller type
          <select
            aria-label="Seller type filter"
            value={sellerTypeFilter}
            onChange={(event) => setSellerTypeFilter(event.target.value as SellerType | "all")}
            className="h-10 rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_38%,transparent)] bg-[var(--admin-surface-mist)] px-3 text-sm font-bold normal-case text-[var(--admin-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)]"
          >
            <option value="all">All seller types</option>
            <option value="INDIVIDUAL">{getSellerTypeLabel("INDIVIDUAL")}</option>
            <option value="REGISTERED_BUSINESS">{getSellerTypeLabel("REGISTERED_BUSINESS")}</option>
          </select>
        </label>
        <label className="grid gap-1 text-[10px] font-black uppercase text-[var(--admin-ink-soft)]">
          Sort queue
          <select
            aria-label="Sort seller queue"
            value={`${sort}:${direction}`}
            onChange={(event) => {
              const [nextSort, nextDirection] = event.target.value.split(":") as [
                AdminVendorApplicationSort,
                AdminVendorApplicationSortDirection,
              ];
              setSort(nextSort, nextDirection);
            }}
            className="h-10 rounded-md border border-[color-mix(in_srgb,var(--admin-copper-muted)_38%,transparent)] bg-[var(--admin-surface-mist)] px-3 text-sm font-bold normal-case text-[var(--admin-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy)]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function StatusFilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-ember)] ${
        active
          ? "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)]"
          : "text-[var(--admin-ink-soft)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)] hover:text-[var(--admin-canopy-deep)]"
      }`}
    >
      {label}
      <span className={active ? "text-[var(--admin-surface-mist)]" : "text-[var(--admin-ember)]"}>
        {count ?? "-"}
      </span>
    </button>
  );
}
