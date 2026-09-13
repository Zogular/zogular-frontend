/**
 * @file PayoutsMobileCards.tsx
 * @module features/admin-finance/components
 * @description
 * Mobile-first card presentation (<1024px) for MoMo vendor settlement queue.
 * Provides touch-friendly cards with carrier badges, account numbers, and inspect buttons.
 */

import React from "react";
import {
  ExternalLink,
  Phone,
  Store,
  Wallet,
} from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import {
  formatAdminCurrency,
  formatAdminDateTime,
} from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type { AdminPayoutRecord } from "../types";
import { PAYOUT_STATUS_METADATA } from "../types";
import { PayoutRailBadge } from "./PayoutsTable";

interface PayoutsMobileCardsProps {
  payouts: AdminPayoutRecord[];
  loading?: boolean;
  requestError?: string | null;
  onRetry?: () => void;
  selectedPayoutId: string | null;
  onSelectPayout: (payoutId: string) => void;
  className?: string;
}

export function PayoutsMobileCards({
  payouts,
  loading = false,
  requestError,
  onRetry,
  selectedPayoutId,
  onSelectPayout,
  className,
}: PayoutsMobileCardsProps) {
  if (loading) {
    return (
      <div className={cn("grid gap-3 lg:hidden", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`payout-card-skel-${i}`}
            className="h-44 animate-pulse rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_20%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm"
          />
        ))}
      </div>
    );
  }

  if (requestError) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm lg:hidden",
          className
        )}
      >
        <p className="text-sm font-bold text-rose-800">{requestError}</p>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-3 text-xs"
          >
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-8 text-center shadow-sm lg:hidden",
          className
        )}
      >
        <Wallet className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
        <p className="text-sm font-bold text-zinc-700">No payouts in this queue</p>
        <p className="mt-1 text-xs text-zinc-500">
          Seller requests will appear here once submitted.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3 lg:hidden", className)}>
      {payouts.map((payout) => {
        const isSelected = selectedPayoutId === payout.id;
        const meta = PAYOUT_STATUS_METADATA[payout.status];

        return (
          <article
            key={payout.id}
            onClick={() => onSelectPayout(payout.id)}
            className={cn(
              "cursor-pointer rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm transition-all active:scale-[0.99]",
              isSelected && "ring-2 ring-[var(--admin-canopy,#075b36)]"
            )}
          >
            {/* Header: Store Name & Status Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Store className="h-4 w-4 text-[var(--admin-canopy,#075b36)] shrink-0" />
                <div className="truncate">
                  <h3 className="text-sm font-black text-zinc-950 truncate">{payout.storeName}</h3>
                  <p className="text-xs text-zinc-500 truncate">{payout.ownerName}</p>
                </div>
              </div>
              <AdminStatusBadge tone={meta.tone} className="shrink-0">
                {meta.label}
              </AdminStatusBadge>
            </div>

            {/* Middle: Rail and Phone */}
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-y border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_15%,transparent)] py-2.5 text-xs">
              <PayoutRailBadge rail={payout.payoutRail} />
              <div className="flex items-center gap-1 font-mono font-bold text-zinc-800">
                <Phone className="h-3 w-3 text-zinc-400" />
                {payout.accountNumber}
              </div>
            </div>

            {/* Bottom: Cleared Amount and Inspect Button */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase text-zinc-500 block">Cleared Settlement</span>
                <span className="text-base font-black text-zinc-950">
                  {formatAdminCurrency(payout.clearedAmount)}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPayout(payout.id);
                }}
                className="h-8 gap-1 rounded-xl bg-[var(--admin-canopy-deep,#063b29)] px-3 text-xs font-bold text-white hover:bg-[var(--admin-canopy,#075b36)]"
              >
                <span>Inspect</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>

            <div className="mt-2 text-right">
              <span className="text-[10px] font-medium text-zinc-600">
                {formatAdminDateTime(payout.requestedAt)}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
