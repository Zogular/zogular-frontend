"use client";

import { RefreshCw } from "lucide-react";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { useAdminSellerReviewAging } from "@/features/admin-reports/hooks/useAdminSellerReviewAging";
import { sellerReviewAgingAuthority } from "@/features/admin-reports/lib/reports-cache";
import { formatLusakaTimestamp } from "@/features/admin-reports/lib/seller-review-aging-contract";

export function AdminReportsWorkspace() {
  const identity = useAdminIdentity();
  const authority = sellerReviewAgingAuthority(identity);

  return (
    <div className="mx-auto max-w-[96rem] space-y-6 min-w-0 pb-12">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
            Operational Reports
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Current submitted seller review workload by elapsed time since submission.
          </p>
        </div>
      </div>

      {authority ? (
        <AuthorizedSellerReviewAging key={authority} authority={authority} />
      ) : (
        <section
          role="status"
          aria-label="Seller review aging unavailable"
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-bold text-zinc-900">
            Seller Review Queue Aging
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Seller review aging report is unavailable for your current permissions.
          </p>
        </section>
      )}

      <section aria-label="Financial reporting status" className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">Financial Reports</h2>
          <p className="text-sm text-zinc-500">Platform revenue and payouts.</p>
        </div>
        <FeaturePendingNotice
          title="Financial reporting unavailable"
          description="Financial reporting is not currently supported in this environment."
        />
      </section>
    </div>
  );
}

function AuthorizedSellerReviewAging({ authority }: { authority: string }) {
  const {
    data,
    error,
    failClosed,
    isInitialLoading,
    isRefreshing,
    refresh,
  } = useAdminSellerReviewAging(authority);

  const rows = data
    ? [
        {
          label: "Under 24 hours",
          detail: "Submitted less than 24 hours ago",
          count: data.bands.under24Hours,
        },
        {
          label: "24 to 72 hours",
          detail: "Submitted 24 hours up to 72 hours ago",
          count: data.bands.hours24To72,
        },
        {
          label: "72 to 168 hours",
          detail: "Submitted 72 hours up to 168 hours ago",
          count: data.bands.hours72To168,
        },
        {
          label: "168 hours or more",
          detail: "Submitted 168 hours or more ago",
          count: data.bands.over168Hours,
        },
        {
          label: "Age unavailable",
          detail: "Missing or future submission timestamp",
          count: data.ageUnavailable,
        },
      ]
    : [];

  return (
    <section
      aria-label="Seller review queue aging"
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-zinc-900 sm:text-lg">
            Seller Review Queue Aging
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">
            {data
              ? `As of ${formatLusakaTimestamp(data.asOf)}`
              : "Counts all currently submitted seller applications."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={isInitialLoading || isRefreshing || failClosed}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {isInitialLoading ? (
        <p role="status" className="py-6 text-sm text-zinc-600">
          Loading seller review aging report...
        </p>
      ) : null}

      {!data && error ? (
        <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-medium text-rose-900">{error.message}</p>
          {error.retryEligible && !failClosed ? (
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-3">
          {error && !failClosed ? (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {error.message} Showing last confirmed snapshot.
            </div>
          ) : null}

          {data.total === 0 ? (
            <p role="status" className="text-sm text-zinc-600">
              No seller applications are currently awaiting review.
            </p>
          ) : null}

          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <th scope="col" className="py-2.5 pr-3">
                  Age Band
                </th>
                <th scope="col" className="py-2.5 text-right">
                  Applications
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="py-3 pr-3 align-top">
                    <div className="font-medium text-zinc-900">{row.label}</div>
                    <div className="text-xs text-zinc-500">{row.detail}</div>
                  </td>
                  <td className="py-3 text-right font-semibold tabular-nums text-zinc-900 align-top">
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-200 font-bold text-zinc-900">
                <th scope="row" className="py-3 pr-3">
                  Total awaiting review
                </th>
                <td className="py-3 text-right tabular-nums">{data.total}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </section>
  );
}
