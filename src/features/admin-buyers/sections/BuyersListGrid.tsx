"use client";

/**
 * @file BuyersListGrid.tsx
 * @module features/admin-buyers/sections
 * @description
 * Responsive card grid layout displaying customer accounts with contact details,
 * verification badges, and direct profile inspection action triggers, styled with
 * the Zogular warm admin aesthetic palette.
 */

import { CheckCircle2, Eye, Mail, Phone, User, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatAdminDate } from "@/lib/admin-format";
import type { AdminBuyerRecord } from "../types/admin-buyer.types";

export interface BuyersListGridProps {
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

export function BuyersListGrid({ buyers, onSelectBuyer, isFetching = false }: BuyersListGridProps) {
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
    <section
      aria-label="Buyer directory"
      aria-busy={isFetching}
      className="relative"
    >
      {isFetching ? (
        <div className="absolute inset-x-0 -top-2 z-10 h-1 overflow-hidden rounded bg-[color-mix(in_srgb,var(--admin-canopy)_14%,transparent)]" aria-hidden="true">
          <div className="h-full w-1/3 bg-[var(--admin-ember)]" />
        </div>
      ) : null}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-150 ${isFetching ? "opacity-75" : "opacity-100"}`}>
      {buyers.map((buyer) => {
        const fullName = [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") || "Unnamed Customer";
        return (
          <div
            key={buyer.id}
            className="flex flex-col justify-between rounded-lg border border-[color-mix(in_srgb,var(--admin-copper-muted)_34%,transparent)] bg-[var(--admin-surface-cream)] p-5 shadow-sm transition-all hover:border-[color-mix(in_srgb,var(--admin-copper-muted)_50%,transparent)]"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--admin-surface-mist)] text-[var(--admin-canopy-deep)]">
                  <User className="size-5" />
                </div>
                <div className="flex items-center gap-1.5">
                  {renderSegmentBadge(buyer.segment)}
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      buyer.isActive
                        ? "border-emerald-600/30 bg-emerald-50 text-emerald-800"
                        : "border-rose-600/30 bg-rose-50 text-rose-800"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${buyer.isActive ? "bg-emerald-600" : "bg-rose-600"}`}
                    />
                    {buyer.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <h3 className="text-base font-black text-[var(--admin-canopy-deep)]">{fullName}</h3>
                <div className="mt-1 space-y-0.5 text-xs font-semibold text-[var(--admin-ink)]">
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail className="size-3.5 shrink-0 text-[var(--admin-ink-soft)]" />
                    <span className="truncate">{buyer.email ?? "No email"}</span>
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <Phone className="size-3.5 shrink-0 text-[var(--admin-ink-soft)]" />
                    <span className="text-[var(--admin-ink-soft)]">{buyer.telephone ?? "No phone"}</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                    buyer.emailVerified
                      ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                      : "border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-mist)] text-[var(--admin-ink-soft)]"
                  }`}
                >
                  {buyer.emailVerified ? (
                    <CheckCircle2 className="size-3 text-emerald-600" />
                  ) : (
                    <XCircle className="size-3 text-[var(--admin-ink-soft)]" />
                  )}
                  Email Verified
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                    buyer.phoneVerified || buyer.phoneVerifiedAt
                      ? "border border-sky-600/30 bg-sky-50 text-sky-800"
                      : "border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-mist)] text-[var(--admin-ink-soft)]"
                  }`}
                >
                  {buyer.phoneVerified || buyer.phoneVerifiedAt ? (
                    <CheckCircle2 className="size-3 text-sky-600" />
                  ) : (
                    <XCircle className="size-3 text-[var(--admin-ink-soft)]" />
                  )}
                  Phone Verified
                </span>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] pt-3">
              <span className="text-[11px] font-semibold text-[var(--admin-ink-soft)]" suppressHydrationWarning>
                Joined {formatAdminDate(buyer.createdAt)}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => onSelectBuyer(buyer)}
                className="h-8 rounded-md bg-[var(--admin-canopy-deep)] px-3 text-xs font-black text-[var(--admin-surface-cream)] hover:bg-[var(--admin-canopy)]"
              >
                <Eye className="mr-1.5 size-3.5" />
                View Profile
              </Button>
            </div>
          </div>
        );
      })}
      </div>
    </section>
  );
}
