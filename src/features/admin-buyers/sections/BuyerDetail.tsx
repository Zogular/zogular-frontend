/**
 * @file BuyerDetail.tsx
 * @module features/admin-buyers/sections
 * @description
 * Detailed customer view component for /admin/buyers/[id] (CM-F1).
 *
 * Responsibilities:
 * - Fetches authoritative customer detail via GET /api/v1/admin/users/:id.
 * - Displays permitted identity, contact, verification, and timestamps.
 * - Distinguishes between omitted restricted fields and actual null values.
 * - Rejects non-customer records with typed contract error.
 * - Provides honest feedback regarding role access limitations.
 * - Return navigation preserving scroll position and filters.
 */

"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldAlert,
  User,
  Calendar,
  Clock,
  Shield,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { formatAdminDateTime } from "@/lib/admin-format";
import { useBuyerDetail } from "../hooks/use-buyer-detail";
import {
  formatBuyerDisplayName,
  isBuyerIdentityMasked,
  isBuyerContactMasked,
} from "../lib/buyer-contract";
import {
  validateAdminBuyersReturnTarget,
  getAdminBuyersReturnTarget,
} from "../lib/buyer-list-state";

interface BuyerDetailProps {
  id: string;
}

export function BuyerDetail({ id }: BuyerDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { buyer, loading, isRefreshing, error, refreshError, refresh } =
    useBuyerDetail(id);

  const returnToParam = searchParams?.get("returnTo");
  const returnTarget = useMemo(() => {
    return validateAdminBuyersReturnTarget(returnToParam || getAdminBuyersReturnTarget());
  }, [returnToParam]);

  const handleReturnToQueue = useCallback(() => {
    router.push(returnTarget);
  }, [router, returnTarget]);

  // 1. Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl min-w-0 space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-zinc-200" />
        </div>
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="h-8 w-48 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-4 w-32 animate-pulse rounded-md bg-zinc-100" />
          <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
            <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
            <div className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Not Found state
  if (error || !buyer) {
    const isNotFound = error?.kind === "not_found" || error?.status === 404;

    return (
      <div className="mx-auto max-w-4xl min-w-0 space-y-6 pb-12">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReturnToQueue}
            className="gap-1.5 text-xs text-zinc-600 hover:text-zinc-950"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back</span>
          </Button>
          <span className="text-xs text-zinc-400">/</span>
          <Link
            href={returnTarget}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 hover:underline"
          >
            Customers
          </Link>
        </div>

        <div
          role="alert"
          className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm sm:p-12"
        >
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-rose-500" />
          <h2 className="text-lg font-bold text-zinc-900">
            {isNotFound ? "Customer Account Not Found" : "Unable to Load Customer"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            {isNotFound
              ? `No customer record exists with ID '${id}'. It may have been removed or the ID is invalid.`
              : error?.message || "An unexpected error occurred while loading this customer record."}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {!isNotFound ? (
              <Button type="button" variant="outline" size="sm" onClick={refresh}>
                Retry
              </Button>
            ) : null}
            <Link href={returnTarget}>
              <Button size="sm">Return to Customers</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = formatBuyerDisplayName(buyer);
  const isMaskedIdentity = isBuyerIdentityMasked(buyer);
  const isMaskedContact = isBuyerContactMasked(buyer);

  return (
    <div className="mx-auto max-w-4xl min-w-0 space-y-6 pb-12">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReturnToQueue}
            className="gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span>Back</span>
          </Button>
          <span className="text-zinc-300">/</span>
          <Link
            href={returnTarget}
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 hover:underline shrink-0"
          >
            Customers
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="min-w-0 break-all font-mono text-xs text-zinc-400">
            {buyer.id}
          </span>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
          className="gap-1.5 shrink-0 self-start sm:self-auto text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>{isRefreshing ? "Refreshing..." : "Refresh Record"}</span>
        </Button>
      </div>

      {/* Background refresh failure: retain previous data with honest retry warning */}
      {refreshError ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="admin-buyer-detail-stale-banner"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-900 shadow-xs backdrop-blur-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="font-medium">
              Background refresh failed ({refreshError.message}). Showing previously loaded record details.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            className="h-7 border-amber-300 bg-white px-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {/* Main Customer Header Card */}
      <div className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-md shadow-zinc-900/5 backdrop-blur-xl sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className={`min-w-0 break-words text-xl font-black tracking-tight sm:text-2xl ${
                  isMaskedIdentity ? "italic text-zinc-600" : "text-zinc-950"
                }`}
              >
                {displayName}
              </h1>
              <AdminStatusBadge tone={buyer.isActive ? "emerald" : "zinc"} className="shrink-0">
                {buyer.isActive ? "Active Account" : "Inactive Account"}
              </AdminStatusBadge>
            </div>
            <p className="min-w-0 break-all font-mono text-xs text-zinc-400">ID: {buyer.id}</p>
          </div>

          <div className="shrink-0 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-left sm:text-right text-xs">
            <span className="block text-zinc-400">Account Type</span>
            <span className="font-bold text-zinc-800">MARKETPLACE CUSTOMER</span>
          </div>
        </div>

        {/* Timestamps row */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Calendar className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="shrink-0">Joined: </span>
            <span className="font-semibold text-zinc-900 break-words">
              {formatAdminDateTime(buyer.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
            <span className="shrink-0">Last Updated: </span>
            <span className="font-semibold text-zinc-900 break-words">
              {formatAdminDateTime(buyer.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Detail Sections Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Identity Section */}
        <div className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-md shadow-zinc-900/5 backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center gap-2 border-b border-zinc-100 pb-3">
            <User className="h-4 w-4 shrink-0 text-zinc-700" />
            <h2 className="text-sm font-bold text-zinc-900">Identity Details</h2>
          </div>

          {isMaskedIdentity ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900">
              <p className="font-semibold">Sensitive Identity Restricted</p>
              <p className="mt-1 text-amber-800">
                First and last names are restricted for your current administrative role.
              </p>
            </div>
          ) : (
            <dl className="space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:justify-between border-b border-zinc-50 pb-2 gap-1">
                <dt className="text-zinc-500 shrink-0">First Name</dt>
                <dd className="min-w-0 break-words font-semibold text-zinc-900 text-left sm:text-right">{buyer.firstName ?? "—"}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between border-b border-zinc-50 pb-2 gap-1">
                <dt className="text-zinc-500 shrink-0">Last Name</dt>
                <dd className="min-w-0 break-words font-semibold text-zinc-900 text-left sm:text-right">{buyer.lastName ?? "—"}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Contact & Verification Section */}
        <div className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-5 shadow-md shadow-zinc-900/5 backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center gap-2 border-b border-zinc-100 pb-3">
            <Shield className="h-4 w-4 shrink-0 text-zinc-700" />
            <h2 className="text-sm font-bold text-zinc-900">Contact & Verification</h2>
          </div>

          {isMaskedContact ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900">
              <p className="font-semibold">Sensitive Contact Restricted</p>
              <p className="mt-1 text-amber-800">
                Email and telephone details are restricted for your current administrative role.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Email row */}
              <div className="space-y-1 border-b border-zinc-50 pb-3">
                <span className="text-zinc-500">Email Address</span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-all font-semibold text-zinc-900">
                    {buyer.email ?? "—"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      buyer.emailVerified
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                    }`}
                  >
                    {buyer.emailVerified ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span>Verified</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 text-zinc-400" />
                        <span>Unverified</span>
                      </>
                    )}
                  </span>
                </div>
                {buyer.emailVerifiedAt ? (
                  <p className="text-[11px] text-zinc-400">
                    Verified on {formatAdminDateTime(buyer.emailVerifiedAt)}
                  </p>
                ) : null}
              </div>

              {/* Phone row */}
              <div className="space-y-1">
                <span className="text-zinc-500">Telephone Number</span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words font-semibold text-zinc-900">
                    {buyer.telephone ?? "Not provided"}
                  </span>
                  {buyer.telephone ? (
                    <span
                      className={`inline-flex items-center gap-1 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        buyer.phoneVerified
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                      }`}
                    >
                      {buyer.phoneVerified ? (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          <span>Verified</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-zinc-400" />
                          <span>Unverified</span>
                        </>
                      )}
                    </span>
                  ) : null}
                </div>
                {buyer.phoneVerifiedAt ? (
                  <p className="text-[11px] text-zinc-400">
                    Verified on {formatAdminDateTime(buyer.phoneVerifiedAt)}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security & Operational Notice */}
      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-4 text-xs text-zinc-600">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          <div className="space-y-1">
            <p className="font-bold text-zinc-900">Read-Only Workspace Notice</p>
            <p className="text-zinc-600 leading-relaxed">
              This workspace provides customer profile inspection. Account mutations (activation/deactivation,
              credential resets, and role governance) are governed under separate operational authority.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
