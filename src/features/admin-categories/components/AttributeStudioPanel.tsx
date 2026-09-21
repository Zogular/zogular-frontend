"use client";

/**
 * @file AttributeStudioPanel.tsx
 * @module features/admin-categories/components
 * @description
 * High-precision product attribute studio panel for category administrators (F7).
 * Displays full taxonomy breadcrumb context, action controls ("Add Attribute", "Apply Template"),
 * separated Inherited Attributes (locked with origin badges) and Category Custom Attributes
 * with functional flags (Variant, Filter Facet, PDP Slicer, Required), units, choices,
 * and re-ordering controls.
 */

import React, { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookmarkPlus,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Filter,
  Layers,
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
        return !!attr.options?.isVariation;
      }
      if (quickFilter === "facets") {
        return !!attr.options?.isFilterable;
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

          {/* Action CTAs */}
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
            <span>{filterCount} search facets</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_18%,transparent)] bg-[#fff8ec]/50 px-5 pt-2">
        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          className={cn(
            "relative pb-2.5 pt-1 text-xs font-black uppercase tracking-[0.14em] transition-colors",
            activeTab === "custom"
              ? "text-[var(--admin-canopy-deep)]"
              : "text-stone-500 hover:text-stone-800"
          )}
        >
          Category Custom Attributes ({directAttributes.length})
          {activeTab === "custom" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--admin-canopy-deep)]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("inherited")}
          className={cn(
            "relative ml-4 pb-2.5 pt-1 text-xs font-black uppercase tracking-[0.14em] transition-colors",
            activeTab === "inherited"
              ? "text-[var(--admin-canopy-deep)]"
              : "text-stone-500 hover:text-stone-800"
          )}
        >
          Inherited Attributes ({inheritedAttributes.length})
          {activeTab === "inherited" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[var(--admin-canopy-deep)]" />
          )}
        </button>
      </div>

      {/* Search and Quick Filters Toolbar */}
      <div className="flex flex-col gap-2.5 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_18%,transparent)] bg-[#fff8ec]/40 px-5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input with search icon */}
        <div className="relative flex-1 max-w-xs sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <Input
            type="text"
            placeholder="Filter attributes by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 rounded-xl border-stone-200 bg-white/90 pl-8 pr-7 text-xs placeholder:text-stone-400 focus-visible:ring-[#075b36]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Quick filter pills and live count */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 rounded-xl bg-stone-200/60 p-0.5">
            <button
              type="button"
              onClick={() => setQuickFilter("all")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                quickFilter === "all"
                  ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("required")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                quickFilter === "required"
                  ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              Required
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("variants")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                quickFilter === "variants"
                  ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              Variants
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter("facets")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition-all",
                quickFilter === "facets"
                  ? "bg-[#063b29] text-[#fff8ec] shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              )}
            >
              Search Facets
            </button>
          </div>

          {/* Live count */}
          <span className="text-[11px] font-semibold text-stone-500 whitespace-nowrap">
            Showing {filteredAttributes.length} of {currentAttributes.length} attributes
          </span>
        </div>
      </div>

      {/* Attribute Cards List */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-6 animate-spin rounded-full border-2 border-[#075b36] border-t-transparent" />
            <p className="mt-3 text-xs font-semibold text-stone-500">
              Loading attribute definitions...
            </p>
          </div>
        ) : activeTab === "custom" ? (
          directAttributes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300/80 bg-white/60 p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#fff8ec] text-[#075b36] shadow-inner ring-1 ring-stone-200">
                <BookmarkPlus className="size-6" />
              </div>
              <h3 className="mt-3 text-sm font-black text-stone-900">
                No Custom Attributes Configured
              </h3>
              <p className="mt-1 max-w-sm text-xs text-stone-500">
                Add attributes tailored to {selectedCategory.name}, or apply a verified industry template to configure specs in 1 click.
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={onApplyTemplate}
                  variant="outline"
                  className="rounded-xl text-xs font-bold"
                >
                  <Sparkles className="mr-1.5 size-3.5 text-amber-600" />
                  Industry Templates
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={onAddAttribute}
                  className="rounded-xl bg-[#075b36] text-xs font-bold text-white hover:bg-[#063b29]"
                >
                  <Plus className="mr-1.5 size-3.5" />
                  Add First Attribute
                </Button>
              </div>
            </div>
          ) : filteredAttributes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300/80 bg-white/60 p-8 text-center">
              <Search className="size-6 text-stone-400" />
              <h3 className="mt-2 text-xs font-black text-stone-800">
                No attributes match your filter
              </h3>
              <p className="mt-1 text-[11px] text-stone-500">
                Try adjusting your search keywords or resetting the quick filter pill.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setQuickFilter("all");
                }}
                className="mt-3 h-8 rounded-xl text-xs font-bold"
              >
                Clear Search & Filter
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAttributes.map((attr) => {
                const realIndex = directAttributes.findIndex((a) => a.id === attr.id);
                return (
                  <AttributeCard
                    key={attr.id}
                    attribute={attr}
                    isCustom={true}
                    canMoveUp={realIndex > 0}
                    canMoveDown={realIndex !== -1 && realIndex < directAttributes.length - 1}
                    onEdit={() => onEditAttribute(attr)}
                    onDelete={() => onDeleteAttribute(attr)}
                    onMoveUp={() => onReorderAttribute(attr.id, "up")}
                    onMoveDown={() => onReorderAttribute(attr.id, "down")}
                  />
                );
              })}
            </div>
          )
        ) : (
          /* Inherited Tab */
          inheritedAttributes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300/80 bg-white/60 p-8 text-center">
              <Layers className="mx-auto size-8 text-stone-400" />
              <h4 className="mt-2 text-xs font-bold text-stone-800">
                No Inherited Attributes
              </h4>
              <p className="mt-1 text-xs text-stone-500">
                This category has no parent categories with configured attributes. Any parent category attributes will automatically cascade down here.
              </p>
            </div>
          ) : filteredAttributes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300/80 bg-white/60 p-8 text-center">
              <Search className="size-6 text-stone-400" />
              <h3 className="mt-2 text-xs font-black text-stone-800">
                No inherited attributes match your filter
              </h3>
              <p className="mt-1 text-[11px] text-stone-500">
                Try adjusting your search keywords or resetting the quick filter pill.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setQuickFilter("all");
                }}
                className="mt-3 h-8 rounded-xl text-xs font-bold"
              >
                Clear Search & Filter
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs font-medium text-amber-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <Lock className="size-3.5 text-amber-700" />
                  Inherited Schema Rules
                </div>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Inherited attributes cascade down from parent categories to maintain cross-marketplace catalog uniformity. They are locked and can only be edited at their source category.
                </p>
              </div>
              {filteredAttributes.map((attr) => (
                <AttributeCard
                  key={attr.id}
                  attribute={attr}
                  isCustom={false}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

interface AttributeCardProps {
  attribute: CategoryAttributeRecord;
  isCustom: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function AttributeCard({
  attribute,
  isCustom,
  canMoveUp = false,
  canMoveDown = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: AttributeCardProps) {
  const options = attribute.options;
  const isVariation = options?.isVariation;
  const isFilterable = options?.isFilterable;
  const isSlicer = options?.isSlicer;
  const choices = options?.choices ?? [];
  const unit = options?.unit;

  return (
    <div
      className={cn(
        "group relative rounded-2xl border bg-white/90 p-4 shadow-sm transition-all duration-150 hover:shadow-md",
        isCustom
          ? "border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] hover:border-[#075b36]/40"
          : "border-stone-200/80 bg-stone-50/70 opacity-95"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Attribute Identity & Flags */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-black text-stone-900">
              {attribute.name}
            </h4>
            <span className="font-mono text-[11px] font-semibold text-stone-500">
              ({attribute.slug})
            </span>

            {/* Type Badge */}
            <span
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider",
                attribute.type === "SELECT"
                  ? "bg-purple-100 text-purple-800"
                  : attribute.type === "NUMBER"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
              )}
            >
              {attribute.type === "SELECT" ? (
                <ListFilter className="size-2.5" />
              ) : attribute.type === "NUMBER" ? (
                <Hash className="size-2.5" />
              ) : (
                <TypeIcon className="size-2.5" />
              )}
              {attribute.type === "SELECT" ? "Dropdown Select" : attribute.type}
            </span>

            {/* Required Badge */}
            {attribute.isRequired ? (
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                Required
              </span>
            ) : (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                Optional
              </span>
            )}

            {/* Inherited Source Badge */}
            {!isCustom && (
              <span className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                <Lock className="size-2.5" />
                From: {attribute.inheritedFromCategory?.name || "Parent Category"}
              </span>
            )}
          </div>

          {/* Functional Capability Badges */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {isVariation && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800 ring-1 ring-amber-500/30">
                <Boxes className="size-2.5" />
                Variant Matrix SKU
              </span>
            )}
            {isFilterable && (
              <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-800 ring-1 ring-blue-500/30">
                <Filter className="size-2.5" />
                Storefront Search Facet
              </span>
            )}
            {isSlicer && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-500/30">
                <CheckCircle2 className="size-2.5" />
                PDP Quick Slicer
              </span>
            )}
            {unit && (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[10px] font-bold text-stone-700">
                Unit: {unit}
              </span>
            )}
          </div>

          {/* Choices Preview if SELECT */}
          {attribute.type === "SELECT" && choices.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-bold text-stone-500">Options ({choices.length}):</span>
              {choices.slice(0, 7).map((choice, i) => (
                <span
                  key={i}
                  className="rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-stone-700"
                >
                  {choice}
                </span>
              ))}
              {choices.length > 7 && (
                <span className="text-[10px] font-bold text-stone-500">
                  +{choices.length - 7} more
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
        {isCustom && (
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
