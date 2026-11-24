/**
 * @file BuyersCollection.tsx
 * @module features/admin-buyers/sections
 * @description
 * Collection presentation for Customer records (CM-F1).
 * Supports:
 * - Desktop dense table (List view)
 * - Structured responsive cards (Grid view)
 * - Compact mobile rows (< sm screens)
 * - Keyboard-accessible detail links wiring `rememberListScroll`
 * - Honest field-masking presentation (distinct omitted vs actual null)
 * - Loading, true empty, filtered zero, and error recovery states
 */

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  User,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { formatAdminDate } from "@/lib/admin-format";
import { rememberListScroll } from "@/hooks/use-list-scroll-restoration";
import {
  formatBuyerDisplayName,
  isBuyerIdentityMasked,
  isBuyerContactMasked,
} from "../lib/buyer-contract";
import {
  setAdminBuyersReturnTarget,
  type BuyerSafeError,
} from "../lib/buyer-list-state";
import type {
  AdminBuyerRecord,
  AdminBuyersPagination,
  AdminBuyerViewMode,
} from "../types/admin-buyer.types";

interface BuyersCollectionProps {
  buyers: AdminBuyerRecord[];
  pagination: AdminBuyersPagination | null;
  loading: boolean;
  isRefreshing: boolean;
  error: BuyerSafeError | null;
  refreshError?: BuyerSafeError | null;
  viewMode: AdminBuyerViewMode;
  page: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

export function BuyersCollection({
  buyers,
  pagination,
  loading,
  isRefreshing,
  error,
  refreshError,
  viewMode,
  page,
  onPageChange,
  onRetry,
  hasActiveFilters,
  onResetFilters,
}: BuyersCollectionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams?.toString();
  const queueUrl = currentQuery ? `${pathname}?${currentQuery}` : (pathname || "/admin/buyers");

  const handleLinkClick = () => {
    if (typeof window !== "undefined") {
      const liveQueueUrl = window.location.pathname + window.location.search;
      rememberListScroll(liveQueueUrl);
      rememberListScroll("/admin/buyers");
      setAdminBuyersReturnTarget(liveQueueUrl);
    }
  };

  // 1. Error state
  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-2xl border border-rose-200 bg-rose-50/90 p-6 text-center text-rose-800 shadow-sm"
      >
        <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-rose-600" />
        <h3 className="text-base font-bold">Failed to load customers</h3>
        <p className="mt-1 text-sm font-medium text-rose-700">{error.message}</p>
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-rose-300 bg-white font-semibold text-rose-800 hover:bg-rose-100"
          >
            Retry Request
          </Button>
        </div>
      </div>
    );
  }

  // 2. Initial loading skeleton
  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-5 w-20 animate-pulse rounded-md bg-zinc-200" />
        </div>
        <div className="space-y-2 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      </div>
    );
  }

  // 3. Filtered zero vs true empty state
  if (buyers.length === 0) {
    if (hasActiveFilters) {
      return (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-8 text-center sm:p-12">
          <User className="mx-auto h-10 w-10 text-zinc-400" />
          <h3 className="mt-2 text-sm font-bold text-zinc-900">No customers match your filters</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Try adjusting your search query, status filters, or clear all filters.
          </p>
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="text-xs"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-8 text-center sm:p-12">
        <User className="mx-auto h-10 w-10 text-zinc-400" />
        <h3 className="mt-2 text-sm font-bold text-zinc-900">No customer accounts registered yet</h3>
        <p className="mt-1 text-xs text-zinc-500">
          When customers register on the marketplace, they will appear in this workspace.
        </p>
      </div>
    );
  }

  const totalPages = pagination?.pages ?? 1;
  const totalCount = pagination?.total ?? buyers.length;

  return (
    <div className="space-y-4">
      {/* Background refresh failure: retain previous data with honest retry warning */}
      {refreshError ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="admin-buyers-stale-banner"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-900 shadow-xs backdrop-blur-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="font-medium">
              Background refresh failed ({refreshError.message}). Showing previously retained customer records.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-7 border-amber-300 bg-white px-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {/* Dimmed indicator while background refreshing */}
      <div className={`transition-opacity ${isRefreshing ? "opacity-60" : "opacity-100"}`}>
        {viewMode === "grid" ? (
          /* Grid View Presentation */
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {buyers.map((buyer) => {
              const displayName = formatBuyerDisplayName(buyer);
              const isMaskedIdentity = isBuyerIdentityMasked(buyer);
              const isMaskedContact = isBuyerContactMasked(buyer);

              return (
                <div
                  key={buyer.id}
                  className="flex min-w-0 flex-col justify-between rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm shadow-zinc-900/5 backdrop-blur-md transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="min-w-0 space-y-2.5">
                    {/* Header: Name and Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4
                          className={`min-w-0 break-words text-sm font-bold ${
                            isMaskedIdentity ? "italic text-zinc-500" : "text-zinc-900"
                          }`}
                          title={displayName}
                        >
                          {displayName}
                        </h4>
                        <p className="min-w-0 break-all font-mono text-xs text-zinc-400" title={buyer.id}>
                          {buyer.id}
                        </p>
                      </div>
                      <AdminStatusBadge
                        tone={buyer.isActive ? "emerald" : "zinc"}
                        className="shrink-0"
                      >
                        {buyer.isActive ? "Active" : "Inactive"}
                      </AdminStatusBadge>
                    </div>

                    {/* Contact & Verification info */}
                    <div className="space-y-1.5 border-t border-zinc-100 pt-2 text-xs">
                      {/* Email */}
                      <div className="flex items-center gap-1.5 text-zinc-600 min-w-0">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span
                          className={`min-w-0 flex-1 break-all ${
                            isMaskedContact ? "italic text-zinc-400" : "text-zinc-700"
                          }`}
                          title={buyer.email ?? "Restricted"}
                        >
                          {buyer.email ?? "(Email Restricted)"}
                        </span>
                        {buyer.email && (
                          <span
                            title={buyer.emailVerified ? "Email verified" : "Email not verified"}
                            className="shrink-0"
                          >
                            {buyer.emailVerified ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-zinc-400" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="flex items-center gap-1.5 text-zinc-600 min-w-0">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span
                          className={`min-w-0 flex-1 break-words ${
                            buyer.telephone === undefined
                              ? "italic text-zinc-400"
                              : "text-zinc-700"
                          }`}
                        >
                          {buyer.telephone === undefined
                            ? "(Phone Restricted)"
                            : buyer.telephone ?? "Not provided"}
                        </span>
                        {buyer.telephone && (
                          <span
                            title={buyer.phoneVerified ? "Phone verified" : "Phone not verified"}
                            className="shrink-0"
                          >
                            {buyer.phoneVerified ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-zinc-400" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Joined Date */}
                      <div className="flex items-center gap-1.5 text-zinc-500 min-w-0">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                        <span className="min-w-0 break-words">Joined {formatAdminDate(buyer.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Link */}
                  <div className="mt-3 border-t border-zinc-100 pt-3">
                    <Link
                      href={`/admin/buyers/${buyer.id}?returnTo=${encodeURIComponent(queueUrl)}`}
                      onClick={handleLinkClick}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900"
                    >
                      <span>View Customer</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List View (Responsive Table with Mobile Card Fallback) */
          <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/90 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
            {/* Desktop Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    <th scope="col" className="px-5 py-3.5">
                      Customer
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Contact
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Verification
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Joined
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {buyers.map((buyer) => {
                    const displayName = formatBuyerDisplayName(buyer);
                    const isMaskedIdentity = isBuyerIdentityMasked(buyer);
                    const isMaskedContact = isBuyerContactMasked(buyer);

                    return (
                      <tr
                        key={buyer.id}
                        className="transition-colors hover:bg-zinc-50/60"
                      >
                        {/* Customer Name & ID */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col">
                            <span
                              className={`font-semibold ${
                                isMaskedIdentity ? "italic text-zinc-500" : "text-zinc-900"
                              }`}
                            >
                              {displayName}
                            </span>
                            <span className="font-mono text-xs text-zinc-400">
                              {buyer.id}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <AdminStatusBadge tone={buyer.isActive ? "emerald" : "zinc"}>
                            {buyer.isActive ? "Active" : "Inactive"}
                          </AdminStatusBadge>
                        </td>

                        {/* Contact */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col text-xs">
                            <span
                              className={`truncate max-w-[200px] ${
                                isMaskedContact ? "italic text-zinc-400" : "text-zinc-700"
                              }`}
                              title={buyer.email}
                            >
                              {buyer.email ?? "(Email Restricted)"}
                            </span>
                            <span className="text-zinc-500">
                              {buyer.telephone === undefined
                                ? "(Phone Restricted)"
                                : buyer.telephone ?? "No phone"}
                            </span>
                          </div>
                        </td>

                        {/* Verification */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 text-xs">
                            <span
                              className="inline-flex items-center gap-1"
                              title={buyer.emailVerified ? "Email verified" : "Email unverified"}
                            >
                              {buyer.emailVerified ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-zinc-300" />
                              )}
                              <span className="text-[11px] text-zinc-500">Email</span>
                            </span>
                            <span
                              className="inline-flex items-center gap-1"
                              title={buyer.phoneVerified ? "Phone verified" : "Phone unverified"}
                            >
                              {buyer.phoneVerified ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-zinc-300" />
                              )}
                              <span className="text-[11px] text-zinc-500">Phone</span>
                            </span>
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td className="px-5 py-3.5 text-xs text-zinc-600 whitespace-nowrap">
                          {formatAdminDate(buyer.createdAt)}
                        </td>

                        {/* Detail Link */}
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/admin/buyers/${buyer.id}?returnTo=${encodeURIComponent(queueUrl)}`}
                            onClick={handleLinkClick}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-zinc-950 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-sm px-1 py-0.5"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout (< 640px) */}
            <div className="divide-y divide-zinc-100 sm:hidden">
              {buyers.map((buyer) => {
                const displayName = formatBuyerDisplayName(buyer);
                const isMaskedIdentity = isBuyerIdentityMasked(buyer);

                return (
                  <div key={buyer.id} className="min-w-0 p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`min-w-0 break-words text-sm font-bold ${
                            isMaskedIdentity ? "italic text-zinc-500" : "text-zinc-900"
                          }`}
                        >
                          {displayName}
                        </p>
                        <p className="min-w-0 break-all font-mono text-[11px] text-zinc-400">
                          {buyer.id}
                        </p>
                      </div>
                      <AdminStatusBadge tone={buyer.isActive ? "emerald" : "zinc"} className="shrink-0">
                        {buyer.isActive ? "Active" : "Inactive"}
                      </AdminStatusBadge>
                    </div>

                    <div className="flex flex-col gap-1 text-xs text-zinc-500 min-w-0">
                      <span className="min-w-0 break-all">{buyer.email ?? "(Email Restricted)"}</span>
                      <span className="shrink-0 text-zinc-400">Joined {formatAdminDate(buyer.createdAt)}</span>
                    </div>

                    <div className="pt-1">
                      <Link
                        href={`/admin/buyers/${buyer.id}?returnTo=${encodeURIComponent(queueUrl)}`}
                        onClick={handleLinkClick}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 py-2 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
                      >
                        <span>Inspect Customer</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 ? (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-zinc-200/80 px-2 py-3 sm:flex-row">
          <p className="text-xs text-zinc-500">
            Showing page <span className="font-bold text-zinc-900">{page}</span> of{" "}
            <span className="font-bold text-zinc-900">{totalPages}</span> ({totalCount} total customers)
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="h-8 gap-1 text-xs"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
