"use client";

/**
 * @file useAdminRealtime.ts
 * @module features/admin-platform/hooks
 * @description
 * Enterprise Real-Time Server-Sent Events (SSE) consumer for Zogular Admin Platform.
 *
 * Architectural Design:
 * - Subscribes to the backend administrative event stream at `/api/backend/admin/events/stream`.
 * - Maintains a resilient connection status lifecycle: "connected" | "connecting" | "disconnected".
 * - Utilizes native browser EventSource which intrinsically implements reconnection with backoff.
 * - Bridges real-time broadcast events directly into TanStack Query cache invalidations:
 *     - "admin:seller:created" / "admin:seller:updated" -> invalidates ["seller-list"], ["admin", "overview"], ["admin-dashboard-overview"]
 *     - "admin:buyer:updated" / "admin:buyer:created"   -> invalidates ["admin", "buyers"], ["admin", "overview"], ["admin-dashboard-overview"]
 *     - "admin:order:created" / "admin:order:updated"   -> invalidates ["admin", "orders"], ["admin", "overview"], ["admin-dashboard-overview"]
 * - Provides both an imperative hook (`useAdminRealtime`), a context provider (`AdminRealtimeProvider`),
 *   and lightweight status consumers (`useAdminRealtimeStatus`, `useAdminRealtimeConnection`)
 *   for freshness badges and operational UI indicators.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const ADMIN_REALTIME_STREAM_ENDPOINT = "/api/backend/admin/events/stream" as const;

export type AdminRealtimeStatus = "connected" | "connecting" | "disconnected";

export interface AdminRealtimeState {
  status: AdminRealtimeStatus;
  isConnected: boolean;
}

export const AdminRealtimeContext = createContext<AdminRealtimeState>({
  status: "disconnected",
  isConnected: false,
});

/**
 * Custom hook to establish and manage the SSE connection lifecycle,
 * invalidating relevant TanStack Query caches whenever domain events arrive.
 */
export function useAdminRealtime(): AdminRealtimeState {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AdminRealtimeStatus>(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return "disconnected";
    }
    return "connecting";
  });

  useEffect(() => {
    // Guard against SSR execution or environments without EventSource support
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    // Initialize native EventSource with credentials forwarding for authenticated proxy session
    const eventSource = new EventSource(ADMIN_REALTIME_STREAM_ENDPOINT, {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      setStatus("connected");
    };

    eventSource.onerror = () => {
      // Upon transport error or connection drop, mark as disconnected.
      // Native browser EventSource will automatically attempt to reconnect with backoff.
      setStatus("disconnected");
    };

    // Cache invalidation handlers mapped to domain entities
    const handleSellerEvent = () => {
      void queryClient.invalidateQueries({ queryKey: ["seller-list"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-overview"] });
    };

    const handleBuyerEvent = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "buyers"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-overview"] });
    };

    const handleOrderEvent = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-overview"] });
    };

    const handleProductEvent = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-overview"] });
    };

    // Register typed domain event listeners
    eventSource.addEventListener("admin:seller:created", handleSellerEvent);
    eventSource.addEventListener("admin:seller:updated", handleSellerEvent);
    eventSource.addEventListener("admin:buyer:updated", handleBuyerEvent);
    eventSource.addEventListener("admin:buyer:created", handleBuyerEvent);
    eventSource.addEventListener("admin:order:created", handleOrderEvent);
    eventSource.addEventListener("admin:order:updated", handleOrderEvent);
    eventSource.addEventListener("admin:product:updated", handleProductEvent);

    // Defensive fallback: handle generic message events containing structured payloads
    const handleGenericMessage = (event: MessageEvent) => {
      try {
        if (!event.data) return;
        const data = JSON.parse(event.data);
        const eventName = data.event || data.type;
        if (eventName === "admin:seller:created" || eventName === "admin:seller:updated") {
          handleSellerEvent();
        } else if (eventName === "admin:buyer:updated" || eventName === "admin:buyer:created") {
          handleBuyerEvent();
        } else if (eventName === "admin:order:created" || eventName === "admin:order:updated") {
          handleOrderEvent();
        } else if (eventName === "admin:product:updated") {
          handleProductEvent();
        }
      } catch {
        // Heartbeats or ping comments from SSE servers are safely ignored
      }
    };

    eventSource.addEventListener("message", handleGenericMessage);

    return () => {
      eventSource.removeEventListener("admin:seller:created", handleSellerEvent);
      eventSource.removeEventListener("admin:seller:updated", handleSellerEvent);
      eventSource.removeEventListener("admin:buyer:updated", handleBuyerEvent);
      eventSource.removeEventListener("admin:buyer:created", handleBuyerEvent);
      eventSource.removeEventListener("admin:order:created", handleOrderEvent);
      eventSource.removeEventListener("admin:order:updated", handleOrderEvent);
      eventSource.removeEventListener("admin:product:updated", handleProductEvent);
      eventSource.removeEventListener("message", handleGenericMessage);
      eventSource.close();
      setStatus("disconnected");
    };
  }, [queryClient]);

  return {
    status,
    isConnected: status === "connected",
  };
}

/**
 * Real-time context provider component wrapping the admin workspace subtree.
 */
export function AdminRealtimeProvider({ children }: { children: React.ReactNode }) {
  const realtime = useAdminRealtime();

  return React.createElement(AdminRealtimeContext.Provider, { value: realtime }, children);
}


/**
 * Accesses current real-time stream status ("connected" | "connecting" | "disconnected").
 * UI components such as Queue Freshness badges can invoke this to display live connectivity.
 */
export function useAdminRealtimeStatus(): AdminRealtimeStatus {
  const context = useContext(AdminRealtimeContext);
  return context?.status ?? "disconnected";
}

/**
 * Accesses both status and boolean convenience flag `isConnected`.
 */
export function useAdminRealtimeConnection(): AdminRealtimeState {
  const context = useContext(AdminRealtimeContext);
  return context ?? { status: "disconnected", isConnected: false };
}
