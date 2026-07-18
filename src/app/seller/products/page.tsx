"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollectionErrorState, CollectionState } from "@/components/collection/collection-state";
import { CollectionSkeleton } from "@/components/collection/collection-skeleton";
import { useSellerApplication } from "@/components/seller/SellerApplicationContext";
import { rememberListScroll, useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import { useCollectionQueryState } from "@/hooks/use-collection-query-state";
import {
  duplicateSellerProduct,
  fetchSellerCatalogProducts,
  removeSellerProduct,
  submitSellerProductForReview as submitSellerProductForReviewRequest,
  unpublishSellerProduct as unpublishSellerProductRequest,
  withdrawSellerProductReview as withdrawSellerProductReviewRequest,
  type SellerProductListing,
} from "@/services/seller-catalog";
import {
  isSellerProductBuyerVisibleStatus,
  isSellerProductNeedsChangesStatus,
} from "@/services/product-moderation";
import { hasSellerCapability } from "@/services/vendor-application";
import { SellerProductGridCard } from "@/features/seller-products/seller-product-grid-card";
import { SellerProductListRow } from "@/features/seller-products/seller-product-list-row";
import { SellerProductsHeader } from "@/features/seller-products/seller-products-header";
import { SellerProductsOverview } from "@/features/seller-products/seller-products-overview";
import {
  SELLER_PRODUCT_TABS,
  SellerProductsTabs,
  isSellerProductTab,
  type SellerProductTab,
} from "@/features/seller-products/seller-products-tabs";
import { SellerProductsToolbar } from "@/features/seller-products/seller-products-toolbar";
import { getSellerProductStockState } from "@/features/seller-products/product-presentation";
import type { SellerProductActions, SellerProductsSummary } from "@/features/seller-products/types";

const SELLER_PRODUCTS_QUERY_KEY = ["seller", "catalog", "products"] as const;
const EMPTY_PRODUCTS: SellerProductListing[] = [];

function matchesSellerProductTab(product: SellerProductListing, tab: SellerProductTab) {
  const stockState = getSellerProductStockState(product);
  if (tab === "all") return true;
  if (tab === "low-stock") return stockState === "low-stock";
  if (tab === "out-of-stock") return stockState === "out-of-stock";
  if (tab === "needs_changes") return isSellerProductNeedsChangesStatus(product.status);
  return product.status === tab;
}

export default function SellerProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { application } = useSellerApplication();
  const {
    activeTab,
    categoryFilter,
    currentUrl,
    pathname,
    searchQuery,
    setActiveTab,
    setCategoryFilter,
    setSearchQuery,
    setView,
    view,
  } = useCollectionQueryState({ defaultTab: "all" as SellerProductTab, isTab: isSellerProductTab });

  const sellerStatus = application?.status ?? null;
  const canCreateDraftProduct = hasSellerCapability(sellerStatus, "canCreateDraftProduct");
  const canSubmitProductForReview = hasSellerCapability(sellerStatus, "canSubmitProductForReview");
  const actionFallbackHref = !application || sellerStatus === "DRAFT" || sellerStatus === "NEEDS_INFO"
    ? "/seller/onboarding"
    : "/seller/status";

  const productsQuery = useQuery({
    queryKey: SELLER_PRODUCTS_QUERY_KEY,
    queryFn: fetchSellerCatalogProducts,
    enabled: canCreateDraftProduct,
    staleTime: 60_000,
  });
  const products = productsQuery.data ?? EMPTY_PRODUCTS;
  const loading = canCreateDraftProduct && productsQuery.isPending;
  const error = productsQuery.error instanceof Error
    ? productsQuery.error.message
    : productsQuery.error
      ? "An unknown error occurred"
      : null;

  const getReturnTo = useCallback(() => `${pathname}${window.location.search}`, [pathname]);
  const updateProducts = useCallback((updater: (current: SellerProductListing[]) => SellerProductListing[]) => {
    queryClient.setQueryData<SellerProductListing[]>(SELLER_PRODUCTS_QUERY_KEY, (current = []) => updater(current));
  }, [queryClient]);

  const duplicateProduct = useCallback(async (product: SellerProductListing) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Seller approval is required before mutating products.");
      return;
    }
    try {
      const duplicate = await duplicateSellerProduct(product.id);
      updateProducts((current) => [duplicate, ...current]);
      toast.success(`${product.title} duplicated as draft.`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to duplicate product.");
    }
  }, [actionFallbackHref, canCreateDraftProduct, router, updateProducts]);

  const editProduct = useCallback((product: SellerProductListing) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Seller approval is required before editing products.");
      return;
    }
    if (product.status === "pending_review") {
      toast.warning("Withdraw review before editing this product.");
      return;
    }
    router.push(`/seller/products/${product.id}/edit?returnTo=${encodeURIComponent(getReturnTo())}`);
  }, [actionFallbackHref, canCreateDraftProduct, getReturnTo, router]);

  const viewProduct = useCallback((product: SellerProductListing) => {
    rememberListScroll(getReturnTo());
    router.push(`/seller/products/${product.id}?returnTo=${encodeURIComponent(getReturnTo())}`);
  }, [getReturnTo, router]);

  const submitProductForReview = useCallback(async (productId: string) => {
    if (!canSubmitProductForReview) {
      router.push("/seller/status");
      toast.error("Only APPROVED sellers can submit products for review.");
      return;
    }
    try {
      const updated = await submitSellerProductForReviewRequest(productId);
      updateProducts((current) => current.map((product) => product.id === productId ? updated : product));
      toast.success("Product submitted for review.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to update product.");
    }
  }, [canSubmitProductForReview, router, updateProducts]);

  const withdrawProductReview = useCallback(async (productId: string) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Seller approval is required before mutating products.");
      return;
    }
    try {
      const updated = await withdrawSellerProductReviewRequest(productId);
      updateProducts((current) => current.map((product) => product.id === productId ? updated : product));
      toast.success("Review withdrawn. Product moved back to drafts.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to withdraw review.");
    }
  }, [actionFallbackHref, canCreateDraftProduct, router, updateProducts]);

  const unpublishProduct = useCallback(async (productId: string) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Seller approval is required before mutating products.");
      return;
    }
    try {
      const updated = await unpublishSellerProductRequest(productId);
      updateProducts((current) => current.map((product) => product.id === productId ? updated : product));
      toast.success("Listing paused and removed from buyer visibility.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to pause listing.");
    }
  }, [actionFallbackHref, canCreateDraftProduct, router, updateProducts]);

  const removeProduct = useCallback(async (productId: string) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Seller approval is required before mutating products.");
      return;
    }
    try {
      await removeSellerProduct(productId);
      updateProducts((current) => current.filter((product) => product.id !== productId));
      toast.success("Product removed from this list.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to remove product.");
    }
  }, [actionFallbackHref, canCreateDraftProduct, router, updateProducts]);

  const productActions = useMemo<SellerProductActions>(() => ({
    edit: editProduct,
    view: viewProduct,
    duplicate: duplicateProduct,
    submitForReview: submitProductForReview,
    withdrawReview: withdrawProductReview,
    pause: unpublishProduct,
    remove: removeProduct,
  }), [duplicateProduct, editProduct, removeProduct, submitProductForReview, unpublishProduct, viewProduct, withdrawProductReview]);

  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.categoryName))).sort(), [products]);
  const summary = useMemo<SellerProductsSummary>(() => ({
    total: products.length,
    buyerVisible: products.filter((product) => isSellerProductBuyerVisibleStatus(product.status)).length,
    draft: products.filter((product) => product.status === "draft").length,
    pendingReview: products.filter((product) => product.status === "pending_review").length,
    lowStock: products.filter((product) => getSellerProductStockState(product) === "low-stock").length,
    outOfStock: products.filter((product) => getSellerProductStockState(product) === "out-of-stock").length,
  }), [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query
        || product.title.toLowerCase().includes(query)
        || product.id.toLowerCase().includes(query)
        || product.brand.toLowerCase().includes(query);
      const matchesCategory = categoryFilter === "all" || product.categoryName === categoryFilter;
      return matchesSearch && matchesCategory && matchesSellerProductTab(product, activeTab);
    });
  }, [activeTab, categoryFilter, products, searchQuery]);

  const tabCounts = useMemo(() => SELLER_PRODUCT_TABS.reduce<Record<SellerProductTab, number>>((counts, tab) => {
    counts[tab.id] = products.filter((product) => matchesSellerProductTab(product, tab.id)).length;
    return counts;
  }, {} as Record<SellerProductTab, number>), [products]);

  useListScrollRestoration(currentUrl, !loading);

  if (!application || !canCreateDraftProduct) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-black tracking-tight text-amber-950">Seller approval is not ready for product access</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-amber-800">Product drafts are available only after seller status moves to PROVISIONAL or APPROVED. Complete seller onboarding or follow your seller review status first.</p>
        <Button asChild className="mt-5 h-10 rounded-lg bg-[#009E49] px-5 font-bold text-white hover:bg-[#00853d]">
          <Link href={actionFallbackHref}>
            {actionFallbackHref === "/seller/onboarding" ? "Continue seller application" : "View seller status"}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-350 space-y-4 animate-in fade-in duration-300">
      <SellerProductsHeader addProductHref="/seller/products/new" showDraftOnlyNotice={!canSubmitProductForReview} />

      {loading ? <CollectionSkeleton view={view} label="Loading products" /> : null}

      {!loading && error ? (
        <CollectionErrorState
          title="Failed to load products"
          description={error}
          action={{ label: "Try again", onClick: () => { void productsQuery.refetch(); } }}
        />
      ) : null}

      {!loading && !error ? (
        <>
          <SellerProductsOverview summary={summary} />
          <SellerProductsTabs activeTab={activeTab} counts={tabCounts} onChange={setActiveTab} />
          <SellerProductsToolbar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            categories={categories}
            view={view}
            onViewChange={setView}
            resultCount={filteredProducts.length}
            totalCount={products.length}
          />

          {filteredProducts.length === 0 ? (
            <CollectionState
              title={products.length === 0 ? "No products yet" : "No matching products"}
              description={products.length === 0
                ? "Create your first product draft to begin building your catalog."
                : "No products match the current search, category, and status filters."}
              action={products.length === 0
                ? { label: "Add product", onClick: () => router.push("/seller/products/new") }
                : { label: "Clear filters", onClick: () => router.push(pathname, { scroll: false }) }}
            />
          ) : view === "grid" ? (
            <section aria-label="Seller products grid" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product) => <SellerProductGridCard key={product.id} product={product} actions={productActions} />)}
            </section>
          ) : (
            <section aria-label="Seller products list" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="hidden min-h-10 items-center border-b border-zinc-100 bg-zinc-50/80 px-4 xl:flex">
                <div className="grid min-w-0 flex-1 grid-cols-[64px_minmax(0,1fr)_112px_96px_128px] gap-4 text-[9px] font-black uppercase tracking-wide text-zinc-500">
                  <span>Image</span><span>Product</span><span>Price</span><span>Stock</span><span>Status</span>
                </div>
                <span className="ml-1 w-9" />
              </div>
              {filteredProducts.map((product) => <SellerProductListRow key={product.id} product={product} actions={productActions} />)}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
