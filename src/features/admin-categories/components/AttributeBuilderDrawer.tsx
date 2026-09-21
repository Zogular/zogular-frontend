"use client";

/**
 * @file AttributeBuilderDrawer.tsx
 * @module features/admin-categories/components
 * @description
 * Product-field editor drawer for category configuration.
 *
 * The drawer keeps product-field labels, options, seller guidance, and buyer
 * filter flags in one focused editing flow without exposing internal taxonomy
 * or platform-copy jargon to the operator.
 */

import React, { useEffect, useState } from "react";
import {
  Boxes,
  Check,
  CheckCircle2,
  Filter,
  Hash,
  ListFilter,
  Plus,
  Save,
  Sliders,
  Type as TypeIcon,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  AttributeOptionConfig,
  CategoryAttributeRecord,
  CategoryAttributeType,
  CreateCategoryAttributePayload,
} from "../types";

export interface AttributeBuilderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreateCategoryAttributePayload, attributeId?: string) => Promise<void>;
  editingAttribute: CategoryAttributeRecord | null;
  categoryName: string;
}

const COMMON_PRESET_DICTIONARIES: Record<string, string[]> = {
  "RAM Sizes": ["2GB", "3GB", "4GB", "6GB", "8GB", "12GB", "16GB+"],
  "Storage ROM": ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"],
  "Apparel Sizes": ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
  "Shoe Sizes (EU)": ["EU 38", "EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44", "EU 45"],
  "Standard Colors": ["Black", "White", "Silver", "Midnight Blue", "Forest Green", "Gold", "Gray"],
  "System Voltages": ["12V", "24V", "48V", "96V", "High Voltage (>100V)"],
};

