"use client";

import { type ChangeEvent } from "react";
import { CheckCircle2, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { type CategoryNode } from "@/services/categories-api";
import { type CategorySelection, type PickerSelection } from "../_lib/category-selection";

type CategoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categorySearch: string;
  setCategorySearch: (value: string) => void;
  browsePath: CategoryNode[];
  setBrowsePath: (path: CategoryNode[]) => void;
  currentLevel: CategoryNode[];
  searchResults: Array<{ node: CategoryNode; path: CategoryNode[] }>;
  pickerSelection: PickerSelection | null;
  selectedPickerCategory: CategorySelection | null;
  canSubmitCategory: boolean;
  onSelectBrowseNode: (node: CategoryNode) => void;
  onChooseSearchResult: (path: CategoryNode[]) => void;
  onSelectOther: () => void;
  onSubmitCategory: () => void;
  categoryTreeStatus?: "loading" | "success" | "error";
  onRetryCategoryTree?: () => void;
};

export function CategoryDrawer({
  open,
  onOpenChange,
  categorySearch,
  setCategorySearch,
  browsePath,
  setBrowsePath,
  currentLevel,
  searchResults,
  pickerSelection,
  selectedPickerCategory,
  canSubmitCategory,
  onSelectBrowseNode,
  onChooseSearchResult,
  onSelectOther,
  onSubmitCategory,
  categoryTreeStatus = "success",
  onRetryCategoryTree,
}: CategoryDrawerProps) {
  const canSelectOther = browsePath.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="h-full w-full overflow-hidden border-l border-white/50 bg-white/80 p-0 shadow-[0_0_80px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:max-w-xl" showCloseButton>
        <SheetHeader className="border-b border-white/60 bg-linear-to-br from-white/80 via-emerald-50/80 to-white/70 px-5 py-5">
          <SheetTitle className="text-xl font-black text-zinc-950">Choose Category</SheetTitle>
          <SheetDescription className="text-sm font-semibold text-zinc-600">Browse to a final category, or choose Other under the nearest correct parent.</SheetDescription>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input value={categorySearch} onChange={(e: ChangeEvent<HTMLInputElement>) => setCategorySearch(e.target.value)} placeholder="Search categories..." className="h-11 rounded-2xl border-white bg-white/85 pl-9 text-sm font-semibold shadow-inner focus-visible:ring-[#009E49]" />
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-black text-zinc-500">
            <button type="button" onClick={() => setBrowsePath([])} className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">All</button>
            {browsePath.map((node, index) => (
              <span key={node.id} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button type="button" onClick={() => setBrowsePath(browsePath.slice(0, index + 1))} className="rounded-full bg-emerald-50 px-3 py-1 text-[#009E49]">{node.name}</button>
              </span>
            ))}
          </div>

          {categorySearch.trim() ? (
            <div className="space-y-2">
              {searchResults.length ? searchResults.map(({ node, path }) => (
                <button key={`${node.id}-${path.length}`} type="button" onClick={() => onChooseSearchResult(path)} className="w-full rounded-2xl border border-white/70 bg-white/80 p-3 text-left shadow-sm transition hover:border-[#009E49] hover:bg-emerald-50">
                  <span className="block text-sm font-black text-zinc-900">{node.name}</span>
                  <span className="mt-1 block text-xs font-semibold text-zinc-500">{path.map((item) => item.name).join(" > ")}</span>
                </button>
              )) : <p className="rounded-2xl bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">No category matches. Browse to the closest parent and choose Other.</p>}
            </div>
          ) : categoryTreeStatus === "loading" ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/90 p-4 text-sm font-semibold text-zinc-600">
               Loading category tree...
            </div>
          ) : categoryTreeStatus === "error" ? (
            <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/90 p-4 text-sm font-semibold text-red-600">
               <p>Failed to load categories.</p>
               <Button type="button" onClick={onRetryCategoryTree} className="mt-3 h-9 rounded-xl bg-red-100 px-4 text-xs font-bold text-red-800 hover:bg-red-200">Retry</Button>
            </div>
          ) : (
            <div className="space-y-2">
              {currentLevel.length ? currentLevel.map((node) => {
                const isLeaf = !node.children?.length;
                const isSelected = pickerSelection && !pickerSelection.isOther && pickerSelection.path[pickerSelection.path.length - 1]?.id === node.id;
                return (
                  <button key={node.id} type="button" onClick={() => onSelectBrowseNode(node)} className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left shadow-sm transition ${
                    isSelected ? "border-[#009E49] bg-emerald-50" : "border-white/70 bg-white/80 hover:border-[#009E49] hover:bg-emerald-50"
                  }`}>
                    <span>
                      <span className="block text-sm font-black text-zinc-900">{node.name}</span>
                      <span className="mt-1 block text-xs font-semibold text-zinc-500">{isLeaf ? "Final category" : `${node.children?.length ?? 0} more options`}</span>
                    </span>
                    {isLeaf ? <CheckCircle2 className={`h-4 w-4 ${isSelected ? "text-[#009E49]" : "text-zinc-300"}`} /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
                  </button>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/90 p-4 text-sm font-semibold text-zinc-600">
                  No categories are available yet. Create them in admin before listing products here.
                </div>
              )}
              <button
                type="button"
                onClick={onSelectOther}
                disabled={!canSelectOther}
                className={`w-full rounded-2xl border border-dashed p-3 text-left transition ${
                  pickerSelection?.isOther
                    ? "border-amber-400 bg-amber-50 text-amber-900"
                    : canSelectOther
                      ? "border-amber-200 bg-amber-50/70 text-amber-800 hover:border-amber-400"
                      : "border-zinc-200 bg-zinc-100 text-zinc-400"
                }`}
              >
                <span className="block text-sm font-black">Other</span>
                <span className="mt-1 block text-xs font-semibold">
                  {canSelectOther
                    ? "Use when the exact category is missing under the current parent."
                    : "Select a parent category first."}
                </span>
              </button>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-white/60 bg-white/80 p-5 backdrop-blur-2xl">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
            <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Selected path</p>
            <p className="mt-1 text-sm font-bold text-zinc-900">{selectedPickerCategory ? selectedPickerCategory.path.join(" > ") : "Choose a final category or Other"}</p>
            {pickerSelection && !canSubmitCategory ? <p className="mt-1 text-xs font-semibold text-amber-700">Parent categories are navigation only. Continue deeper or choose Other.</p> : null}
          </div>
          <Button type="button" onClick={onSubmitCategory} disabled={!canSubmitCategory} className="h-12 rounded-2xl bg-[#009E49] text-sm font-black text-white shadow-[0_10px_28px_rgba(0,158,73,0.24)] hover:bg-[#00853d] disabled:bg-zinc-300 disabled:shadow-none">
            Submit Category
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
