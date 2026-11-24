"use client";

/**
 * @file AttributeStudioPanel.tsx
 * @module features/admin-categories/components
 * @description
 * High-precision product attribute studio panel for category administrators (F7).
 * Displays full taxonomy breadcrumb context, action controls ("Add Attribute", "Apply Template"),
 * separated Inherited Attributes (locked with origin badges) and Category Custom Attributes
 * with functional flags (Variant, Filter Facet, PDP Slicer, Required), units, choices,
 * re-ordering controls, and permission presentation gating.
 */

import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Boxes,
  ChevronRight,
  Filter,
  Lock,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  HelpCircle,
  Hash,
  Type as TypeIcon,
  ListFilter,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  AdminCategoryRecord,
  CategoryAttributeRecord,
} from "../types";

export interface AttributeStudioPanelProps {
  selectedCategory: AdminCategoryRecord;
  breadcrumbCategories: AdminCategoryRecord[];
  directAttributes: CategoryAttributeRecord[];
  inheritedAttributes: CategoryAttributeRecord[];
  onAddAttribute: () => void;
  onApplyTemplate: () => void;
  onEditAttribute: (attr: CategoryAttributeRecord) => void;
  onDeleteAttribute: (attr: CategoryAttributeRecord) => void;
  onReorderAttribute: (attributeId: string, direction: "up" | "down") => void;
  isLoading?: boolean;
  canManageCategories?: boolean;
}

