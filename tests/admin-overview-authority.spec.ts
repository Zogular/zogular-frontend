import { expect, test } from "@playwright/test";
import { QueryClient } from "@tanstack/react-query";
import { overviewAuthority, overviewKey, overviewPlaceholder, purgeOverview } from "../src/features/admin-overview/lib/overview-cache";
import { DEFAULT_ADMIN_DASHBOARD_OVERVIEW_QUERY as period } from "../src/features/admin-overview/lib/dashboard-overview-contract";
import type { AdminIdentity } from "../src/services/admin/session";

const operator: AdminIdentity = {
  id: "operator-a", name: "Operator", email: "operator@example.test", sessionStatus: "authenticated",
  claims: { role: "OPERATIONS", permissions: ["access_admin_panel", "view_all_orders"], authStrength: "password", issuedAt: "" },
};

test("only verified panel access mounts a workspace; authority is normalized but not role-derived", () => {
  const key = overviewAuthority(operator);
  expect(key).not.toBeNull();
  expect(overviewAuthority(null)).toBeNull();
  expect(overviewAuthority({ ...operator, sessionStatus: "expired" })).toBeNull();
  expect(overviewAuthority({ ...operator, claims: { ...operator.claims, permissions: [] } })).toBeNull();
  expect(overviewAuthority({ ...operator, claims: { ...operator.claims, permissions: [
    "view_all_orders", "access_admin_panel", "view_all_orders",
  ] } })).toBe(key);
  expect(overviewAuthority({ ...operator, id: "operator-b" })).not.toBe(key);
  expect(overviewAuthority({ ...operator, claims: { ...operator.claims, role: "ADMIN" } })).not.toBe(key);
  expect(overviewAuthority({ ...operator, claims: { ...operator.claims, permissions: ["access_admin_panel"] } })).not.toBe(key);
});

test("period changes may retain prior data; a new authority cannot reuse it, even with identical filters", () => {
  const client = new QueryClient();
  const a = overviewAuthority(operator)!;
  const b = overviewAuthority({ ...operator, id: "operator-b" })!;
  const oldKey = overviewKey(a, period);
  client.setQueryData(oldKey, 12);
  expect(client.getQueryData(overviewKey(b, period))).toBeUndefined();
  expect(overviewPlaceholder(b, 12, oldKey)).toBeUndefined();
  expect(overviewPlaceholder(a, 12, oldKey)).toBe(12);
  expect(overviewPlaceholder(a, 12, ["other-module", a])).toBeUndefined();
  client.clear();
});

test("purging an authority cancels late work and drops every period, leaving unrelated entries alone", async () => {
  const client = new QueryClient();
  const a = overviewAuthority(operator)!;
  const key = overviewKey(a, period);
  const other = overviewKey("other-authority", period);
  client.setQueryData(overviewKey(a, { ...period, period: "MONTH_TO_DATE" }), 15);
  client.setQueryData(other, 7);
  client.setQueryData(["admin", "customers"], 1);
  let release!: (value: number) => void;
  let requestSignal: AbortSignal | undefined;
  const request = client.fetchQuery({ queryKey: key, queryFn: ({ signal }) => {
    requestSignal = signal;
    return new Promise<number>(resolve => { release = resolve; });
  } }).catch(() => undefined);
  purgeOverview(client, a);
  expect(requestSignal?.aborted).toBe(true);
  release(99);
  await request;
  expect(client.getQueryCache().findAll({ queryKey: ["admin-dashboard-overview", a] })).toHaveLength(0);
  expect(client.getQueryData(other)).toBe(7);
  expect(client.getQueryData(["admin", "customers"])).toBe(1);
  client.clear();
});
