"use client";

/**
 * Category create/edit dialog for the admin category workspace.
 *
 * The dialog sends a full payload for new categories and a minimal patch for
 * edits. Backend rules require a reason only for real structural changes:
 * category URL, parent category, or visibility.
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  BatteryCharging,
  Dumbbell,
  FolderTree,
  HeartPulse,
  Laptop,
  Refrigerator,
  Save,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sun,
  Trash2,
  Tv,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DeleteCategoryConfirmationDialog } from "./DeleteCategoryConfirmationDialog";
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

const ICON_OPTIONS = [
  { value: "", label: "No icon", Icon: FolderTree },
  { value: "smartphone", label: "Phone", Icon: Smartphone },
  { value: "laptop", label: "Laptop", Icon: Laptop },
  { value: "shirt", label: "Fashion", Icon: Shirt },
  { value: "shopping-basket", label: "Groceries", Icon: ShoppingBasket },
  { value: "tv", label: "TV", Icon: Tv },
  { value: "heart-pulse", label: "Health", Icon: HeartPulse },
  { value: "dumbbell", label: "Fitness", Icon: Dumbbell },
  { value: "sofa", label: "Home", Icon: Sofa },
  { value: "zap", label: "Power", Icon: Zap },
  { value: "refrigerator", label: "Appliances", Icon: Refrigerator },
  { value: "battery-charging", label: "Battery", Icon: BatteryCharging },
  { value: "sun", label: "Solar", Icon: Sun },
] as const;

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
  const headingId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [parentId, setParentId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [reason, setReason] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsConfirmingDelete(false);
    setIsDeleting(false);
    setReason("");
    setIsAdvancedOpen(false);
    if (mode === "edit" && categoryToEdit) {
      setName(categoryToEdit.name);
      setSlug(categoryToEdit.slug);
      setDescription(categoryToEdit.description ?? "");
      setIcon(categoryToEdit.icon ?? "");
      setParentId(categoryToEdit.parentId ?? "");
      setSortOrder(String(categoryToEdit.sortOrder));
      setIsActive(categoryToEdit.isActive);
      setIsSlugManuallyEdited(true);
    } else {
      setName("");
      setSlug("");
      setDescription("");
      setIcon("");
      setParentId(initialParentId ?? "");
      setSortOrder("0");
      setIsActive(true);
      setIsSlugManuallyEdited(false);
    }
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, [mode, categoryToEdit, initialParentId, isOpen]);

  const parentOptions = useMemo(
    () => allCategories.filter((cat) => mode !== "edit" || cat.id !== categoryToEdit?.id),
    [allCategories, categoryToEdit?.id, mode],
  );

  const structuralChanges = useMemo(() => {
    if (mode !== "edit" || !categoryToEdit) return [];
    const changes: string[] = [];
    if (slug.trim() !== categoryToEdit.slug) changes.push("category URL");
    if ((parentId || null) !== categoryToEdit.parentId) changes.push("parent category");
    if (isActive !== categoryToEdit.isActive) changes.push("visibility");
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
    if (hasUnsavedChanges && !window.confirm("Close without saving these category changes?")) return;
    onClose();
  }, [hasUnsavedChanges, isDeleting, isSubmitting, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, requestClose]);

  if (!isOpen) return null;

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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save category.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm transition-opacity duration-200">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[#fff8ec] text-stone-900 shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] bg-[#fff8ec]/95 px-5 py-4 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#063b29] text-[#fff8ec]">
              <FolderTree className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={headingId} className="text-base font-black tracking-tight text-[var(--admin-canopy-deep)]">
                {mode === "edit" ? "Edit Category" : "Create Category"}
              </h2>
              <p id={descriptionId} className="truncate text-[11px] text-[var(--admin-ink-soft)]">
                {mode === "edit" ? `Updating ${categoryToEdit?.name}` : "Add a main category or subcategory."}
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={requestClose}
            aria-label="Close category editor"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-stone-200/70 text-stone-600 transition-colors hover:bg-stone-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(92vh-5rem)] overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Category name *</span>
                <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Solar and energy" className="mt-1 h-11 rounded-xl border-stone-300 bg-white text-sm font-semibold focus-visible:ring-[#075b36]" required />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Parent category</span>
                <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900 outline-none focus:ring-1 focus:ring-[#075b36]">
                  <option value="">Main category</option>
                  {parentOptions.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Description</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note for operators and category navigation." className="mt-1 min-h-20 w-full rounded-xl border border-stone-300 bg-white p-3 text-sm font-medium text-stone-900 outline-none focus:ring-1 focus:ring-[#075b36]" />
            </label>

            <fieldset className="rounded-2xl border border-stone-200 bg-white/70 p-3">
              <legend className="px-1 text-[11px] font-bold uppercase tracking-wider text-stone-600">Category icon</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {ICON_OPTIONS.map(({ value, label, Icon }) => {
                  const selected = icon === value;
                  return (
                    <button key={value || "none"} type="button" onClick={() => setIcon(value)} aria-pressed={selected} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]", selected ? "border-[#075b36] bg-[#075b36]/10 text-[#063b29]" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300")}>
                      <Icon className="size-4" aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-2xl border border-stone-200 bg-white/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-stone-900">Show this category</p>
                  <p className="text-xs text-stone-500">{isActive ? "Buyers and sellers can see this category where it is supported." : "This category is hidden from normal buyer and seller choices."}</p>
                </div>
                <button type="button" onClick={() => setIsActive(!isActive)} className={cn("min-h-11 rounded-full px-4 text-xs font-black uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]", isActive ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600")}>
                  {isActive ? "Visible" : "Hidden"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white/70">
              <button type="button" onClick={() => setIsAdvancedOpen((open) => !open)} className="flex min-h-12 w-full items-center justify-between px-3 text-left text-sm font-black text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]">
                Advanced details
                <span className="text-xs font-bold text-stone-500">{isAdvancedOpen ? "Hide" : "Show"}</span>
              </button>
              {isAdvancedOpen ? (
                <div className="grid gap-3 border-t border-stone-200 p-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Category URL</span>
                    <Input value={slug} onChange={(e) => { setIsSlugManuallyEdited(true); setSlug(slugify(e.target.value)); }} placeholder="solar-energy" className="mt-1 h-11 rounded-xl border-stone-300 bg-white text-sm font-semibold focus-visible:ring-[#075b36]" />
                    <span className="mt-1 block text-[11px] text-stone-500">Optional web address text. Changing it can affect saved links.</span>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Display order</span>
                    <Input type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mt-1 h-11 rounded-xl border-stone-300 bg-white text-sm font-semibold focus-visible:ring-[#075b36]" />
                    <span className="mt-1 block text-[11px] text-stone-500">Lower numbers show earlier in admin lists.</span>
                  </label>
                </div>
              ) : null}
            </div>

            {structuralChanges.length > 0 ? (
              <label className="block rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <span className="text-sm font-black text-amber-950">Reason for structure change *</span>
                <span className="mt-1 block text-xs text-amber-900">Required because this changes {structuralChanges.join(", ")}.</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this category structure needs to change." className="mt-2 min-h-20 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm text-stone-900 outline-none focus:ring-1 focus:ring-[#075b36]" />
              </label>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-stone-200/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {mode === "edit" && categoryToEdit && onDelete ? (
              <Button type="button" variant="ghost" disabled={isSubmitting || isDeleting} onClick={() => setIsConfirmingDelete(true)} className="min-h-11 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" />
                Delete Category
              </Button>
            ) : <div />}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={requestClose} disabled={isSubmitting || isDeleting} className="min-h-11 rounded-xl text-xs font-bold">Cancel</Button>
              <Button type="submit" disabled={isSubmitting || isDeleting} className="min-h-11 rounded-xl bg-[#075b36] px-5 text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-[#063b29]">
                <Save className="mr-1.5 size-3.5" aria-hidden="true" />
                {isSubmitting ? "Saving..." : mode === "edit" ? "Save changes" : "Create category"}
              </Button>
            </div>
          </div>
        </form>

        <DeleteCategoryConfirmationDialog
          isOpen={isConfirmingDelete}
          category={categoryToEdit}
          onClose={() => setIsConfirmingDelete(false)}
          onConfirm={async (id) => {
            if (!onDelete) return;
            try {
              setIsDeleting(true);
              await onDelete(id);
              setIsConfirmingDelete(false);
              onClose();
            } finally {
              setIsDeleting(false);
            }
          }}
          isDeleting={isDeleting}
        />
      </section>
    </div>
  );
}
