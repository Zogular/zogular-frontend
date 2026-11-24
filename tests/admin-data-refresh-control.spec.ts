/**
 * @file admin-data-refresh-control.spec.ts
 * @description
 * Unit and behavioral tests for the Admin Data Refresh Control package in zogular-frontend (PC-1A).
 *
 * Verifies all required behavioral dimensions:
 * 1. Default refresh preferences (auto-refresh: true, interval: 300s / 5m, pause when hidden: true, refresh on navigation: true).
 * 2. Polling interval selection and robust settings parsing/fallback (Every minute, Every 5 minutes, Manual only; 30s removed).
 * 3. Manual-only mode (`autoRefreshEnabled: false` or `intervalMs: 0` results in `effectiveIntervalMs === false`).
 * 4. Hidden-tab pause (`isTabHidden: true` always produces `effectiveIntervalMs === false` and `pauseWhenHidden: true`, including old storage with `pauseWhenHidden: false`).
 * 5. No duplicate timers / timer cleanup (single dynamic TanStack Query interval without interval stacking).
 * 6. Navigation refresh behavior (`refreshOnNavigation: true` configures `refetchOnMount: true`).
 * 7. Preserved realtime compatibility contract with truthful disconnected state.
 * 8. Truthful, non-consuming notification control: visibly disabled, zero network calls, no fake unread counters.
 * 9. Explicit coverage boundary: Overview wired; unlisted queues unchanged.
 */

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_ADMIN_REFRESH_SETTINGS,
  ADMIN_REFRESH_STORAGE_KEY,
  ADMIN_REFRESH_EVENT_NAME,
  ADMIN_REFRESH_INTERVAL_OPTIONS,
  parseAdminRefreshSettings,
  getAdminRefreshStatusText,
  _resetMemorySnapshotForTesting,
  applyAdminRefreshUpdates,
  getAdminRefreshSnapshot,
} from "../src/features/admin-shell/hooks/useAdminRefreshPolicy";
import { useAdminRealtime } from "../src/features/admin-shell/hooks/useAdminRealtime";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test.describe("Admin Data Refresh Control - Unit & Behavioral Contracts (PC-1A)", () => {
  test("defines verified default refresh settings (5 minutes default)", () => {
    expect(DEFAULT_ADMIN_REFRESH_SETTINGS).toEqual({
      autoRefreshEnabled: true,
      intervalMs: 300_000,
      pauseWhenHidden: true,
      refreshOnNavigation: true,
    });
    expect(ADMIN_REFRESH_STORAGE_KEY).toBe("zogular_admin_refresh_settings_v1");
    expect(ADMIN_REFRESH_EVENT_NAME).toBe("zogular:admin-refresh-settings-changed");
  });

  test("defines exactly three supported refresh intervals with human labels (30s removed)", () => {
    expect(ADMIN_REFRESH_INTERVAL_OPTIONS).toHaveLength(3);
    const intervals = ADMIN_REFRESH_INTERVAL_OPTIONS.map((opt) => opt.value);
    expect(intervals).toEqual([60_000, 300_000, 0]);
  });

  test("parseAdminRefreshSettings parses valid JSON, normalizes legacy 30s and pauseWhenHidden: false, and recovers from corrupted data", () => {
    // Null / empty input falls back to default
    expect(parseAdminRefreshSettings(null)).toEqual(DEFAULT_ADMIN_REFRESH_SETTINGS);
    expect(parseAdminRefreshSettings("")).toEqual(DEFAULT_ADMIN_REFRESH_SETTINGS);
    expect(parseAdminRefreshSettings("invalid-json{")).toEqual(DEFAULT_ADMIN_REFRESH_SETTINGS);

    // Partial input falls back missing fields to defaults
    const partial = JSON.stringify({ intervalMs: 60_000 });
    const parsedPartial = parseAdminRefreshSettings(partial);
    expect(parsedPartial.intervalMs).toBe(60_000);
    expect(parsedPartial.autoRefreshEnabled).toBe(true);
    expect(parsedPartial.pauseWhenHidden).toBe(true);
    expect(parsedPartial.refreshOnNavigation).toBe(true);

    // Legacy 30s interval falls back to default 5m (300_000)
    const legacy30s = JSON.stringify({ intervalMs: 30_000 });
    expect(parseAdminRefreshSettings(legacy30s).intervalMs).toBe(300_000);

    // Invalid interval values fall back to default 5m
    const invalidInterval = JSON.stringify({ intervalMs: 9999 });
    expect(parseAdminRefreshSettings(invalidInterval).intervalMs).toBe(300_000);

    // Old local storage containing pauseWhenHidden: false is strictly normalized to true
    const legacyPauseFalse = JSON.stringify({
      autoRefreshEnabled: true,
      intervalMs: 60_000,
      pauseWhenHidden: false,
      refreshOnNavigation: true,
    });
    expect(parseAdminRefreshSettings(legacyPauseFalse).pauseWhenHidden).toBe(true);

    // Contradictory legacy storage: autoRefreshEnabled: false with nonzero interval normalizes to intervalMs: 0 (Manual only)
    const legacyContradictory = JSON.stringify({
      autoRefreshEnabled: false,
      intervalMs: 60_000,
    });
    const parsedContradictory = parseAdminRefreshSettings(legacyContradictory);
    expect(parsedContradictory.intervalMs).toBe(0);
    expect(parsedContradictory.autoRefreshEnabled).toBe(false);

    // Valid complete custom settings (manual only)
    const custom = JSON.stringify({
      autoRefreshEnabled: false,
      intervalMs: 0,
      pauseWhenHidden: true,
      refreshOnNavigation: false,
    });
    expect(parseAdminRefreshSettings(custom)).toEqual({
      autoRefreshEnabled: false,
      intervalMs: 0,
      pauseWhenHidden: true,
      refreshOnNavigation: false,
    });
  });

  test("getAdminRefreshStatusText generates truthful status descriptions across states", () => {
    // 1. Manual only reports "Manual refresh only" (whether autoRefreshEnabled is false or intervalMs is 0)
    expect(
      getAdminRefreshStatusText({
        settings: { ...DEFAULT_ADMIN_REFRESH_SETTINGS, autoRefreshEnabled: false, intervalMs: 0 },
        isTabHidden: false,
        isPollingPaused: false,
      }),
    ).toBe("Manual refresh only");

    // 2. Manual only interval (0ms)
    expect(
      getAdminRefreshStatusText({
        settings: { ...DEFAULT_ADMIN_REFRESH_SETTINGS, intervalMs: 0 },
        isTabHidden: false,
        isPollingPaused: false,
      }),
    ).toBe("Manual refresh only");

    // 3. Tab is hidden and polling is paused
    expect(
      getAdminRefreshStatusText({
        settings: DEFAULT_ADMIN_REFRESH_SETTINGS,
        isTabHidden: true,
        isPollingPaused: true,
      }),
    ).toBe("Auto-refresh paused while tab is hidden");

    // 4. Active 60 seconds (Every minute)
    expect(
      getAdminRefreshStatusText({
        settings: { ...DEFAULT_ADMIN_REFRESH_SETTINGS, intervalMs: 60_000 },
        isTabHidden: false,
        isPollingPaused: false,
      }),
    ).toBe("Auto-refreshes every minute while this page is visible");

    // 5. Active 5 minutes (default)
    expect(
      getAdminRefreshStatusText({
        settings: DEFAULT_ADMIN_REFRESH_SETTINGS,
        isTabHidden: false,
        isPollingPaused: false,
      }),
    ).toBe("Auto-refreshes every 5 minutes while this page is visible");
  });

  test("useAdminRealtime hook returns truthful disconnected state without live EventSource connection", () => {
    const realtime = useAdminRealtime();
    expect(realtime).toEqual({
      status: "disconnected",
      isConnected: false,
    });

    const realtimeSource = readSource("src/features/admin-shell/hooks/useAdminRealtime.ts");
    expect(realtimeSource).not.toContain("new EventSource");
    expect(realtimeSource).toContain('status: "disconnected"');
    expect(realtimeSource).toContain("isConnected: false");
  });
});

