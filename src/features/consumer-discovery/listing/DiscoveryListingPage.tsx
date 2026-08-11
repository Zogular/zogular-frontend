import { ProductPagination } from "@/components/product/ProductPagination";
import { ProductGrid } from "@/features/consumer-discovery/components/ProductGrid";
import { DiscoveryListingHeader, type ListingBreadcrumb, type ListingSubcategory } from "@/features/consumer-discovery/listing/DiscoveryListingHeader";
import { DiscoveryListingState, type DiscoveryListingStateKind } from "@/features/consumer-discovery/listing/DiscoveryListingState";
import { ListingToolbar } from "@/features/consumer-discovery/listing/ListingToolbar";
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
}: DiscoveryListingPageProps) {
  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-5 md:pt-7 lg:pt-8">
      <div className="container mx-auto max-w-7xl space-y-5 px-4 md:space-y-6 md:px-6">
        <DiscoveryListingHeader
          breadcrumbs={breadcrumbs}
          title={title}
          description={description}
          approvedPublicProductCount={approvedPublicProductCount}
          subcategories={subcategories}
        />

        {pagination ? (
          <ListingToolbar
            total={pagination.total}
            startItem={pagination.startItem}
            endItem={pagination.endItem}
            sort={query.sort}
          />
        ) : null}

        {state ? (
          <DiscoveryListingState kind={state} query={searchTerm} clearHref={clearHref} />
        ) : (
          <>
            <ProductGrid
              products={products}
              label={`${title} product results`}
              className="lg:grid-cols-4 xl:grid-cols-[repeat(5,minmax(0,220px))] xl:justify-between"
            />
            {pagination && pagination.totalPages > 1 ? (
              <ProductPagination
                basePath={basePath}
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                startItem={pagination.startItem}
                endItem={pagination.endItem}
                query={query}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
