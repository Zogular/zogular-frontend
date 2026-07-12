"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { 
  Search, Clock3, Package, Truck, CheckCircle2, Download, MoreHorizontal, 
  MapPin, XCircle, RotateCcw, CreditCard, Phone, Copy, AlertCircle 
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import { CollectionViewToggle, type CollectionViewMode } from "@/components/shared/CollectionViewToggle";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import {
  sellerOrdersApi,
  type SellerOrderStatus,
  type SellerOrderSummary,
  type SellerPaymentStatus,
} from "@/services/seller-orders";

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================
type DateFilter = "today" | "7days" | "30days" | "all";

// ============================================================================
// 3. UI CONFIG & LOGIC HELPERS
// ============================================================================
const STATUS_COLUMNS = [
  { id: "new", title: "New Orders", icon: Clock3, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { id: "confirmed", title: "Confirmed", icon: CheckCircle2, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { id: "processing", title: "Preparing", icon: Package, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { id: "shipped", title: "Shipped", icon: Truck, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  { id: "delivered", title: "Delivered", icon: CheckCircle2, color: "text-[#009E49]", bg: "bg-[#009E49]/10", border: "border-[#009E49]/30" },
  { id: "cancelled", title: "Cancelled", icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  { id: "refund", title: "Refunds", icon: RotateCcw, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  { id: "unknown", title: "Status unavailable", icon: AlertCircle, color: "text-zinc-600", bg: "bg-zinc-100", border: "border-zinc-200" },
] as const;

const PAYMENT_STYLES: Record<SellerPaymentStatus, string> = {
  paid: "bg-[#009E49]/10 text-[#009E49] border-[#009E49]/20",
  cod: "bg-zinc-100 text-zinc-700 border-zinc-200",
  refunded: "bg-orange-50 text-orange-700 border-orange-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  unavailable: "bg-amber-50 text-amber-800 border-amber-200",
};

const PAYMENT_LABELS: Record<SellerPaymentStatus, string> = {
  paid: "Paid",
  cod: "COD",
  refunded: "Refunded",
  failed: "Failed",
  unavailable: "Pending backend",
};

function formatRelativeTime(value: string): string {
  const diffMins = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diffMins < 60) return `${diffMins} mins ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
}

function isWithinDateFilter(value: string, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const diffDays = (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24);
  if (filter === "today") return diffDays < 1;
  if (filter === "7days") return diffDays <= 7;
  return diffDays <= 30;
}

// ============================================================================
// 4. SUBCOMPONENTS
// ============================================================================
function OrderActionMenu({
  order,
  onCancelOrder,
}: {
  order: SellerOrderSummary;
  onCancelOrder: (orderId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(order.id);
      toast.success("Order ID copied to clipboard.");
    } catch {
      toast.error("Unable to copy order ID.");
    } finally {
      setIsOpen(false);
    }
  };

  return (
    <ActionMenu open={isOpen} onOpenChange={setIsOpen}>
      <ActionMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Open order actions for ${order.id}`}
          className="h-8 w-8 shrink-0 rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </ActionMenuTrigger>

      <ActionMenuContent>
        <ActionMenuItem onClick={handleCopyId}>
          <Copy className="h-3.5 w-3.5 text-zinc-400" /> Copy Order ID
        </ActionMenuItem>
        <ActionMenuItem onClick={() => { window.location.href = `tel:${order.phone}`; }}>
          <div className="flex w-full items-center gap-2 cursor-pointer">
            <Phone className="h-3.5 w-3.5 text-zinc-400" /> Call Customer
          </div>
        </ActionMenuItem>
        {(["new", "confirmed", "processing"] as SellerOrderStatus[]).includes(order.status) ? (
          <>
            <ActionMenuSeparator />
            <ActionMenuItem
              onClick={() => {
                onCancelOrder(order.id);
                setIsOpen(false);
              }}
              className="text-red-600 hover:bg-red-50 focus-visible:ring-red-200"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel Order
            </ActionMenuItem>
          </>
        ) : null}
      </ActionMenuContent>
    </ActionMenu>
  );
}

function OrderCard({
  order,
  onCancelOrder,
}: {
  order: SellerOrderSummary;
  onCancelOrder: (orderId: string) => void;
}) {
  const statusMeta = STATUS_COLUMNS.find(c => c.id === order.status);
  
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md flex flex-col min-w-70">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{order.id}</span>
            {statusMeta && (
              <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusMeta.bg} ${statusMeta.color} ${statusMeta.border}`}>
                {statusMeta.title}
              </span>
            )}
          </div>
          <h3 className="truncate text-sm font-bold text-zinc-900">{order.customer}</h3>
        </div>
        <OrderActionMenu order={order} onCancelOrder={onCancelOrder} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-medium text-zinc-500">
        <div className="flex items-center"><Package className="mr-2 h-3.5 w-3.5 text-zinc-400 shrink-0" /> {order.items} Items</div>
        <div className="flex items-center truncate"><MapPin className="mr-2 h-3.5 w-3.5 text-zinc-400 shrink-0" /> <span className="truncate">{order.location}</span></div>
        <div className="flex items-center"><Phone className="mr-2 h-3.5 w-3.5 text-zinc-400 shrink-0" /> {order.phone}</div>
        <div className="flex items-center">
          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${PAYMENT_STYLES[order.paymentStatus]}`}>
            <CreditCard className="mr-1 h-3 w-3 shrink-0" /> {PAYMENT_LABELS[order.paymentStatus]}
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-zinc-100 pt-3 mt-auto">
        <div className="min-w-0">
          <p suppressHydrationWarning className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            {formatRelativeTime(order.createdAt)}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">Visible Items Total</p>
          <p className="mt-0.5 text-sm font-black text-zinc-900">K{order.total.toLocaleString()}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/seller/orders/${order.id}`}>
            <Button size="sm" className="h-8 rounded-lg bg-zinc-900 px-3 text-xs font-bold text-white shadow-sm hover:bg-zinc-800">
              Manage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. MAIN PAGE EXPORT
// ============================================================================
export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<SellerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<SellerOrderStatus | "all">("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("30days");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileView, setMobileView] = useState<CollectionViewMode>("list");

  const handleCancelOrder = useCallback(async (orderId: string) => {
    const target = orders.find((order) => order.id === orderId);
    if (!target) return;

    if (target.status === "cancelled") {
      toast.message("Order is already cancelled.");
      return;
    }
    if (target.status === "delivered") {
      toast.error("Delivered orders cannot be cancelled.");
      return;
    }
    try {
      await sellerOrdersApi.cancelOrder(orderId);
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: "cancelled" } : order,
        ),
      );
      toast.success(`Order ${orderId} cancelled.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel order.");
    }
  }, [orders]);

  // --- API DATA FETCHING ---
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await sellerOrdersApi.fetchSummaries();
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // --- FILTERING ENGINE ---
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesDate = isWithinDateFilter(order.createdAt, dateFilter);
      const matchesQuery = !query || order.id.toLowerCase().includes(query) || order.customer.toLowerCase().includes(query) || order.phone.includes(query);
      return matchesStatus && matchesDate && matchesQuery;
    });
  }, [orders, dateFilter, searchQuery, statusFilter]);

  // --- CSV EXPORT ENGINE ---
  const handleExportCSV = () => {
    const headers = ["Order ID", "Customer", "Phone", "Location", "Items", "Visible Items Total (Kwacha)", "Status", "Payment", "Date"];
    
    const csvRows = filteredOrders.map(order => [
      order.id,
      `"${order.customer}"`,
      order.phone,
      `"${order.location}"`,
      order.items,
      order.total,
      order.status.toUpperCase(),
      PAYMENT_LABELS[order.paymentStatus].toUpperCase(),
      new Date(order.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Zogular_Orders_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Orders exported successfully!");
  };  

  // --- SYSTEM STATES ---
  if (loading) return <SellerPageLoading variant="table" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center mt-6">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-base font-bold text-red-900">Failed to load orders</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <Button onClick={loadOrders} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
          Try Again
        </Button>
      </div>
    );
  }

  // --- MAIN UI ---
  return (
    <div className="mx-auto max-w-350 animate-in fade-in space-y-6 pb-20 duration-500 md:pb-0 h-full flex flex-col">
      <Toaster />

      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Orders</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage fulfillment, track deliveries, and handle seller actions.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleExportCSV}
          className="hidden h-11 rounded-xl border-zinc-200 bg-white px-4 font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 md:inline-flex"
        >
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <FeaturePendingNotice
        compact
        title="Payment and settlement fields are limited"
        description="Totals on this page cover only the seller-visible line items. Payment method, payment status, commission, and seller net stay hidden or marked pending until seller finance endpoints return them."
      />

      {/* 2. FILTERS & SEARCH */}
      <div className="relative z-40 flex shrink-0 flex-col gap-3 rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(e.target.value.length > 0); }}
            onFocus={() => { if(searchQuery.length > 0) setIsSearchOpen(true); }}
            onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
            placeholder="Search order ID, customer, phone..."
            className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium shadow-inner focus-visible:ring-[#009E49]"
          />
          {isSearchOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)] animate-in fade-in slide-in-from-top-2">
              <div className="max-h-75 space-y-1 overflow-y-auto p-2">
                {filteredOrders.length > 0 ? (
                  filteredOrders.map(order => (
                    <Link key={order.id} href={`/seller/orders/${order.id}`} className="flex items-center justify-between rounded-lg border border-transparent p-3 transition-colors hover:border-zinc-100 hover:bg-zinc-50">
                      <div>
                        <p className="text-xs font-black text-zinc-900">{order.id}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{order.customer}</p>
                      </div>
                      <div className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${STATUS_COLUMNS.find(c => c.id === order.status)?.bg} ${STATUS_COLUMNS.find(c => c.id === order.status)?.color}`}>
                        {order.status}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm font-bold text-zinc-500">No orders found.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <select 
            aria-label="Filter orders by status"
            value={statusFilter} 
            title="Filter by status"
            onChange={(e) => setStatusFilter(e.target.value as SellerOrderStatus | "all")} 
            className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] md:w-40"
          >
            <option value="all">All Statuses</option>
            {STATUS_COLUMNS.map(col => <option key={col.id} value={col.id}>{col.title}</option>)}
          </select>

          <select 
            aria-label="Filter orders by date range"
            value={dateFilter} 
            title="Filter by date range"
            onChange={(e) => setDateFilter(e.target.value as DateFilter)} 
            className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] md:w-32"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      <CollectionViewToggle
        value={mobileView}
        onChange={setMobileView}
        className="md:hidden"
      />

      {/* 3. UNIFIED KANBAN VIEW (Desktop & Mobile) */}
      <div className="hidden flex-1 items-start gap-4 overflow-x-auto px-4 pb-4 pt-2 -mx-4 hide-scrollbar snap-x snap-mandatory md:flex md:gap-6 md:px-2 md:-mx-2">
        {STATUS_COLUMNS.map((column) => {
          const columnOrders = filteredOrders.filter(o => o.status === column.id);
          const Icon = column.icon;
          return (
            <div key={column.id} className="flex w-[85vw] max-w-[320px] min-w-[280px] md:min-w-[320px] flex-col gap-4 snap-center shrink-0">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-[#f4fbf6] pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${column.bg} ${column.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="truncate text-sm font-black text-zinc-900">{column.title}</h2>
                </div>
                <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500">{columnOrders.length}</span>
              </div>

              <div className="flex flex-col gap-3">
                {columnOrders.map(order => (
                  <OrderCard key={order.id} order={order} onCancelOrder={handleCancelOrder} />
                ))}
                {columnOrders.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white/50 p-6 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Empty</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="md:hidden">
        {mobileView === "list" ? (
          filteredOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-200 bg-white/60 p-10 text-center">
              <p className="text-sm font-bold text-zinc-500">No orders match this view.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
              <div className="divide-y divide-zinc-100">
                {filteredOrders.map((order) => {
                  const statusMeta = STATUS_COLUMNS.find((c) => c.id === order.status);
                  return (
                    <div key={order.id} className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-black text-zinc-900">{order.customer}</p>
                          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{order.id}</p>
                        </div>
                        {statusMeta ? (
                          <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${statusMeta.bg} ${statusMeta.color} ${statusMeta.border}`}>
                            {statusMeta.title}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-600">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Items</span>
                          <span>{order.items}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Phone</span>
                          <span>{order.phone}</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Time</span>
                          <span suppressHydrationWarning>{formatRelativeTime(order.createdAt)}</span>
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">Visible Items Total</p>
                          <span className="text-sm font-black text-zinc-900">K{order.total.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/seller/orders/${order.id}`}>
                            <Button size="sm" className="h-8 rounded-xl bg-zinc-900 px-3 text-[10px] font-bold text-white hover:bg-zinc-800">
                              Manage
                            </Button>
                          </Link>
                          <OrderActionMenu order={order} onCancelOrder={handleCancelOrder} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div className="flex items-start gap-4 overflow-x-auto px-4 pb-4 pt-2 -mx-4 hide-scrollbar snap-x snap-mandatory">
            {STATUS_COLUMNS.map((column) => {
              const columnOrders = filteredOrders.filter((o) => o.status === column.id);
              const Icon = column.icon;
              return (
                <div key={column.id} className="flex w-[85vw] max-w-[320px] min-w-[280px] flex-col gap-4 snap-center shrink-0">
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-[#f4fbf6] pb-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${column.bg} ${column.color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <h2 className="truncate text-sm font-black text-zinc-900">{column.title}</h2>
                    </div>
                    <span className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500">{columnOrders.length}</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {columnOrders.map((order) => (
                      <OrderCard key={order.id} order={order} onCancelOrder={handleCancelOrder} />
                    ))}
                    {columnOrders.length === 0 ? (
                      <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white/50 p-6 text-center">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Empty</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
