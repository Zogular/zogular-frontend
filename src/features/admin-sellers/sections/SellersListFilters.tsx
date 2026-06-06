import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AdminToolbar } from "@/components/admin/AdminPrimitives";
import { getSellerTypeLabel } from "@/components/admin/sellers/VendorApplicationReviewUI";
import type { SellerApplicationStatus, SellerType } from "@/types/seller";

const STATUS_FILTERS: Array<SellerApplicationStatus | "all"> = [
  "all",
  "DRAFT",
  "SUBMITTED",
  "NEEDS_INFO",
  "PROVISIONAL",
  "APPROVED",
  "RESTRICTED",
  "SUSPENDED",
  "REJECTED",
];

const SELLER_TYPE_FILTERS: Array<SellerType | "all"> = [
  "all",
  "INDIVIDUAL",
  "REGISTERED_BUSINESS",
];

interface SellersListFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  statusFilter: SellerApplicationStatus | "all";
  setStatusFilter: (val: SellerApplicationStatus | "all") => void;
  sellerTypeFilter: SellerType | "all";
  setSellerTypeFilter: (val: SellerType | "all") => void;
}

export function SellersListFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sellerTypeFilter,
  setSellerTypeFilter,
}: SellersListFiltersProps) {
  return (
    <AdminToolbar>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search store, owner, phone, or email"
          className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium shadow-inner transition-all hover:bg-white focus-visible:ring-zinc-900"
        />
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:gap-3 xl:w-auto xl:grid-cols-2">
        <select
          aria-label="Seller application status filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as SellerApplicationStatus | "all")}
          className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none transition-all hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-900"
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All statuses" : status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          aria-label="Seller type filter"
          value={sellerTypeFilter}
          onChange={(event) => setSellerTypeFilter(event.target.value as SellerType | "all")}
          className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none transition-all hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-900"
        >
          {SELLER_TYPE_FILTERS.map((sellerType) => (
            <option key={sellerType} value={sellerType}>
              {sellerType === "all" ? "All seller types" : getSellerTypeLabel(sellerType)}
            </option>
          ))}
        </select>
      </div>
    </AdminToolbar>
  );
}
