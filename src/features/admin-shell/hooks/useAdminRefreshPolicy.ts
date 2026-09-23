"use client";

/**
 * @file useAdminRefreshPolicy.ts
 * @module features/admin-shell/hooks
 * @description
 * Shared administrative data refresh policy hook and local preference store.
 *
 * Architectural Design:
 * - Provides centralized refresh configuration for Admin Overview and administrative queues.
 * - Supports three configurable intervals: 60s (Every minute), 300s (Every 5 minutes, default), and 0 (Manual only).
 *   30-second polling is removed.
 * - Auto-refresh executes ONLY while the page is open and visible (`document.visibilityState === "visible"`).
 * - Hidden tabs ALWAYS pause periodic polling (`pauseWhenHidden` is strictly non-negotiable platform protection).
 * - Legacy storage records containing `pauseWhenHidden: false` or unsupported intervals (like 30s) are safely normalized.
 * - Faster checks explicitly inform operators that they consume more database activity.
 * - Preferences are strictly browser-local (stored in `localStorage` without backend persistence).
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type AdminRefreshInterval = 60_000 | 300_000 | 0;

export interface AdminRefreshSettings {
  /** Whether periodic auto-refresh is globally enabled for the session */
  autoRefreshEnabled: boolean;
  /** Milliseconds between background queries; 0 represents manual refresh only */
  intervalMs: AdminRefreshInterval;
  /** Immediately halt query timers when the browser tab loses visibility (strictly true) */
  pauseWhenHidden: true;
  /** Trigger a fresh background fetch immediately upon navigating into a dashboard route */
  refreshOnNavigation: boolean;
}

export const DEFAULT_ADMIN_REFRESH_SETTINGS: AdminRefreshSettings = {
  autoRefreshEnabled: true,
  intervalMs: 300_000,
  pauseWhenHidden: true,
  refreshOnNavigation: true,
};

export const ADMIN_REFRESH_STORAGE_KEY = "zogular_admin_refresh_settings_v1" as const;
export const ADMIN_REFRESH_EVENT_NAME = "zogular:admin-refresh-settings-changed" as const;

export const ADMIN_REFRESH_INTERVAL_OPTIONS: ReadonlyArray<{
  value: AdminRefreshInterval;
  label: string;
  description: string;
}> = [
  { value: 60_000, label: "Every minute", description: "Frequent checks (uses more database activity)" },
  { value: 300_000, label: "Every 5 minutes (Default)", description: "Balanced background check" },
  { value: 0, label: "Manual only", description: "Refresh only when clicked" },
] as const;

function isAllowedInterval(val: unknown): val is AdminRefreshInterval {
  return val === 60_000 || val === 300_000 || val === 0;
}

/**
 * Safely parses persisted settings from a serialized JSON string with fallback to defaults.
 * Guarantees that pauseWhenHidden is always true and interval is the canonical mode:
 * - intervalMs === 0 -> Manual only (autoRefreshEnabled is derived as false)
 * - intervalMs > 0   -> Auto-refresh active (autoRefreshEnabled is derived as true)
 * - legacy autoRefreshEnabled: false with nonzero interval normalizes to 0 (Manual only)
 */
export function parseAdminRefreshSettings(raw: string | null): AdminRefreshSettings {
  if (!raw) return DEFAULT_ADMIN_REFRESH_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<AdminRefreshSettings>;
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_ADMIN_REFRESH_SETTINGS;
    }

    let intervalMs: AdminRefreshInterval = DEFAULT_ADMIN_REFRESH_SETTINGS.intervalMs;
    if (isAllowedInterval(parsed.intervalMs)) {
      intervalMs = parsed.intervalMs;
    }

    // Normalize legacy contradictory storage: if autoRefreshEnabled was explicitly false, normalize interval to 0 (Manual only)
    if (parsed.autoRefreshEnabled === false) {
      intervalMs = 0;
    }

    return {
      autoRefreshEnabled: intervalMs !== 0,
      intervalMs,
      // Strictly enforced: hidden tabs always pause periodic polling
      pauseWhenHidden: true,
      refreshOnNavigation:
        typeof parsed.refreshOnNavigation === "boolean"
          ? parsed.refreshOnNavigation
          : DEFAULT_ADMIN_REFRESH_SETTINGS.refreshOnNavigation,
    };
  } catch {
    return DEFAULT_ADMIN_REFRESH_SETTINGS;
  }
}

