/**
 * @file SellerQueueFreshness.tsx
 * @module features/admin-sellers/sections
 * @description
 * Queue freshness indicator and on-demand cache refresh action for the Seller Review Queue.
 *
 * Architectural Design:
 * - Subscribes to `useAdminRealtimeStatus()` to reflect real-time SSE stream connectivity.
 * - Displays a live pulsing emerald badge when the admin event stream is actively connected.
 * - Tracks relative cache timestamp age ("Just now", "Xm ago", "Xh ago") via interval timer.
 * - Provides an on-demand manual refetch button with spinning feedback during network fetches.
 */

import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminRealtimeStatus } from "@/features/admin-shell";

interface SellerQueueFreshnessProps {
  dataUpdatedAt: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function SellerQueueFreshness({ dataUpdatedAt, isRefreshing, onRefresh }: SellerQueueFreshnessProps) {
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
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
        className="h-8 w-8"
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

