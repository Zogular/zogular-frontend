import { z } from "zod";
import { apiClient } from "@/services/api";

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

export class CategoryContractError extends Error {
  constructor(message = "The category service returned an invalid response.", options?: ErrorOptions) {
    super(message, options);
    this.name = "CategoryContractError";
  }
}

export const categoryAttributeOptionSchema: z.ZodType<CategoryAttributeOption> = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  type: z.enum(["text", "number", "select"]),
  options: z.array(z.string().trim().min(1)).nullable(),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
});

const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() => z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  parentId: z.string().min(1).nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  children: z.array(categoryNodeSchema).optional(),
  attributes: z.array(categoryAttributeOptionSchema).optional(),
  _count: z.object({ products: z.number().int().nonnegative() }).optional(),
}));

const categoryTreeResponseSchema = z.object({
  status: z.literal("success"),
  results: z.number().int().nonnegative(),
  data: z.object({ categories: z.array(categoryNodeSchema) }),
});

const categoryDetailResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    category: categoryNodeSchema.and(z.object({
      parent: z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1),
        slug: z.string().trim().min(1),
      }).nullable().optional(),
    })),
  }),
});

const categoryAttributesResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    categoryId: z.string().min(1),
    categoryName: z.string().trim().min(1),
    categorySlug: z.string().trim().min(1),
    attributes: z.array(categoryAttributeOptionSchema),
  }),
});

export function parseCategoryTreeResponse(payload: unknown): CategoryNode[] {
  assertCategoryPayloadIsAcyclic(payload);
  const parsed = parseContract(categoryTreeResponseSchema, payload);
  validateCategoryTree(parsed.data.categories);
  return parsed.data.categories;
}

export function parseCategoryAttributesResponse(
  payload: unknown,
  expected?: { categoryId?: string; categorySlug?: string },
): CategoryAttributeOption[] {
  const parsed = parseContract(categoryAttributesResponseSchema, payload);
  if (expected?.categoryId && parsed.data.categoryId !== expected.categoryId) {
    throw new CategoryContractError("The category fields did not match the selected category.");
  }
  if (expected?.categorySlug && parsed.data.categorySlug !== expected.categorySlug) {
    throw new CategoryContractError("The category fields did not match the selected category.");
  }
  return parsed.data.attributes;
}

export async function fetchCategoryTree(): Promise<CategoryNode[]> {
  const response = await apiClient<unknown>("/categories", {
    method: "GET",
    authMode: "omit",
    cache: "no-store",
  });
  return parseCategoryTreeResponse(response);
}

export async function fetchCategoryBySlug(slug: string): Promise<CategoryNode | null> {
  const response = await apiClient<unknown>(`/categories/${slug}`, {
    method: "GET",
    authMode: "omit",
    cache: "no-store",
  });
  return parseContract(categoryDetailResponseSchema, response).data.category;
}

export async function fetchCategoryAttributes(slug: string, categoryId?: string): Promise<CategoryAttributeOption[]> {
  const response = await apiClient<unknown>(`/categories/${slug}/attributes`, {
    method: "GET",
    authMode: "omit",
    cache: "no-store",
  });
  return parseCategoryAttributesResponse(response, { categoryId, categorySlug: slug });
}

export function flattenCategoryTree(categories: CategoryNode[]): Map<string, CategoryNode> {
  const map = new Map<string, CategoryNode>();
  const walk = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      map.set(node.slug, node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(categories);
  return map;
}

export function buildCategoryNameTree(categories: CategoryNode[]): Record<string, string[]> {
  return Object.fromEntries(
    categories.map((parent) => [parent.name, (parent.children ?? []).map((child) => child.name)]),
  );
}

function parseContract<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new CategoryContractError(undefined, { cause: result.error });
  return result.data;
}

export function assertCategoryPayloadIsAcyclic(value: unknown) {
  const active = new WeakSet<object>();
  const visited = new WeakSet<object>();
  const visit = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object") return;
    if (active.has(candidate)) throw new CategoryContractError("The category response contained a recursive cycle.");
    if (visited.has(candidate)) return;
    active.add(candidate);
    for (const child of Object.values(candidate)) visit(child);
    active.delete(candidate);
    visited.add(candidate);
  };
  visit(value);
}

function validateCategoryTree(categories: CategoryNode[]) {
  const seenIds = new Set<string>();
  const visit = (nodes: CategoryNode[], parentId: string | null) => {
    for (const node of nodes) {
      if (seenIds.has(node.id)) throw new CategoryContractError("The category response contained duplicate or cyclic category IDs.");
      if (parentId && node.parentId !== parentId) throw new CategoryContractError("The category response contained an invalid parent relationship.");
      seenIds.add(node.id);
      visit(node.children ?? [], node.id);
    }
  };
  visit(categories, null);
}
