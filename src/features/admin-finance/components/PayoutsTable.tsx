/**
 * @file PayoutsTable.tsx
 * @module features/admin-finance/components
 * @description
 * Dense, tactile desktop table for MoMo vendor settlement review.
 * Displays store name, carrier payout rail (MTN/Airtel/Bank), account number,
 * cleared payout amount, status badge, and inspection triggers.
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
import type { AdminPayoutRecord, PayoutRail } from "../types";
import {
  PAYOUT_RAIL_LABELS,
  PAYOUT_STATUS_METADATA,
} from "../types";

interface PayoutsTableProps {
  payouts: AdminPayoutRecord[];
  loading?: boolean;
  requestError?: string | null;
  onRetry?: () => void;
  selectedPayoutId: string | null;
  onSelectPayout: (payoutId: string) => void;
  className?: string;
}

export function PayoutRailBadge({ rail }: { rail: PayoutRail }) {
  if (rail === "MTN_MOMO") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-900">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {PAYOUT_RAIL_LABELS[rail]}
      </span>
    );
  }
  if (rail === "AIRTEL_MONEY") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/50 bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-900">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
        {PAYOUT_RAIL_LABELS[rail]}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-900">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      {PAYOUT_RAIL_LABELS[rail]}
    </span>
  );
}

export function PayoutsTable({
  payouts,
  loading = false,
  requestError,
  onRetry,
  selectedPayoutId,
  onSelectPayout,
  className,
}: PayoutsTableProps) {
  return (
    <section
      aria-label="Payouts settlement table"
      className={cn(
        "overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] shadow-[0_12px_32px_rgb(6_59_41_/_6%)]",
        className
      )}
    >
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[1020px] text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-canopy-deep,#063b29)] text-[10px] font-black uppercase tracking-wider text-[var(--admin-surface-cream,#fff8ec)]">
              <th scope="col" className="px-5 py-3.5">Vendor & Merchant</th>
              <th scope="col" className="px-5 py-3.5">MoMo / Settlement Rail</th>
              <th scope="col" className="px-5 py-3.5">Destination Account</th>
              <th scope="col" className="px-5 py-3.5">Amount (ZMW)</th>
              <th scope="col" className="px-5 py-3.5">Status</th>
              <th scope="col" className="px-5 py-3.5">Requested At</th>
              <th scope="col" className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_15%,transparent)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`payout-skel-${i}`} className="animate-pulse">
                  <td colSpan={7} className="px-5 py-4">
                    <div className="h-6 w-full rounded bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_6%,transparent)]" />
                  </td>
                </tr>
              ))
            ) : requestError ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-rose-700">
                  <p className="font-bold text-xs">{requestError}</p>
                  {onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                      className="mt-2 text-xs"
                    >
                      Retry Payouts Load
                    </Button>
                  )}
                </td>
              </tr>
            ) : payouts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                  <Wallet className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                  <p className="font-bold text-sm text-zinc-700">No payout requests in this queue</p>
                  <p className="text-xs text-zinc-500">
                    Vendor disbursements submitted by sellers will appear here for review.
                  </p>
                </td>
              </tr>
            ) : (
              payouts.map((payout) => {
                const isSelected = selectedPayoutId === payout.id;
                const meta = PAYOUT_STATUS_METADATA[payout.status];

                return (
                  <tr
                    key={payout.id}
                    onClick={() => onSelectPayout(payout.id)}
                    className={cn(
                      "cursor-pointer transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_4%,transparent)]",
                      isSelected && "bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_8%,transparent)]"
                    )}
                  >
                    {/* Vendor & Merchant */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-[var(--admin-canopy,#075b36)] shrink-0" />
                        <div>
                          <p className="font-black text-xs text-zinc-950">{payout.storeName}</p>
                          <p className="text-[11px] font-medium text-zinc-600">{payout.ownerName}</p>
                        </div>
                      </div>
                    </td>

                    {/* Rail */}
                    <td className="px-5 py-4">
                      <PayoutRailBadge rail={payout.payoutRail} />
                    </td>

                    {/* Account */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-900">
                        <Phone className="h-3.5 w-3.5 text-zinc-500" />
                        {payout.accountNumber}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-4">
                      <div>
                        <span className="font-black text-sm text-zinc-950">
                          {formatAdminCurrency(payout.clearedAmount)}
                        </span>
                        {payout.pendingEscrowAmount > 0 && (
                          <p className="text-[10px] font-medium text-amber-700">
                            +{formatAdminCurrency(payout.pendingEscrowAmount)} escrow
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <AdminStatusBadge tone={meta.tone}>
                        {meta.label}
                      </AdminStatusBadge>
                    </td>

                    {/* Timeline */}
                    <td className="px-5 py-4">
                      <span className="text-[11px] font-medium text-zinc-600">
                        {formatAdminDateTime(payout.requestedAt)}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPayout(payout.id);
                        }}
                        className="h-8 gap-1 rounded-lg px-2.5 text-xs font-bold text-[var(--admin-canopy,#075b36)] hover:bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_12%,transparent)]"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
