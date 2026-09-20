"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type CategorySchemaFailureFallbackProps = {
  note: string;
  onNoteChange: (value: string) => void;
  onRetry: () => void;
  title?: string;
};

export function CategorySchemaFailureFallback({ note, onNoteChange, onRetry, title = "Category fields are unavailable" }: CategorySchemaFailureFallbackProps) {
  return (
    <section
      id="product-category-details"
      tabIndex={-1}
      aria-labelledby="category-schema-error-title"
      className="rounded-2xl border border-red-200 bg-red-50/80 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="category-schema-error-title" className="text-sm font-black text-red-900">{title}</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-red-700">
            Your draft is preserved. Add a manual note for continuity, then retry. This draft cannot be submitted for review until governed category fields load.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onRetry} className="h-9 rounded-xl border-red-200 bg-white text-xs font-black text-red-800 hover:bg-red-100">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
        </Button>
      </div>
      <label htmlFor="product-category-fallback-note" className="mt-4 block text-xs font-black text-red-900">Manual category note</label>
      <textarea
        id="product-category-fallback-note"
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Record the product type and important specifications for this draft."
        className="mt-1 min-h-24 w-full resize-y rounded-xl border border-red-200 bg-white p-3 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      />
    </section>
  );
}
