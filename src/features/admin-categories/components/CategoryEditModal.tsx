"use client";

/**
 * Category create/edit dialog for the admin category workspace.
 *
 * The dialog sends a full payload for new categories and a minimal patch for
 * edits. Backend rules require a reason only for real structural changes:
 * category URL, parent category, or visibility.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderTree,
  Lock,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DeleteCategoryConfirmationDialog } from "./DeleteCategoryConfirmationDialog";
import {
  CategoryIconPickerModal,
  CATEGORY_ICON_CATALOG,
} from "./CategoryIconPickerModal";
import type { AdminCategoryPayload, AdminCategoryRecord } from "../types";

export interface CategoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initialParentId?: string | null;
  categoryToEdit?: AdminCategoryRecord | null;
  allCategories: AdminCategoryRecord[];
  onSave: (payload: Partial<AdminCategoryPayload>, categoryId?: string) => Promise<void>;
  onDelete?: (categoryId: string) => Promise<void> | void;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeDescription(value: string) {
  return value.trim() || undefined;
}

function hasValidStructuralReason(value: string) {
  return value.trim().length >= 3;
}

export function CategoryEditModal({
  isOpen,
  onClose,
  mode,
  initialParentId = null,
  categoryToEdit = null,
  allCategories,
  onSave,
  onDelete,
}: CategoryEditModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState("0");
  const [reason, setReason] = useState("");

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const iconPickerTriggerRef = useRef<HTMLButtonElement>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmingDelete(false);
      setIsConfirmingDiscard(false);
      setIsIconPickerOpen(false);
      setIsSubmitting(false);
      setIsDeleting(false);
      return;
    }

    if (mode === "edit" && categoryToEdit) {
      setName(categoryToEdit.name);
      setSlug(categoryToEdit.slug);
      setIsSlugManuallyEdited(true);
      setDescription(categoryToEdit.description ?? "");
      setIcon(categoryToEdit.icon ?? "");
      setParentId(categoryToEdit.parentId ?? "");
      setIsActive(categoryToEdit.isActive);
      setSortOrder(String(categoryToEdit.sortOrder ?? 0));
      setReason("");
      setIsAdvancedOpen(false);
    } else {
      setName("");
      setSlug("");
      setIsSlugManuallyEdited(false);
      setDescription("");
      setIcon("");
      setParentId(initialParentId ?? "");
      setIsActive(true);
      setSortOrder("0");
      setReason("");
      setIsAdvancedOpen(false);
    }

  }, [categoryToEdit, initialParentId, isOpen, mode]);

  const parentOptions = useMemo(() => {
    return allCategories
      .filter((cat) => cat.id !== categoryToEdit?.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCategories, categoryToEdit?.id]);

  const selectedIconDef = useMemo(() => {
    if (!icon) return null;
    return CATEGORY_ICON_CATALOG.find((item) => item.value === icon) ?? null;
  }, [icon]);

  const structuralChanges = useMemo(() => {
    if (mode !== "edit" || !categoryToEdit) return [];
    const changes: string[] = [];
    const currentParentId = categoryToEdit.parentId ?? null;
    const nextParentId = parentId ? parentId : null;

    if (currentParentId !== nextParentId) changes.push("parent category");
    if (categoryToEdit.slug !== slug.trim()) changes.push("category URL");
    if (categoryToEdit.isActive !== isActive) changes.push("category visibility");
    return changes;
  }, [categoryToEdit, isActive, mode, parentId, slug]);

  const hasUnsavedChanges = useMemo(() => {
    if (mode === "create") {
      return Boolean(name.trim() || slug.trim() || description.trim() || icon || parentId || sortOrder !== "0" || !isActive);
    }
    if (!categoryToEdit) return false;
    return (
      name.trim() !== categoryToEdit.name ||
      slug.trim() !== categoryToEdit.slug ||
      description.trim() !== (categoryToEdit.description ?? "") ||
      icon !== (categoryToEdit.icon ?? "") ||
      (parentId || null) !== categoryToEdit.parentId ||
      (Number(sortOrder) || 0) !== categoryToEdit.sortOrder ||
      isActive !== categoryToEdit.isActive
    );
  }, [categoryToEdit, description, icon, isActive, mode, name, parentId, slug, sortOrder]);

  const requestClose = useCallback(() => {
    if (isSubmitting || isDeleting) return;
    if (hasUnsavedChanges) {
      setIsConfirmingDiscard(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, isDeleting, isSubmitting, onClose]);

  const closeIconPicker = () => {
    setIsIconPickerOpen(false);
    // This picker is controlled by the editor, not a Radix DialogTrigger.
    // Restore keyboard users to the exact control that opened it.
    window.requestAnimationFrame(() => iconPickerTriggerRef.current?.focus());
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!isSlugManuallyEdited) setSlug(slugify(value));
  };

  const buildEditPayload = (): Partial<AdminCategoryPayload> => {
    if (!categoryToEdit) return {};
    const payload: Partial<AdminCategoryPayload> = {};
    const nextName = name.trim();
    const nextSlug = slug.trim();
    const nextDescription = normalizeDescription(description);
    const nextIcon = icon || undefined;
    const nextParentId = parentId ? parentId : null;
    const nextSortOrder = Number(sortOrder) || 0;

    if (nextName !== categoryToEdit.name) payload.name = nextName;
    if (nextSlug !== categoryToEdit.slug) payload.slug = nextSlug;
    if ((nextDescription ?? null) !== (categoryToEdit.description ?? null)) payload.description = nextDescription;
    if ((nextIcon ?? null) !== (categoryToEdit.icon ?? null)) payload.icon = nextIcon;
    if (nextParentId !== categoryToEdit.parentId) payload.parentId = nextParentId;
    if (nextSortOrder !== categoryToEdit.sortOrder) payload.sortOrder = nextSortOrder;
    if (isActive !== categoryToEdit.isActive) payload.isActive = isActive;
    if (structuralChanges.length) payload.reason = reason.trim();
    return payload;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Category name is required.");
      return;
    }
    if (mode === "edit" && structuralChanges.length > 0 && !hasValidStructuralReason(reason)) {
      toast.error("Add a reason with at least 3 characters.");
      return;
    }

    const payload: Partial<AdminCategoryPayload> = mode === "edit"
      ? buildEditPayload()
      : {
          name: name.trim(),
          slug: slug.trim() || undefined,
          description: normalizeDescription(description),
          icon: icon || undefined,
          parentId: parentId ? parentId : null,
          isActive,
          sortOrder: Number(sortOrder) || 0,
        };

    if (mode === "edit" && Object.keys(payload).length === 0) {
      toast.message("No category changes to save.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(payload, categoryToEdit?.id);
      toast.success(mode === "edit" ? "Category updated." : "Category created.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save category.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToEdit || !onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete(categoryToEdit.id);
      setIsConfirmingDelete(false);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete category.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && requestClose()}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          requestClose();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[#fff8ec] text-stone-900 shadow-2xl"
      >
        {/* Modal Header */}
        <DialogHeader className="flex-row items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#063b29] text-[#fff8ec]">
              <FolderTree className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-black tracking-tight text-[var(--admin-canopy-deep)]">
                {mode === "edit" ? "Edit Category" : "Create Category"}
              </DialogTitle>
              <DialogDescription className="truncate text-[11px] text-[var(--admin-ink-soft)]">
                {mode === "edit" ? `Updating ${categoryToEdit?.name}` : "Add a main category or subcategory."}
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close category editor"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-stone-200/70 text-stone-600 transition-colors hover:bg-stone-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-5rem)] overflow-y-auto p-5">
          <div className="space-y-4">
            {/* Section 1: Basic Setup */}
            <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--admin-canopy-deep)]">
                  1. Basic Taxonomy Setup
                </span>
                <span className="text-[10px] font-semibold text-stone-500">Core marketplace visibility</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Category name *</span>
                  <Input
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Solar Energy"
                    className="mt-1 h-11 rounded-xl border-stone-300 bg-white text-sm font-semibold focus-visible:ring-[#075b36]"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Parent category</span>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900 outline-none focus:ring-1 focus:ring-[#075b36]"
                  >
                    <option value="">Main category (Top Level)</option>
                    {parentOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Visual Icon Picker Trigger */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600">
                  Visual Category Icon
                </label>
                <div className="mt-1.5 flex items-center gap-3">
                  <button
                    ref={iconPickerTriggerRef}
                    type="button"
                    onClick={() => setIsIconPickerOpen(true)}
                    className="flex flex-1 items-center justify-between rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-left transition-all hover:border-[#075b36] hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-[#075b36]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-[#fff8ec] text-[#063b29] ring-1 ring-stone-200">
                        {selectedIconDef ? (
                          <selectedIconDef.Icon className="size-4.5" />
                        ) : (
                          <FolderTree className="size-4.5 text-stone-400" />
                        )}
                      </div>
                      <div>
                        <span className="block text-xs font-black text-stone-900">
                          {selectedIconDef ? selectedIconDef.label : "Default Hierarchy Icon"}
                        </span>
                        <span className="block text-[10px] text-stone-500">
                          {selectedIconDef ? selectedIconDef.department : "No custom icon assigned"}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-700">
                      Change Icon
                    </span>
                  </button>

                  {icon && (
                    <button
                      type="button"
                      onClick={() => setIcon("")}
                      title="Clear custom icon"
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-stone-300 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short note for operators and category navigation guidance."
                  className="mt-1 min-h-18 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm font-medium text-stone-900 outline-none focus:ring-1 focus:ring-[#075b36]"
                />
              </label>

              {/* Visibility Switch */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/75 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-stone-900">Show this category in marketplace</p>
                    <p className="text-[11px] text-stone-500">
                      {isActive
                        ? "Visible: Buyers and sellers can browse and select this category."
                        : "Hidden: Category is archived and hidden from public navigation."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={cn(
                      "min-h-10 rounded-full px-4 text-xs font-black uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]",
                      isActive ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" : "bg-stone-200 text-stone-600"
                    )}
                  >
                    {isActive ? "Visible" : "Hidden"}
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Advanced Taxonomy Settings (Collapsible) */}
            <div className="rounded-2xl border border-stone-200 bg-white/70 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsAdvancedOpen((open) => !open)}
                className="flex min-h-12 w-full items-center justify-between px-4 text-left text-xs font-black uppercase tracking-[0.12em] text-stone-900 hover:bg-stone-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]"
              >
                <span>Advanced Taxonomy Details</span>
                <span className="text-[11px] font-bold text-stone-500">
                  {isAdvancedOpen ? "Hide" : "Show"}
                </span>
              </button>

              {isAdvancedOpen && (
                <div className="grid gap-3 border-t border-stone-200 p-4 sm:grid-cols-2 bg-white/90">
                  <label className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Category URL Slug</span>
                      {isSlugManuallyEdited && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSlugManuallyEdited(false);
                            setSlug(slugify(name));
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#075b36] hover:underline"
                        >
                          <RotateCcw className="size-2.5" />
                          Re-sync with name
                        </button>
                      )}
                    </div>
                    <Input
                      value={slug}
                      onChange={(e) => {
                        setIsSlugManuallyEdited(true);
                        setSlug(slugify(e.target.value));
                      }}
                      placeholder="solar-energy"
                      className="mt-1 h-10 rounded-xl border-stone-300 bg-white text-xs font-semibold focus-visible:ring-[#075b36]"
                    />
                    <span className="mt-1 block text-[10px] text-stone-500">
                      Web path used in URLs. Changing this can break saved links.
                    </span>
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Display Order</span>
                    <Input
                      type="number"
                      min="0"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      className="mt-1 h-10 rounded-xl border-stone-300 bg-white text-xs font-semibold focus-visible:ring-[#075b36]"
                    />
                    <span className="mt-1 block text-[10px] text-stone-500">
                      Sort priority (lower numbers appear earlier in catalog lists).
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Section 3: Structural Change Audit Reason (Required by Governance) */}
            {structuralChanges.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="size-3.5 text-amber-800 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-[0.1em] text-amber-950">
                    Governance Audit Reason Required *
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-normal">
                  You are making structural changes to <span className="font-bold">{structuralChanges.join(", ")}</span>.
                  Platform security invariants require a recorded audit reason (minimum 3 characters) for this category update.
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this category structure needs to change (e.g., 'Reorganizing solar equipment taxonomy per catalog standards')."
                  className="mt-2 min-h-18 w-full rounded-xl border border-amber-300 bg-white p-3 text-xs font-medium text-stone-900 outline-none focus:ring-1 focus:ring-[#075b36]"
                  required
                />
              </div>
            )}
          </div>

          {/* Modal Action Footer */}
          <div className="mt-5 flex flex-col gap-3 border-t border-stone-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {mode === "edit" && categoryToEdit && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting || isDeleting}
                onClick={() => setIsConfirmingDelete(true)}
                className="min-h-11 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" />
                Delete Category
              </Button>
            ) : <div />}

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
                disabled={isSubmitting || isDeleting}
                className="min-h-11 rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || isDeleting}
                className="min-h-11 rounded-xl bg-[#075b36] px-5 text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-[#063b29] shadow-sm"
              >
                <Save className="mr-1.5 size-3.5" aria-hidden="true" />
                {mode === "edit" ? "Save Category Changes" : "Create Category"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      {/* Visual Searchable Icon Picker Modal */}
      <CategoryIconPickerModal
        isOpen={isIconPickerOpen}
        onClose={closeIconPicker}
        selectedIcon={icon}
        onSelectIcon={(nextIcon) => setIcon(nextIcon)}
      />

      {/* Delete Category Confirmation Dialog */}
      <DeleteCategoryConfirmationDialog
        isOpen={isConfirmingDelete}
        category={categoryToEdit}
        onClose={() => setIsConfirmingDelete(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

      {/* Discard Unsaved Changes Modal */}
      <Dialog open={isConfirmingDiscard} onOpenChange={(open) => setIsConfirmingDiscard(open)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-sm rounded-[1.8rem] border border-stone-200 bg-[#fff8ec] p-5 text-stone-900 shadow-2xl"
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-black text-stone-900">
              Discard unsaved category changes?
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-600 leading-relaxed">
              You have modified category fields. If you close now without saving, these adjustments will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmingDiscard(false)}
              className="min-h-10 rounded-xl text-xs font-bold"
            >
              Continue Editing
            </Button>
            <Button
              type="button"
              onClick={() => {
                setIsConfirmingDiscard(false);
                onClose();
              }}
              className="min-h-10 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"
            >
              Discard Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
