import { type CategoryNode } from "@/services/categories-api";
import {
  getCategoryMetaByName,
  getSubcategoryMeta,
  slugifySellerValue,
} from "@/services/seller-catalog";

export type CategorySelection = {
  path: string[];
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  subcategoryId: string;
  subcategoryName: string;
  subcategorySlug: string;
  leafId: string;
  leafName: string;
  leafSlug: string;
  isOther: boolean;
  isBackendCategory: boolean;
};

export type PickerSelection = {
  path: CategoryNode[];
  isOther: boolean;
};

export function flattenCategoryNodes(nodes: CategoryNode[]) {
  const results: Array<{ node: CategoryNode; path: CategoryNode[] }> = [];
  const walk = (items: CategoryNode[], path: CategoryNode[]) => {
    for (const item of items) {
      const nextPath = [...path, item];
      results.push({ node: item, path: nextPath });
      if (item.children?.length) walk(item.children, nextPath);
    }
  };
  walk(nodes, []);
  return results;
}

export function makeCategorySelection(selection: PickerSelection): CategorySelection | null {
  if (!selection.path.length) return null;

  const top = selection.path[0];
  const leaf = selection.path[selection.path.length - 1];
  const nearestParent = selection.isOther ? leaf : selection.path.at(-2) ?? top;
  const subcategorySource = selection.isOther ? nearestParent : leaf;
  const subcategoryName = selection.isOther ? `Other in ${nearestParent.name}` : subcategorySource.name;
  const subcategorySlug = selection.isOther
    ? `${nearestParent.slug || slugifySellerValue(nearestParent.name)}-other`
    : subcategorySource.slug || slugifySellerValue(subcategorySource.name);

  return {
    path: selection.isOther ? [...selection.path.map((item) => item.name), "Other"] : selection.path.map((item) => item.name),
    categoryId: top.id,
    categoryName: top.name,
    categorySlug: top.slug || slugifySellerValue(top.name),
    subcategoryId: subcategorySource.id,
    subcategoryName,
    subcategorySlug,
    leafId: selection.isOther ? `${nearestParent.id}-other` : leaf.id,
    leafName: selection.isOther ? "Other" : leaf.name,
    leafSlug: selection.isOther ? "other" : leaf.slug || slugifySellerValue(leaf.name),
    isOther: selection.isOther,
    isBackendCategory: !selection.isOther && !leaf.id.startsWith("static-"),
  };
}

export function buildSelectionFromLegacy(categoryName: string, subcategoryName: string): CategorySelection {
  const categoryMeta = getCategoryMetaByName(categoryName);
  const subcategoryMeta = getSubcategoryMeta(categoryName, subcategoryName);
  return {
    path: [categoryMeta.name, subcategoryMeta.name],
    categoryId: `static-${categoryMeta.slug}`,
    categoryName: categoryMeta.name,
    categorySlug: categoryMeta.slug,
    subcategoryId: `static-${categoryMeta.slug}-${subcategoryMeta.slug}`,
    subcategoryName: subcategoryMeta.name,
    subcategorySlug: subcategoryMeta.slug,
    leafId: `static-${categoryMeta.slug}-${subcategoryMeta.slug}`,
    leafName: subcategoryMeta.name,
    leafSlug: subcategoryMeta.slug,
    isOther: false,
    isBackendCategory: false,
  };
}