export function AttributeBuilderDrawer({
  isOpen,
  onClose,
  onSave,
  editingAttribute,
  categoryName,
}: AttributeBuilderDrawerProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [type, setType] = useState<CategoryAttributeType>("TEXT");
  const [isRequired, setIsRequired] = useState(false);
  const [unit, setUnit] = useState("");
  const [allowedUnits, setAllowedUnits] = useState<string[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [newChoiceInput, setNewChoiceInput] = useState("");
  const [isVariation, setIsVariation] = useState(false);
  const [isFilterable, setIsFilterable] = useState(false);
  const [isSlicer, setIsSlicer] = useState(false);
  const [sellerGuidance, setSellerGuidance] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset form when drawer opens or editing target changes
  useEffect(() => {
    if (editingAttribute) {
      setName(editingAttribute.name);
      setSlug(editingAttribute.slug);
      setIsSlugManuallyEdited(true);
      setType(editingAttribute.type);
      setIsRequired(editingAttribute.isRequired);

      const opts = editingAttribute.options;
      setUnit(opts?.unit ?? "");
      setAllowedUnits(opts?.allowedUnits ?? []);
      setChoices(opts?.choices ?? []);
      setIsVariation(Boolean(opts?.isVariation));
      setIsFilterable(Boolean(opts?.isFilterable));
      setIsSlicer(Boolean(opts?.isSlicer));
      setSellerGuidance(opts?.sellerGuidance ?? "");
      setPlaceholder(opts?.placeholder ?? "");
    } else {
      setName("");
      setSlug("");
      setIsSlugManuallyEdited(false);
      setType("TEXT");
      setIsRequired(false);
      setUnit("");
      setAllowedUnits([]);
      setChoices([]);
      setIsVariation(false);
      setIsFilterable(false);
      setIsSlicer(false);
      setSellerGuidance("");
      setPlaceholder("");
    }
  }, [editingAttribute, isOpen]);

  // Auto-generate slug from name unless manually modified
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManuallyEdited) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-_]/g, "")
        .trim()
        .replace(/[\s-]+/g, "_");
      setSlug(generated);
    }
  };

  const handleAddChoice = (choiceText?: string) => {
    const textToAdd = (choiceText ?? newChoiceInput).trim();
    if (!textToAdd) return;
    if (choices.includes(textToAdd)) {
      toast.warning(`Option "${textToAdd}" already exists.`);
      return;
    }
    setChoices((prev) => [...prev, textToAdd]);
    if (!choiceText) {
      setNewChoiceInput("");
    }
  };

  const handleRemoveChoice = (indexToRemove: number) => {
    setChoices((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddPresetDictionary = (presetName: string) => {
    const presetChoices = COMMON_PRESET_DICTIONARIES[presetName];
    if (!presetChoices) return;
    setChoices((prev) => {
      const set = new Set([...prev, ...presetChoices]);
      return Array.from(set);
    });
    toast.success(`Added preset options from "${presetName}".`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Product field name is required.");
      return;
    }
    const cleanSlug = slug.trim() || name.toLowerCase().replace(/[^a-z0-9]/g, "_");

    if (type === "SELECT" && choices.length === 0) {
      toast.error("Dropdown fields must have at least one choice.");
      return;
    }

    const optionsConfig: AttributeOptionConfig = {
      choices: type === "SELECT" ? choices : undefined,
      unit: type === "NUMBER" && unit.trim() ? unit.trim() : undefined,
      allowedUnits: type === "NUMBER" && allowedUnits.length ? allowedUnits : undefined,
      isVariation,
      isFilterable,
      isSlicer,
      sellerGuidance: sellerGuidance.trim() || undefined,
      placeholder: placeholder.trim() || undefined,
    };

    const payload: CreateCategoryAttributePayload = {
      name: name.trim(),
      slug: cleanSlug,
      type,
      isRequired,
      options: optionsConfig,
    };

    try {
      setIsSubmitting(true);
      await onSave(payload, editingAttribute?.id);
      toast.success(
        editingAttribute ? "Product field updated." : "Product field created."
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product field.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full border-l border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[#fff8ec] p-0 text-stone-900 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:max-w-xl md:max-w-2xl overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        <form onSubmit={handleSubmit} className="flex min-h-full flex-col">
          {/* Drawer Header */}
          <div className="sticky top-0 z-10 border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] bg-[#fff8ec]/95 px-6 py-4.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--admin-copper-muted)]">
                  <Sliders className="size-3.5" />
                  <span>{categoryName} product fields</span>
                </div>
                <SheetTitle className="mt-1 text-lg font-black tracking-tight text-[var(--admin-canopy-deep)]">
                  {editingAttribute ? "Edit Product Field" : "Create Product Field"}
                </SheetTitle>
                <SheetDescription className="text-xs text-[var(--admin-ink-soft)]">
                  Choose how sellers fill this field and whether buyers may use it as a filter.
                </SheetDescription>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-xl bg-stone-200/70 text-stone-600 hover:bg-stone-300 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Form Body */}
          <div className="flex-1 space-y-6 px-6 py-5">
            {/* Section: Basic Identity */}
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-white/80 p-4.5 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-canopy-deep)]">
                1. Field details
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    Product field name *
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Battery Capacity"
                    className="mt-1 h-10 rounded-xl border-stone-300 bg-white text-xs font-semibold text-stone-900 focus-visible:ring-[#075b36]"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    Field key *
                  </label>
                  <Input
                    value={slug}
                    onChange={(e) => {
                      setIsSlugManuallyEdited(true);
                      setSlug(e.target.value);
                    }}
                    placeholder="e.g. battery_capacity"
                    className="mt-1 h-10 rounded-xl border-stone-300 bg-white font-mono text-xs font-semibold text-stone-900 focus-visible:ring-[#075b36]"
                    required
                  />
                </div>
              </div>

              {/* Data Type Selector */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                  Input type *
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setType("TEXT")}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all",
                      type === "TEXT"
                        ? "border-[#075b36] bg-[#075b36]/10 text-[var(--admin-canopy-deep)] font-black ring-1 ring-[#075b36]"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    )}
                  >
                    <TypeIcon className="size-4" />
                    <span className="mt-1 text-xs">Text</span>
                    <span className="text-[10px] font-normal text-stone-500">Short detail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("NUMBER")}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all",
                      type === "NUMBER"
                        ? "border-[#075b36] bg-[#075b36]/10 text-[var(--admin-canopy-deep)] font-black ring-1 ring-[#075b36]"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    )}
                  >
                    <Hash className="size-4" />
                    <span className="mt-1 text-xs">Number</span>
                    <span className="text-[10px] font-normal text-stone-500">Value with unit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType("SELECT")}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all",
                      type === "SELECT"
                        ? "border-[#075b36] bg-[#075b36]/10 text-[var(--admin-canopy-deep)] font-black ring-1 ring-[#075b36]"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    )}
                  >
                    <ListFilter className="size-4" />
                    <span className="mt-1 text-xs">Dropdown</span>
                    <span className="text-[10px] font-normal text-stone-500">Choice list</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section: Type-Specific Settings */}
            {type === "NUMBER" && (
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-white/80 p-4.5 shadow-sm space-y-3">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-canopy-deep)]">
                  2. Number settings
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                      Unit
                    </label>
                    <Input
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="e.g. kVA, W, mAh, kg, inch"
                      className="mt-1 h-10 rounded-xl border-stone-300 bg-white text-xs font-semibold focus-visible:ring-[#075b36]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                      Placeholder
                    </label>
                    <Input
                      value={placeholder}
                      onChange={(e) => setPlaceholder(e.target.value)}
                      placeholder="e.g. 5.0"
                      className="mt-1 h-10 rounded-xl border-stone-300 bg-white text-xs font-semibold focus-visible:ring-[#075b36]"
                    />
                  </div>
                </div>
              </div>
            )}

            {type === "SELECT" && (
              <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-white/80 p-4.5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-canopy-deep)]">
                    2. Choice list
                  </h3>
                  <span className="text-[11px] font-bold text-stone-500">
                    {choices.length} choices configured
                  </span>
                </div>

                {/* Add new choice input */}
                <div className="flex gap-2">
                  <Input
                    value={newChoiceInput}
                    onChange={(e) => setNewChoiceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddChoice();
                      }
                    }}
                    placeholder="Type an option and press Enter"
                    className="h-10 rounded-xl border-stone-300 bg-white text-xs font-semibold focus-visible:ring-[#075b36]"
                  />
                  <Button
                    type="button"
                    onClick={() => handleAddChoice()}
                    className="h-10 rounded-xl bg-[#075b36] px-4 text-xs font-bold text-white hover:bg-[#063b29]"
                  >
                    <Plus className="mr-1 size-3.5" />
                    Add
                  </Button>
                </div>

                {/* Choices Chips */}
                {choices.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                    {choices.map((c, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-300/80 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 shadow-2xs"
                      >
                        {c}
                        <button
                          type="button"
                          onClick={() => handleRemoveChoice(idx)}
                          className="text-stone-400 hover:text-red-600 transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-xs text-stone-500">
                    No options added yet. Type an option above or pick from quick presets below.
                  </div>
                )}

                {/* Quick Presets */}
                <div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-stone-600">
                    <Sparkles className="size-3 text-amber-600" />
                    <span>Quick Load Presets:</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.keys(COMMON_PRESET_DICTIONARIES).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleAddPresetDictionary(key)}
                        className="rounded-lg border border-stone-200 bg-stone-100/80 px-2 py-1 text-[10px] font-bold text-stone-700 hover:bg-[#fff8ec] hover:border-[var(--admin-copper-muted)] hover:text-[var(--admin-canopy-deep)] transition-colors"
                      >
                        + {key}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Section: Behavioral Capabilities & Toggles */}
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-white/80 p-4.5 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-canopy-deep)]">
                    3. Where this field is used
              </h3>

              <div className="space-y-2">
                {/* Required Toggle */}
                <div
                  onClick={() => setIsRequired(!isRequired)}
                  className="flex items-start justify-between rounded-xl border border-stone-200 bg-[#fffdfa] p-3 cursor-pointer hover:border-stone-300 transition-all"
                >
                  <div className="pr-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                      <span>Required before sellers submit</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      Sellers must provide this value before submitting a product.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isRequired
                        ? "border-[#075b36] bg-[#075b36] text-white"
                        : "border-stone-300 bg-white"
                    )}
                  >
                    {isRequired && <Check className="size-3.5" />}
                  </div>
                </div>

                {/* Variation toggle */}
                <div
                  onClick={() => setIsVariation(!isVariation)}
                  className="flex items-start justify-between rounded-xl border border-stone-200 bg-[#fffdfa] p-3 cursor-pointer hover:border-stone-300 transition-all"
                >
                  <div className="pr-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                      <Boxes className="size-3.5 text-amber-600" />
                      <span>Used for product variations</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      Lets this field define product options such as size, color, or capacity.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isVariation
                        ? "border-[#075b36] bg-[#075b36] text-white"
                        : "border-stone-300 bg-white"
                    )}
                  >
                    {isVariation && <Check className="size-3.5" />}
                  </div>
                </div>

                {/* Buyer filter toggle */}
                <div
                  onClick={() => setIsFilterable(!isFilterable)}
                  className="flex items-start justify-between rounded-xl border border-stone-200 bg-[#fffdfa] p-3 cursor-pointer hover:border-stone-300 transition-all"
                >
                  <div className="pr-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                      <Filter className="size-3.5 text-blue-600" />
                      <span>Show as a buyer filter</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      Makes this field available as a buyer filter when the consumer listing contract supports it.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isFilterable
                        ? "border-[#075b36] bg-[#075b36] text-white"
                        : "border-stone-300 bg-white"
                    )}
                  >
                    {isFilterable && <Check className="size-3.5" />}
                  </div>
                </div>

                {/* Quick choice toggle */}
                <div
                  onClick={() => setIsSlicer(!isSlicer)}
                  className="flex items-start justify-between rounded-xl border border-stone-200 bg-[#fffdfa] p-3 cursor-pointer hover:border-stone-300 transition-all"
                >
                  <div className="pr-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-stone-900">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      <span>Show as a quick choice</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-stone-500">
                      Highlights this field as a quick choice in product surfaces that support it.
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isSlicer
                        ? "border-[#075b36] bg-[#075b36] text-white"
                        : "border-stone-300 bg-white"
                    )}
                  >
                    {isSlicer && <Check className="size-3.5" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Seller Guidance & Compliance */}
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-white/80 p-4.5 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-canopy-deep)]">
                4. Seller guidance
              </h3>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
                  Seller guidance
                </label>
                <textarea
                  value={sellerGuidance}
                  onChange={(e) => setSellerGuidance(e.target.value)}
                  placeholder="Add a short instruction for sellers."
                  className="mt-1 min-h-20 w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs font-medium text-stone-900 placeholder:text-stone-400 focus-visible:ring-1 focus-visible:ring-[#075b36] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Drawer Actions Footer */}
          <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] bg-[#fff8ec]/95 px-6 py-4 backdrop-blur-md">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 rounded-xl border-stone-300 px-4 text-xs font-bold text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 rounded-xl bg-[#075b36] px-6 text-xs font-black uppercase tracking-[0.12em] text-[#fff8ec] shadow-md hover:bg-[#063b29]"
            >
              <Save className="mr-1.5 size-3.5" />
              {isSubmitting
                ? "Saving..."
                : editingAttribute
                ? "Update Field"
                : "Create Field"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
