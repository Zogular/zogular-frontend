"use client";

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuyerOrderStatusBadge } from "@/components/account/BuyerOrderStatusBadge";
import { Input } from "@/components/ui/input";
import { FeedbackState } from "@/components/states/FeedbackState";
import { AccountLoadErrorState } from "@/components/account/AccountLoadErrorState";
import { useBuyerOrderHistory } from "@/features/buyer-orders/hooks/use-buyer-order-history";
import { orderHistoryHref, orderLinkId, parseOrderFilter, type OrderFilter } from "@/features/buyer-orders/lib/order-return-state";

const TABS: { label: string; value: OrderFilter }[] = [
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
  return (
    <Suspense fallback={<OrderHistoryLoading />}>
      <OrderHistory />
    </Suspense>
  );
}

function OrderHistoryLoading() {
  return <div className="py-16 text-center text-sm font-medium text-zinc-500">Loading your order history...</div>;
}

function OrderHistory() {
  const router = useRouter();
  const statuses = useSearchParams().getAll("status");
  const activeTab = parseOrderFilter(statuses.length === 1 ? statuses[0] : null);
  const { page: orderPage, error, loading, loadingMore, nextPageError, search, setSearch, loadMore, rememberOrder, retry } = useBuyerOrderHistory(activeTab);
  const orders = orderPage?.orders ?? [];
  const pagination = orderPage?.pagination ?? null;

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
    <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in duration-500">
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
            disabled={loading}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search Order ID or Item..."
            className="h-11 rounded-xl border-zinc-200 bg-white pl-9 shadow-sm focus-visible:ring-[#009E49]"
          />
        </div>
      </div>

      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.value}
            aria-pressed={activeTab === tab.value}
            disabled={loading}
            onClick={() => router.replace(orderHistoryHref(tab.value), { scroll: false })}
            className={`min-h-11 shrink-0 rounded-full border px-5 py-2 text-sm font-bold transition-colors ${
              activeTab === tab.value
                ? "border-zinc-900 bg-zinc-900 text-white shadow-md"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!loading && !error && pagination ? (
        <p className="text-sm font-medium text-zinc-500" aria-live="polite">
          Showing {orders.length} of {pagination.total} orders
        </p>
      ) : null}

      {loading ? (
        <OrderHistoryLoading />
      ) : error ? (
        <AccountLoadErrorState error={error} resource="orders" onRetry={retry} />
      ) : filteredOrders.length === 0 ? (
        <FeedbackState
          icon={Package}
          title="No orders found"
          description={
            search
              ? "No loaded orders match your search."
              : activeTab === "all" ? "You haven't placed any orders yet." : "No loaded orders match this status."
          }
          action={
            search ? (
              <Button onClick={() => setSearch("")} variant="outline" className="rounded-xl">
                Clear Search
              </Button>
            ) : activeTab !== "all" ? (
              <Button onClick={() => router.replace(orderHistoryHref("all"), { scroll: false })} variant="outline" className="rounded-xl">
                Show All Orders
              </Button>
            ) : (
              <Button asChild className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">
                <Link href="/categories">Browse Categories</Link>
              </Button>
            )
          }
        />
      ) : (
        <div data-order-history-list="" className="space-y-4 md:space-y-6">
          {filteredOrders.map((order) => {
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

                  <BuyerOrderStatusBadge status={order.status} />
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
                      Estimated delivery:{" "}
                      <span className="font-bold text-zinc-900">{order.estDelivery ?? "Not available"}</span>
                    </p>

                    <Button asChild className="h-11 w-full scroll-my-24 rounded-xl bg-zinc-100 text-sm font-bold text-zinc-900 hover:bg-[#009E49] hover:text-white sm:w-auto">
                      <Link id={orderLinkId(order.id)} href={orderHistoryHref(activeTab, order.id)} onNavigate={() => rememberOrder(order.id)}>
                        View Order Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && pagination && pagination.page < pagination.pages ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="h-11 min-w-36 rounded-xl font-bold"
          >
            {loadingMore ? "Loading..." : "Load More Orders"}
          </Button>
          {nextPageError ? (
            <p role="alert" className="text-sm font-semibold text-red-700">More orders could not load. Please try again.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
