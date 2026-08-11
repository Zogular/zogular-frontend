import { getHomeCategories } from "@/services/categories";
import {
  getHomeExploreMore,
  getHomeMostViewed,
  getHomeNewArrivals,
} from "@/services/products";
import type { HomeCategorySummary } from "@/types/category";
import type { Product } from "@/types/product";

export type HomeDiscoveryData = {
  categories: readonly HomeCategorySummary[];
  newArrivals: readonly Product[];
  mostViewed: readonly Product[];
  exploreMore: readonly Product[];
};

export type HomeDiscoveryDependencies = {
  categories: () => Promise<HomeCategorySummary[]>;
  newArrivals: () => Promise<Product[]>;
  mostViewed: () => Promise<Product[]>;
  exploreMore: () => Promise<Product[]>;
};

export class RequiredHomeDiscoveryError extends Error {
  readonly source: "categories" | "explore-more";
  override readonly cause: unknown;

  constructor(source: "categories" | "explore-more", cause: unknown) {
    super(`Required homepage source failed: ${source}`, { cause });
    this.name = "RequiredHomeDiscoveryError";
    this.source = source;
    this.cause = cause;
  }
}

const defaultDependencies: HomeDiscoveryDependencies = {
  categories: getHomeCategories,
  newArrivals: () => getHomeNewArrivals(10),
  mostViewed: () => getHomeMostViewed(10),
  exploreMore: () => getHomeExploreMore(10),
};

function productKey(product: Product): string {
  return `${typeof product.id}:${String(product.id)}`;
}

function preferUnseenProducts(
  products: readonly Product[],
  seen: ReadonlySet<string>,
  minimumUsefulCount: number,
): readonly Product[] {
  const unseen = products.filter((product) => !seen.has(productKey(product)));
  return unseen.length >= minimumUsefulCount ? unseen : products;
}

function addProductKeys(target: Set<string>, products: readonly Product[]) {
  for (const product of products) target.add(productKey(product));
}

export async function loadHomeDiscoveryData(
  dependencies: HomeDiscoveryDependencies = defaultDependencies,
): Promise<HomeDiscoveryData> {
  const [categoriesResult, newArrivalsResult, mostViewedResult, exploreMoreResult] =
    await Promise.allSettled([
      dependencies.categories(),
      dependencies.newArrivals(),
      dependencies.mostViewed(),
      dependencies.exploreMore(),
    ] as const);

  if (categoriesResult.status === "rejected") {
    throw new RequiredHomeDiscoveryError("categories", categoriesResult.reason);
  }
  if (exploreMoreResult.status === "rejected") {
    throw new RequiredHomeDiscoveryError("explore-more", exploreMoreResult.reason);
  }

  const seen = new Set<string>();
  const newArrivals = newArrivalsResult.status === "fulfilled" ? newArrivalsResult.value : [];
  addProductKeys(seen, newArrivals);

  const rawMostViewed = mostViewedResult.status === "fulfilled" ? mostViewedResult.value : [];
  const mostViewed = preferUnseenProducts(rawMostViewed, seen, 4);
  addProductKeys(seen, mostViewed);

  const exploreMore = preferUnseenProducts(exploreMoreResult.value, seen, 4);

  return {
    categories: categoriesResult.value,
    newArrivals,
    mostViewed,
    exploreMore,
  };
}