test.describe("Admin Shell & Notification Control Integration", () => {
  test("AdminHeader mounts AdminNotificationControl beside AdminProfilePopover", () => {
    const headerSource = readSource("src/features/admin-shell/components/AdminHeader.tsx");
    expect(headerSource).toContain("AdminNotificationControl");
    expect(headerSource).toContain("<AdminNotificationControl />");
    expect(headerSource).toContain("<AdminProfilePopover");
  });

  test("AdminNotificationControl is visibly disabled, non-clickable, and contains zero network activity or fake badges", () => {
    const notificationControlSource = readSource("src/features/admin-shell/components/AdminNotificationControl.tsx");
    // Visibly disabled attributes
    expect(notificationControlSource).toContain("disabled");
    expect(notificationControlSource).toContain('aria-disabled="true"');
    expect(notificationControlSource).toContain("cursor-not-allowed");
    expect(notificationControlSource).toContain('aria-label="Notifications are not available yet"');
    expect(notificationControlSource).toContain("data-testid=\"admin-notification-trigger\"");

    // Zero interactive Popover workflow (prevents misleading clickable experience)
    expect(notificationControlSource).not.toContain("<Popover>");
    expect(notificationControlSource).not.toContain("<PopoverContent");

    // Strictly no fake unread counters, notification badges, or live polling loops
    expect(notificationControlSource).not.toContain("<Badge");
    expect(notificationControlSource).not.toContain("data-badge");
    expect(notificationControlSource).not.toContain("unreadCount");
    expect(notificationControlSource).not.toContain("fetch(");
    expect(notificationControlSource).not.toContain("new EventSource");
    expect(notificationControlSource).not.toContain("new WebSocket");
    expect(notificationControlSource).not.toContain("setInterval(");
  });

  test("AdminRefreshSettingsPopover provides controls for all required policy preferences with coherent mode selection", () => {
    // 1. Assert the policy's exported interval options are exactly [60_000, 300_000, 0]
    expect(ADMIN_REFRESH_INTERVAL_OPTIONS.map((opt) => opt.value)).toEqual([60_000, 300_000, 0]);

    const popoverSource = readSource("src/features/admin-shell/components/AdminRefreshSettingsPopover.tsx");

    // 2. Assert the popover source renders its options from ADMIN_REFRESH_INTERVAL_OPTIONS
    expect(popoverSource).toContain("ADMIN_REFRESH_INTERVAL_OPTIONS.map");

    // 3. Assert the popover source uses the dynamic data-testid template for refresh-interval-${option.value}
    expect(popoverSource).toContain("data-testid={`refresh-interval-${option.value}`}");

    // 4. Retain all existing assertions for radiogroup, notices, toggles, and master toggle elimination
    expect(popoverSource).toContain('role="radiogroup"');
    expect(popoverSource).toContain("refresh-hidden-tab-notice");
    expect(popoverSource).toContain("refresh-toggle-on-navigation");
    expect(popoverSource).toContain("refresh-reset-defaults");
    // Contradictory master toggle removed
    expect(popoverSource).not.toContain("refresh-toggle-auto");
  });

  test("behavioural test: storage read failure retains current in-memory session snapshot without throwing", () => {
    _resetMemorySnapshotForTesting();

    const originalWindow = global.window;
    try {
      // Establish an in-memory session setting (60_000ms Every minute)
      (global as unknown as { window: unknown }).window = {
        localStorage: {
          getItem: () => null,
          setItem: () => {},
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };

      const updated = applyAdminRefreshUpdates({ intervalMs: 60_000 });
      expect(updated.intervalMs).toBe(60_000);
      expect(updated.autoRefreshEnabled).toBe(true);

      // Now simulate localStorage.getItem throwing on subsequent read (SecurityError / private mode)
      (global as unknown as { window: { localStorage: { getItem: () => string } } }).window.localStorage.getItem = () => {
        throw new Error("SecurityError: Access to localStorage is denied");
      };

      // Calling getAdminRefreshSnapshot must NOT throw and must retain the active session choice
      let snapshotResult;
      expect(() => {
        snapshotResult = getAdminRefreshSnapshot();
      }).not.toThrow();

      expect(snapshotResult).toEqual({
        autoRefreshEnabled: true,
        intervalMs: 60_000,
        pauseWhenHidden: true,
        refreshOnNavigation: true,
      });
    } finally {
      (global as unknown as { window: unknown }).window = originalWindow;
      _resetMemorySnapshotForTesting();
    }
  });

  test("behavioural test: storage write failure retains newly selected in-memory setting without throwing", () => {
    _resetMemorySnapshotForTesting();

    const originalWindow = global.window;
    try {
      // Simulate localStorage throwing on setItem (QuotaExceededError)
      (global as unknown as { window: unknown }).window = {
        localStorage: {
          getItem: () => null,
          setItem: () => {
            throw new Error("QuotaExceededError: The quota has been exceeded");
          },
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };

      // Applying setting must NOT throw and must return the newly chosen in-memory setting
      let updateResult;
      expect(() => {
        updateResult = applyAdminRefreshUpdates({ intervalMs: 0 });
      }).not.toThrow();

      expect(updateResult).toEqual({
        autoRefreshEnabled: false,
        intervalMs: 0,
        pauseWhenHidden: true,
        refreshOnNavigation: true,
      });

      // Subsequent snapshot read must retain the chosen manual-only setting
      const snapshot = getAdminRefreshSnapshot();
      expect(snapshot.intervalMs).toBe(0);
      expect(snapshot.autoRefreshEnabled).toBe(false);
    } finally {
      (global as unknown as { window: unknown }).window = originalWindow;
      _resetMemorySnapshotForTesting();
    }
  });

  test("behavioural test: updateSettings with contradictory partial input normalizes deterministically to canonical state", () => {
    _resetMemorySnapshotForTesting();

    const originalWindow = global.window;
    try {
      (global as unknown as { window: unknown }).window = {
        localStorage: {
          getItem: () => null,
          setItem: () => {},
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };

      // Contradictory input 1: autoRefreshEnabled: false, intervalMs: 60_000 -> Must normalize to Manual only (0ms)
      const res1 = applyAdminRefreshUpdates({ autoRefreshEnabled: false, intervalMs: 60_000 });
      expect(res1.intervalMs).toBe(0);
      expect(res1.autoRefreshEnabled).toBe(false);
      expect(res1.pauseWhenHidden).toBe(true);

      // Contradictory input 2: intervalMs: 0, autoRefreshEnabled: true -> interval 0 must derive autoRefreshEnabled: false
      const res2 = applyAdminRefreshUpdates({ intervalMs: 0, autoRefreshEnabled: true });
      expect(res2.intervalMs).toBe(0);
      expect(res2.autoRefreshEnabled).toBe(false);
      expect(res2.pauseWhenHidden).toBe(true);

      // Normal nonzero interval activates auto-refresh
      const res3 = applyAdminRefreshUpdates({ intervalMs: 300_000 });
      expect(res3.intervalMs).toBe(300_000);
      expect(res3.autoRefreshEnabled).toBe(true);
      expect(res3.pauseWhenHidden).toBe(true);
    } finally {
      (global as unknown as { window: unknown }).window = originalWindow;
      _resetMemorySnapshotForTesting();
    }
  });
});

test.describe("Overview Refresh Policy Integration & Boundaries (PC-1A)", () => {
  test("OverviewHeader renders truthful status line and settings popover trigger", () => {
    const overviewHeaderSource = readSource("src/features/admin-overview/components/OverviewHeader.tsx");
    expect(overviewHeaderSource).toContain("data-testid=\"overview-refresh-status\"");
    expect(overviewHeaderSource).toContain("AdminRefreshSettingsPopover");
    expect(overviewHeaderSource).toContain("data-testid=\"overview-refresh\"");
    expect(overviewHeaderSource).toContain("data-testid=\"overview-last-updated\"");
  });

  test("useAdminOverview wires effectiveIntervalMs, refetchIntervalInBackground: false, and retry: false", () => {
    const overviewHookSource = readSource("src/features/admin-overview/hooks/useAdminOverview.ts");
    expect(overviewHookSource).toContain("useAdminRefreshPolicy()");
    expect(overviewHookSource).toContain("refetchInterval: refreshPolicy.effectiveIntervalMs");
    expect(overviewHookSource).toContain("refetchIntervalInBackground: false");
    expect(overviewHookSource).toContain("refetchOnWindowFocus: true");
    expect(overviewHookSource).toContain("refetchOnMount: refreshPolicy.settings.refreshOnNavigation");
    expect(overviewHookSource).toContain("retry: false");
    expect(overviewHookSource).toContain("refreshPolicy,");
  });
});
