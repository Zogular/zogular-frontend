import {
  buildCategoryDirectoryFromTree,
  buildCategoryMetaFromSummary,
} from "@/features/categories/category-directory";
import {
  fetchCategoryTree,
  type CategoryNode,
} from "@/services/categories-api";
import type { CategorySummary } from "@/types/category";

export type HeroBanner = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaLabel: string;
  ctaHref: string;
  overlayClass: string;
  badge: string;
};

const HERO_BANNERS: HeroBanner[] = [
  {
    id: "banner_1",
    title: "Shop Zogular",
    subtitle: "Browse current buyer-visible listings available during the Lusaka pilot.",
    image:
      "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=2070&q=80",
    ctaLabel: "Start Shopping",
    ctaHref: "/products",
    overlayClass: "from-[#009E49]/95 via-[#009E49]/70 to-transparent",
    badge: "Marketplace",
  },
  {
    id: "banner_2",
    title: "Explore Electronics",
    subtitle: "Compare current buyer-visible electronics listings.",
    image:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=2070&q=80",
    ctaLabel: "Shop Electronics",
    ctaHref: "/category/electronics",
    overlayClass: "from-zinc-950/95 via-zinc-900/80 to-transparent",
    badge: "Catalog",
  },
  {
    id: "banner_3",
    title: "Discover Fashion",
    subtitle: "Browse current buyer-visible fashion listings.",
    image:
      "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=2070&q=80",
    ctaLabel: "Shop Fashion",
    ctaHref: "/category/fashion",
    overlayClass: "from-[#FF6B00]/95 via-[#FF6B00]/70 to-transparent",
    badge: "Catalog",
  },
];

export async function getCategoryDirectory(): Promise<CategorySummary[]> {
  const categories = await fetchCategoryTree();
  return buildCategoryDirectoryFromTree(categories);
}

export async function getHomeCategories(): Promise<CategorySummary[]> {
  return getCategoryDirectory();
}

export async function getCategorySummaryBySlug(
  slug: string,
): Promise<CategorySummary | null> {
  const categories = await getCategoryDirectory();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getCategoryMetaBySlug(slug: string) {
  const category = await getCategorySummaryBySlug(slug);

  if (category) {
    return buildCategoryMetaFromSummary(category);
  }

  return {
    title: humanizeSlug(slug),
    description: `Explore buyer-visible ${humanizeSlug(slug).toLowerCase()} listings available through Zogular.`,
    subcategories: [{ id: "all", slug: "all", name: "All" }],
  };
}

export async function getHomeHeroBanners(): Promise<HeroBanner[]> {
  return HERO_BANNERS;
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
