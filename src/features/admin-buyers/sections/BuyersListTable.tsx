"use client";

/**
 * @file BuyersListTable.tsx
 * @module features/admin-buyers/sections
 * @description
 * Tabular layout and mobile card list presenting buyer records, verification badges,
 * active status pill indicators, and profile inspection trigger actions, styled with
 * the Zogular warm admin aesthetic palette.
 */

import { CheckCircle2, Eye, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAdminDate } from "@/lib/admin-format";
import type { AdminBuyerRecord } from "../types/admin-buyer.types";

export interface BuyersListTableProps {
  buyers: AdminBuyerRecord[];
  onSelectBuyer: (buyer: AdminBuyerRecord) => void;
  isFetching?: boolean;
}

function renderSegmentBadge(segment?: string) {
  if (!segment) return null;
  const s = segment.toUpperCase();
  if (s === "VIP") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-200">
        <span className="size-1 rounded-full bg-amber-400" />
        VIP
      </span>
    );
  }
  if (s === "ACTIVE_SHOPPER") {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-950/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-200">
        <span className="size-1 rounded-full bg-emerald-400" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-950/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-200">
      <span className="size-1 rounded-full bg-sky-400" />
      New
    </span>
  );
}

export function BuyersListTable({ buyers, onSelectBuyer, isFetching = false }: BuyersListTableProps) {
  if (buyers.length === 0) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-[color-mix(in_srgb,var(--admin-copper-muted)_40%,transparent)] bg-[var(--admin-surface-cream)] p-6 text-center shadow-[inset_0_2px_12px_rgb(6_59_41_/_2%)]">
        <Users className="mb-4 size-10 text-[var(--admin-copper-muted)]" />
        <h3 className="text-sm font-black text-[var(--admin-ink)]">No customers found</h3>
        <p className="mt-1 max-w-sm text-sm font-semibold text-[var(--admin-ink-soft)]">
          No customer accounts match your active search or filter criteria.
        </p>
      </div>
    );
  }

  return (
    <div
      aria-label="Buyer directory"
      aria-busy={isFetching}
      className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] shadow-[0_16px_34px_rgb(6_59_41_/_7%)]"
    >
      {isFetching ? (
        <div className="absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-[color-mix(in_srgb,var(--admin-canopy)_14%,transparent)]" aria-hidden="true">
          <div className="h-full w-1/3 bg-[var(--admin-ember)]" />
        </div>
      ) : null}
      {/* Desktop Table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-canopy-deep)] text-[10px] font-black uppercase text-[var(--admin-surface-mist)]">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Verifications</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] text-xs text-[var(--admin-ink)]">
            {buyers.map((buyer) => {
              const fullName = [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") || "Unnamed Customer";
              return (
                <tr
                  key={buyer.id}
                  onClick={() => onSelectBuyer(buyer)}
                  className="cursor-pointer transition-colors hover:bg-[var(--admin-surface-mist)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-black text-[var(--admin-canopy-deep)]">{fullName}</p>
                      {renderSegmentBadge(buyer.segment)}
                    </div>
                    <p className="text-xs font-semibold text-[var(--admin-ink-soft)]">{buyer.telephone ?? "No phone on file"}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--admin-ink)]">{buyer.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          buyer.emailVerified
                            ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                            : "border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-mist)] text-[var(--admin-ink-soft)]"
                        }`}
                      >
                        {buyer.emailVerified ? (
                          <>
                            <CheckCircle2 className="size-3 text-emerald-600" />
                            <span>Email</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="size-3 text-[var(--admin-ink-soft)]" />
                            <span>Email</span>
                          </>
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          buyer.phoneVerified || buyer.phoneVerifiedAt
                            ? "border border-sky-600/30 bg-sky-50 text-sky-800"
                            : "border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-mist)] text-[var(--admin-ink-soft)]"
                        }`}
                      >
                        {buyer.phoneVerified || buyer.phoneVerifiedAt ? (
                          <>
                            <CheckCircle2 className="size-3 text-sky-600" />
                            <span>Phone</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="size-3 text-[var(--admin-ink-soft)]" />
                            <span>Phone</span>
                          </>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                        buyer.isActive
                          ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                          : "border border-rose-600/30 bg-rose-50 text-rose-800"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${buyer.isActive ? "bg-emerald-600" : "bg-rose-600"}`}
                      />
                      {buyer.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[var(--admin-ink-soft)]" suppressHydrationWarning>
                    {formatAdminDate(buyer.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectBuyer(buyer);
                      }}
                      className="h-8 rounded-md border-[color-mix(in_srgb,var(--admin-canopy)_30%,transparent)] bg-[var(--admin-surface-mist)] px-3 font-black text-[var(--admin-canopy-deep)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_10%,var(--admin-surface-mist))]"
                    >
                      <Eye className="mr-1.5 size-3.5" />
                      View Profile
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Compact Mobile Layout */}
      <div className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] md:hidden">
        {buyers.map((buyer) => {
          const fullName = [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") || "Unnamed Customer";
          return (
            <article
              key={buyer.id}
              onClick={() => onSelectBuyer(buyer)}
              className="cursor-pointer bg-[var(--admin-surface-cream)] p-4 transition-colors hover:bg-[var(--admin-surface-mist)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-[var(--admin-canopy-deep)]">{fullName}</p>
                    {renderSegmentBadge(buyer.segment)}
                  </div>
                  <p className="truncate text-xs font-semibold text-[var(--admin-ink)]">{buyer.email ?? "No email"}</p>
                  <p className="text-xs font-medium text-[var(--admin-ink-soft)]">{buyer.telephone ?? "No phone"}</p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    buyer.isActive
                      ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                      : "border border-rose-600/30 bg-rose-50 text-rose-800"
                  }`}
                >
                  {buyer.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] pt-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                      buyer.emailVerified
                        ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                        : "border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-mist)] text-[var(--admin-ink-soft)]"
                    }`}
                  >
                    {buyer.emailVerified ? "✓ Email" : "✗ Email"}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                      buyer.phoneVerified || buyer.phoneVerifiedAt
                        ? "border border-sky-600/30 bg-sky-50 text-sky-800"
                        : "border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-mist)] text-[var(--admin-ink-soft)]"
                    }`}
                  >
                    {buyer.phoneVerified || buyer.phoneVerifiedAt ? "✓ Phone" : "✗ Phone"}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-[var(--admin-ink-soft)]" suppressHydrationWarning>
                  Joined {formatAdminDate(buyer.createdAt)}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
