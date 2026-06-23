import { searchProducts } from "@/services/products";
import { buildCategorySubcategoryHref, getCategoryDirectory } from "@/services/categories";
import { getProductTitle } from "@/lib/normalizers/product";
import type { SearchCategoryResult, SearchIndex, SearchResults } from "@/types/search";

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function scoreMatch(text: string, query: string): number {
  const normalizedText = normalizeSearchText(text);
  if (!normalizedText) return 0;
  if (normalizedText === query) return 120;
  if (normalizedText.startsWith(query)) return 90;
  if (normalizedText.includes(` ${query}`)) return 70;
  if (normalizedText.includes(query)) return 50;
  return 0;
}

function scoreProduct(product: SearchIndex["products"][number], query: string): number {
  return Math.max(
    scoreMatch(getProductTitle(product), query),
    scoreMatch(product.categoryName ?? "", query),
    scoreMatch(product.subcategoryName ?? "", query),
    scoreMatch(product.badge ?? "", query),
  );
}

function scoreCategory(category: SearchCategoryResult, query: string): number {
  return Math.max(
    scoreMatch(category.title, query),
    scoreMatch(category.parentName ?? "", query),
    scoreMatch(category.description ?? "", query),
  );
}

export async function getSearchIndex(): Promise<SearchIndex> {
  const categoryDirectory = await getCategoryDirectory();

  const categories: SearchCategoryResult[] = categoryDirectory.flatMap((category) => [
    {
      id: category.id,
      title: category.name,
      description: category.description,
      href: `/category/${category.slug}`,
      type: "category" as const,
    },
    ...category.children.map((child) => ({
      id: `${category.id}-${child.slug}`,
      title: child.name,
      description: category.description,
      href: buildCategorySubcategoryHref(category.slug, child.slug),
      parentName: category.name,
      type: "subcategory" as const,
    })),
  ]);

  return { products: [], categories };
}

export function searchFromIndex(
  index: SearchIndex,
  query: string,
  options: { productLimit?: number; categoryLimit?: number } = {},
): SearchResults {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return { products: [], categories: [], totalCount: 0 };
  }

  const productLimit = options.productLimit ?? 6;
  const categoryLimit = options.categoryLimit ?? 6;

  const products = [...index.products]
    .map((product) => ({ product, score: scoreProduct(product, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || right.product.rating - left.product.rating)
    .slice(0, productLimit)
    .map((entry) => entry.product);

  const categories = [...index.categories]
    .map((category) => ({ category, score: scoreCategory(category, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.category.title.localeCompare(right.category.title))
    .slice(0, categoryLimit)
    .map((entry) => entry.category);

  return {
    products,
    categories,
    totalCount: products.length + categories.length,
  };
}

export async function searchCatalog(
  query: string,
  options?: { productLimit?: number; categoryLimit?: number },
): Promise<SearchResults> {
  const productLimit = options?.productLimit ?? 6;
  const [products, index] = await Promise.all([
    searchProducts(query, productLimit),
    getSearchIndex(),
  ]);
  const categoryResults = searchFromIndex(index, query, {
    productLimit: 0,
    categoryLimit: options?.categoryLimit,
  });

  return {
    products,
    categories: categoryResults.categories,
    totalCount: products.length + categoryResults.categories.length,
  };
}
