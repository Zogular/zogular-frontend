"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollectionErrorState, CollectionState } from "@/components/collection/collection-state";
import { CollectionSkeleton } from "@/components/collection/collection-skeleton";
import { DENSE_COLLECTION_GRID_CLASS } from "@/components/collection/collection-grid-density";
import { CollectionPagination } from "@/components/collection/collection-pagination";
import { useSellerApplication } from "@/components/seller/SellerApplicationContext";
import { rememberListScroll, useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import { useCollectionQueryState } from "@/hooks/use-collection-query-state";
import {
  duplicateSellerProduct,
  fetchSellerCatalogProductPage,
  removeSellerProduct,
  submitSellerProductForReview as submitSellerProductForReviewRequest,
  unpublishSellerProduct as unpublishSellerProductRequest,
  withdrawSellerProductReview as withdrawSellerProductReviewRequest,
  type SellerProductListing,
  type SellerProductListQuery,
  type SellerProductStatus,
} from "@/services/seller-catalog";
import { hasSellerCapability } from "@/services/vendor-application";
import { SellerProductGridCard } from "@/features/seller-products/seller-product-grid-card";
import { SellerProductListRow } from "@/features/seller-products/seller-product-list-row";
import { SellerProductsHeader } from "@/features/seller-products/seller-products-header";
import { SellerProductsOverview } from "@/features/seller-products/seller-products-overview";
import {
  SellerProductsTabs,
  isSellerProductTab,
  type SellerProductTab,
} from "@/features/seller-products/seller-products-tabs";
import { SellerProductsToolbar } from "@/features/seller-products/seller-products-toolbar";
import {
  isSellerProductsSortOption,
  type SellerProductActions,
  type SellerProductsSortOption,
  type SellerProductsSummary,
} from "@/features/seller-products/types";
import {
  isProductSnapshotConflict,
  parseProductContentPolicyError,
  storeSafeProductContentPolicyIssues,
} from "@/services/product-content-policy";
import {
  getProductSubmissionRecoveryHref,
  writeProductSubmissionRecovery,
} from "./new/_lib/product-draft-recovery";

const SELLER_PRODUCTS_QUERY_KEY = ["seller", "catalog", "products"] as const;
const PRODUCT_TAB_STATUS: Partial<Record<SellerProductTab, SellerProductStatus>> = {
  published: "published",
  draft: "draft",
  pending_review: "pending_review",
  approved: "approved",
  paused: "paused",
  suspended: "suspended",
};

function buildSellerProductQuery(
  activeTab: SellerProductTab,
  sort: SellerProductsSortOption,
  input: Pick<SellerProductListQuery, "page" | "limit" | "search" | "categorySlug">,
): SellerProductListQuery {
  const sortContract: Record<SellerProductsSortOption, Pick<SellerProductListQuery, "sortBy" | "sortOrder">> = {
    newest: { sortBy: "createdAt", sortOrder: "desc" },
    updated: { sortBy: "updatedAt", sortOrder: "desc" },
    "title-asc": { sortBy: "title", sortOrder: "asc" },
    "price-asc": { sortBy: "price", sortOrder: "asc" },
    "price-desc": { sortBy: "price", sortOrder: "desc" },
    "stock-low": { sortBy: "stock", sortOrder: "asc" },
    "stock-high": { sortBy: "stock", sortOrder: "desc" },
  };

  return {
    ...input,
    ...sortContract[sort],
    status: PRODUCT_TAB_STATUS[activeTab],
    statusGroup: activeTab === "needs_changes" ? "needs_changes" : undefined,
    stockState: activeTab === "low-stock"
      ? "low_stock"
      : activeTab === "out-of-stock"
        ? "out_of_stock"
        : undefined,
  };
}

export default function SellerProductsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { application } = useSellerApplication();
  const {
    activeTab,
    categoryFilter,
    currentUrl,
    limit,
    page,
    pathname,
    searchQuery,
    serverSearch,
    setActiveTab,
    setCategoryFilter,
    setLimit,
    setPage,
    setSearchQuery,
    setSort,
    setView,
    sort,
    view,
  } = useCollectionQueryState({
    defaultTab: "all" as SellerProductTab,
    isTab: isSellerProductTab,
    defaultSort: "newest" as SellerProductsSortOption,
    isSort: isSellerProductsSortOption,
  });

  const sellerStatus = application?.status ?? null;
  const canCreateDraftProduct = hasSellerCapability(sellerStatus, "canCreateDraftProduct");
  const canSubmitProductForReview = hasSellerCapability(sellerStatus, "canSubmitProductForReview");
  const actionFallbackHref = !application || sellerStatus === "DRAFT" || sellerStatus === "NEEDS_INFO"
    ? "/seller/onboarding"
    : "/seller/status";

  const productListQuery = useMemo(() => buildSellerProductQuery(activeTab, sort, {
    page,
    limit,
    search: serverSearch || undefined,
    categorySlug: categoryFilter === "all" ? undefined : categoryFilter,
  }), [activeTab, categoryFilter, limit, page, serverSearch, sort]);
  const productsQuery = useQuery({
    queryKey: [...SELLER_PRODUCTS_QUERY_KEY, productListQuery],
    queryFn: () => fetchSellerCatalogProductPage(productListQuery),
    enabled: canCreateDraftProduct,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const products = productsQuery.data?.products ?? [];
  const loading = canCreateDraftProduct && productsQuery.isPending;
  const error = productsQuery.error instanceof Error
    ? productsQuery.error.message
    : productsQuery.error
      ? "An unknown error occurred"
      : null;

  const getReturnTo = useCallback(() => `${pathname}${window.location.search}`, [pathname]);
  const refreshProducts = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: SELLER_PRODUCTS_QUERY_KEY });
  }, [queryClient]);

  const duplicateProduct = useCallback(async (product: SellerProductListing) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Your seller account is not eligible to change products yet.");
      return;
    }
    try {
      await duplicateSellerProduct(product.id);
      await refreshProducts();
      toast.success(`${product.title} duplicated as draft.`);
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to duplicate product.");
    }
  }, [actionFallbackHref, canCreateDraftProduct, refreshProducts, router]);

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
      toast.error("Your seller account must be fully approved before submitting products for review.");
      return;
    }
    try {
      const updated = await submitSellerProductForReviewRequest(productId);
      void updated;
      await refreshProducts();
      toast.success("Product submitted for review.");
    } catch (requestError) {
      const policyIssues = parseProductContentPolicyError(requestError);
      if (policyIssues) {
        writeProductSubmissionRecovery(productId, {
          kind: "content-policy",
          issues: storeSafeProductContentPolicyIssues(policyIssues),
        });
        router.push(getProductSubmissionRecoveryHref(productId, "content-policy"));
        return;
      }
      if (isProductSnapshotConflict(requestError)) {
        toast.error("This product changed. Reload the latest version and try again.");
        return;
      }
      toast.error("Unable to submit this product for review. Try again.");
    }
  }, [canSubmitProductForReview, refreshProducts, router]);

  const withdrawProductReview = useCallback(async (productId: string) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Your seller account is not eligible to change products yet.");
      return;
    }
    try {
      const updated = await withdrawSellerProductReviewRequest(productId);
      void updated;
      await refreshProducts();
      toast.success("Review withdrawn. Product moved back to drafts.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to withdraw review.");
    }
  }, [actionFallbackHref, canCreateDraftProduct, refreshProducts, router]);

  const unpublishProduct = useCallback(async (productId: string) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Your seller account is not eligible to change products yet.");
      return;
    }
    try {
      const updated = await unpublishSellerProductRequest(productId);
      void updated;
      await refreshProducts();
      toast.success("Listing paused and removed from buyer visibility.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to pause listing.");
    }
  }, [actionFallbackHref, canCreateDraftProduct, refreshProducts, router]);

  const removeProduct = useCallback(async (productId: string) => {
    if (!canCreateDraftProduct) {
      router.push(actionFallbackHref);
      toast.error("Seller approval is required before mutating products.");
      return;
    }
    try {
      await removeSellerProduct(productId);
      await refreshProducts();
      toast.success("Product removed from this list.");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to remove product.");
    }
  }, [actionFallbackHref, canCreateDraftProduct, refreshProducts, router]);

  const productActions = useMemo<SellerProductActions>(() => ({
    edit: editProduct,
    view: viewProduct,
    duplicate: duplicateProduct,
    submitForReview: submitProductForReview,
    withdrawReview: withdrawProductReview,
    pause: unpublishProduct,
    remove: removeProduct,
  }), [duplicateProduct, editProduct, removeProduct, submitProductForReview, unpublishProduct, viewProduct, withdrawProductReview]);

  const facets = productsQuery.data?.facets;
  const summary = useMemo<SellerProductsSummary>(() => ({
    total: productsQuery.data?.summary.total ?? 0,
    buyerVisible: productsQuery.data?.summary.buyerVisible ?? 0,
    draft: facets?.statuses.draft ?? 0,
    pendingReview: productsQuery.data?.summary.pendingReview ?? 0,
    lowStock: productsQuery.data?.summary.lowStock ?? 0,
    outOfStock: productsQuery.data?.summary.outOfStock ?? 0,
  }), [facets?.statuses.draft, productsQuery.data?.summary]);

  const tabCounts = useMemo<Record<SellerProductTab, number>>(() => ({
    all: summary.total,
    published: facets?.statuses.published ?? 0,
    draft: facets?.statuses.draft ?? 0,
    pending_review: facets?.statuses.pending_review ?? 0,
    approved: facets?.statuses.approved ?? 0,
    needs_changes: (facets?.statuses.needs_changes ?? 0) + (facets?.statuses.rejected ?? 0),
    paused: facets?.statuses.paused ?? 0,
    suspended: facets?.statuses.suspended ?? 0,
    "low-stock": facets?.stock.lowStock ?? 0,
    "out-of-stock": facets?.stock.outOfStock ?? 0,
  }), [facets, summary.total]);

  useListScrollRestoration(currentUrl, !loading);

  if (!application || !canCreateDraftProduct) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-black tracking-tight text-amber-950">Seller approval is not ready for product access</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-amber-800">Product drafts become available after your seller application reaches an eligible review stage. Complete onboarding or check your seller status for the next step.</p>
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
            categories={facets?.categories ?? []}
            view={view}
            onViewChange={setView}
            sort={sort}
            onSortChange={setSort}
            limit={limit}
            onLimitChange={setLimit}
            resultCount={products.length}
            totalCount={productsQuery.data?.pagination.total ?? 0}
          />

          {products.length === 0 ? (
            <CollectionState
              title={summary.total === 0 ? "No products yet" : "No matching products"}
              description={summary.total === 0
                ? "Create your first product draft to begin building your catalog."
                : "No products match the current search, category, and status filters."}
              action={summary.total === 0
                ? { label: "Add product", onClick: () => router.push("/seller/products/new") }
                : { label: "Clear filters", onClick: () => router.push(pathname, { scroll: false }) }}
            />
          ) : view === "grid" ? (
            <section
              aria-label="Seller products grid"
              className={DENSE_COLLECTION_GRID_CLASS}
            >
              {products.map((product, index) => (
                <SellerProductGridCard
                  key={product.id}
                  product={product}
                  actions={productActions}
                  eager={index < 4}
                />
              ))}
            </section>
          ) : (
            <section aria-label="Seller products list" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="hidden min-h-10 items-center border-b border-zinc-100 bg-zinc-50/80 px-4 xl:flex">
                <div className="grid min-w-0 flex-1 grid-cols-[64px_minmax(0,1fr)_112px_96px_128px] gap-4 text-[9px] font-black uppercase tracking-wide text-zinc-500">
                  <span>Image</span><span>Product</span><span>Price</span><span>Stock</span><span>Status</span>
                </div>
                <span className="ml-1 w-9" />
              </div>
              {products.map((product) => <SellerProductListRow key={product.id} product={product} actions={productActions} />)}
            </section>
          )}

          <CollectionPagination
            page={productsQuery.data?.pagination.page ?? page}
            totalPages={productsQuery.data?.pagination.pages ?? 0}
            onPageChange={setPage}
            disabled={productsQuery.isFetching}
          />
        </>
      ) : null}
    </div>
  );
}
