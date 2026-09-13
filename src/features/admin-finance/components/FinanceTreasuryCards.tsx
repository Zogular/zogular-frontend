/**
 * @file FinanceTreasuryCards.tsx
 * @module features/admin-finance/components
 * @description
 * High-signal platform treasury KPI metric strip.
 * Displays Total Escrow Held, Net Platform Revenue, Pending Disbursements,
 * and COD Cash Settled using warm tactile styling and AdminMetricCard.
 */

import React from "react";
import {
  Banknote,
  Coins,
  HandCoins,
  ShieldCheck,
} from "lucide-react";
import { AdminMetricCard } from "@/components/admin/AdminPrimitives";
import { formatAdminCurrency } from "@/lib/admin-format";
import type { TreasuryMetrics } from "../types";

interface FinanceTreasuryCardsProps {
  metrics: TreasuryMetrics;
  loading?: boolean;
}

export function FinanceTreasuryCards({
  metrics,
  loading = false,
}: FinanceTreasuryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`treasury-skeleton-${i}`}
            className="h-28 animate-pulse rounded-2xl sm:rounded-3xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_20%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-4 shadow-sm"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {/* Card 1: Total Escrow Held */}
      <AdminMetricCard
        title="Total Escrow Held"
        value={formatAdminCurrency(metrics.totalEscrowHeld)}
        note="72h post-delivery window"
        icon={<ShieldCheck />}
        tone="amber"
      />

      {/* Card 2: Net Platform Revenue */}
      <AdminMetricCard
        title="Net Platform Revenue"
        value={formatAdminCurrency(metrics.netCommissionEarned)}
        note="10% category commission"
        icon={<Coins />}
        tone="emerald"
      />

      {/* Card 3: Pending Disbursements */}
      <AdminMetricCard
        title="Pending Disbursements"
        value={formatAdminCurrency(metrics.pendingDisbursements)}
        note="Cleared vendor payouts"
        icon={<HandCoins />}
        tone="sky"
      />

      {/* Card 4: COD Cash Settled */}
      <AdminMetricCard
        title="COD Cash Settled"
        value={formatAdminCurrency(metrics.collectedCodTotal)}
        note="Direct courier collections"
        icon={<Banknote />}
        tone="zinc"
      />
    </div>
  );
}
