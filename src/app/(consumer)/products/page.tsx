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

export default async function AllProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseDiscoveryQuery((await searchParams) as DiscoveryQueryInput);
  let products: readonly Product[] = [];
  let pagination: ProductPaginationMeta | undefined;
  let resolvedQuery = query;
  let state: DiscoveryListingStateKind | undefined;
  let filters = [{ key: "all", label: "All categories", href: buildDiscoveryUrl("/products", updateDiscoveryQuery(query, { categorySlug: null, subcategorySlug: null })), active: !query.categorySlug }];
  let filterMetadataAvailable = true;

  try {
    const categories = await getCategoryDirectory();
    filters = [filters[0], ...categories.map((category) => ({
      key: category.slug,
      label: category.name,
      href: buildDiscoveryUrl("/products", updateDiscoveryQuery(query, { categorySlug: category.slug, subcategorySlug: null })),
      active: query.categorySlug === category.slug,
    }))];
  } catch {
    filterMetadataAvailable = false;
  }

  try {
    const listing = await getDiscoveryListingPageData(query, { pageSize: 20 });
    products = listing.products;
    pagination = listing.pagination;
    resolvedQuery = listing.query;
    if (products.length === 0) {
      state = query.categorySlug || query.subcategorySlug || query.search
        ? "filtered-zero"
        : "true-empty";
    }
  } catch (error) {
    if (!isDiscoveryListingFailure(error)) throw error;
    state = "product-failure";
  }

  return (
    <DiscoveryListingPage
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "All products" }]}
      title="All products"
      description="Browse products available on Zogular."
      products={products}
      pagination={pagination}
      query={resolvedQuery}
      basePath="/products"
      state={state}
      clearHref="/products"
      filters={filters}
      filterMetadataAvailable={filterMetadataAvailable}
    />
  );
}
