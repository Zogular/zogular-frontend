import { z } from "zod";
import { apiClient } from "@/services/api";
import { assertCategoryPayloadIsAcyclic, CategoryContractError } from "@/services/categories-api";
import type {
  AdminCategoryPayload,
  AdminCategoryRecord,
  AdminCategoryTreeNode,
} from "@/features/admin-categories/types";

const adminCategoryRecordSchema: z.ZodType<AdminCategoryRecord> = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  parentId: z.string().min(1).nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  _count: z.object({
    children: z.number().int().nonnegative(),
    products: z.number().int().nonnegative(),
    attributes: z.number().int().nonnegative(),
  }),
});

const adminCategoryTreeNodeSchema: z.ZodType<AdminCategoryTreeNode> = z.lazy(() =>
  adminCategoryRecordSchema.and(z.object({ children: z.array(adminCategoryTreeNodeSchema) })),
);

const adminCategoriesResponseSchema = z.object({
  status: z.literal("success"),
  results: z.number().int().nonnegative(),
  data: z.object({
    categories: z.array(adminCategoryRecordSchema),
    tree: z.array(adminCategoryTreeNodeSchema),
  }),
});

const adminCategoryResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ category: adminCategoryRecordSchema }),
});

export function parseAdminCategoriesResponse(payload: unknown) {
  assertCategoryPayloadIsAcyclic(payload);
  const parsed = adminCategoriesResponseSchema.safeParse(payload);
  if (!parsed.success) throw new CategoryContractError(undefined, { cause: parsed.error });
  validateAdminCategoryTree(parsed.data.data.tree);
  return parsed.data.data;
}

export function parseAdminCategoryResponse(payload: unknown) {
  const parsed = adminCategoryResponseSchema.safeParse(payload);
  if (!parsed.success) throw new CategoryContractError(undefined, { cause: parsed.error });
  return parsed.data.data.category;
}

export async function getAdminCategories(includeInactive = true) {
  const response = await apiClient<unknown>("/admin/categories", {
    method: "GET",
    query: includeInactive ? { includeInactive: true } : undefined,
    cache: "no-store",
  });

  return parseAdminCategoriesResponse(response);
}

export async function createAdminCategory(payload: AdminCategoryPayload) {
  const response = await apiClient<unknown>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
    csrf: true,
  });

  return parseAdminCategoryResponse(response);
}

export async function updateAdminCategory(
  categoryId: string,
  payload: Partial<AdminCategoryPayload>,
) {
  const response = await apiClient<unknown>(
    `/admin/categories/${categoryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      csrf: true,
    },
  );

  return parseAdminCategoryResponse(response);
}

function validateAdminCategoryTree(tree: AdminCategoryTreeNode[]) {
  const seen = new Set<string>();
  const visit = (nodes: AdminCategoryTreeNode[], parentId: string | null) => {
    for (const node of nodes) {
      if (seen.has(node.id)) throw new CategoryContractError("The admin category response contained duplicate or cyclic category IDs.");
      if (parentId && node.parentId !== parentId) throw new CategoryContractError("The admin category response contained an invalid parent relationship.");
      seen.add(node.id);
      visit(node.children, node.id);
    }
  };
  visit(tree, null);
}
