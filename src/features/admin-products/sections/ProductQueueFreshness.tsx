/**
 * @file ProductQueueFreshness.tsx
 * @module features/admin-products/sections
 * @description
 * Real-time SSE freshness indicator and on-demand queue refresh trigger for the
 * Admin Product Moderation Queue.
 */

import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminRealtimeStatus } from "@/features/admin-shell";

export interface ProductQueueFreshnessProps {
  dataUpdatedAt: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function ProductQueueFreshness({
  dataUpdatedAt,
  isRefreshing,
  onRefresh,
}: ProductQueueFreshnessProps) {
  const realtimeStatus = useAdminRealtimeStatus();
  const isLive = realtimeStatus === "connected";
  const [timeAgo, setTimeAgo] = useState("Just now");

  useEffect(() => {
    if (!dataUpdatedAt) return;
    const update = () => {
      const seconds = Math.floor((Date.now() - dataUpdatedAt) / 1000);
      if (seconds < 60) setTimeAgo("Just now");
      else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
      else setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
    };

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--admin-ink-soft)]">
      {isLive && (
        <div
          className="flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800"
          data-testid="realtime-live-badge"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
          <span>Live</span>
        </div>
      )}

      {dataUpdatedAt > 0 && <span>Updated {timeAgo}</span>}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-[var(--admin-ink-soft)] hover:bg-[color-mix(in_srgb,var(--admin-canopy)_8%,transparent)] hover:text-[var(--admin-canopy-deep)]"
        onClick={onRefresh}
        disabled={isRefreshing}
        title="Refresh queue"
      >
        <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        <span className="sr-only">Refresh queue</span>
      </Button>
    </div>
  );
}
