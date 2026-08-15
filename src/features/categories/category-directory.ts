import type { CategoryNode } from "@/services/categories-api";
import type { CategorySummary, HomeCategorySummary } from "@/types/category";

const ICON_BY_KEY: Record<CategorySummary["iconKey"], string[]> = {
  smartphone: ["smartphone", "phone", "tablet", "mobile"],
  laptop: ["laptop", "desktop", "computer", "monitor"],
  shirt: ["shirt", "fashion", "footwear", "apparel"],
  "shopping-basket": ["shopping-basket", "basket", "grocery", "supermarket"],
  tv: ["tv", "audio", "camera", "electronics"],
  "heart-pulse": ["heart-pulse", "beauty", "health", "wellness"],
  dumbbell: ["dumbbell", "sports", "fitness", "outdoor"],
  sofa: ["sofa", "home", "living", "furniture", "decor", "kitchen"],
};

const COLOR_BY_KEY: Record<CategorySummary["iconKey"], string> = {
  smartphone: "text-blue-600 bg-blue-500/10",
  laptop: "text-zinc-600 bg-zinc-500/10",
  shirt: "text-pink-600 bg-pink-500/10",
  "shopping-basket": "text-[#009E49] bg-[#009E49]/10",
  tv: "text-violet-600 bg-violet-500/10",
  "heart-pulse": "text-rose-600 bg-rose-500/10",
  dumbbell: "text-[#FF6B00] bg-[#FF6B00]/10",
  sofa: "text-amber-700 bg-amber-500/10",
};

export function buildCategoryDirectoryFromTree(
  categories: CategoryNode[],
): CategorySummary[] {
  return categories
    .filter((category) => category.parentId === null || !category.parentId)
    .map((category) => {
      const iconKey = resolveIconKey(category);
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description?.trim() || undefined,
        productCount: category._count?.products,
        icon: category.icon?.trim() || undefined,
        iconKey,
        colorClass: COLOR_BY_KEY[iconKey],
        children: (category.children ?? []).map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
        })),
      };
    });
}

export function buildHomeCategoryDirectoryFromTree(
  categories: CategoryNode[],
): HomeCategorySummary[] {
  return categories
    .filter((category) => category.parentId === null || !category.parentId)
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description?.trim() || undefined,
      productCount: category._count?.products,
    }));
}

export function buildCategoryMetaFromSummary(summary: CategorySummary) {
  return {
    title: summary.name,
    description: summary.description ?? "",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      ...summary.children,
    ],
  };
}

function resolveIconKey(category: CategoryNode): CategorySummary["iconKey"] {
  const haystack = `${category.icon ?? ""} ${category.slug} ${category.name}`.toLowerCase();

  for (const [iconKey, aliases] of Object.entries(ICON_BY_KEY) as Array<
    [CategorySummary["iconKey"], string[]]
  >) {
    if (aliases.some((alias) => haystack.includes(alias))) {
      return iconKey;
    }
  }

  return "shopping-basket";
}