/**
 * Returns the human-readable refresh status text reflecting the active policy and visibility state.
 */
export function getAdminRefreshStatusText(params: {
  settings: AdminRefreshSettings;
  isTabHidden: boolean;
  isPollingPaused: boolean;
}): string {
  const { settings, isPollingPaused } = params;

  // Manual only takes precedence as the deliberate canonical mode
  if (settings.intervalMs === 0 || !settings.autoRefreshEnabled) {
    return "Manual refresh only";
  }
  if (isPollingPaused) {
    return "Auto-refresh paused while tab is hidden";
  }
  switch (settings.intervalMs) {
    case 60_000:
      return "Auto-refreshes every minute while this page is visible";
    case 300_000:
      return "Auto-refreshes every 5 minutes while this page is visible";
    default:
      return `Auto-refreshes every ${Math.round(settings.intervalMs / 60000)} minutes while this page is visible`;
  }
}

/** In-memory cached snapshot to support useSyncExternalStore referential stability and storage-failure fallback */
let cachedRawSnapshot: string | null = null;
let cachedSettingsSnapshot: AdminRefreshSettings = DEFAULT_ADMIN_REFRESH_SETTINGS;
let isStorageAvailable = true;

/**
 * Reset memory state - intended for isolated test environments
 */
export function _resetMemorySnapshotForTesting(): void {
  cachedRawSnapshot = null;
  cachedSettingsSnapshot = DEFAULT_ADMIN_REFRESH_SETTINGS;
  isStorageAvailable = true;
}

function getSnapshot(): AdminRefreshSettings {
  if (typeof window === "undefined") {
    return DEFAULT_ADMIN_REFRESH_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(ADMIN_REFRESH_STORAGE_KEY);
    isStorageAvailable = true;
    if (raw !== cachedRawSnapshot) {
      cachedRawSnapshot = raw;
      cachedSettingsSnapshot = parseAdminRefreshSettings(raw);
    }
    return cachedSettingsSnapshot;
  } catch {
    // Storage read threw (e.g. SecurityError, blocked third-party storage, quota failure).
    // Retain the active session in-memory setting instead of wiping to defaults.
    isStorageAvailable = false;
    return cachedSettingsSnapshot;
  }
}

function getServerSnapshot(): AdminRefreshSettings {
  return DEFAULT_ADMIN_REFRESH_SETTINGS;
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ADMIN_REFRESH_STORAGE_KEY || event.key === null) {
      cachedRawSnapshot = null;
      callback();
    }
  };

  const handleCustom = (event: Event) => {
    const customEvent = event as CustomEvent<AdminRefreshSettings>;
    if (customEvent.detail && typeof customEvent.detail === "object") {
      cachedSettingsSnapshot = customEvent.detail;
    }
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(ADMIN_REFRESH_EVENT_NAME, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ADMIN_REFRESH_EVENT_NAME, handleCustom);
  };
}

/** In-memory document visibility subscription */
function getVisibilitySnapshot(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "hidden";
}

function subscribeVisibility(callback: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", callback);
  return () => {
    document.removeEventListener("visibilitychange", callback);
  };
}

