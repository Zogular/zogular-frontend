"use client";

/**
 * Backend-backed category template picker. Template definitions and application
 * outcomes remain server-authoritative; this dialog only manages selection.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Boxes, Check, Filter, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/api";
import { getCategoryTemplates } from "../api/admin-categories";
import type {
  AdminCategoryRecord,
  CategoryTemplateApplyOutcome,
  CategoryTemplateDefinition,
} from "../types";

export interface IndustryTemplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: AdminCategoryRecord;
  onApplyTemplate: (
    templateKey: string,
    selectedSlugs: string[],
  ) => Promise<CategoryTemplateApplyOutcome>;
}

function readableTemplateError(error: unknown, action: "load" | "apply"): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) return "You do not have access to manage category templates.";
    if (error.status === 404) return action === "load" ? "Category templates are not available right now." : "This template is no longer available. Refresh the library and try again.";
    if (error.status === 422) return "Choose at least one available attribute and try again.";
  }
  return action === "load" ? "Category templates are unavailable right now. Please try again." : "The template could not be applied. Please try again.";
}

function outcomeMessage(outcome: CategoryTemplateApplyOutcome): string {
  const parts = [
    outcome.createdAttributes.length
      ? `${outcome.createdAttributes.length} ${outcome.createdAttributes.length === 1 ? "attribute" : "attributes"} created`
      : null,
    outcome.updatedAttributes.length
      ? `${outcome.updatedAttributes.length} ${outcome.updatedAttributes.length === 1 ? "attribute" : "attributes"} updated`
      : null,
    outcome.unchangedAttributes.length ? `${outcome.unchangedAttributes.length} unchanged` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join("; ") : "No attributes needed changes.";
}

export function IndustryTemplateLibraryModal({ isOpen, onClose, category, onApplyTemplate }: IndustryTemplateLibraryModalProps) {
  const headingId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [templates, setTemplates] = useState<CategoryTemplateDefinition[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const selectedTemplate = templates.find((template) => template.templateKey === selectedTemplateKey) ?? null;

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    setTemplates([]);
    setSelectedTemplateKey(null);
    setSelectedSlugs([]);
    setApplyError(null);
    setOutcome(null);
    try {
      const nextTemplates = await getCategoryTemplates();
      setTemplates(nextTemplates);
    } catch (error) {
      setTemplates([]);
      setSelectedTemplateKey(null);
      setSelectedSlugs([]);
      setLoadError(readableTemplateError(error, "load"));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setTemplates([]);
    setSelectedTemplateKey(null);
    setSelectedSlugs([]);
    setLoadError(null);
    setApplyError(null);
    setOutcome(null);
    closeButtonRef.current?.focus();
    void loadTemplates();
  }, [isOpen, loadTemplates]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isApplying) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isApplying, isOpen, onClose]);

  const selectTemplate = (template: CategoryTemplateDefinition) => {
    setSelectedTemplateKey(template.templateKey);
    setSelectedSlugs(template.attributes.map((attribute) => attribute.slug ?? "").filter(Boolean));
    setApplyError(null);
    setOutcome(null);
  };

  const toggleSlug = (slug: string) => {
    setSelectedSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
    setApplyError(null);
    setOutcome(null);
  };

  const toggleSelectAll = () => {
    if (!selectedTemplate) return;
    const slugs = selectedTemplate.attributes.map((attribute) => attribute.slug ?? "").filter(Boolean);
    setSelectedSlugs(selectedSlugs.length === slugs.length ? [] : slugs);
  };

  const handleApply = async () => {
    if (!selectedTemplate || selectedSlugs.length === 0 || isApplying) return;
    setIsApplying(true);
    setApplyError(null);
    setOutcome(null);
    try {
      // Parent resolves only after direct and inherited attributes have refreshed.
      const result = await onApplyTemplate(selectedTemplate.templateKey, selectedSlugs);
      const message = outcomeMessage(result);
      setOutcome(message);
      toast.success(message);
      onClose();
    } catch (error) {
      setApplyError(readableTemplateError(error, "apply"));
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby={headingId} className="flex h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[#fff8ec] text-stone-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--admin-copper-muted)_22%,transparent)] px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0"><h2 id={headingId} className="text-base font-black tracking-tight text-[var(--admin-canopy-deep)]">Category template library</h2><p className="mt-0.5 text-xs text-[var(--admin-ink-soft)]">Choose attributes for <span className="font-bold text-stone-900">{category.name}</span>.</p></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={isApplying} aria-label="Close category template library" className="flex size-11 shrink-0 items-center justify-center rounded-xl text-stone-600 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36] disabled:opacity-50"><X className="size-4" /></button>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(240px,340px)_minmax(0,1fr)]">
          <div className="min-h-0 overflow-y-auto border-b border-stone-200 p-3 md:border-r md:border-b-0">
            <p className="px-1 pb-2 text-[11px] font-black uppercase tracking-[0.14em] text-stone-500">Available templates</p>
            {isLoading ? <p className="rounded-xl bg-stone-100 px-3 py-4 text-sm text-stone-600">Loading templates…</p> : null}
            {loadError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3" role="status"><p className="text-sm text-amber-900">{loadError}</p><Button type="button" variant="outline" onClick={() => void loadTemplates()} className="mt-3 min-h-11 rounded-xl text-xs font-bold">Try again</Button></div> : null}
            {!isLoading && !loadError && templates.length === 0 ? <p className="rounded-xl bg-stone-100 px-3 py-4 text-sm text-stone-600">No templates are available.</p> : null}
            {!isLoading && !loadError ? <div className="mb-2 rounded-xl border border-stone-200 bg-white/70 p-3 text-xs text-stone-600">Pick one template to review. Nothing is selected by default.</div> : null}
            <div className="space-y-2">{!loadError && templates.map((template) => {
              const selected = template.templateKey === selectedTemplateKey;
              return <button key={template.templateKey} type="button" onClick={() => selectTemplate(template)} aria-pressed={selected} className={`w-full rounded-2xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36] ${selected ? "border-[#075b36] bg-[#075b36]/5" : "border-stone-200 bg-white/70 hover:border-stone-300"}`}><span className="block text-sm font-black text-stone-900">{template.title}</span><span className="mt-1 block line-clamp-2 text-xs text-stone-600">{template.description}</span><span className="mt-2 block text-[11px] font-semibold text-stone-500">{template.attributes.length} attributes</span></button>;
            })}</div>
          </div>
          <div className="flex min-h-0 flex-col bg-white/70 p-4 sm:p-6">
            {selectedTemplate ? <>
              <div className="border-b border-stone-200 pb-3"><h3 className="text-base font-black text-stone-900">{selectedTemplate.title}</h3><p className="mt-1 text-sm text-stone-600">{selectedTemplate.description}</p></div>
              <div className="my-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-stone-700"><span>Attributes to apply ({selectedSlugs.length}/{selectedTemplate.attributes.length})</span><button type="button" onClick={toggleSelectAll} className="min-h-11 rounded-lg px-2 text-xs font-black text-[#075b36] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36]">{selectedSlugs.length === selectedTemplate.attributes.length ? "Deselect all" : "Select all"}</button></div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">{selectedTemplate.attributes.map((attribute) => {
                const slug = attribute.slug ?? "";
                const checked = selectedSlugs.includes(slug);
                return <button key={slug} type="button" onClick={() => toggleSlug(slug)} aria-pressed={checked} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#075b36] ${checked ? "border-[#075b36]/60 bg-[#075b36]/5" : "border-stone-200 bg-stone-50/50"}`}><span className="min-w-0"><span className="flex items-center gap-2 text-sm font-bold text-stone-900">{checked ? <Check className="size-4 shrink-0 text-[#075b36]" /> : <span className="size-4 shrink-0 rounded border border-stone-300" />}{attribute.name}</span><span className="mt-1 block truncate font-mono text-[11px] text-stone-500">{slug}</span></span><span className="flex shrink-0 items-center gap-1"><span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-black text-stone-700">{attribute.type}</span>{attribute.options?.isVariation ? <Boxes className="size-3.5 text-amber-700" aria-label="Variant attribute" /> : null}{attribute.options?.isFilterable ? <Filter className="size-3.5 text-blue-700" aria-label="Filterable attribute" /> : null}</span></button>;
              })}</div>
              <div className="mt-4 border-t border-stone-200 pt-3">{applyError ? <p className="mb-2 text-sm text-rose-700" role="alert">{applyError}</p> : null}{outcome ? <p className="mb-2 text-sm text-[#075b36]" role="status">{outcome}</p> : null}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={isApplying} className="min-h-11 rounded-xl text-xs font-bold">Cancel</Button><Button type="button" disabled={!selectedSlugs.length || isApplying} onClick={() => void handleApply()} className="min-h-11 rounded-xl bg-[#075b36] px-4 text-xs font-black text-[#fff8ec] hover:bg-[#063b29]"><Sparkles className="mr-1.5 size-3.5" />{isApplying ? "Applying…" : "Apply selected"}</Button></div></div>
            </> : <p className="rounded-xl bg-stone-100 p-4 text-sm text-stone-600">Select a template to review its attributes.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
