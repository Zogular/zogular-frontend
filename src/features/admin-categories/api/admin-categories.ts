import { apiClient } from "@/services/api";
import type {
  AdminCategoryPayload,
  AdminCategoryRecord,
  AdminCategoryTreeNode,
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

export async function getAdminCategories(includeInactive = true) {
  const response = await apiClient<AdminCategoriesResponse>("/admin/categories", {
    method: "GET",
    query: includeInactive ? { includeInactive: true } : undefined,
    cache: "no-store",
  });

  return response.data;
}

export async function createAdminCategory(payload: AdminCategoryPayload) {
  const response = await apiClient<AdminCategoryResponse>("/admin/categories", {
    method: "POST",
    body: JSON.stringify(payload),
    csrf: true,
  });

  return response.data.category;
}

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
