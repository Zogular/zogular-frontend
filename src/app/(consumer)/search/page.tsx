import { buildDiscoveryUrl, parseDiscoveryQuery, updateDiscoveryQuery } from "@/features/consumer-discovery/lib/discovery-query";
import { DiscoveryListingPage } from "@/features/consumer-discovery/listing/DiscoveryListingPage";
import type { DiscoveryListingStateKind } from "@/features/consumer-discovery/listing/DiscoveryListingState";
import { isDiscoveryListingFailure } from "@/features/consumer-discovery/listing/listing-errors";
import type { DiscoveryQueryInput } from "@/features/consumer-discovery/types/discovery.types";
import { getDiscoveryListingPageData } from "@/services/products";
import { getCategoryDirectory } from "@/services/categories";
import type { ProductPaginationMeta } from "@/types/category";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseDiscoveryQuery((await searchParams) as DiscoveryQueryInput);
  let products: readonly Product[] = [];
  let pagination: ProductPaginationMeta | undefined;
  let resolvedQuery = query;
  let state: DiscoveryListingStateKind | undefined = query.search ? undefined : "search-idle";
  let filters = [{ key: "all", label: "All categories", href: buildDiscoveryUrl("/search", updateDiscoveryQuery(query, { categorySlug: null, subcategorySlug: null })), active: !query.categorySlug }];
  let filterMetadataAvailable = true;

  try {
    const categories = await getCategoryDirectory();
    filters = [filters[0], ...categories.map((category) => ({
      key: category.slug,
      label: category.name,
      href: buildDiscoveryUrl("/search", updateDiscoveryQuery(query, { categorySlug: category.slug, subcategorySlug: null })),
      active: query.categorySlug === category.slug,
    }))];
  } catch {
    filterMetadataAvailable = false;
  }

  if (query.search) {
    try {
      const listing = await getDiscoveryListingPageData(query, { pageSize: 20 });
      products = listing.products;
      pagination = listing.pagination;
      resolvedQuery = listing.query;
      if (products.length === 0) state = "search-zero";
    } catch (error) {
      if (!isDiscoveryListingFailure(error)) throw error;
      state = "product-failure";
    }
  }

  const title = query.search ? `Search results for “${query.search}”` : "Search products";
  return (
    <DiscoveryListingPage
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Search" }]}
      title={title}
      description={query.search ? "Approved public products matching your search." : undefined}
      products={products}
      pagination={pagination}
      query={resolvedQuery}
      basePath="/search"
      state={state}
      clearHref="/search"
      searchTerm={query.search}
      filters={filters}
      filterMetadataAvailable={filterMetadataAvailable}
    />
  );
}
