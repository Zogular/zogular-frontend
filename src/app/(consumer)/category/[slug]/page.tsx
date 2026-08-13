import { notFound } from "next/navigation";
import { buildDiscoveryUrl, parseDiscoveryQuery, updateDiscoveryQuery } from "@/features/consumer-discovery/lib/discovery-query";
import { DiscoveryListingPage } from "@/features/consumer-discovery/listing/DiscoveryListingPage";
import type { DiscoveryListingStateKind } from "@/features/consumer-discovery/listing/DiscoveryListingState";
import { isDiscoveryListingFailure } from "@/features/consumer-discovery/listing/listing-errors";
import type { DiscoveryQueryInput, DiscoveryQueryState } from "@/features/consumer-discovery/types/discovery.types";
import { CategoryNotFoundError, getCategoryMetaBySlug } from "@/services/categories";
import { getDiscoveryListingPageData } from "@/services/products";
import type { ProductPaginationMeta } from "@/types/category";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<PageSearchParams>;
}) {
  const [{ slug }, rawSearchParams] = await Promise.all([params, searchParams]);
  const routeQuery = parseDiscoveryQuery(rawSearchParams as DiscoveryQueryInput);

  let meta;
  try {
    meta = await getCategoryMetaBySlug(slug);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) notFound();
    if (!isDiscoveryListingFailure(error)) throw error;
    return (
      <DiscoveryListingPage
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Categories", href: "/categories" }, { label: "Unavailable" }]}
        title="Category unavailable"
        products={[]}
        query={routeQuery}
        basePath={`/category/${slug}`}
        state="metadata-failure"
      />
    );
  }

  const requestedQuery = parseDiscoveryQuery({
    page: String(routeQuery.page),
    sort: routeQuery.sort,
    categorySlug: slug,
    subcategorySlug: routeQuery.subcategorySlug,
    search: routeQuery.search,
  });
  let products: readonly Product[] = [];
  let pagination: ProductPaginationMeta | undefined;
  let resolvedQuery = requestedQuery;
  let state: DiscoveryListingStateKind | undefined;

  try {
    const listing = await getDiscoveryListingPageData(requestedQuery, {
      pageSize: 20,
      approvedPublicProductCount: meta.approvedPublicProductCount,
    });
    products = listing.products;
    pagination = listing.pagination;
    resolvedQuery = listing.query;
    if (products.length === 0) {
      state = meta.approvedPublicProductCount === 0 ? "true-empty" : "filtered-zero";
    }
  } catch (error) {
    if (!isDiscoveryListingFailure(error)) throw error;
    state = "product-failure";
  }

  const urlQuery: DiscoveryQueryState = { ...resolvedQuery, categorySlug: undefined };
  const subcategories = meta.subcategories.map((subcategory) => {
    const isAll = subcategory.slug === "all";
    const nextQuery = updateDiscoveryQuery(urlQuery, {
      subcategorySlug: isAll ? null : subcategory.slug,
    });
    return {
      label: subcategory.name,
      href: buildDiscoveryUrl(`/category/${slug}`, nextQuery),
      active: isAll ? !urlQuery.subcategorySlug : urlQuery.subcategorySlug === subcategory.slug,
    };
  });
  const filters = meta.subcategories.map((subcategory) => {
    const isAll = subcategory.slug === "all";
    const nextQuery = updateDiscoveryQuery(urlQuery, {
      subcategorySlug: isAll ? null : subcategory.slug,
    });
    return {
      key: isAll ? "all" : subcategory.slug,
      label: isAll ? "All products" : subcategory.name,
      href: buildDiscoveryUrl(`/category/${slug}`, nextQuery),
      active: isAll ? !urlQuery.subcategorySlug : urlQuery.subcategorySlug === subcategory.slug,
    };
  });

  return (
    <DiscoveryListingPage
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Categories", href: "/categories" }, { label: meta.title }]}
      title={meta.title}
      description={meta.description || undefined}
      approvedPublicProductCount={meta.approvedPublicProductCount}
      subcategories={subcategories}
      filters={filters}
      products={products}
      pagination={pagination}
      query={urlQuery}
      basePath={`/category/${slug}`}
      state={state}
      clearHref={`/category/${slug}`}
    />
  );
}
