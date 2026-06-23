import { apiClient } from "@/services/api";

// ============================================================
// TYPES
// ============================================================

export interface CategoryAttributeOption {
  id: string;
  name: string;
  slug: string;
  type: "text" | "number" | "select";
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
}

export type ProductAttributeInput = {
  attributeId: string;
  slug: string;
  name: string;
  value: string;
};

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  children?: CategoryNode[];
  attributes?: CategoryAttributeOption[];
  _count?: { products: number };
}

export interface CategoryTreeResponse {
  status: string;
  results: number;
  data: {
    categories: CategoryNode[];
  };
}

export interface CategoryDetailResponse {
  status: string;
  data: {
    category: CategoryNode & {
      parent?: { id: string; name: string; slug: string } | null;
    };
  };
}

export interface CategoryAttributesResponse {
  status: string;
  data: {
    categoryId: string;
    categoryName: string;
    categorySlug: string;
    attributes: CategoryAttributeOption[];
  };
}

// ============================================================
// API FUNCTIONS
// ============================================================

/**
 * Fetch the full category tree (top-level with children).
 */
export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  try {
    const response = await apiClient<CategoryTreeResponse>("/categories", {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
    });
    return response.data.categories;
  } catch (error) {
    console.warn("[categories-api] Failed to fetch category tree:", error);
    return [];
  }
}

/**
 * Fetch a single category by slug with children and attributes.
 */
export async function fetchCategoryBySlug(slug: string): Promise<CategoryNode | null> {
  try {
    const response = await apiClient<CategoryDetailResponse>(`/categories/${slug}`, {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
    });
    return response.data.category;
  } catch (error) {
    console.warn(`[categories-api] Failed to fetch category "${slug}":`, error);
    return null;
  }
}

/**
 * Fetch attributes for a specific category by slug.
 */
export async function fetchCategoryAttributes(
  slug: string,
): Promise<CategoryAttributeOption[]> {
  try {
    const response = await apiClient<CategoryAttributesResponse>(
      `/categories/${slug}/attributes`,
      {
        method: "GET",
        authMode: "omit",
        cache: "no-store",
      },
    );
    return response.data.attributes;
  } catch (error) {
    console.warn(`[categories-api] Failed to fetch attributes for "${slug}":`, error);
    return [];
  }
}

/**
 * Build a flat map of slug -> CategoryNode from the tree.
 * Useful for quick lookups by slug.
 */
export function flattenCategoryTree(
  categories: CategoryNode[],
): Map<string, CategoryNode> {
  const map = new Map<string, CategoryNode>();

  function walk(nodes: CategoryNode[]) {
    for (const node of nodes) {
      map.set(node.slug, node);
      if (node.children?.length) walk(node.children);
    }
  }

  walk(categories);
  return map;
}

/**
 * Build a category tree structure suitable for the seller
 * product form: Record<parentName, childName[]>
 */
export function buildCategoryNameTree(
  categories: CategoryNode[],
): Record<string, string[]> {
  const tree: Record<string, string[]> = {};

  for (const parent of categories) {
    tree[parent.name] = (parent.children ?? []).map((child) => child.name);
  }

  return tree;
}
