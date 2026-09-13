/**
 * @file SupportQueueTabs.tsx
 * @module features/admin-support/components
 * @description
 * Tactile queue navigation tabs for the Support Operations Center.
 * Features live operational badges, smooth transitions, and warm surface styling.
 */

import React from "react";
import { AlertCircle, CheckCircle2, Inbox, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SUPPORT_QUEUE_TABS,
  type SupportQueueTabKey,
} from "../types";

interface SupportQueueTabsProps {
  activeTab: SupportQueueTabKey;
  onTabChange: (tab: SupportQueueTabKey) => void;
  tabCounts?: Record<SupportQueueTabKey, number | null>;
  className?: string;
}

const TAB_ICONS: Record<
  SupportQueueTabKey,
  React.ComponentType<{ className?: string }>
> = {
  needs_action: AlertCircle,
  waiting_seller: RotateCcw,
  resolved_closed: CheckCircle2,
  all: Inbox,
};

export function SupportQueueTabs({
  activeTab,
  onTabChange,
  tabCounts,
  className,
}: SupportQueueTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Support ticket queue lifecycle tabs"
      className={cn(
        "flex w-full items-center gap-1.5 overflow-x-auto rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] p-1.5 shadow-[0_4px_16px_rgb(6_59_41_/_4%)] scrollbar-none",
        className
      )}
    >
      {SUPPORT_QUEUE_TABS.map((tab) => {
        const Icon = TAB_ICONS[tab.key];
        const isActive = activeTab === tab.key;
        const count = tabCounts ? tabCounts[tab.key] : null;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`support-panel-${tab.key}`}
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
                  : "text-[var(--admin-ink-soft,#5f625a)] group-hover:text-[var(--admin-canopy-deep,#063b29)]"
              )}
            />
            <span>{tab.label}</span>
            {typeof count === "number" ? (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-black transition-colors",
                  isActive
                    ? "bg-white/20 text-[var(--admin-surface-cream,#fff8ec)]"
                    : "bg-zinc-200/80 text-zinc-700 group-hover:bg-[var(--admin-canopy,#075b36)]/15 group-hover:text-[var(--admin-canopy-deep,#063b29)]"
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
