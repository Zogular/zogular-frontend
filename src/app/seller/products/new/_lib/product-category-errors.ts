import { z } from "zod";
import { ApiError } from "@/services/api";
import type { ProductAttributeInput } from "@/services/categories-api";

const serverFieldErrorSchema = z.object({
  field: z.string().trim().min(1).max(240).optional(),
  path: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).optional(),
  attributeId: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(500),
});

const validationResponseSchema = z.object({
  errors: z.array(serverFieldErrorSchema).min(1),
});

export type ProductCategoryServerErrors = {
  categoryMessage?: string;
  detailsMessage?: string;
  attributeErrors: Record<string, string>;
  firstAttributeId?: string;
};

export function parseProductCategoryServerErrors(
  error: unknown,
  submittedAttributes: readonly ProductAttributeInput[],
  governedAttributeIds: ReadonlySet<string> = new Set(
    submittedAttributes.map((attribute) => attribute.attributeId),
  ),
): ProductCategoryServerErrors | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;
  const parsed = validationResponseSchema.safeParse(error.details);
  if (!parsed.success) return null;

  const result: ProductCategoryServerErrors = { attributeErrors: {} };
  for (const issue of parsed.data.errors) {
    const field = normalizeField(issue.field, issue.path);
    const attributeId = resolveAttributeId(
      issue.attributeId,
      field,
      submittedAttributes,
      governedAttributeIds,
    );

    if (attributeId) {
      result.attributeErrors[attributeId] = issue.message;
      result.firstAttributeId ??= attributeId;
      result.detailsMessage ??= "Some category details need attention.";
      continue;
    }

    if (field === "category" || field === "categoryId" || field.startsWith("category.")) {
      result.categoryMessage ??= issue.message;
      continue;
    }

    if (field.startsWith("attributes") || field.startsWith("categoryAttributes")) {
      result.detailsMessage ??= issue.message;
    }
  }

  return result.categoryMessage || result.detailsMessage || Object.keys(result.attributeErrors).length
    ? result
    : null;
}

function normalizeField(field?: string, path?: string | Array<string | number>) {
  if (field) return field;
  if (typeof path === "string") return path;
  return Array.isArray(path) ? path.join(".") : "";
}

function resolveAttributeId(
  explicitId: string | undefined,
  field: string,
  submittedAttributes: readonly ProductAttributeInput[],
  governedAttributeIds: ReadonlySet<string>,
) {
  if (explicitId && governedAttributeIds.has(explicitId)) return explicitId;

  const indexedMatch = /^attributes(?:\.(\d+)|\[(\d+)\])(?:\.|$)/.exec(field);
  if (indexedMatch) {
    const index = Number(indexedMatch[1] ?? indexedMatch[2]);
    return submittedAttributes[index]?.attributeId;
  }

  const idMatch = /^attributes(?:\.([^.\]]+)|\[([^\]]+)\])(?:\.|$)/.exec(field);
  const pathAttributeId = idMatch?.[1] ?? idMatch?.[2];
  return pathAttributeId && governedAttributeIds.has(pathAttributeId) ? pathAttributeId : undefined;
}
