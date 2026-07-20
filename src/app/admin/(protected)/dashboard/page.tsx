"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Package, RefreshCw, Store, Ticket, Truck } from "lucide-react";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { adminOrdersApi } from "@/services/admin/orders";
import { adminProductsApi } from "@/services/admin/products";
import { adminSupportApi } from "@/services/admin/support";
import { getVendorApplications } from "@/services/admin/vendor-applications";
import { adminIdentityHasPermission } from "@/services/admin/session";

type MetricState = { status: "loading" | "ready" | "error" | "unauthorized"; value?: number; detail?: string };
type DashboardState = Record<"sellers" | "products" | "orders" | "support", MetricState>;

const INITIAL_STATE: DashboardState = {
  sellers: { status: "loading" },
  products: { status: "loading" },
  orders: { status: "loading" },
  support: { status: "loading" },
};

export default function AdminDashboardPage() {
  const identity = useAdminIdentity();
  const [state, setState] = useState<DashboardState>(INITIAL_STATE);

  const load = useCallback(async () => {
    if (!identity) return;

    const sources = [
      { key: "sellers" as const, allowed: adminIdentityHasPermission(identity, "view_sellers"), run: async () => { const result = await getVendorApplications({ limit: 1 }); return { value: result.pagination.total, detail: "seller applications" }; } },
      { key: "products" as const, allowed: adminIdentityHasPermission(identity, "view_products"), run: async () => { const total = await adminProductsApi.fetchProductsCount(); return { value: total, detail: "moderation records" }; } },
      { key: "orders" as const, allowed: adminIdentityHasPermission(identity, "view_orders"), run: async () => { const result = await adminOrdersApi.fetchOrders({ limit: 1 }); return { value: result.pagination.total, detail: "orders in the queue" }; } },
      { key: "support" as const, allowed: adminIdentityHasPermission(identity, "view_support_tickets"), run: async () => { const result = await adminSupportApi.fetchTickets({ limit: 1 }); return { value: result.pagination.total, detail: "seller support tickets" }; } },
    ];

    await Promise.all(sources.map(async (source) => {
      if (!source.allowed) {
        setState((current) => ({ ...current, [source.key]: { status: "unauthorized" } }));
        return;
      }
      try {
        const result = await source.run();
        setState((current) => ({ ...current, [source.key]: { status: "ready", ...result } }));
      } catch {
        setState((current) => ({ ...current, [source.key]: { status: "error" } }));
      }
    }));
  }, [identity]);

  useEffect(() => { void load(); }, [load]);

  const cards = [
    { key: "sellers" as const, label: "Sellers", icon: Store },
    { key: "products" as const, label: "Products", icon: Package },
    { key: "orders" as const, label: "Orders", icon: Truck },
    { key: "support" as const, label: "Support", icon: Ticket },
  ];
  const hasError = Object.values(state).some((metric) => metric.status === "error");

  return (
    <div className="mx-auto max-w-[96rem] space-y-5 pb-12">
      <AdminPageHeader title="Dashboard" description="Live launch-control counts from the backend sources your role may access." />
      {hasError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" /><div><p className="text-sm font-black text-amber-950">Some dashboard sources are unavailable</p><p className="text-xs font-semibold text-amber-800">Failed sources remain marked unavailable and are not converted to zero.</p></div></div>
          <Button onClick={() => void load()} variant="outline" className="h-10 rounded-xl border-amber-300 bg-white font-bold"><RefreshCw className="mr-2 h-4 w-4" />Retry failed sources</Button>
        </div>
      ) : null}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ key, label, icon: Icon }) => {
          const metric = state[key];
          return (
            <article key={key} className="min-w-0 rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between gap-2"><Icon className="h-4 w-4 text-zinc-500" />{metric.status === "ready" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}</div>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
              {metric.status === "loading" ? <div className="mt-2 h-12 w-24 animate-pulse rounded-lg bg-zinc-200/60" /> : null}
              {metric.status === "ready" ? <><p className="mt-1 text-3xl font-black text-zinc-950">{metric.value?.toLocaleString()}</p><p className="mt-1 text-xs font-semibold text-zinc-500">{metric.detail}</p></> : null}
              {metric.status === "error" ? <p className="mt-2 text-sm font-black text-rose-700">Source unavailable</p> : null}
              {metric.status === "unauthorized" ? <p className="mt-2 text-sm font-black text-zinc-500">Not permitted</p> : null}
            </article>
          );
        })}
      </section>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-semibold leading-6 text-zinc-600">Counts are operational queue totals only. This dashboard does not infer revenue, settlement, payout, delivery automation, or analytics.</div>
    </div>
  );
}
