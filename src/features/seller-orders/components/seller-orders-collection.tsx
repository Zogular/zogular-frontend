"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  Download,
  MoreHorizontal,
  Package,
  Phone,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { CollectionFilterSheet } from "@/components/collection/collection-filter-sheet";
import { CollectionPagination } from "@/components/collection/collection-pagination";
import { CollectionErrorState, CollectionState } from "@/components/collection/collection-state";
import { CollectionToolbar, CollectionResultCount } from "@/components/collection/collection-toolbar";
import { CollectionViewToggle } from "@/components/shared/CollectionViewToggle";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rememberListScroll, useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import {
  sellerOrderQueryKeys,
  sellerOrdersApi,
  type SellerOrderSort,
  type SellerOrderStatus,
  type SellerOrderSummary,
} from "@/services/seller-orders";
import { useSellerOrdersQueryState } from "../hooks/use-seller-orders-query-state";
import {
  formatSellerOrderCurrency,
  formatSellerOrderDate,
  getSellerOrderStatusMeta,
  SELLER_ORDER_STATUSES,
} from "../order-ui";
import { OrderCancellationDialog } from "./order-cancellation-dialog";

const SELLER_PRODUCTS_QUERY_KEY = ["seller", "products"] as const;
const SELLER_INVENTORY_QUERY_KEY = ["seller", "inventory"] as const;

