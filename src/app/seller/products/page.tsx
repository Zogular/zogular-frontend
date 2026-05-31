"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Box, Filter, Image as ImageIcon, MoreVertical, Package, Plus, Search, AlertCircle,
  Layers, CheckCircle2, FileEdit, AlertTriangle, XCircle, Eye, Pencil, Trash2,
  Send, RotateCcw, PauseCircle, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActionMenu,
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuNote,
  ActionMenuSeparator,
  ActionMenuTrigger,
} from "@/components/ui/action-menu";
import { toast } from "sonner";
import { SellerPageLoading } from "@/components/seller/SellerPageLoading";
import {
  duplicateSellerProduct,
  fetchSellerCatalogProducts,
  removeSellerProduct,
  submitSellerProductForReview as submitSellerProductForReviewRequest,
  unpublishSellerProduct as unpublishSellerProductRequest,
  withdrawSellerProductReview as withdrawSellerProductReviewRequest,
  type SellerProductListing,
  type SellerProductStatus,
} from "@/services/seller-catalog";
import { getProductModerationStatusLabel } from "@/services/product-moderation";

// ============================================================================
// 1. DATA CONTRACTS
// ============================================================================
type ProductTab =
  | "all"
  | "published"
  | "draft"
  | "pending_review"
  | "approved"
  | "needs_changes"
  | "rejected"
  | "paused"
  | "suspended"
  | "low-stock"
  | "out-of-stock";

const PRODUCT_TABS: Array<{ id: ProductTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Draft" },
  { id: "pending_review", label: "Pending Review" },
  { id: "approved", label: "Approved" },
  { id: "needs_changes", label: "Needs Changes" },
  { id: "rejected", label: "Rejected" },
  { id: "paused", label: "Paused" },
  { id: "suspended", label: "Suspended" },
  { id: "low-stock", label: "Low Stock" },
  { id: "out-of-stock", label: "Out of Stock" },
];

// ============================================================================
// 3. LOGIC HELPERS
// ============================================================================
function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function getStockState(product: SellerProductListing) {
  if (product.stock === 0) return "out-of-stock";
  if (product.stock <= product.lowStockThreshold) return "low-stock";
  return "in-stock";
}

