"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCategoryAttributes, fetchCategoryTree } from "@/services/categories-api";
import type { CategorySelection } from "../_lib/category-selection";

const CATEGORY_STALE_TIME = 5 * 60 * 1000;

export function useProductCategoryContracts(selection: CategorySelection | null) {
  const queryClient = useQueryClient();
  const categoryTreeQuery = useQuery({
    queryKey: ["categories", "seller-product-tree"],
    queryFn: fetchCategoryTree,
    staleTime: CATEGORY_STALE_TIME,
    retry: 1,
  });

  const shouldLoadAttributes = Boolean(selection?.isBackendCategory && !selection.isOther);
  const categoryAttributesQuery = useQuery({
    queryKey: ["categories", "seller-product-attributes", selection?.leafId, selection?.leafSlug],
    queryFn: () => fetchCategoryAttributes(selection!.leafSlug, selection!.leafId),
    enabled: shouldLoadAttributes,
    staleTime: CATEGORY_STALE_TIME,
    retry: 1,
  });

  return {
    categoryTree: categoryTreeQuery.data ?? [],
    categoryTreeStatus: categoryTreeQuery.isPending
      ? "loading" as const
      : categoryTreeQuery.isError
        ? "error" as const
        : "success" as const,
    retryCategoryTree: () => categoryTreeQuery.refetch(),
    categoryAttributes: shouldLoadAttributes ? categoryAttributesQuery.data ?? [] : [],
    categoryAttributesStatus: shouldLoadAttributes
      ? categoryAttributesQuery.isPending
        ? "loading" as const
        : categoryAttributesQuery.isError
          ? "error" as const
          : "success" as const
      : "success" as const,
    retryCategoryAttributes: () => categoryAttributesQuery.refetch(),
    loadAttributesForSelection: (nextSelection: CategorySelection) => {
      if (!nextSelection.isBackendCategory || nextSelection.isOther) return Promise.resolve([]);
      return queryClient.fetchQuery({
        queryKey: ["categories", "seller-product-attributes", nextSelection.leafId, nextSelection.leafSlug],
        queryFn: () => fetchCategoryAttributes(nextSelection.leafSlug, nextSelection.leafId),
        staleTime: CATEGORY_STALE_TIME,
        retry: 1,
      });
    },
  };
}
