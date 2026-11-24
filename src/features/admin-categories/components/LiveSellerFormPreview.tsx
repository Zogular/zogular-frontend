"use client";

/**
 * Seller product-field preview.
 *
 * This component previews the category-specific fields that a seller would
 * complete for a product listing. It deliberately avoids fake SKUs, stock,
 * prices, brands, conditions, or marketplace claims because those belong to
 * real seller/product contracts outside this configuration surface.
 */

import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, HelpCircle, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AdminCategoryRecord, CategoryAttributeRecord } from "../types";

export interface LiveSellerFormPreviewProps {
  category: AdminCategoryRecord;
  attributes: CategoryAttributeRecord[];
}

function getDefaultValue(attribute: CategoryAttributeRecord): string {
  if (attribute.type === "SELECT") {
    return "";
  }

  return "";
}

export function LiveSellerFormPreview({ category, attributes }: LiveSellerFormPreviewProps) {
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [selectedVariationChoices, setSelectedVariationChoices] = useState<Record<string, string[]>>({});

  const variationAttributes = useMemo(
    () => attributes.filter((attribute) => attribute.options?.isVariation && attribute.type === "SELECT"),
    [attributes],
  );

  const missingRequired = useMemo(
    () =>
      attributes
        .filter((attribute) => attribute.isRequired && !previewValues[attribute.slug]?.trim())
        .map((attribute) => attribute.name),
    [attributes, previewValues],
  );

  const configuredFilterCount = useMemo(
    () => attributes.filter((attribute) => attribute.options?.isFilterable).length,
    [attributes],
  );

  const toggleVariationChoice = (attributeSlug: string, choice: string) => {
    setSelectedVariationChoices((current) => {
      const choices = current[attributeSlug] ?? [];
      return {
        ...current,
        [attributeSlug]: choices.includes(choice)
          ? choices.filter((item) => item !== choice)
          : [...choices, choice],
      };
    });
  };

  const resetPreview = () => {
    setPreviewValues({});
    setSelectedVariationChoices({});
  };

  return (
    <section
      aria-label={`${category.name} seller product-field preview`}
      className="flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ea_100%)] shadow-[0_16px_40px_rgba(6,59,41,0.06)]"
    >
      <header className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-[#fff8ec]/85 px-5 py-4 backdrop-blur-md">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#075b36] text-[#fff8ec]">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-[var(--admin-canopy-deep)]">
                Seller field preview
              </h2>
              <p className="text-xs text-[var(--admin-ink-soft)]">
                Shows fields configured for <span className="font-bold text-stone-900">{category.name}</span>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {missingRequired.length === 0 ? (
              <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-emerald-100 px-3 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Required fields filled
              </span>
            ) : (
              <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-amber-100 px-3 text-xs font-bold text-amber-800">
                <AlertCircle className="size-3.5" aria-hidden="true" />
                {missingRequired.length} required empty
              </span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetPreview}
              className="min-h-11 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-100"
            >
              <RotateCcw className="mr-1 size-3" aria-hidden="true" />
              Reset preview
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5 scrollbar-none [&::-webkit-scrollbar]:hidden">
        <div className="rounded-2xl border border-stone-200/90 bg-white/90 p-4 shadow-sm">
          <h3 className="text-sm font-black text-stone-900">Configured product fields</h3>
          <p className="mt-1 text-xs leading-relaxed text-stone-600">
            This preview checks how configured fields feel in a seller form. It does not create a product or show live buyer results.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-md bg-stone-200/80 px-2 py-1 text-stone-700">Fields: {attributes.length}</span>
            <span className="rounded-md bg-stone-200/80 px-2 py-1 text-stone-700">Buyer filters: {configuredFilterCount}</span>
            <span className="rounded-md bg-stone-200/80 px-2 py-1 text-stone-700">Variation fields: {variationAttributes.length}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/90 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--admin-canopy-deep)]">
              {category.name} fields
            </h3>
            <span className="text-[11px] font-bold text-stone-500">Configuration preview</span>
          </div>

          {attributes.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-stone-300 p-8 text-center">
              <p className="text-sm font-bold text-stone-800">No product fields yet</p>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                Add a field or apply a template to preview the seller form.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {attributes.map((attribute) => {
                const guidance = attribute.options?.sellerGuidance;
                const unit = attribute.options?.unit;
                const choices = attribute.options?.choices ?? [];
                const value = previewValues[attribute.slug] ?? getDefaultValue(attribute);

                return (
                  <div key={attribute.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor={`seller-preview-${attribute.id}`} className="flex min-w-0 items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-stone-700">
                        <span className="truncate">{attribute.name}</span>
                        {attribute.isRequired ? <span className="text-red-500" aria-label="required">*</span> : null}
                        {attribute.isInherited ? (
                          <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-800">
                            Inherited
                          </span>
                        ) : null}
                      </label>
                      {unit ? <span className="font-mono text-[10px] font-bold text-stone-500">{unit}</span> : null}
                    </div>

                    {attribute.type === "SELECT" ? (
                      <select
                        id={`seller-preview-${attribute.id}`}
                        value={value}
                        onChange={(event) => setPreviewValues((current) => ({ ...current, [attribute.slug]: event.target.value }))}
                        className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900 outline-none focus:ring-2 focus:ring-[#075b36]"
                      >
                        <option value="">Choose {attribute.name}</option>
                        {choices.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                    ) : attribute.type === "NUMBER" ? (
                      <div className="relative">
                        <Input
                          id={`seller-preview-${attribute.id}`}
                          type="number"
                          value={value}
                          onChange={(event) => setPreviewValues((current) => ({ ...current, [attribute.slug]: event.target.value }))}
                          placeholder={attribute.options?.placeholder || "Enter a number"}
                          className="min-h-11 rounded-xl border-stone-300 bg-white pr-12 text-sm font-semibold focus-visible:ring-[#075b36]"
                        />
                        {unit ? (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-stone-400">
                            {unit}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <Input
                        id={`seller-preview-${attribute.id}`}
                        type="text"
                        value={value}
                        onChange={(event) => setPreviewValues((current) => ({ ...current, [attribute.slug]: event.target.value }))}
                        placeholder={attribute.options?.placeholder || `Enter ${attribute.name}`}
                        className="min-h-11 rounded-xl border-stone-300 bg-white text-sm font-semibold focus-visible:ring-[#075b36]"
                      />
                    )}

                    {guidance ? (
                      <div className="flex items-start gap-1 pt-0.5 text-[11px] text-stone-500">
                        <HelpCircle className="mt-0.5 size-3 shrink-0 text-[var(--admin-copper-muted)]" aria-hidden="true" />
                        <span>{guidance}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {variationAttributes.length > 0 ? (
          <div className="space-y-4 rounded-2xl border border-amber-200/80 bg-white/95 p-4 shadow-sm">
            <div className="border-b border-amber-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-[0.14em] text-amber-900">
                Product variation fields
              </h3>
              <p className="mt-1 text-xs text-amber-800/90">
                Choose sample options to confirm the variation choices are easy to scan. This preview does not generate SKUs, stock, or prices.
              </p>
            </div>

            <div className="space-y-3">
              {variationAttributes.map((attribute) => (
                <fieldset key={attribute.id} className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                  <legend className="px-1 text-xs font-bold text-stone-800">{attribute.name}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(attribute.options?.choices ?? []).map((choice) => {
                      const selected = (selectedVariationChoices[attribute.slug] ?? []).includes(choice);
                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => toggleVariationChoice(attribute.slug, choice)}
                          aria-pressed={selected}
                          className={cn(
                            "min-h-11 rounded-xl px-3 text-xs font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]",
                            selected
                              ? "bg-[#075b36] text-white shadow-xs"
                              : "border border-stone-300 bg-white text-stone-700 hover:border-stone-400",
                          )}
                        >
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
