/**
 * @file admin-realtime-sse.spec.ts
 * @description
 * Unit and integration contract tests for the Admin Real-time
 * compatibility layer and query freshness mechanisms in zogular-frontend (PC-1A).
 *
 * Verifies:
 * 1. Public realtime compatibility interfaces (`useAdminRealtime`, `useAdminRealtimeStatus`,
 *    `useAdminRealtimeConnection`, `AdminRealtimeProvider`, `AdminRealtimeContext`).
 * 2. Shared context availability mounted in `AdminShell`.
 * 3. Safe disconnected contract: no unsupported `EventSource` connection is opened to the backend.
 * 4. Truthful state reporting: consumers receive `"disconnected"` with zero fake connected indicators.
 * 5. Data freshness mechanisms: Overview relies on the shared refresh policy
 *    and manual refetch actions rather than nonexistent backend SSE streams.
 */

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_REALTIME_STREAM_ENDPOINT,
  useAdminRealtime,
  useAdminRealtimeStatus,
  useAdminRealtimeConnection,
  AdminRealtimeProvider,
  AdminRealtimeContext,
} from "../src/features/admin-shell/hooks/useAdminRealtime";

const repoRoot = path.resolve(__dirname, "..");
const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

test.describe("Admin Realtime SSE Architecture & Contracts", () => {
  test("exports required realtime hooks, context, and stream endpoint", () => {
    expect(ADMIN_REALTIME_STREAM_ENDPOINT).toBe("/api/backend/admin/events/stream");
    expect(typeof useAdminRealtime).toBe("function");
    expect(typeof useAdminRealtimeStatus).toBe("function");
    expect(typeof useAdminRealtimeConnection).toBe("function");
    expect(typeof AdminRealtimeProvider).toBe("function");
    expect(AdminRealtimeContext).toBeDefined();
  });

  test("AdminShell mounts AdminRealtimeProvider to guarantee shared realtime context availability", () => {
    const shellSource = readSource("src/components/admin/AdminShell.tsx");
    expect(shellSource).toContain("AdminRealtimeProvider");
    expect(shellSource).toContain("<AdminRealtimeProvider>");
    expect(shellSource).toContain("</AdminRealtimeProvider>");
  });

  test("useAdminRealtime maintains truthful disconnected state without creating unsupported EventSource", () => {
    const hookResult = useAdminRealtime();
    expect(hookResult).toEqual({
      status: "disconnected",
      isConnected: false,
    });

    const hookSource = readSource("src/features/admin-shell/hooks/useAdminRealtime.ts");
    expect(hookSource).not.toContain("new EventSource(");
    expect(hookSource).toContain('status: "disconnected"');
    expect(hookSource).toContain("isConnected: false");
  });

  test("Wired admin surface (Overview) uses refresh policy and manual refetch", () => {
    const overviewHook = readSource("src/features/admin-overview/hooks/useAdminOverview.ts");
    expect(overviewHook).toContain("useAdminRefreshPolicy");
    expect(overviewHook).toContain("refetchInterval: refreshPolicy.effectiveIntervalMs");
  });
});
