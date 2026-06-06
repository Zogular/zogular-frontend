"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Package, Search, ShieldAlert, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  adminProductsApi,
  type AdminProductRecord,
} from "@/services/admin/products";
import { recordAdminAudit } from "@/services/admin/audit";
import { adminHasPermission, CURRENT_ADMIN_IDENTITY } from "@/services/admin/session";
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
  const [search, setSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});

  const canModerate = adminHasPermission("moderate_products");

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      try {
        setLoading(true);
        const data = await adminProductsApi.fetchProducts();
        if (!ignore) setProducts(data);
      } catch {
        if (!ignore) toast.error("Failed to load product moderation queue.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadProducts();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(query) ||
        product.sellerStore.toLowerCase().includes(query) ||
        product.id.toLowerCase().includes(query) ||
        product.categoryName.toLowerCase().includes(query)
      );
    });
  }, [products, search]);

  const summary = useMemo(() => {
    return {
      published: products.filter((product) => product.status === "published").length,
      pending: products.filter((product) => product.status === "pending_review").length,
      changesRequested: products.filter((product) => product.status === "needs_changes").length,
      flagged: products.filter((product) => product.flags > 0).length,
    };
  }, [products]);



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
      const updatedProducts = await Promise.all(selectedProducts.map((product) => adminProductsApi.reviewProduct(product.sellerProductId, {
        action,
        note: `Bulk ${action} action by admin.`,
      })));
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: `product_bulk_${action}`,
        target: `${selectedProducts.length} products`,
        severity: "warning",
        note: `Bulk ${action} action by admin.`,
      });
      setProducts((current) => current.map((product) => updatedProducts.find((updated) => updated.sellerProductId === product.sellerProductId) ?? product));
      setSelectedProductIds([]);
      toast.success(`${selectedProducts.length} products updated.`);
    } catch {
      toast.error("Failed to run bulk moderation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCategoryOverride(product: AdminProductRecord, value: string) {
    setCategoryOverrides((current) => ({ ...current, [product.sellerProductId]: value }));
    await recordAdminAudit({
      actorId: CURRENT_ADMIN_IDENTITY.id,
      action: "product_category_override_drafted",
      target: product.sellerProductId,
      note: value,
    });
    toast.success("Category override draft saved.");
  }

  async function handlePublishState(product: AdminProductRecord, status: ProductModerationStatus) {
    if (!canModerate) return toast.error("Unauthorized.");
    try {
      setIsSubmitting(true);
      const updated = await adminProductsApi.updateProductStatus(product.sellerProductId, status);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: `product_${status}`,
        target: product.sellerProductId,
        severity: status === "suspended" ? "critical" : "warning",
      });
      setProducts((current) => current.map((item) => item.sellerProductId === product.sellerProductId ? updated : item));
      toast.success(`Product moved to ${getProductModerationStatusLabel(status)}.`);
    } catch {
      toast.error("Failed to update product status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="h-96 w-full animate-pulse rounded-3xl bg-zinc-200" />;
  }

  return (
    <div className="mx-auto max-w-[88rem] animate-in space-y-6 pb-12 fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Product Moderation</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Review submitted products before backend publication and keep future moderation signals isolated for integration.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="rounded-3xl border border-white/70 bg-white/75 p-4 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, seller, category, or ID..."
            className="h-11 rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium shadow-inner focus-visible:ring-zinc-900"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-600">{selectedProductIds.length} selected</span>
          <Button disabled={isSubmitting || selectedProductIds.length === 0} onClick={() => handleBulkModeration("approve")} className="rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">Bulk approve</Button>
          <Button disabled={isSubmitting || selectedProductIds.length === 0} onClick={() => handleBulkModeration("request_changes")} variant="outline" className="rounded-xl font-black">Bulk changes</Button>
          <Button disabled={isSubmitting || selectedProductIds.length === 0} onClick={() => handleBulkModeration("reject")} variant="destructive" className="rounded-xl font-black">Bulk reject</Button>
        </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-100/80 backdrop-blur-sm">
              <tr>
                <th className="rounded-tl-2xl p-4 pl-6 text-[10px] font-black uppercase tracking-wider text-zinc-500">Select</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Product & Seller</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Category</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Submitted</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Price & Stock</th>
                <th className="rounded-tr-2xl p-4 pr-6 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Action</th>
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
                      <td className="p-4 pl-6">
                        <input
                          type="checkbox"
                          aria-label={`Select ${product.name}`}
                          checked={selectedProductIds.includes(product.sellerProductId)}
                          onChange={() => toggleProductSelection(product.sellerProductId)}
                          className="h-4 w-4 rounded border-zinc-300 accent-[#009E49]"
                        />
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-zinc-900 transition-colors group-hover:text-amber-700">{product.name}</p>
                        <p className="mt-1 flex items-center text-[10px] font-bold text-zinc-500">
                          <Store className="mr-1 h-3 w-3" /> {product.sellerStore} • {product.id}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className={cn("inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", statusUi.bg, statusUi.text, statusUi.border)}>
                          {getProductModerationStatusLabel(product.status)}
                        </span>
                        {product.flags > 0 ? (
                          <p className="mt-1.5 flex items-center text-[10px] font-bold text-rose-600">
                            <ShieldAlert className="mr-1 h-3 w-3" /> {product.flags} moderation signals
                          </p>
                        ) : null}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-zinc-900">{product.categoryName}</p>
                        <p className="text-[10px] font-medium text-zinc-500">{product.subcategoryName}</p>
                        <select
                          value={categoryOverrides[product.sellerProductId] ?? product.categoryName}
                          onChange={(event) => handleCategoryOverride(product, event.target.value)}
                          className="mt-2 h-8 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-[10px] font-bold text-zinc-700"
                        >
                          <option value={product.categoryName}>{product.categoryName}</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Fashion">Fashion</option>
                          <option value="Home & Living">Home & Living</option>
                          <option value="Healthcare & Beauty">Healthcare & Beauty</option>
                        </select>
                      </td>
                      <td className="p-4 text-xs font-bold text-zinc-600">{formatDate(product.submittedAt)}</td>
                      <td className="p-4">
                        <p className="font-black text-zinc-900">{formatCurrency(product.price)}</p>
                        <p className="text-[10px] font-bold text-zinc-500">{product.stock} units</p>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <Button
                          onClick={() => openReview(product)}
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-zinc-200 font-bold text-zinc-700 shadow-sm hover:bg-zinc-900 hover:text-white"
                        >
                          {product.status === "pending_review" ? "Review" : "View"}
                        </Button>
                        {product.status === "approved" ? (
                          <Button onClick={() => handlePublishState(product, "published")} size="sm" className="ml-2 h-9 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700">Publish</Button>
                        ) : null}
                        {product.status === "published" ? (
                          <Button onClick={() => handlePublishState(product, "suspended")} size="sm" variant="destructive" className="ml-2 h-9 rounded-xl font-bold">Suspend</Button>
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
    <div className={cn("rounded-3xl border bg-linear-to-br p-5 shadow-md shadow-zinc-900/5 transition-all hover:-translate-y-0.5 hover:shadow-lg", toneClasses[tone])}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{title}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-current shadow-sm">
          {icon}
        </div>
      </div>
      <h3 className="text-3xl font-black text-zinc-950">{value}</h3>
      <p className="mt-1 text-xs font-bold">{note}</p>
    </div>
  );
}
