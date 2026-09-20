/**
 * @file BuyerQueueFreshness.tsx
 * @module features/admin-buyers/sections
 * @description
 * Real-time freshness indicator and manual refresh action for the Admin Buyers CRM queue.
 *
 * Architectural Design:
 * - Integrates with `useAdminRealtimeStatus()` to inspect live SSE streaming state.
 * - Renders an ambient "Live" badge with an animated pulsing indicator when connected.
 * - Computes relative time since the last successful cache response from the backend.
 * - Provides an on-demand manual refetch action with spinning indicator.
 */

import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminRealtimeStatus } from "@/features/admin-shell";

export interface BuyerQueueFreshnessProps {
  dataUpdatedAt: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function BuyerQueueFreshness({ dataUpdatedAt, isRefreshing, onRefresh }: BuyerQueueFreshnessProps) {
  const realtimeStatus = useAdminRealtimeStatus();
  const isLive = realtimeStatus === "connected";
  const [timeAgo, setTimeAgo] = React.useState("Just now");

  React.useEffect(() => {
    if (!dataUpdatedAt) return;
    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000);
      if (seconds < 60) setTimeAgo("Just now");
      else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
      else setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
    }, 5000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink-soft)]">
      {isLive && (
        <div
          className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full"
          data-testid="realtime-live-badge"
        >
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          <span>Live</span>
        </div>
      )}
      {dataUpdatedAt > 0 && <span>Updated {timeAgo}</span>}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-[var(--admin-ink-soft)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)] hover:text-[var(--admin-canopy-deep)]"
        onClick={onRefresh}
        disabled={isRefreshing}
        title="Refresh list"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
        <span className="sr-only">Refresh</span>
      </Button>
    </div>
  );
}

