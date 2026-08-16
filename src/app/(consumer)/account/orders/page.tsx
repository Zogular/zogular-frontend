"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  Clock,
  Package,
  Search,
  Truck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FeedbackState } from "@/components/states/FeedbackState";
import { AccountLoadErrorState } from "@/components/account/AccountLoadErrorState";
import { getMyOrders } from "@/services/orders";
import type { OrderStatus, OrderSummary } from "@/types/order";

const STATUS_CONFIG = {
  processing: {
    label: "Processing",
    icon: Clock,
    className: "bg-amber-100 text-amber-700",
  },
  shipped: {
    label: "In Transit",
    icon: Truck,
    className: "bg-blue-100 text-blue-700",
  },
  delivered: {
    label: "Delivered",
    icon: CheckCircle2,
    className: "bg-[#009E49]/10 text-[#009E49]",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-red-100 text-red-700",
  },
} as const;

const TABS: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All Orders", value: "all" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<OrderSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);
  const [activeTab, setActiveTab] = React.useState<OrderStatus | "all">("all");
  const [search, setSearch] = React.useState("");

  const loadOrders = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyOrders();
      setOrders(data);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((order) => {
    const matchTab = activeTab === "all" ? true : order.status === activeTab;
    const query = search.toLowerCase();
    const matchSearch =
      order.id.toLowerCase().includes(query) ||
      (order.orderNumber && order.orderNumber.toLowerCase().includes(query)) ||
      order.items.some((item) => item.name.toLowerCase().includes(query));
    return matchTab && matchSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
            My Orders
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Track, return, or buy items again.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-zinc-400" />
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Order ID or Item..."
            className="h-11 rounded-xl border-zinc-200 bg-white pl-9 shadow-sm focus-visible:ring-[#009E49]"
          />
        </div>
      </div>

      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`shrink-0 rounded-full border px-5 py-2 text-sm font-bold transition-colors ${
              activeTab === tab.value
                ? "border-zinc-900 bg-zinc-900 text-white shadow-md"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm font-medium text-zinc-500">
          Loading your order history...
        </div>
      ) : error ? (
        <AccountLoadErrorState error={error} resource="orders" onRetry={loadOrders} />
      ) : filteredOrders.length === 0 ? (
        <FeedbackState
          icon={Package}
          title="No orders found"
          description={
            search
              ? "We couldn't find anything matching your search."
              : "You haven't placed any orders yet."
          }
          action={
            search ? (
              <Button onClick={() => setSearch("")} variant="outline" className="rounded-xl">
                Clear Search
              </Button>
            ) : (
              <Link href="/categories">
                <Button className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">
                  Browse Categories
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4 md:space-y-6">
          {filteredOrders.map((order) => {
            const config = STATUS_CONFIG[order.status];
            const Icon = config.icon;

            return (
              <div key={order.id} className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-[0_2px_15px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-4 border-b border-zinc-100 bg-zinc-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Order Placed</p>
                      <p className="text-sm font-bold text-zinc-900">{order.date}</p>
                    </div>
                    <div className="flex flex-col">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{order.isLegacyIncomplete ? "Item subtotal" : "Total"}</p>
                      <p className="text-sm font-bold text-zinc-900">{order.isLegacyIncomplete ? formatCurrency(order.itemSubtotal) : formatCurrency(order.total as number)}</p>
                      {order.isLegacyIncomplete && <p className="text-[10px] font-bold text-orange-600 mt-0.5">Payment breakdown unavailable</p>}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Order ID</p>
                      <p className="text-sm font-bold text-zinc-900">{order.orderNumber || order.id}</p>
                    </div>
                  </div>

                  <Badge className={`flex w-fit items-center gap-1.5 border-none px-3 py-1 text-xs shadow-none ${config.className}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                  </Badge>
                </div>

                <div className="p-5">
                  <div className="space-y-4">
                    {order.items.map((item, index) => (
                      <div key={`${order.id}-${index}`} className="flex gap-4">
                        <div className="relative w-14 shrink-0 aspect-[3/4] overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50 md:w-16">
                          <Image
                            src={item.image}
                            alt={item.name}
                            fill
                            sizes="80px"
                            className="object-contain mix-blend-multiply"
                          />
                        </div>
                        <div className="flex flex-col justify-center">
                          <p className="line-clamp-2 text-sm font-bold text-zinc-900 md:text-base">{item.name}</p>
                          <p className="mt-1 text-xs font-medium text-zinc-500">Qty: {item.qty}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-zinc-600">
                      {order.status === "delivered" ? "Delivered on:" : "Est. Delivery:"}{" "}
                      <span className="font-bold text-zinc-900">{order.estDelivery}</span>
                    </p>

                    <Link href={`/account/orders/${order.id}`} className="w-full sm:w-auto">
                      <Button className="w-full rounded-xl bg-zinc-100 text-sm font-bold text-zinc-900 hover:bg-[#009E49] hover:text-white sm:w-auto">
                        View Order Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
