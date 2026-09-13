/**
 * @file use-admin-products.ts
 * @module features/admin-products/hooks
 * @description
 * High-performance TanStack Query hook managing the Admin Product Moderation and Inventory Oversight state.
 * Implements React 19 deferred value synchronization for search debouncing, structured multi-selection,
 * real-time SSE cache invalidations on ["admin", "products"], and single/bulk moderation actions with
 * comprehensive policy and concurrency conflict handling.
 */

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminProductsApi,
  type AdminProductRecord,
} from "@/services/admin/products";
import {
  isProductSnapshotConflict,
  parseProductContentPolicyError,
  type ProductContentPolicyIssue,
} from "@/services/product-content-policy";
import {
  getReasonTemplateByCode,
  MODERATION_REASON_TEMPLATES,
} from "../lib/product-moderation.utils";
import type {
  ProductListViewMode,
  ProductModerationDialogState,
  ProductModerationStatusFilter,
  ProductSummaryCounts,
} from "../types/admin-product.types";

export function useAdminProducts(canModerate: boolean) {
  const queryClient = useQueryClient();

  // Primary data query
  const {
    data: products = [],
    isLoading,
    isFetching,
    isError,
    error,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["admin", "products"],
    queryFn: () => adminProductsApi.fetchProducts(),
    staleTime: 30_000,
  });

  // Filter & view state
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [statusFilter, setStatusFilter] = useState<ProductModerationStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [view, setView] = useState<ProductListViewMode>("list");

  // Multi-selection state
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Policy feedback & snapshot conflicts
  const [contentPolicyIssues, setContentPolicyIssues] = useState<readonly ProductContentPolicyIssue[]>([]);
  const [hasSnapshotConflict, setHasSnapshotConflict] = useState(false);

  // Moderation Dialog state
  const [dialogState, setDialogState] = useState<ProductModerationDialogState>({
    isOpen: false,
    action: "reject",
    productIds: [],
    targetTitle: undefined,
    isBulk: false,
    reasonCode: MODERATION_REASON_TEMPLATES[0].code,
    note: MODERATION_REASON_TEMPLATES[0].defaultNote,
  });

  // Unique categories derived from catalog
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.categoryName) set.add(p.categoryName);
    }
    return ["all", ...Array.from(set).sort()];
  }, [products]);

  // Filtered dataset
  const filteredProducts = useMemo(() => {
    let result = products;

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    if (categoryFilter !== "all") {
      result = result.filter((p) => p.categoryName === categoryFilter);
    }

    const query = deferredSearch.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.sellerStore.toLowerCase().includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.categoryName.toLowerCase().includes(query),
      );
    }

    return result;
  }, [products, statusFilter, categoryFilter, deferredSearch]);

  // Metric counts across complete dataset
  const summary: ProductSummaryCounts = useMemo(() => {
    return {
      published: products.filter((p) => p.status === "published").length,
      pending: products.filter((p) => p.status === "pending_review").length,
      changesRequested: products.filter((p) => p.status === "needs_changes").length,
      flagged: products.filter((p) => p.flags > 0).length,
      total: products.length,
    };
  }, [products]);

  // Selection metrics
  const filteredProductIds = useMemo(
    () => filteredProducts.map((p) => p.sellerProductId),
    [filteredProducts],
  );

  const isAllSelected =
    filteredProductIds.length > 0 &&
    filteredProductIds.every((id) => selectedProductIds.includes(id));

  const selectedPendingCount = useMemo(() => {
    return products.filter(
      (p) =>
        selectedProductIds.includes(p.sellerProductId) &&
        p.status === "pending_review",
    ).length;
  }, [products, selectedProductIds]);

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const selectAllFiltered = () => {
    if (isAllSelected) {
      const visibleSet = new Set(filteredProductIds);
      setSelectedProductIds((current) => current.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedProductIds((current) =>
        Array.from(new Set([...current, ...filteredProductIds])),
      );
    }
  };

  const clearSelection = () => {
    setSelectedProductIds([]);
  };

  // Invalidate cache helper
  const invalidateProductQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-dashboard-overview"] });
  };

  // Single review mutation
  const singleReviewMutation = useMutation({
    mutationFn: async ({
      productId,
      action,
      note,
      reasonCode,
    }: {
      productId: string;
      action: "approve" | "reject" | "request_changes";
      note?: string;
      reasonCode?: string;
    }) => {
      return adminProductsApi.reviewProduct(productId, { action, note, reasonCode });
    },
    onSuccess: (_, variables) => {
      invalidateProductQueries();
      const actionText =
        variables.action === "approve"
          ? "approved"
          : variables.action === "request_changes"
            ? "requested changes for"
            : "rejected";
      toast.success(`Successfully ${actionText} product.`);
    },
    onError: (err) => {
      const policyIssues = parseProductContentPolicyError(err);
      if (policyIssues) {
        setContentPolicyIssues(policyIssues);
        return;
      }
      if (isProductSnapshotConflict(err)) {
        setHasSnapshotConflict(true);
        toast.error("Product was updated concurrently. Please refresh.");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Moderation action failed.");
    },
  });

  // Bulk review mutation
  const bulkReviewMutation = useMutation({
    mutationFn: async ({
      productIds,
      action,
      note,
      reasonCode,
    }: {
      productIds: string[];
      action: "approve" | "reject" | "request_changes";
      note?: string;
      reasonCode?: string;
    }) => {
      return adminProductsApi.bulkReviewProducts(productIds, { action, note, reasonCode });
    },
    onSuccess: (result) => {
      invalidateProductQueries();
      clearSelection();
      toast.success(`${result.count} products updated successfully.`);
    },
    onError: (err) => {
      const policyIssues = parseProductContentPolicyError(err);
      if (policyIssues) {
        setContentPolicyIssues(policyIssues);
        return;
      }
      if (isProductSnapshotConflict(err)) {
        setHasSnapshotConflict(true);
        toast.error("One or more products were modified concurrently. Please refresh.");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Bulk moderation failed.");
    },
  });

  // Action handlers
  const handleQuickApprove = (product: AdminProductRecord) => {
    if (!canModerate) return toast.error("Unauthorized.");
    setContentPolicyIssues([]);
    setHasSnapshotConflict(false);
    singleReviewMutation.mutate({
      productId: product.sellerProductId,
      action: "approve",
    });
  };

  const handleBulkApprove = () => {
    if (!canModerate) return toast.error("Unauthorized.");
    const eligibleProducts = products.filter(
      (p) =>
        selectedProductIds.includes(p.sellerProductId) &&
        p.status === "pending_review",
    );
    if (eligibleProducts.length === 0) {
      return toast.error("Select at least one pending review product to approve.");
    }
    setContentPolicyIssues([]);
    setHasSnapshotConflict(false);
    bulkReviewMutation.mutate({
      productIds: eligibleProducts.map((p) => p.sellerProductId),
      action: "approve",
    });
  };

  const openModerationDialog = (
    action: "reject" | "request_changes",
    productIds: string[],
    targetTitle?: string,
  ) => {
    const defaultTemplate = MODERATION_REASON_TEMPLATES[0];
    setDialogState({
      isOpen: true,
      action,
      productIds,
      targetTitle,
      isBulk: productIds.length > 1,
      reasonCode: defaultTemplate.code,
      note: defaultTemplate.defaultNote,
    });
  };

  const closeModerationDialog = () => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  };

  const setDialogReasonCode = (code: string) => {
    const template = getReasonTemplateByCode(code);
    setDialogState((prev) => ({
      ...prev,
      reasonCode: code,
      note: template?.defaultNote || prev.note,
    }));
  };

  const setDialogNote = (note: string) => {
    setDialogState((prev) => ({ ...prev, note }));
  };

  const handleSubmitDialogDecision = () => {
    if (!canModerate) return toast.error("Unauthorized.");
    const { action, productIds, isBulk, note, reasonCode } = dialogState;

    if (!note.trim()) {
      return toast.error("Please specify a note or rationale for the seller.");
    }

    setContentPolicyIssues([]);
    setHasSnapshotConflict(false);

    if (isBulk) {
      bulkReviewMutation.mutate(
        {
          productIds,
          action,
          note: note.trim(),
          reasonCode,
        },
        {
          onSuccess: () => closeModerationDialog(),
        },
      );
    } else {
      singleReviewMutation.mutate(
        {
          productId: productIds[0],
          action,
          note: note.trim(),
          reasonCode,
        },
        {
          onSuccess: () => closeModerationDialog(),
        },
      );
    }
  };

  const isSubmitting =
    singleReviewMutation.isPending || bulkReviewMutation.isPending;

  return {
    // Data
    products: filteredProducts,
    allProducts: products,
    categories,
    summary,
    isLoading,
    isFetching,
    isError,
    error,
    dataUpdatedAt,
    refetch,

    // Filters
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    view,
    setView,

    // Selection
    selectedProductIds,
    toggleProductSelection,
    selectAllFiltered,
    clearSelection,
    isAllSelected,
    selectedPendingCount,

    // Policy & Conflicts
    contentPolicyIssues,
    hasSnapshotConflict,
    isSubmitting,

    // Actions & Dialog
    dialogState,
    openModerationDialog,
    closeModerationDialog,
    setDialogReasonCode,
    setDialogNote,
    handleSubmitDialogDecision,
    handleQuickApprove,
    handleBulkApprove,
  };
}