export interface AdminRefreshPolicy {
  /** The administrator's current refresh settings */
  settings: AdminRefreshSettings;
  /** Persistently update one or more settings fields */
  updateSettings: (updates: Partial<AdminRefreshSettings>) => void;
  /** Reset all settings back to verified defaults */
  resetSettings: () => void;
  /** Effective polling interval in ms for TanStack Query, or `false` when polling is suspended */
  effectiveIntervalMs: number | false;
  /** True when auto-refresh is active but halted specifically because the tab is hidden */
  isPollingPaused: boolean;
  /** True when the browser tab is hidden */
  isTabHidden: boolean;
  /** Truthful user-facing description of current refresh status */
  statusText: string;
}

/**
 * Internal core updater that normalizes settings deterministically and handles storage + in-memory fallback.
 * Can be called directly by tests to exercise real behavioral execution.
 */
export function applyAdminRefreshUpdates(updates: Partial<AdminRefreshSettings>): AdminRefreshSettings {
  const current = cachedSettingsSnapshot;
  const merged = { ...current, ...updates };

  let intervalMs: AdminRefreshInterval = current.intervalMs;
  if (isAllowedInterval(merged.intervalMs)) {
    intervalMs = merged.intervalMs;
  }

  // If autoRefreshEnabled is explicitly set to false or interval is 0, normalize to Manual only (intervalMs = 0, autoRefreshEnabled = false)
  if (updates.autoRefreshEnabled === false || intervalMs === 0) {
    intervalMs = 0;
  } else if (updates.intervalMs !== undefined && updates.intervalMs > 0) {
    intervalMs = updates.intervalMs;
  }

  const next: AdminRefreshSettings = {
    autoRefreshEnabled: intervalMs !== 0,
    intervalMs,
    // Enforce pauseWhenHidden invariant always
    pauseWhenHidden: true,
    refreshOnNavigation:
      typeof merged.refreshOnNavigation === "boolean"
        ? merged.refreshOnNavigation
        : current.refreshOnNavigation,
  };

  cachedSettingsSnapshot = next;

  if (typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(next);
      window.localStorage.setItem(ADMIN_REFRESH_STORAGE_KEY, serialized);
      cachedRawSnapshot = serialized;
      isStorageAvailable = true;
    } catch {
      // Storage write threw (e.g. private mode, quota exceeded, SecurityError).
      // Mark storage unavailable; retain in-memory session settings.
      isStorageAvailable = false;
      cachedRawSnapshot = null;
    }

    window.dispatchEvent(new CustomEvent(ADMIN_REFRESH_EVENT_NAME, { detail: next }));
  }

  return next;
}

export function getAdminRefreshSnapshot(): AdminRefreshSettings {
  return getSnapshot();
}

/**
 * Shared hook to consume and manage administrative data refresh behavior.
 */
export function useAdminRefreshPolicy(): AdminRefreshPolicy {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isTabHidden = useSyncExternalStore(subscribeVisibility, getVisibilitySnapshot, () => false);

  const updateSettings = useCallback((updates: Partial<AdminRefreshSettings>) => {
    applyAdminRefreshUpdates(updates);
  }, []);

  const resetSettings = useCallback(() => {
    applyAdminRefreshUpdates(DEFAULT_ADMIN_REFRESH_SETTINGS);
  }, []);

  const isPollingPaused = useMemo(() => {
    return (
      settings.autoRefreshEnabled &&
      settings.intervalMs > 0 &&
      isTabHidden
    );
  }, [settings.autoRefreshEnabled, settings.intervalMs, isTabHidden]);

  const effectiveIntervalMs = useMemo<number | false>(() => {
    if (!settings.autoRefreshEnabled) return false;
    if (settings.intervalMs === 0) return false;
    if (isTabHidden) return false;
    return settings.intervalMs;
  }, [settings.autoRefreshEnabled, settings.intervalMs, isTabHidden]);

  const statusText = useMemo(() => {
    return getAdminRefreshStatusText({
      settings,
      isTabHidden,
      isPollingPaused,
    });
  }, [settings, isTabHidden, isPollingPaused]);

  return {
    settings,
    updateSettings,
    resetSettings,
    effectiveIntervalMs,
    isPollingPaused,
    isTabHidden,
    statusText,
  };
}
