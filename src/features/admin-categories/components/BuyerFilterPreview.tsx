"use client";

/**
 * Buyer filter configuration preview.
 *
 * This surface does not simulate search results or product counts. It only
 * shows which category fields are configured as buyer filters.
 */

import React, { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Filter, Info, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminCategoryRecord, CategoryAttributeRecord } from "../types";

export interface BuyerFilterPreviewProps {
  category: AdminCategoryRecord;
  attributes: CategoryAttributeRecord[];
}

export function BuyerFilterPreview({ category, attributes }: BuyerFilterPreviewProps) {
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string[]>>({});
  const [numberRanges, setNumberRanges] = useState<Record<string, { min?: string; max?: string }>>({});
  const [checkedFlags, setCheckedFlags] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const filterableAttributes = useMemo(
    () => attributes.filter((attribute) => attribute.options?.isFilterable),
    [attributes],
  );

  const activeCount = useMemo(() => {
    const choices = Object.values(selectedChoices).reduce((sum, values) => sum + values.length, 0);
    const ranges = Object.values(numberRanges).filter((range) => range.min || range.max).length;
    const flags = Object.values(checkedFlags).filter(Boolean).length;
    return choices + ranges + flags;
  }, [checkedFlags, numberRanges, selectedChoices]);

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((current) => ({ ...current, [sectionKey]: !current[sectionKey] }));
  };

  const toggleChoice = (attributeSlug: string, choice: string) => {
    setSelectedChoices((current) => {
      const values = current[attributeSlug] ?? [];
      return {
        ...current,
        [attributeSlug]: values.includes(choice)
          ? values.filter((item) => item !== choice)
          : [...values, choice],
      };
    });
  };

  const clearPreviewState = () => {
    setSelectedChoices({});
    setNumberRanges({});
    setCheckedFlags({});
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_26%,transparent)] bg-[linear-gradient(180deg,#fffdfa_0%,#faf4ea_100%)] shadow-[0_16px_40px_rgba(6,59,41,0.06)]">
      <div className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-[#fff8ec]/85 px-5 py-4 backdrop-blur-md">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#063b29] text-[#fff8ec] shadow-sm">
              <Filter className="size-4 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-[var(--admin-canopy-deep)]">
                Buyer filter preview
              </h2>
              <p className="text-xs text-[var(--admin-ink-soft)]">
                Shows fields that can be offered as filters for <span className="font-bold text-stone-900">{category.name}</span>.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={activeCount === 0} onClick={clearPreviewState} className="min-h-11 rounded-xl border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-40">
            <RotateCcw className="mr-1 size-3" aria-hidden="true" />
            Clear preview choices
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <div className="flex flex-col space-y-4 overflow-y-auto border-r border-[color-mix(in_srgb,var(--admin-copper-muted)_20%,transparent)] bg-[#fffdfa]/70 p-4 scrollbar-none [&::-webkit-scrollbar]:hidden">
          <div className="rounded-2xl border border-stone-200 bg-white/90 p-3.5 shadow-xs">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-[#075b36]" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-stone-600">
                This is a configuration preview only. It does not show live products, brands, seller trust, stock, delivery, or search-result counts.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white/90 p-3.5 shadow-xs">
            <button type="button" onClick={() => toggleSection("price")} className="flex min-h-11 w-full items-center justify-between text-left text-xs font-black text-stone-900">
              <span>Price filter preview (ZMW)</span>
              {collapsedSections.price ? <ChevronDown className="size-4 text-stone-400" /> : <ChevronUp className="size-4 text-stone-400" />}
            </button>
            {!collapsedSections.price ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold text-stone-500">Min ZMW</span>
                  <Input type="number" placeholder="0" className="mt-1 h-10 rounded-lg text-xs" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-stone-500">Max ZMW</span>
                  <Input type="number" placeholder="50000" className="mt-1 h-10 rounded-lg text-xs" />
                </label>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">
                Category fields ({filterableAttributes.length})
              </span>
            </div>

            {filterableAttributes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300/80 bg-stone-50/70 p-4 text-center">
                <Info className="mx-auto size-5 text-stone-400" aria-hidden="true" />
                <p className="mt-2 text-xs font-bold text-stone-700">No buyer filters set</p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                  Mark a product field as “Show as a buyer filter” to preview it here.
                </p>
              </div>
            ) : (
              filterableAttributes.map((attribute) => {
                const isCollapsed = collapsedSections[attribute.slug];
                const choices = attribute.options?.choices ?? [];
                const unit = attribute.options?.unit;
                const selected = selectedChoices[attribute.slug] ?? [];
                const range = numberRanges[attribute.slug] ?? {};
                return (
                  <div key={attribute.id} className="rounded-2xl border border-stone-200 bg-white/90 p-3.5 shadow-xs">
                    <button type="button" onClick={() => toggleSection(attribute.slug)} className="flex min-h-11 w-full items-center justify-between text-left text-xs font-black text-stone-900">
                      <span className="min-w-0 truncate">{attribute.name}{unit ? ` (${unit})` : ""}</span>
                      {isCollapsed ? <ChevronDown className="size-4 shrink-0 text-stone-400" /> : <ChevronUp className="size-4 shrink-0 text-stone-400" />}
                    </button>
                    {!isCollapsed ? (
                      <div className="mt-3">
                        {attribute.type === "SELECT" ? (
                          choices.length ? (
                            <div className="space-y-1.5">
                              {choices.map((choice) => {
                                const checked = selected.includes(choice);
                                return (
                                  <label key={choice} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs font-medium text-stone-800 hover:bg-stone-50">
                                    <input type="checkbox" checked={checked} onChange={() => toggleChoice(attribute.slug, choice)} className="size-4 accent-[#075b36]" />
                                    <span>{choice}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : <p className="text-[11px] italic text-stone-400">No choices entered.</p>
                        ) : attribute.type === "NUMBER" ? (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="text-[10px] font-bold text-stone-500">Min {unit ? `(${unit})` : ""}</span>
                              <Input type="number" value={range.min ?? ""} onChange={(event) => setNumberRanges((current) => ({ ...current, [attribute.slug]: { ...range, min: event.target.value } }))} className="mt-1 h-10 rounded-lg text-xs" />
                            </label>
                            <label className="block">
                              <span className="text-[10px] font-bold text-stone-500">Max {unit ? `(${unit})` : ""}</span>
                              <Input type="number" value={range.max ?? ""} onChange={(event) => setNumberRanges((current) => ({ ...current, [attribute.slug]: { ...range, max: event.target.value } }))} className="mt-1 h-10 rounded-lg text-xs" />
                            </label>
                          </div>
                        ) : (
                          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-xs font-medium text-stone-800 hover:bg-stone-50">
                            <input type="checkbox" checked={Boolean(checkedFlags[attribute.slug])} onChange={() => setCheckedFlags((current) => ({ ...current, [attribute.slug]: !current[attribute.slug] }))} className="size-4 accent-[#075b36]" />
                            <span>Filter by filled {attribute.name}</span>
                          </label>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col overflow-y-auto bg-white/70 p-5 scrollbar-none [&::-webkit-scrollbar]:hidden">
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] bg-[#fff8ec]/70 p-4">
            <h3 className="text-sm font-black text-stone-900">What this means</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-600">
              The checked controls show how an operator can test field choices. A real buyer filter appears only when the backend consumer search contract supports it.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-md bg-stone-200/80 px-2 py-1 text-stone-700">Category: {category.name}</span>
              <span className="rounded-md bg-stone-200/80 px-2 py-1 text-stone-700">Buyer filters: {filterableAttributes.length}</span>
              <span className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">Preview choices: {activeCount}</span>
            </div>
          </div>

          {activeCount > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(selectedChoices).flatMap(([slug, choices]) => choices.map((choice) => ({ id: `${slug}:${choice}`, label: choice, slug }))).map((pill) => (
                <span key={pill.id} className="inline-flex items-center gap-1 rounded-full border border-[#075b36]/30 bg-emerald-50/90 py-1 pl-3 pr-2 text-xs font-bold text-[#063b29]">
                  {pill.label}
                  <button type="button" onClick={() => toggleChoice(pill.slug, pill.label)} aria-label={`Remove ${pill.label}`} className="flex size-5 items-center justify-center rounded-full hover:bg-emerald-200">
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {Object.entries(checkedFlags).filter(([, checked]) => checked).map(([slug]) => (
                <span key={slug} className="inline-flex items-center gap-1 rounded-full border border-[#075b36]/30 bg-emerald-50/90 px-3 py-1 text-xs font-bold text-[#063b29]">
                  <Check className="size-3" aria-hidden="true" />
                  {filterableAttributes.find((attribute) => attribute.slug === slug)?.name ?? slug}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
