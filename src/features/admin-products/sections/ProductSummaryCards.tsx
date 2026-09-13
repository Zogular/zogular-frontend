/**
 * @file ProductSummaryCards.tsx
 * @module features/admin-products/sections
 * @description
 * Tactical overview count cards displaying Published, Pending Review, Changes Requested,
 * and Flagged product metrics. Styled using the tactile warm admin palette.
 */

import React from "react";
import { AlertTriangle, CheckCircle2, Package, ShieldAlert } from "lucide-react";
import type { ProductSummaryCounts } from "../types/admin-product.types";

export interface ProductSummaryCardsProps {
  summary: ProductSummaryCounts;
  isLoading?: boolean;
}

export function ProductSummaryCards({ summary, isLoading }: ProductSummaryCardsProps) {
  return (
    <div
      aria-label="Moderation queue summary metrics"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4"
    >
      <SummaryCardItem
        title="Published"
        value={summary.published}
        note="Active & visible to buyers"
        tone="canopy"
        icon={<Package className="h-5 w-5" />}
        isLoading={isLoading}
      />
      <SummaryCardItem
        title="Pending Review"
        value={summary.pending}
        note="Requires moderator decision"
        tone="amber"
        icon={<ShieldAlert className="h-5 w-5" />}
        isLoading={isLoading}
      />
      <SummaryCardItem
        title="Changes Requested"
        value={summary.changesRequested}
        note="Awaiting seller corrections"
        tone="copper"
        icon={<AlertTriangle className="h-5 w-5" />}
        isLoading={isLoading}
      />
      <SummaryCardItem
        title="Flagged Signals"
        value={summary.flagged}
        note="Content & policy notices"
        tone="ember"
        icon={<CheckCircle2 className="h-5 w-5" />}
        isLoading={isLoading}
      />
    </div>
  );
}

interface SummaryCardItemProps {
  title: string;
  value: number;
  note: string;
  tone: "canopy" | "amber" | "copper" | "ember";
  icon: React.ReactNode;
  isLoading?: boolean;
}

function SummaryCardItem({
  title,
  value,
  note,
  tone,
  icon,
  isLoading,
}: SummaryCardItemProps) {
  const toneStyles: Record<
    SummaryCardItemProps["tone"],
    { border: string; bg: string; iconBg: string; text: string; badge: string }
  > = {
    canopy: {
      border: "border-[color-mix(in_srgb,var(--admin-canopy)_35%,transparent)]",
      bg: "bg-[linear-gradient(135deg,var(--admin-surface-cream)_0%,color-mix(in_srgb,var(--admin-canopy)_8%,transparent)_100%)]",
      iconBg: "bg-[var(--admin-canopy-deep)] text-[var(--admin-surface-cream)]",
      text: "text-[var(--admin-canopy-deep)]",
      badge: "text-[var(--admin-canopy-deep)]",
    },
    amber: {
      border: "border-amber-400/40",
      bg: "bg-[linear-gradient(135deg,var(--admin-surface-cream)_0%,color-mix(in_srgb,#f59e0b_10%,transparent)_100%)]",
      iconBg: "bg-amber-600 text-white",
      text: "text-amber-900",
      badge: "text-amber-800",
    },
    copper: {
      border: "border-[color-mix(in_srgb,var(--admin-copper-muted)_45%,transparent)]",
      bg: "bg-[linear-gradient(135deg,var(--admin-surface-cream)_0%,color-mix(in_srgb,var(--admin-copper-muted)_12%,transparent)_100%)]",
      iconBg: "bg-[var(--admin-copper-muted)] text-white",
      text: "text-[var(--admin-ink)]",
      badge: "text-[var(--admin-copper-muted)]",
    },
    ember: {
      border: "border-[color-mix(in_srgb,var(--admin-ember)_40%,transparent)]",
      bg: "bg-[linear-gradient(135deg,var(--admin-surface-cream)_0%,color-mix(in_srgb,var(--admin-ember)_10%,transparent)_100%)]",
      iconBg: "bg-[var(--admin-ember)] text-white",
      text: "text-[var(--admin-ember)]",
      badge: "text-[var(--admin-ember)]",
    },
  };

  const style = toneStyles[tone];

  return (
    <div
      className={`relative min-h-[7.5rem] overflow-hidden rounded-lg border ${style.border} ${style.bg} p-3.5 shadow-[0_12px_26px_rgb(6_59_41_/_6%)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgb(6_59_41_/_10%)] md:min-h-[8.5rem] md:p-4`}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-ink-soft)]">
          {title}
        </p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${style.iconBg} shadow-sm md:h-9 md:w-9`}>
          {icon}
        </div>
      </div>
      {isLoading ? (
        <div className="h-8 w-16 animate-pulse rounded bg-[var(--admin-surface-mist)]" />
      ) : (
        <h3 className={`text-[1.65rem] font-black leading-none ${style.text} md:text-[2rem]`}>
          {value.toLocaleString()}
        </h3>
      )}
      <p className="mt-1.5 text-[10px] font-bold leading-4 text-[var(--admin-ink-soft)] md:text-[11px]">
        {note}
      </p>
    </div>
  );
}
