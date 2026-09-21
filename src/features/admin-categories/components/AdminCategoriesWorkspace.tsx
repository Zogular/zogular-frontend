"use client";

/**
 * @file AdminCategoriesWorkspace.tsx
 * @module features/admin-categories/components
 * @description
 * Primary orchestrator for Category and Product Field Studio (F7).
 * Thin layout coordinator decomposing responsibilities across CategoryTreePanel,
 * AttributeStudioPanel, LiveSellerFormPreview, AttributeBuilderDrawer,
 * and IndustryTemplateLibraryModal with return scroll restoration, tactile styling,
 * permission gating, and accessible confirmation dialogs.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Filter,
  FolderTree,
  Layers,
  Plus,
  Sliders,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  applyCategoryTemplate,
  createAdminCategory,
  createCategoryAttribute,
  deleteAdminCategory,
  deleteCategoryAttribute,
  getAdminCategories,
  getCategoryAttributes,
  updateAdminCategory,
  updateCategoryAttribute,
} from "../api/admin-categories";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { CategoryTreePanel } from "./CategoryTreePanel";
import { AttributeStudioPanel } from "./AttributeStudioPanel";
import { AttributeBuilderDrawer } from "./AttributeBuilderDrawer";
import { LiveSellerFormPreview } from "./LiveSellerFormPreview";
import { BuyerFilterPreview } from "./BuyerFilterPreview";
import { IndustryTemplateLibraryModal } from "./IndustryTemplateLibraryModal";
import { CategoryEditModal } from "./CategoryEditModal";
import { DeleteAttributeConfirmationDialog } from "./DeleteAttributeConfirmationDialog";
import type {
  AdminCategoryPayload,
  AdminCategoryRecord,
  AdminCategoryTreeNode,
  CategoryAttributeRecord,
  CreateCategoryAttributePayload,
  CategoryTemplateApplyOutcome,
} from "../types";

const SELECTED_CATEGORY_STORAGE_KEY = "zogular:admin:selected-category-id";

export function AdminCategoriesWorkspace() {
  const identity = useAdminIdentity();
  const canManageCategories = adminIdentityHasPermission(identity, "manage_categories");

  // Category data state
  const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
  const [tree, setTree] = useState<AdminCategoryTreeNode[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  // The first taxonomy request is still meaningful loading work. Keeping this
  // true prevents an empty tree or premature scroll restoration before it settles.
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);

  // Selected Category Attributes state
  const [directAttributes, setDirectAttributes] = useState<CategoryAttributeRecord[]>([]);
  const [inheritedAttributes, setInheritedAttributes] = useState<CategoryAttributeRecord[]>([]);
  const [isAttributesLoading, setIsAttributesLoading] = useState(false);
  const [attributeLoadError, setAttributeLoadError] = useState<string | null>(null);

  // Active workspace right-panel view mode
  const [viewMode, setViewMode] = useState<"studio" | "simulator" | "buyer_filters">("studio");

  // Category Edit/Create modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState<"create" | "edit">("create");
  const [categoryModalParentId, setCategoryModalParentId] = useState<string | null>(null);
  const [categoryToEdit, setCategoryToEdit] = useState<AdminCategoryRecord | null>(null);
  const categoryModalTriggerRef = useRef<HTMLElement | null>(null);

  // Attribute Builder Drawer state
  const [isAttributeDrawerOpen, setIsAttributeDrawerOpen] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<CategoryAttributeRecord | null>(null);

  // Attribute Delete Confirmation Dialog state
  const [attributeToDelete, setAttributeToDelete] = useState<CategoryAttributeRecord | null>(null);
  const [isDeletingAttribute, setIsDeletingAttribute] = useState(false);

  // Template Library modal state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Restore scroll positions across navigation once categories have loaded.
  // The ready gate becomes true only after the first category request settles.
  useListScrollRestoration("/admin/categories", !isCategoriesLoading);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  // Compute breadcrumbs for selected category
  const breadcrumbCategories = useMemo(() => {
    if (!selectedCategory) return [];
    const chain: AdminCategoryRecord[] = [];
    let curr: AdminCategoryRecord | undefined = selectedCategory;
    while (curr) {
      chain.unshift(curr);
      curr = curr.parentId
        ? categories.find((c) => c.id === curr?.parentId)
        : undefined;
    }
    return chain;
  }, [selectedCategory, categories]);

  // Load categories taxonomy
  const refreshCategories = useCallback(async (preferredId?: string | null) => {
    try {
      setIsCategoriesLoading(true);
      const data = await getAdminCategories(true);
      setCategories(data.categories);
      setTree(data.tree);

      setSelectedCategoryId((current) => {
        if (preferredId !== undefined) {
          if (preferredId) {
            window.sessionStorage.setItem(SELECTED_CATEGORY_STORAGE_KEY, preferredId);
          } else {
            window.sessionStorage.removeItem(SELECTED_CATEGORY_STORAGE_KEY);
          }
          return preferredId;
        }
        // Try to restore from sessionStorage
        const saved = window.sessionStorage.getItem(SELECTED_CATEGORY_STORAGE_KEY);
        if (saved && data.categories.some((c) => c.id === saved)) {
          return saved;
        }
        if (current && data.categories.some((c) => c.id === current)) {
          return current;
        }
        const first = data.categories[0]?.id ?? null;
        if (first) {
          window.sessionStorage.setItem(SELECTED_CATEGORY_STORAGE_KEY, first);
        }
        return first;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load categories.");
    } finally {
      setIsCategoriesLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void refreshCategories();
  }, [refreshCategories]);

  // Load attributes whenever selected category changes
  const loadCategoryAttributes = useCallback(async (catId: string) => {
    try {
      setIsAttributesLoading(true);
      setAttributeLoadError(null);
      const res = await getCategoryAttributes(catId);
      setDirectAttributes(res.directAttributes);
      setInheritedAttributes(res.inheritedAttributes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Category fields could not load.";
      setAttributeLoadError(message);
      toast.error(message);
      setDirectAttributes([]);
      setInheritedAttributes([]);
    } finally {
      setIsAttributesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      void loadCategoryAttributes(selectedCategoryId);
      window.sessionStorage.setItem(SELECTED_CATEGORY_STORAGE_KEY, selectedCategoryId);
    } else {
      setDirectAttributes([]);
      setInheritedAttributes([]);
    }
  }, [selectedCategoryId, loadCategoryAttributes]);

  // Handle category selection
  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
  };

  // Category creation / edit dialog handlers
  const handleOpenCreateRoot = () => {
    if (!canManageCategories) {
      toast.error("Requires category management permission.");
      return;
    }
    categoryModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCategoryModalMode("create");
    setCategoryModalParentId(null);
    setCategoryToEdit(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenCreateChild = (parentId: string) => {
    if (!canManageCategories) {
      toast.error("Requires category management permission.");
      return;
    }
    categoryModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCategoryModalMode("create");
    setCategoryModalParentId(parentId);
    setCategoryToEdit(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: AdminCategoryRecord) => {
    if (!canManageCategories) {
      toast.error("Requires category management permission.");
      return;
    }
    categoryModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCategoryModalMode("edit");
    setCategoryToEdit(cat);
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    // The editor is opened by contextual tree controls rather than a Radix
    // DialogTrigger. Restore the exact initiating control after the portal closes.
    window.requestAnimationFrame(() => categoryModalTriggerRef.current?.focus());
  };

  const handleSaveCategory = async (payload: Partial<AdminCategoryPayload>, categoryId?: string) => {
    if (categoryModalMode === "edit" && categoryId) {
      const updated = await updateAdminCategory(categoryId, payload);
      await refreshCategories(updated.id);
    } else {
      const created = await createAdminCategory(payload as AdminCategoryPayload);
      await refreshCategories(created.id);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await deleteAdminCategory(categoryId);
      toast.success("Category deleted successfully.");
      if (selectedCategoryId === categoryId) {
        window.sessionStorage.removeItem(SELECTED_CATEGORY_STORAGE_KEY);
        await refreshCategories(null);
      } else {
        await refreshCategories(selectedCategoryId);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category.");
      throw err;
    }
  };

  // Attribute builder drawer handlers
  const handleOpenAddAttribute = () => {
    if (!canManageCategories) {
      toast.error("Requires category management permission.");
      return;
    }
    setEditingAttribute(null);
    setIsAttributeDrawerOpen(true);
  };

  const handleOpenEditAttribute = (attr: CategoryAttributeRecord) => {
    if (!canManageCategories) {
      toast.error("Requires category management permission.");
      return;
    }
    setEditingAttribute(attr);
    setIsAttributeDrawerOpen(true);
  };

  const handleSaveAttribute = async (
    payload: CreateCategoryAttributePayload,
    attributeId?: string
  ) => {
    if (!selectedCategoryId) return;

    if (attributeId) {
      await updateCategoryAttribute(selectedCategoryId, attributeId, payload);
    } else {
      const nextSortOrder =
        payload.sortOrder ?? (directAttributes.length > 0
          ? Math.max(...directAttributes.map((a) => a.sortOrder)) + 1
          : 0);
      await createCategoryAttribute(selectedCategoryId, {
        ...payload,
        sortOrder: nextSortOrder,
      });
    }

    await loadCategoryAttributes(selectedCategoryId);
    await refreshCategories(selectedCategoryId);
  };

  const handleConfirmDeleteAttribute = async (attr: CategoryAttributeRecord) => {
    if (!selectedCategoryId) return;

    try {
      setIsDeletingAttribute(true);
      await deleteCategoryAttribute(selectedCategoryId, attr.id);
      toast.success(`Attribute "${attr.name}" deleted.`);
      setAttributeToDelete(null);
      await loadCategoryAttributes(selectedCategoryId);
      await refreshCategories(selectedCategoryId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete attribute.");
    } finally {
      setIsDeletingAttribute(false);
    }
  };

  const handleReorderAttribute = async (attributeId: string, direction: "up" | "down") => {
    if (!selectedCategoryId || !canManageCategories) return;
    const index = directAttributes.findIndex((a) => a.id === attributeId);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= directAttributes.length) return;

    const currentAttr = directAttributes[index];
    const swapAttr = directAttributes[targetIndex];

    // Optimistic swap
    const reordered = [...directAttributes];
    reordered[index] = swapAttr;
    reordered[targetIndex] = currentAttr;
    setDirectAttributes(reordered);

    try {
      await updateCategoryAttribute(selectedCategoryId, currentAttr.id, {
        sortOrder: swapAttr.sortOrder,
      });
      await updateCategoryAttribute(selectedCategoryId, swapAttr.id, {
        sortOrder: currentAttr.sortOrder,
      });
      await loadCategoryAttributes(selectedCategoryId);
    } catch {
      // Revert if failed
      setDirectAttributes(directAttributes);
      toast.error("Failed to reorder attributes.");
    }
  };

  // Industry template application
  const handleApplyTemplate = async (
    templateKey: string,
    selectedSlugs: string[],
  ): Promise<CategoryTemplateApplyOutcome> => {
    if (!selectedCategoryId) {
      throw new Error("Select a category before applying a template.");
    }
    const outcome = await applyCategoryTemplate(selectedCategoryId, templateKey, selectedSlugs);
    const refreshedAttributes = await getCategoryAttributes(selectedCategoryId);
    setDirectAttributes(refreshedAttributes.directAttributes);
    setInheritedAttributes(refreshedAttributes.inheritedAttributes);
    await refreshCategories(selectedCategoryId);
    return outcome;
  };

  // Derived KPI metrics
  const rootCount = categories.filter((c) => !c.parentId).length;
  const subcategoryCount = Math.max(categories.length - rootCount, 0);
  const totalAttributesConfigured = categories.reduce(
    (acc, c) => acc + (c._count?.attributes ?? 0),
    0
  );

  return (
    <div className="mx-auto max-w-[96rem] space-y-4">
      {/* Top Metrics Row */}
      <section className="grid grid-cols-2 gap-2 p-0.5 sm:gap-3 md:grid-cols-4">
        <KpiMetricCard
          label="Categories"
          value={categories.length}
          icon={<FolderTree className="size-4 text-[#075b36]" />}
          helper="All category levels"
        />
        <KpiMetricCard
          label="Main Departments"
          value={rootCount}
          icon={<Layers className="size-4 text-emerald-600" />}
          helper="Top-level taxonomy"
        />
        <KpiMetricCard
          label="Subcategories"
          value={subcategoryCount}
          icon={<Sliders className="size-4 text-amber-600" />}
          helper="Specialized branches"
        />
        <KpiMetricCard
          label="Configured Fields"
          value={totalAttributesConfigured}
          icon={<SlidersHorizontal className="size-4 text-blue-600" />}
          helper="Total attribute schemas"
        />
      </section>

      {/* Main Workspace Bento Grid */}
      <section className="grid grid-cols-1 items-start gap-4 lg:h-[calc(100vh-13.5rem)] lg:min-h-[700px] lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        {/* Left Column: Interactive Taxonomy Tree */}
        <div className="flex min-h-0 flex-col overflow-visible lg:h-full lg:overflow-hidden">
          <CategoryTreePanel
            tree={tree}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={handleSelectCategory}
            onCreateRoot={handleOpenCreateRoot}
            onCreateChild={handleOpenCreateChild}
            onEditCategory={handleOpenEditCategory}
            onDeleteCategory={handleDeleteCategory}
            isLoading={isCategoriesLoading}
            canManageCategories={canManageCategories}
          />
        </div>

        {/* Right Column: product fields, seller preview, or buyer preview */}
        <div className="flex min-h-0 flex-col overflow-visible lg:h-full lg:overflow-hidden">
          {selectedCategory ? (
            <div className="flex h-full flex-col">
              {/* Studio vs seller preview vs buyer preview mode toggle bar */}
              <div className="mb-2 flex flex-col gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] bg-[#fff8ec]/75 px-3 py-2 backdrop-blur-md sm:px-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("studio")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition-all",
                      viewMode === "studio"
                        ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    )}
                  >
                    <SlidersHorizontal className="size-3.5" />
                    Product Fields
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("simulator")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition-all",
                      viewMode === "simulator"
                        ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    )}
                  >
                    <Eye className="size-3.5" />
                    Seller Preview
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("buyer_filters")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-[0.1em] transition-all",
                      viewMode === "buyer_filters"
                        ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                        : "text-stone-600 hover:text-stone-900"
                    )}
                  >
                    <Filter className="size-3.5" />
                    Buyer Filters
                  </button>
                </div>

                <div className="text-[11px] font-semibold text-stone-500">
                  Editing: <span className="font-bold text-stone-900">{selectedCategory.name}</span>
                </div>
              </div>

              {/* Active Tab Panel */}
              {attributeLoadError ? (
                <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
                  <div className="font-black">Category fields could not load.</div>
                  <p className="mt-1 text-xs">{attributeLoadError}</p>
                  {selectedCategoryId ? (
                    <Button type="button" variant="outline" onClick={() => void loadCategoryAttributes(selectedCategoryId)} className="mt-3 min-h-11 rounded-xl text-xs font-bold">
                      Try again
                    </Button>
                  ) : null}
                </div>
              ) : null}
              <div className="min-h-[520px] flex-1 overflow-visible lg:min-h-0 lg:overflow-hidden">
                {viewMode === "studio" ? (
                  <AttributeStudioPanel
                    selectedCategory={selectedCategory}
                    breadcrumbCategories={breadcrumbCategories}
                    directAttributes={directAttributes}
                    inheritedAttributes={inheritedAttributes}
                    onAddAttribute={handleOpenAddAttribute}
                    onApplyTemplate={() => {
                      if (!canManageCategories) {
                        toast.error("Requires category management permission.");
                        return;
                      }
                      setIsTemplateModalOpen(true);
                    }}
                    onEditAttribute={handleOpenEditAttribute}
                    onDeleteAttribute={(attr) => setAttributeToDelete(attr)}
                    onReorderAttribute={handleReorderAttribute}
                    isLoading={isAttributesLoading}
                    canManageCategories={canManageCategories}
                  />
                ) : viewMode === "simulator" ? (
                  <LiveSellerFormPreview
                    category={selectedCategory}
                    attributes={[...inheritedAttributes, ...directAttributes]}
                  />
                ) : (
                  <BuyerFilterPreview
                    category={selectedCategory}
                    attributes={[...inheritedAttributes, ...directAttributes]}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-[1.8rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ea_100%)] p-8 text-center shadow-[0_16px_40px_rgba(6,59,41,0.06)]">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[#fff8ec] text-[#075b36] shadow-sm ring-1 ring-stone-200">
                <FolderTree className="size-7" />
              </div>
              <h3 className="mt-4 text-base font-black text-stone-900">
                Select a category to manage product fields
              </h3>
              <p className="mt-1 max-w-md text-xs text-stone-500">
                Choose a category from the list, or create a main category to begin defining product fields.
              </p>
              {canManageCategories && (
                <Button
                  type="button"
                  onClick={handleOpenCreateRoot}
                  className="mt-4 rounded-xl bg-[#075b36] px-5 text-xs font-black uppercase tracking-[0.1em] text-[#fff8ec] hover:bg-[#063b29]"
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Create Main Category
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Attribute Builder Slide-Out Drawer */}
      <AttributeBuilderDrawer
        isOpen={isAttributeDrawerOpen}
        onClose={() => setIsAttributeDrawerOpen(false)}
        onSave={handleSaveAttribute}
        editingAttribute={editingAttribute}
        categoryName={selectedCategory?.name ?? "Category"}
      />

      {/* Industry Template Library Modal */}
      {selectedCategory && (
        <IndustryTemplateLibraryModal
          isOpen={isTemplateModalOpen}
          onClose={() => setIsTemplateModalOpen(false)}
          category={selectedCategory}
          onApplyTemplate={handleApplyTemplate}
        />
      )}

      {/* Category Create / Edit Modal */}
      <CategoryEditModal
        isOpen={isCategoryModalOpen}
        onClose={handleCloseCategoryModal}
        mode={categoryModalMode}
        initialParentId={categoryModalParentId}
        categoryToEdit={categoryToEdit}
        allCategories={categories}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />

      {/* Attribute Delete Confirmation Dialog */}
      <DeleteAttributeConfirmationDialog
        isOpen={Boolean(attributeToDelete)}
        attribute={attributeToDelete}
        onClose={() => setAttributeToDelete(null)}
        onConfirm={handleConfirmDeleteAttribute}
        isDeleting={isDeletingAttribute}
      />
    </div>
  );
}

function KpiMetricCard({
  label,
  value,
  icon,
  helper,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_24%,transparent)] bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ea_100%)] p-2.5 sm:p-3.5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="truncate text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-stone-500">
          {label}
        </span>
        <div className="flex size-6 sm:size-7 items-center justify-center rounded-xl bg-[#fff8ec] shadow-inner ring-1 ring-stone-200 shrink-0">
          {icon}
        </div>
      </div>
      <p className="mt-1 text-xl sm:text-2xl font-black tracking-tight text-[var(--admin-canopy-deep)]">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[9px] sm:text-[10px] font-medium text-stone-500">{helper}</p>
    </div>
  );
}
