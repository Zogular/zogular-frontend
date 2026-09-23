"use client";

/**
 * @file useAdminRealtime.ts
 * @module features/admin-shell/hooks
 * @description
 * Administrative Real-Time compatibility layer for Zogular Admin Platform.
 *
 * Architectural Design:
 * - Preserves the public real-time interface (`useAdminRealtime`, `AdminRealtimeProvider`,
 *   `useAdminRealtimeStatus`, `useAdminRealtimeConnection`) as compatibility APIs.
 * - The backend currently has no `/admin/events/stream` endpoint implemented and no active SSE stream exists.
 * - To prevent wasteful reconnection loops, network error noise, and unverified server load,
 *   no active `EventSource` connection or WebSocket is initiated.
 * - Runtime state remains truthfully "disconnected" (`isConnected: false`).
 * - Operational query freshness and cache invalidation are owned deterministically by the
 *   Admin Data Refresh Policy (`useAdminRefreshPolicy`) on wired surfaces (Overview).
 */

import React, { createContext, useContext } from "react";

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
 * Custom hook to establish and manage the realtime compatibility lifecycle.
 *
 * Truthfully reports "disconnected" without network requests, SSE streams, or WebSockets.
 */
export function useAdminRealtime(): AdminRealtimeState {
  return {
    status: "disconnected",
    isConnected: false,
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
 * Accesses current real-time status ("connected" | "connecting" | "disconnected").
 * UI components such as Queue Freshness badges can invoke this to display connectivity.
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
