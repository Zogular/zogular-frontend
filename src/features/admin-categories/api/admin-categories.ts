/**
 * @file admin-categories.ts
 * @module features/admin-categories/api
 * @description
 * Typed API client for Admin Category Management and Product Field Studio (F7).
 * Encapsulates CRUD for taxonomy nodes, attribute definitions, inheritance resolution,
 * and industry template application with enterprise error unwrapping and CSRF safety.
 */

import { apiClient } from "@/services/api";
import type {
  AdminCategoryPayload,
  AdminCategoryRecord,
  AdminCategoryTreeNode,
  CategoryAttributeRecord,
  CategoryAttributesResponse,
  CategoryTemplateApplyOutcome,
  CategoryTemplateDefinition,
  CreateCategoryAttributePayload,
  UpdateCategoryAttributePayload,
} from "@/features/admin-categories/types";

type AdminCategoriesResponse = {
  data: {
    categories: AdminCategoryRecord[];
    tree: AdminCategoryTreeNode[];
  };
};

type AdminCategoryResponse = {
  data: {
    category: AdminCategoryRecord;
  };
};

type RawAttributesApiResponse = {
  data?: {
    directAttributes?: CategoryAttributeRecord[];
    inheritedAttributes?: CategoryAttributeRecord[];
    allAttributes?: CategoryAttributeRecord[];
    attributes?: CategoryAttributeRecord[];
  };
  directAttributes?: CategoryAttributeRecord[];
  inheritedAttributes?: CategoryAttributeRecord[];
  allAttributes?: CategoryAttributeRecord[];
  attributes?: CategoryAttributeRecord[];
};

type SingleAttributeApiResponse = {
  data?: {
    attribute?: CategoryAttributeRecord;
  };
  attribute?: CategoryAttributeRecord;
};

type CategoryTemplatesApiResponse = {
  status?: unknown;
  data?: {
    templates?: unknown;
  };
};

type ApplyCategoryTemplateApiResponse = {
  status?: unknown;
  data?: {
    templateKey?: unknown;
    requestedAttributeSlugs?: unknown;
    createdAttributes?: unknown;
    updatedAttributes?: unknown;
    unchangedAttributes?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAttributeType(value: unknown): value is CreateCategoryAttributePayload["type"] {
  return value === "TEXT" || value === "NUMBER" || value === "SELECT";
}

function parseTemplateAttribute(value: unknown): CreateCategoryAttributePayload {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim() ||
    typeof value.slug !== "string" || !value.slug.trim() || !isAttributeType(value.type) ||
    typeof value.isRequired !== "boolean" || typeof value.sortOrder !== "number" ||
    !Number.isInteger(value.sortOrder) || value.sortOrder < 0 ||
    (value.options !== undefined && value.options !== null && !isRecord(value.options))) {
    throw new Error("Category templates are unavailable right now. Please try again.");
  }

  return {
    name: value.name,
    slug: value.slug,
    type: value.type,
    isRequired: value.isRequired,
    sortOrder: value.sortOrder,
    options: (value.options ?? null) as CreateCategoryAttributePayload["options"],
  };
}

function parseTemplateDefinition(value: unknown): CategoryTemplateDefinition {
  if (!isRecord(value) || typeof value.templateKey !== "string" || !value.templateKey.trim() ||
    typeof value.title !== "string" || !value.title.trim() ||
    typeof value.description !== "string" || !Array.isArray(value.attributes)) {
    throw new Error("Category templates are unavailable right now. Please try again.");
  }

  return {
    templateKey: value.templateKey,
    title: value.title,
    description: value.description,
    attributes: value.attributes.map(parseTemplateAttribute),
  };
}

function parseAttributeArray(value: unknown): CategoryAttributeRecord[] {
  if (!Array.isArray(value) || !value.every((attribute) =>
    isRecord(attribute) && typeof attribute.id === "string" && typeof attribute.categoryId === "string" &&
    typeof attribute.name === "string" && typeof attribute.slug === "string" && isAttributeType(attribute.type) &&
    typeof attribute.isRequired === "boolean" && typeof attribute.sortOrder === "number" &&
    Number.isInteger(attribute.sortOrder))) {
    throw new Error("The template result could not be confirmed. Please refresh and try again.");
  }
  return value as CategoryAttributeRecord[];
}

function parseCategoryTemplateApplyOutcome(value: unknown): CategoryTemplateApplyOutcome {
  if (!isRecord(value) || value.status !== "success" || !isRecord(value.data) ||
    typeof value.data.templateKey !== "string" || !Array.isArray(value.data.requestedAttributeSlugs) ||
    !value.data.requestedAttributeSlugs.every((slug) => typeof slug === "string")) {
    throw new Error("The template result could not be confirmed. Please refresh and try again.");
  }

  return {
    templateKey: value.data.templateKey,
    requestedAttributeSlugs: value.data.requestedAttributeSlugs,
    createdAttributes: parseAttributeArray(value.data.createdAttributes),
    updatedAttributes: parseAttributeArray(value.data.updatedAttributes),
    unchangedAttributes: parseAttributeArray(value.data.unchangedAttributes),
  };
}

/**
 * Normalizes various backend response structures into a guaranteed CategoryAttributesResponse contract.
 */
function normalizeAttributesResponse(raw: RawAttributesApiResponse): CategoryAttributesResponse {
  const container = raw.data ?? raw;
  const direct: CategoryAttributeRecord[] =
    container.directAttributes ??
    (container.attributes ? container.attributes.filter((a) => !a.isInherited) : []);
  const inherited: CategoryAttributeRecord[] =
    container.inheritedAttributes ??
    (container.attributes ? container.attributes.filter((a) => a.isInherited) : []);
  const all: CategoryAttributeRecord[] =
    container.allAttributes ??
    (container.attributes ?? [...direct, ...inherited]);

  return {
    directAttributes: direct,
    inheritedAttributes: inherited,
    allAttributes: all,
  };
}

/**
 * Fetch the full category flat list and hierarchical tree for taxonomy administration.
 */
export async function getAdminCategories(includeInactive = true) {
  const response = await apiClient<AdminCategoriesResponse>("/admin/categories", {
    method: "GET",
    query: includeInactive ? { includeInactive: true } : undefined,
    cache: "no-store",
  });

  return response.data;
}

/**
 * Create a new taxonomy category.
 */
export async function createAdminCategory(payload: AdminCategoryPayload) {
  const response = await apiClient<AdminCategoryResponse>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
    csrf: true,
  });

  return response.data.category;
}

