import { ChevronRight, FolderTree, ShieldAlert, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CategorySelection } from "../_lib/category-selection";
import { fieldError, GlassSection, inputErrorClass } from "./ProductListingStudioPrimitives";

export function ProductEssentialsSection({
  categoryError,
  nameError,
  onOpenCategory,
  onProductNameChange,
  productName,
  submittedCategory,
}: {
  categoryError?: string;
  nameError?: string;
  onOpenCategory: () => void;
  onProductNameChange: (value: string) => void;
  productName: string;
  submittedCategory: CategorySelection | null;
}) {
  return (
    <>
      <GlassSection title="Product Name" subtitle="Start with the exact product name shoppers will recognize." icon={<Tag className="h-4 w-4" />}>
        <Input
          placeholder="e.g. MacBook Air M2 - 256GB"
          value={productName}
          onChange={(event) => onProductNameChange(event.target.value)}
          className={`h-12 rounded-2xl bg-white/80 text-base font-bold shadow-inner ${inputErrorClass(nameError)}`}
        />
        {fieldError(nameError)}
      </GlassSection>

      <GlassSection title="Category Selector" subtitle="Choose the nearest final category. Use Other under the correct parent when the exact match is missing." icon={<FolderTree className="h-4 w-4" />}>
        <button
          type="button"
          onClick={onOpenCategory}
          className={`flex min-h-14 w-full items-center justify-between rounded-2xl border bg-white/80 px-4 text-left shadow-inner transition-all hover:border-[#009E49] ${
            categoryError ? "border-rose-300" : "border-zinc-200"
          }`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-black text-zinc-950">{submittedCategory ? submittedCategory.leafName : "Select product category"}</span>
            <span className="mt-1 block truncate text-xs font-semibold text-zinc-500">{submittedCategory ? submittedCategory.path.join(" > ") : "Open category drawer"}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
        </button>
        {submittedCategory?.isOther ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <ShieldAlert className="h-3.5 w-3.5" />
            Other category selected. This listing will carry stricter review metadata.
          </p>
        ) : null}
        {fieldError(categoryError)}
      </GlassSection>
    </>
  );
}
