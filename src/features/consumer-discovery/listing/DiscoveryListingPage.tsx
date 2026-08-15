import { ProductPagination } from "@/components/product/ProductPagination";
import { ProductGrid } from "@/features/consumer-discovery/components/ProductGrid";
import { DiscoveryListingHeader, type ListingBreadcrumb, type ListingSubcategory } from "@/features/consumer-discovery/listing/DiscoveryListingHeader";
import { DiscoveryListingState, type DiscoveryListingStateKind } from "@/features/consumer-discovery/listing/DiscoveryListingState";
import { DiscoveryListingControls, type DiscoveryFilterOption } from "@/features/consumer-discovery/listing/DiscoveryListingControls";
import { DesktopSubcategoryFilterRail } from "@/features/consumer-discovery/listing/DesktopSubcategoryFilterRail";
import {
  DiscoveryListingResultBoundary,
  DiscoveryListingTransitionProvider,
} from "@/features/consumer-discovery/listing/DiscoveryListingTransition";
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
  const listingFailed = state === "product-failure" || state === "metadata-failure";

  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-5 md:pt-7 lg:pt-8">
      <div className="container mx-auto max-w-[1440px] space-y-5 px-4 md:space-y-6">
        <DiscoveryListingHeader
          breadcrumbs={breadcrumbs}
          title={title}
          description={description}
          approvedPublicProductCount={listingFailed ? undefined : approvedPublicProductCount}
          subcategories={subcategories}
        />

        <DiscoveryListingTransitionProvider>
          <DiscoveryListingControls
            query={query}
            basePath={basePath}
            filters={filters}
            total={pagination?.total}
            startItem={pagination?.startItem}
            endItem={pagination?.endItem}
            filterMetadataAvailable={filterMetadataAvailable}
          />

          <div className="min-w-0 lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:items-start lg:gap-5 xl:grid-cols-[196px_minmax(0,1fr)] xl:gap-6">
            <DesktopSubcategoryFilterRail
              key={filters.find((filter) => filter.active)?.key ?? "all"}
              filters={filters}
              filterMetadataAvailable={filterMetadataAvailable}
            />
            <div className="min-w-0 space-y-5">
              {state ? (
                <DiscoveryListingResultBoundary>
                  <DiscoveryListingState kind={state} query={searchTerm} clearHref={clearHref} />
                </DiscoveryListingResultBoundary>
              ) : (
                <DiscoveryListingResultBoundary>
                  <ProductGrid products={products} label={`${title} product results`} className="xl:grid-cols-[repeat(4,minmax(0,220px))] xl:justify-between" />
                  {pagination && pagination.totalPages > 1 ? (
                    <ProductPagination basePath={basePath} page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} startItem={pagination.startItem} endItem={pagination.endItem} query={query} />
                  ) : null}
                </DiscoveryListingResultBoundary>
              )}
            </div>
          </div>
        </DiscoveryListingTransitionProvider>
      </div>
    </main>
  );
}
