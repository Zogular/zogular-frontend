"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  FolderTree,
  Layers3,
  Plus,
  Save,
  Shapes,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createAdminCategory,
  getAdminCategories,
  updateAdminCategory,
} from "@/features/admin-categories/api/admin-categories";
import type {
  AdminCategoryPayload,
  AdminCategoryRecord,
  AdminCategoryTreeNode,
} from "@/features/admin-categories/types";

type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  parentId: string;
  sortOrder: string;
  isActive: boolean;
};

const ICON_OPTIONS = [
  "smartphone",
  "laptop",
  "shirt",
  "shopping-basket",
  "tv",
  "heart-pulse",
  "dumbbell",
  "sofa",
];

const EMPTY_FORM: CategoryFormState = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  parentId: "",
  sortOrder: "0",
  isActive: true,
};

export function AdminCategoriesWorkspace() {
  const [categories, setCategories] = useState<AdminCategoryRecord[]>([]);
  const [tree, setTree] = useState<AdminCategoryTreeNode[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );
  const rootCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );
  const totalSubcategories = Math.max(categories.length - rootCategories.length, 0);

  useEffect(() => {
    void refreshCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategory || mode !== "edit") return;

    setForm({
      name: selectedCategory.name,
      slug: selectedCategory.slug,
      description: selectedCategory.description ?? "",
      icon: selectedCategory.icon ?? "",
      parentId: selectedCategory.parentId ?? "",
      sortOrder: String(selectedCategory.sortOrder),
      isActive: selectedCategory.isActive,
    });
  }, [mode, selectedCategory]);

  async function refreshCategories(nextSelectedId?: string | null) {
    try {
      setLoading(true);
      const response = await getAdminCategories(true);
      setCategories(response.categories);
      setTree(response.tree);
      setSelectedCategoryId((current) => {
        if (nextSelectedId !== undefined) return nextSelectedId;
        return current && response.categories.some((category) => category.id === current)
          ? current
          : response.categories[0]?.id ?? null;
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }

  function startCreate(parentId?: string | null) {
    setMode("create");
    setSelectedCategoryId(parentId ?? null);
    setForm({
      ...EMPTY_FORM,
      parentId: parentId ?? "",
      sortOrder: "0",
    });
  }

  function startEdit(categoryId: string) {
    setSelectedCategoryId(categoryId);
    setMode("edit");
  }

  async function handleSubmit() {
    const payload = buildPayload(form);

    if (!payload.name) {
      toast.error("Category name is required.");
      return;
    }

    try {
      setSubmitting(true);

      if (mode === "edit" && selectedCategory) {
        const updated = await updateAdminCategory(selectedCategory.id, payload);
        toast.success("Category updated.");
        await refreshCategories(updated.id);
      } else {
        const created = await createAdminCategory(payload);
        toast.success("Category created.");
        setMode("edit");
        await refreshCategories(created.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Category action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[96rem] space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total categories" value={categories.length} icon={<Layers3 className="h-4 w-4" />} />
        <SummaryCard label="Root groups" value={rootCategories.length} icon={<FolderTree className="h-4 w-4" />} />
        <SummaryCard label="Subcategories" value={totalSubcategories} icon={<Shapes className="h-4 w-4" />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(22rem,0.8fr)]">
        <div className="rounded-[1.9rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] p-4 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Category tree</p>
              <h1 className="text-2xl font-black tracking-tight text-zinc-950">Dynamic categories</h1>
              <p className="mt-1 text-sm font-semibold text-zinc-500">
                Admin, seller, and consumer surfaces should all read from this same tree.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => startCreate(null)}
                className="h-10 rounded-2xl bg-[#009E49] px-4 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-[#00853d]"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New root
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedCategory}
                onClick={() => startCreate(selectedCategory?.id ?? null)}
                className="h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-[0.16em]"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New child
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[1.4rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-10 text-sm font-semibold text-zinc-500">
              Loading categories...
            </div>
          ) : tree.length ? (
            <div className="space-y-3">
              {tree.map((node) => (
                <CategoryTreeCard
                  key={node.id}
                  node={node}
                  selectedCategoryId={selectedCategoryId}
                  onSelect={startEdit}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-10 text-sm font-semibold text-zinc-500">
              No categories exist yet. Create the first root category to unlock seller product selection and consumer navigation.
            </div>
          )}
        </div>

        <div className="rounded-[1.9rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] p-4 shadow-[0_28px_80px_rgba(15,23,42,0.12)] backdrop-blur-2xl md:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                {mode === "edit" ? "Edit category" : "Create category"}
              </p>
              <h2 className="text-2xl font-black tracking-tight text-zinc-950">
                {mode === "edit" ? selectedCategory?.name ?? "Category details" : "New category"}
              </h2>
              <p className="mt-1 text-sm font-semibold text-zinc-500">
                Keep names, slugs, and parent placement consistent across the marketplace.
              </p>
            </div>
            {mode === "edit" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => startCreate(selectedCategory?.parentId ?? null)}
                className="h-10 rounded-2xl px-4 text-xs font-black uppercase tracking-[0.16em]"
              >
                Create sibling
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Name"
              input={
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="h-11 rounded-2xl bg-white/85 shadow-inner"
                  placeholder="Health & Beauty"
                />
              }
            />
            <Field
              label="Slug"
              input={
                <Input
                  value={form.slug}
                  onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                  className="h-11 rounded-2xl bg-white/85 shadow-inner"
                  placeholder="health-and-beauty"
                />
              }
            />
            <Field
              label="Parent"
              input={
                <select
                  value={form.parentId}
                  onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
                  className="h-11 w-full rounded-2xl border border-zinc-200 bg-white/85 px-3 text-sm font-semibold text-zinc-900 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                >
                  <option value="">Root category</option>
                  {categories
                    .filter((category) => mode !== "edit" || category.id !== selectedCategory?.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              }
            />
            <Field
              label="Sort order"
              input={
                <Input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                  className="h-11 rounded-2xl bg-white/85 shadow-inner"
                />
              }
            />
            <Field
              label="Icon"
              helper="Used by buyer and seller category surfaces."
              className="md:col-span-2"
              input={
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
                  <Input
                    value={form.icon}
                    onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
                    className="h-11 rounded-2xl bg-white/85 shadow-inner"
                    placeholder="smartphone"
                  />
                  <select
                    value={form.icon}
                    onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
                    className="h-11 w-full rounded-2xl border border-zinc-200 bg-white/85 px-3 text-sm font-semibold text-zinc-900 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                  >
                    <option value="">No icon</option>
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>
              }
            />
            <Field
              label="Description"
              className="md:col-span-2"
              input={
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-28 w-full rounded-[1.4rem] border border-zinc-200 bg-white/85 p-3 text-sm font-medium text-zinc-900 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]"
                  placeholder="Beauty, wellness, and personal care."
                />
              }
            />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-[1.3rem] border border-zinc-200 bg-zinc-50/85 px-4 py-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">Visibility</p>
              <p className="text-sm font-semibold text-zinc-800">
                {form.isActive ? "Active across the marketplace" : "Hidden from active category surfaces"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, isActive: !current.isActive }))}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition-colors",
                form.isActive
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-zinc-200 text-zinc-600",
              )}
            >
              {form.isActive ? "Active" : "Inactive"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="h-11 rounded-2xl bg-zinc-950 px-5 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-zinc-900"
            >
              <Save className="mr-2 h-3.5 w-3.5" />
              {mode === "edit" ? "Save category" : "Create category"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => startCreate(null)}
              className="h-11 rounded-2xl px-5 text-xs font-black uppercase tracking-[0.16em]"
            >
              Reset form
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function CategoryTreeCard({
  node,
  selectedCategoryId,
  onSelect,
  depth = 0,
}: {
  node: AdminCategoryTreeNode;
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  depth?: number;
}) {
  const isSelected = selectedCategoryId === node.id;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex w-full items-start justify-between rounded-[1.35rem] border px-4 py-3 text-left transition-all",
          depth === 0
            ? "bg-zinc-50/85"
            : "bg-white/85",
          isSelected
            ? "border-[#009E49]/30 shadow-[0_12px_28px_rgba(0,158,73,0.12)]"
            : "border-zinc-200 hover:border-zinc-300",
        )}
        style={{ marginLeft: depth ? `${Math.min(depth * 18, 54)}px` : undefined }}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-zinc-950">{node.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
            <span>{node.slug}</span>
            <span>{node._count.children} children</span>
            <span>{node._count.products} products</span>
          </div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
      </button>

      {node.children.map((child) => (
        <CategoryTreeCard
          key={child.id}
          node={child}
          selectedCategoryId={selectedCategoryId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.94))] p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
      <div className="flex items-center gap-2 text-zinc-500">{icon}</div>
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-zinc-950">{value}</p>
    </div>
  );
}

function Field({
  label,
  helper,
  input,
  className,
}: {
  label: string;
  helper?: string;
  input: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </label>
      {input}
      {helper ? <p className="text-xs font-semibold text-zinc-500">{helper}</p> : null}
    </div>
  );
}

function buildPayload(form: CategoryFormState): AdminCategoryPayload {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    description: form.description.trim() || undefined,
    icon: form.icon.trim() || undefined,
    parentId: form.parentId || null,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder || "0"),
  };
}
