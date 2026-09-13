/**
 * @file admin-realtime-sse.spec.ts
 * @description
 * Unit and integration contract tests for the Admin Real-time Server-Sent Events (SSE) listener
 * and TanStack Query cache invalidation bindings in zogular-frontend.
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
} from "../src/features/admin-platform";

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

  test("AdminShell mounts AdminRealtimeProvider to guarantee persistent connection", () => {
    const shellSource = readSource("src/components/admin/AdminShell.tsx");
    expect(shellSource).toContain("AdminRealtimeProvider");
    expect(shellSource).toContain("<AdminRealtimeProvider>");
    expect(shellSource).toContain("</AdminRealtimeProvider>");
  });

  test("useAdminRealtime registers exact domain invalidation listeners", () => {
    const hookSource = readSource("src/features/admin-platform/hooks/useAdminRealtime.ts");
    expect(hookSource).toContain('addEventListener("admin:seller:created"');
    expect(hookSource).toContain('addEventListener("admin:seller:updated"');
    expect(hookSource).toContain('addEventListener("admin:buyer:updated"');
    expect(hookSource).toContain('addEventListener("admin:order:created"');
    expect(hookSource).toContain('addEventListener("admin:order:updated"');
    expect(hookSource).toContain('queryKey: ["seller-list"]');
    expect(hookSource).toContain('queryKey: ["admin", "buyers"]');
    expect(hookSource).toContain('queryKey: ["admin", "orders"]');
    expect(hookSource).toContain('queryKey: ["admin", "overview"]');
    expect(hookSource).toContain("eventSource.close()");
  });

  test("SellerQueueFreshness and BuyerQueueFreshness integrate live indicator badge", () => {
    const sellerFreshness = readSource("src/features/admin-sellers/sections/SellerQueueFreshness.tsx");
    const buyerFreshness = readSource("src/features/admin-buyers/sections/BuyerQueueFreshness.tsx");

    expect(sellerFreshness).toContain("useAdminRealtimeStatus");
    expect(sellerFreshness).toContain("Live");
    expect(sellerFreshness).toContain("animate-pulse");

    expect(buyerFreshness).toContain("useAdminRealtimeStatus");
    expect(buyerFreshness).toContain("Live");
    expect(buyerFreshness).toContain("animate-pulse");
  });

  test("Polling intervals in seller and buyer lists are relaxed to 60s", () => {
    const sellerListHook = readSource("src/features/admin-sellers/hooks/use-sellers-list.ts");
    const buyerListHook = readSource("src/features/admin-buyers/hooks/use-buyers-list.ts");

    expect(sellerListHook).toContain("refetchInterval: 60000");
    expect(buyerListHook).toContain("refetchInterval: 60_000");
  });
});
