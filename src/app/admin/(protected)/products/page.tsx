"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, LayoutGrid, Package, Rows3, Search, ShieldAlert, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  adminProductsApi,
  type AdminProductRecord,
} from "@/services/admin/products";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import {
  getProductModerationStatusLabel,
  type ProductModerationAction,
  type ProductModerationStatus,
} from "@/services/product-moderation";

const STATUS_UI: Record<ProductModerationStatus, { bg: string; text: string; border: string }> = {
  draft: { bg: "bg-zinc-100", text: "text-zinc-700", border: "border-zinc-200" },
  pending_review: { bg: "bg-amber-950", text: "text-amber-100", border: "border-amber-400/50" },
  approved: { bg: "bg-emerald-950", text: "text-emerald-100", border: "border-emerald-400/50" },
  rejected: { bg: "bg-rose-950", text: "text-rose-100", border: "border-rose-400/50" },
  needs_changes: { bg: "bg-orange-950", text: "text-orange-100", border: "border-orange-400/50" },
  published: { bg: "bg-[#014d2b]", text: "text-emerald-100", border: "border-[#00b358]/40" },
  paused: { bg: "bg-amber-950", text: "text-amber-100", border: "border-amber-400/50" },
  suspended: { bg: "bg-red-950", text: "text-red-100", border: "border-red-400/50" },
};

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function formatDate(value: string | null) {
  if (!value) return "Awaiting submission";
  return new Intl.DateTimeFormat("en-ZM", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobileView, setMobileView] = useState<"list" | "grid">("list");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const identity = useAdminIdentity()!;
  const canModerate = adminIdentityHasPermission(identity, "moderate_products");

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      try {
        setLoading(true);
        setRequestError(null);
        const data = await adminProductsApi.fetchProducts();
        if (!ignore) setProducts(data);
      } catch (error) {
        if (!ignore) {
          const message = error instanceof Error ? error.message : "Failed to load product moderation queue.";
          setRequestError(message);
          toast.error(message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (statusFilter !== "all") {
      filtered = filtered.filter((product) => product.status === statusFilter);
    }
    const query = search.trim().toLowerCase();
    if (!query) return filtered;
    return filtered.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        product.sellerStore.toLowerCase().includes(query) ||
        product.id.toLowerCase().includes(query) ||
        product.categoryName.toLowerCase().includes(query)
      );
    });
  }, [products, search, statusFilter]);

  const summary = useMemo(() => {
    return {
      published: products.filter((product) => product.status === "published").length,
      pending: products.filter((product) => product.status === "pending_review").length,
      changesRequested: products.filter((product) => product.status === "needs_changes").length,
      flagged: products.filter((product) => product.flags > 0).length,
    };
  }, [products]);

  const filteredProductIds = useMemo(
    () => filteredProducts.map((product) => product.sellerProductId),
    [filteredProducts],
  );
  const allFilteredSelected =
    filteredProductIds.length > 0 &&
    filteredProductIds.every((id) => selectedProductIds.includes(id));
  const selectedPendingCount = useMemo(
    () =>
      products.filter(
        (product) =>
          selectedProductIds.includes(product.sellerProductId) &&
          product.status === "pending_review",
      ).length,
    [products, selectedProductIds],
  );



  function openReview(product: AdminProductRecord) {
    window.location.href = `/admin/products/${product.sellerProductId}`;
  }

  function toggleProductSelection(productId: string) {
    setSelectedProductIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  }

  async function handleBulkModeration(action: ProductModerationAction) {
    if (!canModerate) return toast.error("Unauthorized.");
    if (selectedProductIds.length === 0) return toast.error("Select products before running a bulk action.");

    try {
      setIsSubmitting(true);
      const selectedProducts = products.filter((product) => selectedProductIds.includes(product.sellerProductId));
      const eligibleProducts = selectedProducts.filter((product) => product.status === "pending_review");

      if (eligibleProducts.length === 0) {
        toast.error("Bulk moderation only works for products that are still pending review.");
        return;
      }

      const note =
        action === "approve"
          ? "Bulk approval by admin."
          : action === "request_changes"
            ? "Bulk changes request by admin."
            : "Bulk rejection by admin.";

      const result = await adminProductsApi.bulkReviewProducts(
        eligibleProducts.map((product) => product.sellerProductId),
        { action, note },
      );

      const refreshedProducts = await adminProductsApi.fetchProducts();
      setProducts(refreshedProducts);
      setSelectedProductIds([]);
      toast.success(`${result.count} products updated.`);
    } catch {
      toast.error("Failed to run bulk moderation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-xl bg-zinc-200/60" />
            <div className="h-4 w-96 animate-pulse rounded-lg bg-zinc-200/60" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[7.5rem] animate-pulse rounded-[1.55rem] bg-zinc-200/60 md:min-h-[8.5rem]" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-3xl bg-zinc-200/60" />
      </div>
    );
  }

  if (requestError) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-sm">
        <h1 className="text-xl font-black text-zinc-950">Product moderation queue unavailable</h1>
        <p className="mt-2 text-sm font-semibold text-zinc-600">{requestError}</p>
        <Button onClick={() => setReloadKey((value) => value + 1)} variant="outline" className="mt-5 rounded-xl font-black">Retry products</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[88rem] animate-in space-y-5 pb-10 fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Product Moderation</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Review submitted products before approval. Approved products are buyer-visible under the current backend rules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <SummaryCard
          title="Published"
          value={summary.published}
          note="Visible to buyers"
          tone="emerald"
          icon={<Package className="h-5 w-5" />}
        />
        <SummaryCard
          title="Pending Review"
          value={summary.pending}
          note="Needs admin action"
          tone="amber"
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <SummaryCard
          title="Needs Changes"
          value={summary.changesRequested}
          note="Waiting on seller edits"
          tone="orange"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <SummaryCard
          title="Flagged"
          value={summary.flagged}
          note="Optional backend signals"
          tone="rose"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      <div className="rounded-[1.75rem] border border-white/70 bg-white/75 p-2.5 shadow-md shadow-zinc-900/5 backdrop-blur-xl md:p-3.5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-2 min-[540px]:grid-cols-[152px_minmax(0,1fr)]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold shadow-inner outline-none focus-visible:ring-1 focus-visible:ring-zinc-900 md:h-10 md:text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending_review">Pending Review</option>
              <option value="needs_changes">Needs Changes</option>
              <option value="published">Published</option>
              <option value="approved">Approved</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </select>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product, seller, category, or ID..."
                className="h-9 w-full rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-xs font-medium shadow-inner focus-visible:ring-zinc-900 md:h-10 md:text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-1 md:hidden">
            <span className="pl-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">View</span>
            <div className="grid grid-cols-2 gap-1">
              <Button
                type="button"
                variant={mobileView === "list" ? "default" : "ghost"}
                onClick={() => setMobileView("list")}
                className={cn(
                  "h-8 rounded-xl px-3 text-[11px] font-black",
                  mobileView === "list"
                    ? "bg-zinc-950 text-white hover:bg-zinc-900"
                    : "text-zinc-600 hover:bg-white",
                )}
              >
                <Rows3 className="mr-1.5 h-3.5 w-3.5" />
                List
              </Button>
              <Button
                type="button"
                variant={mobileView === "grid" ? "default" : "ghost"}
                onClick={() => setMobileView("grid")}
                className={cn(
                  "h-8 rounded-xl px-3 text-[11px] font-black",
                  mobileView === "grid"
                    ? "bg-zinc-950 text-white hover:bg-zinc-900"
                    : "text-zinc-600 hover:bg-white",
                )}
              >
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                Grid
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-[540px]:flex-row min-[540px]:items-center min-[540px]:justify-between lg:flex-none lg:justify-end">
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600 min-[540px]:justify-start">
              <span>{selectedProductIds.length} selected</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span>{selectedPendingCount} pending</span>
            </div>
            <div className="grid grid-cols-3 gap-2 min-[540px]:flex min-[540px]:flex-wrap">
              <Button
                disabled={isSubmitting || selectedProductIds.length === 0}
                onClick={() => handleBulkModeration("approve")}
                className="h-9 rounded-xl bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 md:h-10"
              >
                Approve
              </Button>
              <Button
                disabled={isSubmitting || selectedProductIds.length === 0}
                onClick={() => handleBulkModeration("request_changes")}
                variant="outline"
                className="h-9 rounded-xl px-3 text-[11px] font-black md:h-10"
              >
                Changes
              </Button>
              <Button
                disabled={isSubmitting || selectedProductIds.length === 0}
                onClick={() => handleBulkModeration("reject")}
                variant="destructive"
                className="h-9 rounded-xl px-3 text-[11px] font-black md:h-10"
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className={cn("lg:hidden", mobileView === "grid" ? "grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 min-[720px]:grid-cols-3" : "space-y-2.5")}>
        {filteredProducts.length === 0 ? (
          <div className={cn("rounded-3xl border border-white/70 bg-white/75 px-4 py-10 text-center shadow-md shadow-zinc-900/5 backdrop-blur-xl", mobileView === "grid" && "col-span-full")}>
            <p className="text-sm font-bold text-zinc-500">No products match your search.</p>
          </div>
        ) : (
          filteredProducts.map((product) => {
            const statusUi = STATUS_UI[product.status];
            const isGridView = mobileView === "grid";
            return (
              <article
                key={product.sellerProductId}
                className={cn(
                  "border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(247,248,250,0.94))] backdrop-blur-2xl",
                  isGridView
                    ? "rounded-[1.35rem] p-2.5 shadow-[0_12px_26px_rgba(15,23,42,0.07)]"
                    : "rounded-[1.35rem] px-3 py-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
                )}
              >
                {isGridView ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${product.name}`}
                        checked={selectedProductIds.includes(product.sellerProductId)}
                        onChange={() => toggleProductSelection(product.sellerProductId)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300 accent-[#009E49]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-[13px] font-black leading-5 text-zinc-950">
                              {product.name}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                              <Store className="h-3 w-3 shrink-0" />
                              <span className="truncate">{product.sellerStore}</span>
                            </p>
                          </div>
                          <span className={cn("shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]", statusUi.bg, statusUi.text, statusUi.border)}>
                            {getProductModerationStatusLabel(product.status)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.1rem] border border-zinc-200/80 bg-zinc-50/90 px-2.5">
                      <GridDetailRow label="Category" value={product.categoryName} />
                      <GridDetailRow label="Submitted" value={formatDate(product.submittedAt)} />
                      <GridDetailRow label="Price" value={formatCurrency(product.price)} />
                      <GridDetailRow label="Stock" value={`${product.stock} units`} isLast />
                    </div>

                    {product.flags > 0 ? (
                      <p className="flex items-center gap-1 text-[10px] font-bold text-rose-600">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {product.flags} moderation signals
                      </p>
                    ) : null}

                    <div className={cn("grid gap-2", product.status === "approved" || product.status === "published" ? "grid-cols-2" : "grid-cols-1")}>
                      <Button
                        onClick={() => openReview(product)}
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl border-zinc-200 bg-white text-[11px] font-bold text-zinc-700 shadow-sm hover:bg-zinc-900 hover:text-white"
                      >
                        {product.status === "pending_review" ? "Review" : "View"}
                      </Button>
                      {product.status === "approved" ? (
                        <Button
                          disabled
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl border-emerald-200 bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700"
                        >
                          Buyer-visible
                        </Button>
                      ) : null}
                      {product.status === "published" ? (
                        <Button
                          disabled
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl border-amber-200 bg-amber-50 px-3 text-[11px] font-bold text-amber-800"
                        >
                          Suspend via review
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${product.name}`}
                      checked={selectedProductIds.includes(product.sellerProductId)}
                      onChange={() => toggleProductSelection(product.sellerProductId)}
                      className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-[#009E49]"
                    />
                    <div className="min-w-0 flex-1">
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-[13px] font-black leading-5 text-zinc-950">
                              {product.name}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                              <Store className="h-3 w-3 shrink-0" />
                              <span className="truncate">{product.sellerStore}</span>
                            </p>
                          </div>
                          <span className={cn("shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]", statusUi.bg, statusUi.text, statusUi.border)}>
                            {getProductModerationStatusLabel(product.status)}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-600">
                          <ListInlineMetric label="Category" value={product.categoryName} />
                          <ListInlineMetric label="Submitted" value={formatDate(product.submittedAt)} />
                          <ListInlineMetric label="Price" value={formatCurrency(product.price)} />
                          <ListInlineMetric label="Stock" value={`${product.stock} units`} />
                        </div>

                        {product.flags > 0 ? (
                          <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-600">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            {product.flags} moderation signals
                          </p>
                        ) : null}

                        <div className={cn("mt-1.5 flex items-center gap-2", product.status === "approved" || product.status === "published" ? "justify-between" : "justify-start")}>
                          <Button
                            onClick={() => openReview(product)}
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl border-zinc-200 bg-white px-3 text-[10px] font-bold text-zinc-700 shadow-sm hover:bg-zinc-900 hover:text-white"
                          >
                            {product.status === "pending_review" ? "Review" : "View"}
                          </Button>
                          {product.status === "approved" ? (
                            <Button
                              disabled
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold text-emerald-700"
                            >
                              Buyer-visible
                            </Button>
                          ) : product.status === "published" ? (
                            <Button
                              disabled
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl border-amber-200 bg-amber-50 px-3 text-[10px] font-bold text-amber-800"
                            >
                              Suspend via review
                            </Button>
                          ) : null}
                        </div>
                      </>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-md shadow-zinc-900/5 backdrop-blur-xl lg:block">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-100/80 backdrop-blur-sm">
              <tr>
                <th className="rounded-tl-2xl p-3 pl-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProductIds(Array.from(new Set([...selectedProductIds, ...filteredProductIds])));
                        } else {
                          const visibleIds = new Set(filteredProductIds);
                          setSelectedProductIds(selectedProductIds.filter(id => !visibleIds.has(id)));
                        }
                      }}
                      className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600"
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">All</span>
                  </div>
                </th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Product & Seller</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Status</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Category</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Submitted</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-zinc-500">Price & Stock</th>
                <th className="rounded-tr-2xl p-3 pr-4 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center">
                    <p className="text-sm font-bold text-zinc-500">No products match your search.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const statusUi = STATUS_UI[product.status];
                  return (
                    <tr key={product.sellerProductId} className="group transition-colors hover:bg-amber-50/35">
                      <td className="p-3 pl-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${product.name}`}
                          checked={selectedProductIds.includes(product.sellerProductId)}
                          onChange={() => toggleProductSelection(product.sellerProductId)}
                          className="h-4 w-4 rounded border-zinc-300 accent-[#009E49]"
                        />
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-zinc-900 transition-colors group-hover:text-amber-700">{product.name}</p>
                        <p className="mt-1 flex items-center text-[10px] font-bold text-zinc-500">
                          <Store className="mr-1 h-3 w-3" /> {product.sellerStore} • {product.id}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className={cn("inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", statusUi.bg, statusUi.text, statusUi.border)}>
                          {getProductModerationStatusLabel(product.status)}
                        </span>
                        {product.flags > 0 ? (
                          <p className="mt-1.5 flex items-center text-[10px] font-bold text-rose-600">
                            <ShieldAlert className="mr-1 h-3 w-3" /> {product.flags} moderation signals
                          </p>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-zinc-900">{product.categoryName}</p>
                        <p className="text-[10px] font-medium text-zinc-500">{product.subcategoryName}</p>
                        <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-[10px] font-bold text-zinc-500">
                          Backend category snapshot
                        </p>
                      </td>
                      <td className="p-3 text-xs font-bold text-zinc-600">{formatDate(product.submittedAt)}</td>
                      <td className="p-3">
                        <p className="font-black text-zinc-900">{formatCurrency(product.price)}</p>
                        <p className="text-[10px] font-bold text-zinc-500">{product.stock} units</p>
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <Button
                          onClick={() => openReview(product)}
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-zinc-200 font-bold text-zinc-700 shadow-sm hover:bg-zinc-900 hover:text-white"
                        >
                          {product.status === "pending_review" ? "Review" : "View"}
                        </Button>
                        {product.status === "approved" ? (
                          <Button disabled size="sm" variant="outline" className="ml-2 h-9 rounded-xl border-emerald-200 bg-emerald-50 font-bold text-emerald-700">Buyer-visible</Button>
                        ) : null}
                        {product.status === "published" ? (
                          <Button disabled size="sm" variant="outline" className="ml-2 h-9 rounded-xl border-amber-200 bg-amber-50 font-bold text-amber-800">Suspend via review</Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function SummaryCard({
  title,
  value,
  note,
  tone,
  icon,
}: {
  title: string;
  value: number;
  note: string;
  tone: "emerald" | "amber" | "orange" | "rose";
  icon: ReactNode;
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: "border-emerald-200/70 from-white via-emerald-50/70 to-emerald-100/60 text-emerald-700",
    amber: "border-amber-200/70 from-white via-amber-50/70 to-orange-100/60 text-amber-700",
    orange: "border-orange-200/70 from-white via-orange-50/70 to-amber-100/60 text-orange-700",
    rose: "border-rose-200/70 from-white via-rose-50/70 to-red-100/60 text-rose-700",
  };

  return (
    <div className={cn("min-h-[7.5rem] rounded-[1.55rem] border bg-linear-to-br p-3.5 shadow-md shadow-zinc-900/5 transition-all hover:-translate-y-0.5 hover:shadow-lg md:min-h-[8.5rem] md:p-4", toneClasses[tone])}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/80 text-current shadow-sm md:h-9 md:w-9">
          {icon}
        </div>
      </div>
      <h3 className="text-[1.65rem] font-black leading-none text-zinc-950 md:text-[2rem]">{value}</h3>
      <p className="mt-1 text-[10px] font-bold leading-4 md:text-[11px]">{note}</p>
    </div>
  );
}

function GridDetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 py-2", !isLast && "border-b border-zinc-200/80")}>
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="truncate text-right text-[11px] font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function ListInlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">{label}</span>
      <span className="text-[10px] font-bold text-zinc-700">{value}</span>
    </span>
  );
}