export function AttributeStudioPanel({
  selectedCategory,
  breadcrumbCategories,
  directAttributes,
  inheritedAttributes,
  onAddAttribute,
  onApplyTemplate,
  onEditAttribute,
  onDeleteAttribute,
  onReorderAttribute,
  isLoading = false,
  canManageCategories = true,
}: AttributeStudioPanelProps) {
  const [activeTab, setActiveTab] = useState<"custom" | "inherited">("custom");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "required" | "variants" | "facets">("all");

  const totalAttributes = directAttributes.length + inheritedAttributes.length;
  const variationCount = [...directAttributes, ...inheritedAttributes].filter(
    (a) => a.options?.isVariation,
  ).length;
  const filterCount = [...directAttributes, ...inheritedAttributes].filter(
    (a) => a.options?.isFilterable,
  ).length;

  const currentAttributes = activeTab === "custom" ? directAttributes : inheritedAttributes;

  const filteredAttributes = useMemo(() => {
    return currentAttributes.filter((attr) => {
      // 1. Text search by name or slug
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = attr.name.toLowerCase().includes(query);
        const matchesSlug = attr.slug.toLowerCase().includes(query);
        if (!matchesName && !matchesSlug) return false;
      }

      // 2. Quick filter pills
      if (quickFilter === "required") {
        return attr.isRequired;
      }
      if (quickFilter === "variants") {
        return Boolean(attr.options?.isVariation);
      }
      if (quickFilter === "facets") {
        return Boolean(attr.options?.isFilterable);
      }

      return true;
    });
  }, [currentAttributes, searchQuery, quickFilter]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ea_100%)] shadow-[0_16px_40px_rgba(6,59,41,0.06)]">
      {/* Header with Breadcrumb and Actions */}
      <div className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-[#fff8ec]/75 px-5 py-4 backdrop-blur-md">
        {/* Breadcrumb Path */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-stone-500">
          <span>Taxonomy</span>
          {breadcrumbCategories.map((cat, idx) => (
            <React.Fragment key={cat.id}>
              <ChevronRight className="size-3 text-stone-400" />
              <span
                className={
                  idx === breadcrumbCategories.length - 1
                    ? "font-black text-[var(--admin-canopy-deep)]"
                    : "hover:text-stone-800"
                }
              >
                {cat.name}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Category Title & Quick Metrics */}
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-black tracking-tight text-[var(--admin-canopy-deep)]">
                {selectedCategory.name}
              </h1>
              <span className="rounded-full border border-stone-300/80 bg-white/90 px-2.5 py-0.5 font-mono text-[10px] font-bold text-stone-600">
                {selectedCategory.slug}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
                  selectedCategory.isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-stone-200 text-stone-600"
                )}
              >
                {selectedCategory.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-[var(--admin-ink-soft)]">
              {selectedCategory.description || "Configure product schema, variation dimensions, and search filters for this category."}
            </p>
          </div>

          {/* Action CTAs (gated by canManageCategories) */}
          {canManageCategories ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onApplyTemplate}
                className="h-9 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted)_40%,transparent)] bg-white/80 px-3.5 text-xs font-black uppercase tracking-[0.1em] text-stone-800 hover:bg-[#fff8ec] hover:text-[var(--admin-canopy-deep)]"
              >
                <Sparkles className="mr-1.5 size-3.5 text-[var(--admin-copper-muted)]" />
                Apply Template
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onAddAttribute}
                className="h-9 rounded-xl bg-[#075b36] px-4 text-xs font-black uppercase tracking-[0.1em] text-[#fff8ec] shadow-sm hover:bg-[#063b29]"
              >
                <Plus className="mr-1.5 size-3.5" />
                Add Attribute
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white/80 px-3 py-1.5 text-right">
              <span className="text-[11px] font-bold text-stone-500">
                Read-Only Access (manage_categories required)
              </span>
            </div>
          )}
        </div>

        {/* Feature Counters Strip */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_14%,transparent)] pt-3 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-stone-700">
            <SlidersHorizontal className="size-3.5 text-[#075b36]" />
            <span>{totalAttributes} total attributes</span>
          </div>
          <span className="text-stone-300">•</span>
          <div className="flex items-center gap-1.5 text-stone-700">
            <Boxes className="size-3.5 text-amber-600" />
            <span>{variationCount} variant dimensions</span>
          </div>
          <span className="text-stone-300">•</span>
          <div className="flex items-center gap-1.5 text-stone-700">
            <Filter className="size-3.5 text-blue-600" />
            <span>{filterCount} search filters</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Toolbar */}
      <div className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_16%,transparent)] bg-[#fffdfa] px-5 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Main Scope Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl bg-[#f5ecdd]/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-black transition-all",
                activeTab === "custom"
                  ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              Direct Fields ({directAttributes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inherited")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-black transition-all",
                activeTab === "inherited"
                  ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              <Lock className="size-3" />
              Inherited Fields ({inheritedAttributes.length})
            </button>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setQuickFilter("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 transition-all",
                quickFilter === "all"
                  ? "bg-stone-800 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("required")}
              className={cn(
                "rounded-lg px-2.5 py-1 transition-all",
                quickFilter === "required"
                  ? "bg-rose-700 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              Required Only
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("variants")}
              className={cn(
                "rounded-lg px-2.5 py-1 transition-all",
                quickFilter === "variants"
                  ? "bg-amber-700 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              Variants
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("facets")}
              className={cn(
                "rounded-lg px-2.5 py-1 transition-all",
                quickFilter === "facets"
                  ? "bg-blue-700 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              )}
            >
              Storefront Filters
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === "custom" ? "direct" : "inherited"} attributes by name or slug...`}
            className="h-9 rounded-xl border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-white/90 pl-8.5 pr-8 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus-visible:ring-1 focus-visible:ring-[#075b36]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Attribute List */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <div className="size-6 animate-spin rounded-full border-2 border-[#075b36] border-t-transparent" />
            <p className="text-xs font-semibold text-[var(--admin-ink-soft)]">
              Loading attribute studio...
            </p>
          </div>
        ) : filteredAttributes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300/80 bg-white/60 p-10 text-center">
            <SlidersHorizontal className="size-8 text-stone-400" />
            <p className="mt-3 text-sm font-bold text-stone-700">
              {searchQuery || quickFilter !== "all"
                ? "No attributes match your filter criteria"
                : activeTab === "custom"
                ? "No direct attributes configured for this category"
                : "No inherited attributes from parent categories"}
            </p>
            <p className="mt-1 max-w-sm text-xs text-stone-500">
              {activeTab === "custom" && canManageCategories
                ? "Add product fields specifically for this category or apply an industry template to load verified schemas."
                : "Inherited attributes cascade down automatically from ancestor categories."}
            </p>
            {activeTab === "custom" && canManageCategories && !searchQuery && (
              <div className="mt-4 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onApplyTemplate}
                  className="rounded-xl text-xs font-bold"
                >
                  <Sparkles className="mr-1.5 size-3.5" />
                  Load Template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={onAddAttribute}
                  className="rounded-xl bg-[#075b36] text-xs font-bold text-white hover:bg-[#063b29]"
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Create First Field
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredAttributes.map((attr, idx) => (
              <AttributeItem
                key={attr.id}
                attribute={attr}
                isCustom={activeTab === "custom"}
                canMoveUp={activeTab === "custom" && idx > 0 && canManageCategories}
                canMoveDown={
                  activeTab === "custom" && idx < filteredAttributes.length - 1 && canManageCategories
                }
                onMoveUp={() => onReorderAttribute(attr.id, "up")}
                onMoveDown={() => onReorderAttribute(attr.id, "down")}
                onEdit={() => onEditAttribute(attr)}
                onDelete={() => onDeleteAttribute(attr)}
                canManageCategories={canManageCategories}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AttributeItemProps {
  attribute: CategoryAttributeRecord;
  isCustom: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canManageCategories?: boolean;
}

function AttributeItem({
  attribute,
  isCustom,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  canManageCategories = true,
}: AttributeItemProps) {
  const { name, slug, type, isRequired, options, isInherited, inheritedFromCategory } = attribute;

  const TypeBadgeIcon = {
    TEXT: TypeIcon,
    NUMBER: Hash,
    SELECT: ListFilter,
  }[type] ?? TypeIcon;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border p-4 transition-all duration-150",
        isCustom
          ? "border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] bg-white/90 hover:border-[#075b36]/40 hover:shadow-sm"
          : "border-stone-200/80 bg-stone-50/70"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Main Details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black tracking-tight text-stone-900">{name}</span>
            <span className="rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 font-mono text-[10px] font-bold text-stone-600">
              {slug}
            </span>

            {/* Type badge */}
            <span className="flex items-center gap-1 rounded-md bg-[#fff8ec] px-2 py-0.5 text-[10px] font-bold text-[var(--admin-canopy-deep)] ring-1 ring-[var(--admin-copper-muted)]/30">
              <TypeBadgeIcon className="size-3 text-[#075b36]" />
              <span>{type}</span>
            </span>

            {/* Required flag */}
            {isRequired && (
              <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-800">
                Required
              </span>
            )}

            {/* Inheritance Badge */}
            {isInherited && (
              <span className="flex items-center gap-1 rounded-md bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-700">
                <Lock className="size-2.5 text-stone-500" />
                <span>Cascaded from {inheritedFromCategory?.name ?? "Parent"}</span>
              </span>
            )}
          </div>

          {/* Functional Capability Badges */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {options?.isVariation && (
              <span className="flex items-center gap-1 rounded-md bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-300">
                <Boxes className="size-2.5 text-amber-700" />
                <span>Variant Dimension</span>
              </span>
            )}

            {options?.isFilterable && (
              <span className="flex items-center gap-1 rounded-md bg-blue-100/90 px-2 py-0.5 text-[10px] font-bold text-blue-900 ring-1 ring-blue-300">
                <Filter className="size-2.5 text-blue-700" />
                <span>Storefront Search Filter</span>
              </span>
            )}

            {options?.isSlicer && (
              <span className="flex items-center gap-1 rounded-md bg-purple-100/90 px-2 py-0.5 text-[10px] font-bold text-purple-900 ring-1 ring-purple-300">
                <BookmarkPlus className="size-2.5 text-purple-700" />
                <span>Product Page Quick-Choice Pill</span>
              </span>
            )}

            {options?.unit && (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                Unit: <strong className="font-bold text-stone-900">{options.unit}</strong>
              </span>
            )}

            {options?.placeholder && (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                Placeholder: &quot;{options.placeholder}&quot;
              </span>
            )}
          </div>

          {/* Choices preview for SELECT types */}
          {type === "SELECT" && options?.choices && options.choices.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-stone-500">Options ({options.choices.length}):</span>
              {options.choices.slice(0, 8).map((choice, i) => (
                <span
                  key={i}
                  className="rounded-md border border-stone-200 bg-stone-100/80 px-1.5 py-0.5 text-[10px] font-medium text-stone-700"
                >
                  {choice}
                </span>
              ))}
              {options.choices.length > 8 && (
                <span className="text-[10px] font-bold text-stone-400">
                  +{options.choices.length - 8} more
                </span>
              )}
            </div>
          )}

          {/* Seller Guidance tooltip preview */}
          {options?.sellerGuidance && (
            <div className="mt-2 flex items-start gap-1 text-[11px] text-stone-600">
              <HelpCircle className="mt-0.5 size-3 shrink-0 text-[var(--admin-copper-muted)]" />
              <span className="italic font-medium">{options.sellerGuidance}</span>
            </div>
          )}
        </div>

        {/* Action Controls for Custom Attributes */}
        {isCustom && canManageCategories && (
          <div className="flex shrink-0 items-center gap-1">
            {/* Reorder Buttons */}
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                title="Move Up"
                className="flex size-6 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 disabled:opacity-30"
              >
                <ArrowUp className="size-3" />
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                title="Move Down"
                className="flex size-6 items-center justify-center rounded-md text-stone-500 hover:bg-stone-100 disabled:opacity-30"
              >
                <ArrowDown className="size-3" />
              </button>
            </div>

            {/* Edit & Delete Buttons */}
            <button
              type="button"
              onClick={onEdit}
              title="Edit Attribute"
              className="flex size-8 items-center justify-center rounded-xl bg-stone-100 text-stone-700 hover:bg-[#fff8ec] hover:text-[var(--admin-canopy-deep)] hover:ring-1 hover:ring-[var(--admin-copper-muted)] transition-all"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete Attribute"
              className="flex size-8 items-center justify-center rounded-xl bg-stone-100 text-red-600 hover:bg-red-50 hover:ring-1 hover:ring-red-200 transition-all"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