// ============================================================================
// 4. SUBCOMPONENTS
// ============================================================================
function ListingStatusBadge({ status }: { status: SellerProductStatus }) {
  const styles: Record<SellerProductStatus, string> = {
    published: "bg-[#009E49]/10 text-[#009E49] border-[#009E49]/20",
    draft: "bg-zinc-100 text-zinc-700 border-zinc-200",
    pending_review: "bg-blue-50 text-blue-700 border-blue-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    needs_changes: "bg-orange-50 text-orange-700 border-orange-200",
    rejected: "bg-red-50 text-red-600 border-red-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
    suspended: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${styles[status]}`}>
      {getProductModerationStatusLabel(status)}
    </span>
  );
}

function StockBadge({ product }: { product: SellerProductListing }) {
  const stockState = getStockState(product);

  if (stockState === "out-of-stock") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">
        <Box className="h-3.5 w-3.5" /> 0
      </span>
    );
  }

  if (stockState === "low-stock") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
        <Box className="h-3.5 w-3.5" /> {product.stock}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-bold text-zinc-600">
      <Box className="h-3.5 w-3.5" /> {product.stock}
    </span>
  );
}

function CategoryDropdown({ value, onChange, categories }: { value: string; onChange: (v: string) => void; categories: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const displayValue = value === "all" ? "All Categories" : value;

  return (
    <div className="relative w-full md:w-56 shrink-0">
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-11 w-full items-center justify-between rounded-xl border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-[#009E49]"
      >
        <span className="truncate">{displayValue}</span>
        <Filter className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-full origin-top-right overflow-hidden rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.1)] animate-in fade-in slide-in-from-top-2 md:w-60">
            <div className="max-h-75 overflow-y-auto hide-scrollbar space-y-0.5">
              <button
                type="button"
                onClick={() => { onChange("all"); setIsOpen(false); }}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${value === "all" ? "bg-[#009E49]/10 text-[#009E49]" : "text-zinc-700 hover:bg-zinc-100"}`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { onChange(cat); setIsOpen(false); }}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${value === cat ? "bg-[#009E49]/10 font-bold text-[#009E49]" : "text-zinc-700 hover:bg-zinc-100"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProductActionMenu({
  product,
  onEdit,
  onView,
  onDuplicate,
  onSubmitForReview,
  onWithdrawReview,
  onUnpublish,
  onRemove,
}: {
  product: SellerProductListing;
  onEdit: (product: SellerProductListing) => void;
  onView: (product: SellerProductListing) => void;
  onDuplicate: (product: SellerProductListing) => void;
  onSubmitForReview: (productId: string) => void;
  onWithdrawReview: (productId: string) => void;
  onUnpublish: (productId: string) => void;
  onRemove: (productId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isRejectedFamily = product.status === "rejected" || product.status === "needs_changes";
  const isPublishedFamily = product.status === "published" || product.status === "approved";
  const isPausedFamily = product.status === "paused";

  const closeAfter = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <ActionMenu open={open} onOpenChange={setOpen}>
      <ActionMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Open product actions for ${product.title}`}
          className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </ActionMenuTrigger>
      <ActionMenuContent className="w-56">
        {product.status === "draft" ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => onEdit(product))}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => onView(product))}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => onRemove(product.id))} className="text-red-600 hover:bg-red-50 focus-visible:ring-red-200">
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </ActionMenuItem>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => onSubmitForReview(product.id))} className="text-[#009E49] hover:bg-emerald-50">
              <Send className="h-3.5 w-3.5" />
              Submit for Review
            </ActionMenuItem>
          </>
        ) : null}

        {product.status === "pending_review" ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => onView(product))}>
              <Eye className="h-3.5 w-3.5" />
              View
            </ActionMenuItem>
            <ActionMenuNote>Withdraw review before editing this product.</ActionMenuNote>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => onWithdrawReview(product.id))} className="text-amber-700 hover:bg-amber-50">
              <RotateCcw className="h-3.5 w-3.5" />
              Withdraw Review
            </ActionMenuItem>
          </>
        ) : null}

        {isRejectedFamily ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => onView(product))}>
              <Eye className="h-3.5 w-3.5" />
              View Reason / Preview
            </ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => onEdit(product))}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionMenuItem>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => onSubmitForReview(product.id))} className="text-[#009E49] hover:bg-emerald-50">
              <Send className="h-3.5 w-3.5" />
              Resubmit
            </ActionMenuItem>
          </>
        ) : null}

        {isPublishedFamily ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => onView(product))}>
              <Eye className="h-3.5 w-3.5" />
              View
            </ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => onEdit(product))}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => onUnpublish(product.id))} className="text-amber-700 hover:bg-amber-50">
              <PauseCircle className="h-3.5 w-3.5" />
              Pause/Unpublish
            </ActionMenuItem>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => onDuplicate(product))}>
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </ActionMenuItem>
          </>
        ) : null}

        {isPausedFamily ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => onView(product))}>
              <Eye className="h-3.5 w-3.5" />
              View
            </ActionMenuItem>
            <ActionMenuItem onClick={() => closeAfter(() => onEdit(product))}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </ActionMenuItem>
            <ActionMenuSeparator />
            <ActionMenuItem onClick={() => closeAfter(() => onDuplicate(product))}>
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </ActionMenuItem>
          </>
        ) : null}

        {product.status === "suspended" ? (
          <>
            <ActionMenuItem onClick={() => closeAfter(() => onView(product))}>
              <Eye className="h-3.5 w-3.5" />
              View
            </ActionMenuItem>
            <ActionMenuNote>This listing is controlled by moderation.</ActionMenuNote>
          </>
        ) : null}
      </ActionMenuContent>
    </ActionMenu>
  );
}

// ============================================================================
// 5. MAIN PAGE EXPORT
// ============================================================================
export default function SellerProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<SellerProductListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ProductTab>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const duplicateProduct = useCallback(async (product: SellerProductListing) => {
    try {
      const duplicate = await duplicateSellerProduct(product.id);
      setProducts((prev) => [duplicate, ...prev]);
      toast.success(`${product.title} duplicated as draft.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate product.");
    }
  }, []);

  const editProduct = useCallback((product: SellerProductListing) => {
    if (product.status === "pending_review") {
      toast.warning("Withdraw review before editing this product.");
      return;
    }
    router.push(`/seller/products/${product.id}/edit`);
  }, [router]);

  const viewProduct = useCallback((product: SellerProductListing) => {
    router.push(`/seller/products/${product.id}`);
  }, [router]);

  const submitProductForReview = useCallback(async (productId: string) => {
    try {
      const updated = await submitSellerProductForReviewRequest(productId);
      setProducts((prev) => prev.map((product) => (product.id === productId ? updated : product)));
      toast.success("Product submitted for review.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update product.");
    }
  }, []);

  const withdrawProductReview = useCallback(async (productId: string) => {
    try {
      const updated = await withdrawSellerProductReviewRequest(productId);
      setProducts((prev) => prev.map((product) => (product.id === productId ? updated : product)));
      toast.success("Review withdrawn. Product moved back to drafts.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to withdraw review.");
    }
  }, []);

  const unpublishProduct = useCallback(async (productId: string) => {
    try {
      const updated = await unpublishSellerProductRequest(productId);
      setProducts((prev) => prev.map((product) => (product.id === productId ? updated : product)));
      toast.success("Product unpublished and moved to paused.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unpublish product.");
    }
  }, []);

  const removeProduct = useCallback(async (productId: string) => {
    try {
      await removeSellerProduct(productId);
      setProducts((prev) => prev.filter((product) => product.id !== productId));
      toast.success("Product removed from this list.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove product.");
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSellerCatalogProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.categoryName))).sort(), [products]);

  const summary = useMemo(() => {
    return {
      total: products.length,
      published: products.filter((p) => p.status === "published" || p.status === "approved").length,
      draft: products.filter((p) => p.status === "draft").length,
      pendingReview: products.filter((p) => p.status === "pending_review").length,
      lowStock: products.filter((p) => getStockState(p) === "low-stock").length,
      outOfStock: products.filter((p) => getStockState(p) === "out-of-stock").length,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || product.title.toLowerCase().includes(query) || product.id.toLowerCase().includes(query) || product.brand.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "all" || product.categoryName === categoryFilter;
      const stockState = getStockState(product);
      const matchesTab = activeTab === "all" || (activeTab === "low-stock" && stockState === "low-stock") || (activeTab === "out-of-stock" && stockState === "out-of-stock") || product.status === activeTab;
      
      return matchesSearch && matchesCategory && matchesTab;
    });
  }, [products, activeTab, categoryFilter, searchQuery]);

  const tabCounts = useMemo(() => {
    return PRODUCT_TABS.reduce<Record<ProductTab, number>>((acc, tab) => {
      acc[tab.id] = products.filter((product) => {
        const stockState = getStockState(product);
        if (tab.id === "all") return true;
        if (tab.id === "low-stock") return stockState === "low-stock";
        if (tab.id === "out-of-stock") return stockState === "out-of-stock";
        return product.status === tab.id;
      }).length;
      return acc;
    }, {} as Record<ProductTab, number>);
  }, [products]);

  // --- SYSTEM STATES ---
  if (loading) return <SellerPageLoading variant="table" />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center mt-6">
        <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
        <h3 className="text-base font-bold text-red-900">Failed to load products</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <Button onClick={loadProducts} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-350 animate-in space-y-5 fade-in slide-in-from-bottom-4 duration-500 min-w-0">
      
      {/* 1. HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Products</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage inventory, pricing, visibility, and product review status.</p>
        </div>
        <Link href="/seller/products/new">
          <Button className="h-11 w-full rounded-xl bg-[#009E49] px-6 font-bold text-white shadow-[0_4px_15px_rgba(0,158,73,0.2)] transition-all hover:bg-[#00853d] active:scale-95 md:w-auto">
            <Plus className="mr-2 h-5 w-5" /> Add New Product
          </Button>
        </Link>
      </div>

      {/* 2. KPI SUMMARY (Upgraded UI) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Total</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-600">
              <Layers className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-950">{summary.total}</p>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl border border-[#009E49]/20 bg-[#009E49]/5 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#009E49]">Published</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#009E49]/10 text-[#009E49]">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900">{summary.published}</p>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Pending Review</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 text-blue-700">
              <FileEdit className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900">{summary.pendingReview}</p>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Low Stock</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-200/50 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-950">{summary.lowStock}</p>
        </div>
        
        <div className="relative overflow-hidden rounded-2xl border border-red-200 bg-red-50/80 p-4 shadow-sm transition-all hover:shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Out of Stock</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-200/50 text-red-700">
              <XCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="text-2xl font-black text-red-950">{summary.outOfStock}</p>
        </div>
      </div>

      {/* 3. TABS (Horizontal Scroll on Mobile) */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 hide-scrollbar">
        {PRODUCT_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
                isActive ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              {tab.label}
              <span className={`ml-2 rounded-md px-2 py-0.5 text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"}`}>
                {tabCounts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>

        {/* 4. FILTERS & SEARCH */}
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] md:flex-row relative z-30">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, ID, or brand..."
              className="h-11 w-full rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium focus-visible:ring-[#009E49] shadow-inner"
            />
          </div>

          <CategoryDropdown 
            value={categoryFilter} 
            onChange={setCategoryFilter} 
            categories={categories} 
          />
      </div>

      {/* 5. PRODUCT LIST (Desktop Table / Mobile Stack) */}
      <div className="overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        
        {/* Desktop Table Header */}
        <div className="hidden grid-cols-[72px_minmax(0,1fr)_120px_120px_120px_52px] items-center gap-4 border-b border-zinc-100 bg-zinc-50/50 p-4 md:grid">
          <div className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">Image</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Product Info</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Price</div>
          <div className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">Stock</div>
          <div className="text-center text-[10px] font-bold uppercase tracking-wider text-zinc-400">Status</div>
          <div />
        </div>

        {filteredProducts.length > 0 ? (
          <div className="divide-y divide-zinc-100">
            {filteredProducts.map((product) => (
              <div key={product.id} className="grid grid-cols-1 gap-4 p-4 transition-colors hover:bg-zinc-50/50 md:grid-cols-[72px_minmax(0,1fr)_120px_120px_120px_52px] md:items-center">
                
                <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 md:h-12 md:w-12">
                  {product.images[0]?.url ? (
                    <Image src={product.images[0].url} alt={product.title} fill sizes="64px" unoptimized className="object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-zinc-300" />
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-zinc-900">{product.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{product.id}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-300" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{product.brand}</span>
                    <span className="h-1 w-1 rounded-full bg-zinc-300" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{product.categoryName}</span>
                  </div>
                  {product.moderation?.moderationNotes && (product.status === "needs_changes" || product.status === "rejected") ? (
                    <p className="mt-2 truncate text-[11px] font-medium text-orange-700">
                      {product.moderation.moderationNotes}
                    </p>
                  ) : null}
                </div>

                <div className="hidden text-sm font-black text-zinc-900 md:block">{formatCurrency(product.salePrice ?? product.price)}</div>
                <div className="hidden justify-center md:flex"><StockBadge product={product} /></div>
                <div className="hidden justify-center md:flex"><ListingStatusBadge status={product.status} /></div>

                <div className="hidden justify-end md:flex">
                  <ProductActionMenu
                    product={product}
                    onEdit={editProduct}
                    onView={viewProduct}
                    onDuplicate={duplicateProduct}
                    onSubmitForReview={submitProductForReview}
                    onWithdrawReview={withdrawProductReview}
                    onUnpublish={unpublishProduct}
                    onRemove={removeProduct}
                  />
                </div>

                {/* Mobile View Additions */}
                <div className="flex items-center justify-between border-t border-zinc-100 pt-3 mt-1 md:hidden">
                  <div className="text-sm font-black text-zinc-900">{formatCurrency(product.salePrice ?? product.price)}</div>
                  <div className="flex items-center gap-2">
                    <StockBadge product={product} />
                    <ListingStatusBadge status={product.status} />
                    <ProductActionMenu
                      product={product}
                      onEdit={editProduct}
                      onView={viewProduct}
                      onDuplicate={duplicateProduct}
                      onSubmitForReview={submitProductForReview}
                      onWithdrawReview={withdrawProductReview}
                      onUnpublish={unpublishProduct}
                      onRemove={removeProduct}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <Package className="h-6 w-6" />
            </div>
            <h3 className="text-base font-black text-zinc-900">No products found</h3>
            <p className="mt-1 max-w-md text-sm font-medium text-zinc-500">Try changing your search, switching tabs, or clearing the category filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
