import {
  buildCategoryDirectoryFromTree,
  buildHomeCategoryDirectoryFromTree,
  buildCategoryMetaFromSummary,
} from "@/features/categories/category-directory";
import {
  fetchCategoryTree,
  type CategoryNode,
} from "@/services/categories-api";
import type {
  CategoryHeroMeta,
  CategorySummary,
  HomeCategorySummary,
} from "@/types/category";

export async function getCategoryDirectory(): Promise<CategorySummary[]> {
  const categories = await fetchCategoryTree();
  return buildCategoryDirectoryFromTree(categories);
}

export async function getHomeCategories(): Promise<HomeCategorySummary[]> {
  const categories = await fetchCategoryTree();
  return buildHomeCategoryDirectoryFromTree(categories);
}

export async function getCategorySummaryBySlug(
  slug: string,
): Promise<CategorySummary | null> {
  const categories = await getCategoryDirectory();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getCategoryMetaBySlug(slug: string): Promise<CategoryHeroMeta> {
  const category = await getCategorySummaryBySlug(slug);

  if (category) {
    return {
      ...buildCategoryMetaFromSummary(category),
      approvedPublicProductCount: category.productCount,
    };
  }

  return {
    title: humanizeSlug(slug),
    description: `Explore buyer-visible ${humanizeSlug(slug).toLowerCase()} listings available through Zogular.`,
    subcategories: [{ id: "all", slug: "all", name: "All" }],
  };
}

export function buildCategorySubcategoryHref(
  categorySlug: string,
  subcategorySlug: string,
): string {
  return `/category/${categorySlug}?subcategory=${subcategorySlug}`;
}

export function slugMatches(left: string, right: string) {
  return normalizeComparableSlug(left) === normalizeComparableSlug(right);
}

export function findCategoryNodeBySlug(
  categories: CategoryNode[],
  slug: string,
): CategoryNode | null {
  for (const category of categories) {
    if (slugMatches(category.slug, slug)) {
      return category;
    }

    const child = (category.children ?? []).find((item) =>
      slugMatches(item.slug, slug),
    );
    if (child) return child;
  }

  return null;
}

function humanizeSlug(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeComparableSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|-)and(?=-|$)/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
