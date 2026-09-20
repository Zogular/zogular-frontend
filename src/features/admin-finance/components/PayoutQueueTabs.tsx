/**
 * @file PayoutQueueTabs.tsx
 * @module features/admin-finance/components
 * @description
 * Tactile navigation tabs for the MoMo Payout settlement queue.
 * Allows filtering across All Payouts, Needs Action / Pending, Processing, Completed,
 * and Exceptions / Rejected with live badge counts and human-crafted warm surface styling.
 */

import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PAYOUT_QUEUE_TABS, type PayoutQueueTabKey } from "../types";

interface PayoutQueueTabsProps {
  activeTab: PayoutQueueTabKey;
  onTabChange: (tab: PayoutQueueTabKey) => void;
  tabCounts?: Record<PayoutQueueTabKey, number | null>;
  className?: string;
}

const TAB_ICONS: Record<PayoutQueueTabKey, React.ComponentType<{ className?: string }>> = {
  all: Inbox,
  needs_action: AlertCircle,
  processing: RefreshCw,
  completed: CheckCircle2,
  exceptions: AlertTriangle,
};

export function PayoutQueueTabs({
  activeTab,
  onTabChange,
  tabCounts,
  className,
}: PayoutQueueTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Payout queue settlement tabs"
      className={cn(
        "flex w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-1.5 shadow-[0_4px_16px_rgb(6_59_41_/_4%)] scrollbar-none",
        className
      )}
    >
      {PAYOUT_QUEUE_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab.key];
        const isActive = activeTab === tab.key;
        const count = tabCounts ? tabCounts[tab.key] : null;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`payout-panel-${tab.key}`}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "group relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-canopy,#075b36)]",
              isActive
                ? "bg-[var(--admin-canopy-deep,#063b29)] text-[var(--admin-surface-cream,#fff8ec)] shadow-sm"
                : "text-[var(--admin-ink-soft,#5f625a)] hover:bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_8%,transparent)] hover:text-[var(--admin-canopy-deep,#063b29)]"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                isActive
                  ? "text-[var(--admin-surface-cream,#fff8ec)]"
                  : "text-[var(--admin-ink-soft,#5f625a)] group-hover:text-[var(--admin-canopy-deep,#063b29)]",
                tab.key === "processing" && isActive ? "animate-spin" : ""
              )}
            />
            <span>{tab.label}</span>
            {typeof count === "number" ? (
              <span
                className={cn(
                  "ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black transition-colors",
                  isActive
                    ? "bg-[color-mix(in_srgb,var(--admin-surface-cream,#fff8ec)_20%,transparent)] text-[var(--admin-surface-cream,#fff8ec)]"
                    : tab.key === "needs_action" && count > 0
                    ? "bg-amber-100 text-amber-900 border border-amber-300/60"
                    : tab.key === "exceptions" && count > 0
                    ? "bg-rose-100 text-rose-800 border border-rose-300/60"
                    : "bg-zinc-100 text-zinc-600 border border-zinc-200/80"
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
