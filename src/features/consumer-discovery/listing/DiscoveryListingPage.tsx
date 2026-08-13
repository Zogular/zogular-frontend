import Link from "next/link";
import { ProductPagination } from "@/components/product/ProductPagination";
import { ProductGrid } from "@/features/consumer-discovery/components/ProductGrid";
import { DiscoveryListingHeader, type ListingBreadcrumb, type ListingSubcategory } from "@/features/consumer-discovery/listing/DiscoveryListingHeader";
import { DiscoveryListingState, type DiscoveryListingStateKind } from "@/features/consumer-discovery/listing/DiscoveryListingState";
import { DiscoveryListingControls, type DiscoveryFilterOption } from "@/features/consumer-discovery/listing/DiscoveryListingControls";
import type { DiscoveryQueryState } from "@/features/consumer-discovery/types/discovery.types";
import type { ProductPaginationMeta } from "@/types/category";
import type { Product } from "@/types/product";

type DiscoveryListingPageProps = {
  breadcrumbs: readonly ListingBreadcrumb[];
  title: string;
  description?: string;
  approvedPublicProductCount?: number;
  subcategories?: readonly ListingSubcategory[];
  products: readonly Product[];
  pagination?: ProductPaginationMeta;
  query: DiscoveryQueryState;
  basePath: string;
  state?: DiscoveryListingStateKind;
  clearHref?: string;
  searchTerm?: string;
  filters?: readonly DiscoveryFilterOption[];
  filterMetadataAvailable?: boolean;
};

export function DiscoveryListingPage({
  breadcrumbs,
  title,
  description,
  approvedPublicProductCount,
  subcategories,
  products,
  pagination,
  query,
  basePath,
  state,
  clearHref,
  searchTerm,
  filters = [],
  filterMetadataAvailable = true,
}: DiscoveryListingPageProps) {
  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-5 md:pt-7 lg:pt-8">
      <div className="container mx-auto max-w-[1440px] space-y-5 px-4 md:space-y-6">
        <DiscoveryListingHeader
          breadcrumbs={breadcrumbs}
          title={title}
          description={description}
          approvedPublicProductCount={approvedPublicProductCount}
          subcategories={subcategories}
        />

        <DiscoveryListingControls
          query={query}
          basePath={basePath}
          filters={filters}
          total={pagination?.total}
          startItem={pagination?.startItem}
          endItem={pagination?.endItem}
          filterMetadataAvailable={filterMetadataAvailable}
        />

        {state ? (
          <DiscoveryListingState kind={state} query={searchTerm} clearHref={clearHref} />
        ) : (
          <div className="min-w-0 lg:grid lg:grid-cols-[112px_minmax(0,1fr)] lg:items-start lg:gap-3">
            <aside className="hidden lg:block" aria-label="Product filters">
              <div className="sticky top-32 space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm" data-testid="desktop-filter-rail">
                <h2 className="px-1 text-sm font-black text-zinc-950">Filter</h2>
                {filterMetadataAvailable && filters.length > 1 ? filters.map((filter) => (
                  <Link key={filter.key} href={filter.href} prefetch={false} aria-current={filter.active ? "page" : undefined} className={filter.active ? "flex min-h-11 items-center rounded-xl bg-zinc-900 px-3 text-sm font-bold text-white" : "flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"}>{filter.label}</Link>
                )) : <p className="px-1 py-2 text-xs leading-5 text-zinc-500">{filterMetadataAvailable ? "No additional filters are available." : "Category filters are unavailable right now."}</p>}
              </div>
            </aside>
            <div className="min-w-0 space-y-5">
              <ProductGrid products={products} label={`${title} product results`} className="xl:grid-cols-[repeat(5,minmax(0,220px))] xl:justify-between" />
              {pagination && pagination.totalPages > 1 ? (
                <ProductPagination basePath={basePath} page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} startItem={pagination.startItem} endItem={pagination.endItem} query={query} />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