/**
 * Update category details. Callers should send a minimal patch so unchanged
 * structural fields do not trigger backend reason requirements.
 */
export async function updateAdminCategory(
  categoryId: string,
  payload: Partial<AdminCategoryPayload>,
) {
  const response = await apiClient<AdminCategoryResponse>(
    `/admin/categories/${categoryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      csrf: true,
    },
  );

  return response.data.category;
}

/**
 * Delete a category taxonomy node by ID.
 */
export async function deleteAdminCategory(categoryId: string): Promise<void> {
  await apiClient<void>(`/admin/categories/${categoryId}`, {
    method: "DELETE",
    csrf: true,
  });
}

/**
 * Get direct and inherited custom attributes for a category.
 */
export async function getCategoryAttributes(categoryId: string): Promise<CategoryAttributesResponse> {
  const response = await apiClient<RawAttributesApiResponse>(
    `/admin/categories/${categoryId}/attributes`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return normalizeAttributesResponse(response);
}

/** Fetches the backend-owned template catalog; no local template fallback exists. */
export async function getCategoryTemplates(): Promise<CategoryTemplateDefinition[]> {
  const response = await apiClient<CategoryTemplatesApiResponse>("/admin/category-templates", {
    method: "GET",
    cache: "no-store",
  });

  if (response.status !== "success" || !Array.isArray(response.data?.templates)) {
    throw new Error("Category templates are unavailable right now. Please try again.");
  }

  return response.data.templates.map(parseTemplateDefinition);
}

/**
 * Create a custom attribute for a category.
 */
export async function createCategoryAttribute(
  categoryId: string,
  payload: CreateCategoryAttributePayload,
): Promise<CategoryAttributeRecord> {
  const response = await apiClient<SingleAttributeApiResponse>(
    `/admin/categories/${categoryId}/attributes`,
    {
      method: "POST",
      body: JSON.stringify(payload),
      csrf: true,
    },
  );

  const attribute = response.data?.attribute ?? response.attribute;
  if (!attribute) {
    // If backend returns the record directly
    return response as unknown as CategoryAttributeRecord;
  }
  return attribute;
}

/**
 * Update an existing category attribute definition.
 */
export async function updateCategoryAttribute(
  categoryId: string,
  attributeId: string,
  payload: UpdateCategoryAttributePayload,
): Promise<CategoryAttributeRecord> {
  const response = await apiClient<SingleAttributeApiResponse>(
    `/admin/categories/${categoryId}/attributes/${attributeId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      csrf: true,
    },
  );

  const attribute = response.data?.attribute ?? response.attribute;
  if (!attribute) {
    return response as unknown as CategoryAttributeRecord;
  }
  return attribute;
}

/**
 * Delete a category attribute definition.
 */
export async function deleteCategoryAttribute(
  categoryId: string,
  attributeId: string,
): Promise<void> {
  await apiClient<void>(`/admin/categories/${categoryId}/attributes/${attributeId}`, {
    method: "DELETE",
    csrf: true,
  });
}

/**
 * Applies a backend-owned template. A missing or failed batch endpoint remains a
 * failure: silently creating attributes one-by-one would override backend truth.
 */
export async function applyCategoryTemplate(
  categoryId: string,
  templateKey: string,
  selectedAttributeSlugs?: string[],
): Promise<CategoryTemplateApplyOutcome> {
  const response = await apiClient<ApplyCategoryTemplateApiResponse>(
    `/admin/categories/${categoryId}/apply-template`,
    {
      method: "POST",
      body: JSON.stringify({ templateKey, selectedAttributeSlugs }),
      csrf: true,
    },
  );

  return parseCategoryTemplateApplyOutcome(response);
}