function escapeCsv(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function OrderCollectionSkeleton({ view }: { view: "list" | "grid" }) {
  if (view === "grid") {
    return (
      <div aria-label="Loading order board" role="status" className="flex max-w-full gap-3 overflow-hidden pb-3">
        {Array.from({ length: 4 }, (_, column) => (
          <div key={column} className="w-66 shrink-0 space-y-3">
            <div className="h-9 animate-pulse rounded-lg bg-zinc-100" />
            <div className="h-40 animate-pulse rounded-2xl border border-zinc-100 bg-white" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div aria-label="Loading order list" role="status" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex min-h-22 items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-0 md:px-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-100" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="h-8 w-18 animate-pulse rounded-lg bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}

function OrderFilters({
  status,
  createdFrom,
  createdTo,
  sort,
  onStatusChange,
  onCreatedFromChange,
  onCreatedToChange,
  onSortChange,
}: {
  status?: SellerOrderStatus;
  createdFrom: string;
  createdTo: string;
  sort: SellerOrderSort;
  onStatusChange: (status?: SellerOrderStatus) => void;
  onCreatedFromChange: (date: string) => void;
  onCreatedToChange: (date: string) => void;
  onSortChange: (sort: SellerOrderSort) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:flex xl:items-end">
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
        Status
        <select value={status ?? ""} onChange={(event) => onStatusChange((event.target.value || undefined) as SellerOrderStatus | undefined)} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 xl:w-36 xl:text-sm">
          <option value="">All statuses</option>
          {SELLER_ORDER_STATUSES.filter((item) => item.id !== "unknown").map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
        From
        <Input type="date" value={createdFrom} max={createdTo || undefined} onChange={(event) => onCreatedFromChange(event.target.value)} className="h-10 rounded-xl text-base xl:w-38 xl:text-sm" />
      </label>
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
        To
        <Input type="date" value={createdTo} min={createdFrom || undefined} onChange={(event) => onCreatedToChange(event.target.value)} className="h-10 rounded-xl text-base xl:w-38 xl:text-sm" />
      </label>
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500">
        Sort
        <select value={sort} onChange={(event) => onSortChange(event.target.value as SellerOrderSort)} className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-base font-semibold text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 xl:w-44 xl:text-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="recently-updated">Recently updated</option>
          <option value="order-number">Order number</option>
        </select>
      </label>
    </div>
  );
}

function OrderActionMenu({ order, onCancel }: { order: SellerOrderSummary; onCancel: (order: SellerOrderSummary) => void }) {
  const canCancel = order.allowedTransitions.includes("cancelled");
  const copyOrderNumber = async () => {
    try {
      await navigator.clipboard.writeText(order.orderNumber);
      toast.success("Order number copied.");
    } catch {
      toast.error("Could not copy the order number.");
    }
  };

  return (
    <ActionMenu>
      <ActionMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Actions for order ${order.orderNumber}`} className="h-9 w-9 shrink-0 rounded-xl">
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </ActionMenuTrigger>
      <ActionMenuContent>
        <ActionMenuItem onClick={copyOrderNumber}><Copy className="h-4 w-4" /> Copy order number</ActionMenuItem>
        {order.phone !== "Not provided" ? (
          <ActionMenuItem onClick={() => { window.location.href = `tel:${order.phone}`; }}><Phone className="h-4 w-4" /> Call customer</ActionMenuItem>
        ) : null}
        {canCancel ? (
          <>
            <ActionMenuSeparator />
            <ActionMenuItem className="text-red-600" onClick={() => onCancel(order)}><XCircle className="h-4 w-4" /> Cancel order</ActionMenuItem>
          </>
        ) : null}
      </ActionMenuContent>
    </ActionMenu>
  );
}

function OrderList({ orders, listUrl, onCancel }: { orders: SellerOrderSummary[]; listUrl: string; onCancel: (order: SellerOrderSummary) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm" role="table" aria-label="Seller orders">
      <div className="hidden min-h-9 grid-cols-[minmax(180px,1.3fr)_100px_90px_110px_130px_40px] items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-500 lg:grid" role="row">
        <span>Order</span><span>Items</span><span>Total</span><span>Status</span><span>Date</span><span className="sr-only">Actions</span>
      </div>
      <div className="divide-y divide-zinc-100">
        {orders.map((order) => {
          const status = getSellerOrderStatusMeta(order.status);
          const detailHref = `/seller/orders/${order.id}?returnTo=${encodeURIComponent(listUrl)}`;
          return (
            <div key={order.id} className="grid min-h-22 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 lg:min-h-18 lg:grid-cols-[minmax(180px,1.3fr)_100px_90px_110px_130px_40px] lg:gap-3 lg:px-4" role="row">
              <Link href={detailHref} onClick={() => rememberListScroll(listUrl)} className="min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" role="cell">
                <p className="truncate text-[13px] font-black text-zinc-950">{order.customer}</p>
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-zinc-500">{order.orderNumber}</p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-zinc-500 lg:hidden">{formatSellerOrderDate(order.createdAt)}</p>
              </Link>
              <div className="row-span-2 flex items-center gap-1 lg:row-span-1 lg:contents">
                <span className="hidden text-xs font-bold text-zinc-700 lg:block" role="cell">{order.items}</span>
                <span className="hidden text-xs font-black text-zinc-950 lg:block" role="cell">{formatSellerOrderCurrency(order.total)}</span>
                <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${status.background} ${status.color} ${status.border}`} role="cell">{status.title}</span>
                <span className="hidden text-xs font-semibold text-zinc-600 lg:block" role="cell">{formatSellerOrderDate(order.createdAt)}</span>
                <OrderActionMenu order={order} onCancel={onCancel} />
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-600 lg:hidden">
                <span>{order.items} {order.items === 1 ? "item" : "items"}</span>
                <span>{formatSellerOrderCurrency(order.total)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderBoardCard({ order, listUrl, onCancel }: { order: SellerOrderSummary; listUrl: string; onCancel: (order: SellerOrderSummary) => void }) {
  const status = getSellerOrderStatusMeta(order.status);
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-wider text-zinc-500">{order.orderNumber}</p>
          <h3 className="mt-0.5 truncate text-sm font-black text-zinc-950">{order.customer}</h3>
        </div>
        <OrderActionMenu order={order} onCancel={onCancel} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-zinc-600">
        <span>{order.items} {order.items === 1 ? "item" : "items"}</span>
        <span className="font-black text-zinc-950">{formatSellerOrderCurrency(order.total)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2">
        <span className={`rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${status.background} ${status.color} ${status.border}`}>{status.title}</span>
        <Link href={`/seller/orders/${order.id}?returnTo=${encodeURIComponent(listUrl)}`} onClick={() => rememberListScroll(listUrl)} className="rounded-lg px-2 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-50">Manage</Link>
      </div>
    </article>
  );
}

function OrderBoard({ orders, visibleStatuses, facets, listUrl, onCancel }: {
  orders: SellerOrderSummary[];
  visibleStatuses: SellerOrderStatus[];
  facets: Map<SellerOrderStatus, number>;
  listUrl: string;
  onCancel: (order: SellerOrderSummary) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:thin]" data-order-board>
      <div className="flex w-max min-w-full items-start gap-3">
        {visibleStatuses.map((statusId) => {
          const status = getSellerOrderStatusMeta(statusId);
          const ordersForStatus = orders.filter((order) => order.status === statusId);
          const Icon = status.icon;
          return (
            <section key={statusId} className="w-66 shrink-0 space-y-2.5" data-order-board-column>
              <header className="flex h-9 items-center justify-between gap-2 border-b border-zinc-200 px-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${status.background} ${status.color}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <h2 className="truncate text-xs font-black text-zinc-950">{status.title}</h2>
                </div>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-600">{facets.get(statusId) ?? 0}</span>
              </header>
              {ordersForStatus.map((order) => <OrderBoardCard key={order.id} order={order} listUrl={listUrl} onCancel={onCancel} />)}
              {ordersForStatus.length === 0 ? <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white/50 text-[10px] font-black uppercase tracking-wider text-zinc-400">No orders on this page</div> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function SellerOrdersCollection() {
  const state = useSellerOrdersQueryState();
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<SellerOrderSummary | null>(null);
  const ordersQuery = useQuery({
    queryKey: sellerOrderQueryKeys.list(state.apiQuery),
    queryFn: () => sellerOrdersApi.fetchPage(state.apiQuery),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const cancellation = useMutation({
    mutationFn: (orderId: string) => sellerOrdersApi.cancelOrder(orderId),
    onSuccess: async (updated) => {
      setCancelTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sellerOrderQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: sellerOrderQueryKeys.detail(updated.id) }),
        queryClient.invalidateQueries({ queryKey: SELLER_PRODUCTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SELLER_INVENTORY_QUERY_KEY }),
      ]);
      toast.success(`Order ${updated.orderNumber} cancelled.`);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not cancel the order."),
  });
  const data = ordersQuery.data;
  const orders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const facets = useMemo(() => new Map(data?.facets.statuses.map((facet) => [facet.status, facet.count]) ?? []), [data?.facets.statuses]);
  const visibleStatuses = state.status
    ? [state.status]
    : SELLER_ORDER_STATUSES.filter((status) => status.id !== "unknown").map((status) => status.id);
  const activeFilterCount = Number(Boolean(state.status)) + Number(Boolean(state.createdFrom)) + Number(Boolean(state.createdTo));
  const isInitialLoading = ordersQuery.isPending && !data;
  useListScrollRestoration(state.listUrl, !isInitialLoading);

  const filters = (
    <OrderFilters
      status={state.status}
      createdFrom={state.createdFrom}
      createdTo={state.createdTo}
      sort={state.sort}
      onStatusChange={state.setStatus}
      onCreatedFromChange={state.setCreatedFrom}
      onCreatedToChange={state.setCreatedTo}
      onSortChange={state.setSort}
    />
  );

  const handleExport = useCallback(() => {
    if (orders.length === 0) return;
    const rows = [
      ["Order number", "Customer", "Phone", "Items", "Seller-visible total", "Status", "Created"],
      ...orders.map((order) => [order.orderNumber, order.customer, order.phone, order.items, order.total, getSellerOrderStatusMeta(order.status).title, order.createdAt]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zogular-orders-page-${state.page}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Current page exported.");
  }, [orders, state.page]);

  return (
    <div className="mx-auto flex w-full max-w-350 flex-col gap-4 pb-20 md:pb-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-950 md:text-3xl">Orders</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage your items from confirmation through operations handoff.</p>
        </div>
        <Button type="button" variant="outline" disabled={orders.length === 0} onClick={handleExport} className="h-10 self-start rounded-xl bg-white text-xs font-bold">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Export current page
        </Button>
      </header>

      <FeaturePendingNotice compact title="Payment details are still limited" description="Order totals cover only items assigned to your store. Final earnings and payment availability will appear when confirmed by Zogular." />

      <CollectionToolbar
        search={(
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <Input value={state.search} onChange={(event) => state.setSearch(event.target.value)} placeholder="Search order number, customer, or phone" aria-label="Search seller orders" className="h-10 rounded-xl pl-9 text-base md:text-sm" />
          </div>
        )}
        mobileFilters={<CollectionFilterSheet title="Order filters" description="Filter the complete seller order collection." activeCount={activeFilterCount}>{filters}</CollectionFilterSheet>}
        desktopControls={<div className="hidden xl:block">{filters}</div>}
        resultContext={<CollectionResultCount count={orders.length} total={data?.pagination.total ?? 0} label="orders" />}
        viewControl={<CollectionViewToggle value={state.view} onChange={state.setView} variant="icon" />}
      />

      {data ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Order status totals">
          <button type="button" onClick={() => state.setStatus(undefined)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${!state.status ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-600"}`}>All {data.summary.totalOrders}</button>
          {SELLER_ORDER_STATUSES.filter((item) => item.id !== "unknown").map((item) => (
            <button key={item.id} type="button" onClick={() => state.setStatus(item.id)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-black ${state.status === item.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-600"}`}>{item.title} {facets.get(item.id) ?? 0}</button>
          ))}
        </div>
      ) : null}

      {isInitialLoading ? <OrderCollectionSkeleton view={state.view} /> : null}
      {!isInitialLoading && ordersQuery.isError ? <CollectionErrorState title="Orders could not be loaded" description={ordersQuery.error instanceof Error ? ordersQuery.error.message : "Try the request again."} action={{ label: "Try again", onClick: () => void ordersQuery.refetch() }} /> : null}
      {!isInitialLoading && !ordersQuery.isError && data?.summary.totalOrders === 0 ? <CollectionState title="No orders yet" description="Orders containing your approved products will appear here when buyers place them." icon={Package} /> : null}
      {!isInitialLoading && !ordersQuery.isError && data && data.summary.totalOrders > 0 && orders.length === 0 ? <CollectionState title="No orders match these filters" description="Change the search, status, date range, or page to see other orders." action={{ label: "Clear status filter", onClick: () => state.setStatus(undefined) }} /> : null}
      {!isInitialLoading && !ordersQuery.isError && orders.length > 0 ? (
        <div className={ordersQuery.isFetching ? "opacity-70 transition-opacity" : "transition-opacity"} aria-busy={ordersQuery.isFetching}>
          {state.view === "list" ? <OrderList orders={orders} listUrl={state.listUrl} onCancel={setCancelTarget} /> : <OrderBoard orders={orders} visibleStatuses={visibleStatuses} facets={facets} listUrl={state.listUrl} onCancel={setCancelTarget} />}
        </div>
      ) : null}

      {data ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-3">
          <CollectionPagination page={data.pagination.page} totalPages={data.pagination.pages} onPageChange={state.setPage} disabled={ordersQuery.isFetching} />
          <label className="flex items-center justify-end gap-2 text-xs font-bold text-zinc-500">
            Orders per page
            <select value={state.limit} onChange={(event) => state.setLimit(Number(event.target.value))} className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-sm font-bold text-zinc-800">
              <option value={20}>20</option><option value={40}>40</option><option value={60}>60</option>
            </select>
          </label>
        </div>
      ) : null}

      <OrderCancellationDialog order={cancelTarget} open={Boolean(cancelTarget)} pending={cancellation.isPending} onOpenChange={(open) => !open && setCancelTarget(null)} onConfirm={() => cancelTarget && cancellation.mutate(cancelTarget.id)} />
    </div>
  );
}
