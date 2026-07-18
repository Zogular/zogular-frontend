import type { ProductCondition } from "@/services/seller-catalog";
import type { CategoryFieldValue } from "../_components/CategorySpecificDetails";
import type { CategorySelection } from "./category-selection";

const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type RecoverableProductDraft = {
  version: typeof DRAFT_VERSION;
  savedAt: number;
  productName: string;
  brand: string;
  condition: ProductCondition;
  description: string;
  price: string;
  salePrice: string;
  stock: string;
  sku: string;
  lowStockThreshold: string;
  submittedCategory: CategorySelection | null;
  categoryFieldValues: CategoryFieldValue[];
  deliveryType: "standard" | "express";
  packageWeight: string;
  hasDiscount: boolean;
  hasVariants: boolean;
  showAdvanced: boolean;
  specs: Array<{ name: string; value: string }>;
  variantOptions: { colors: string; sizes: string };
  seo: { title: string; description: string };
  dimensions: { l: string; w: string; h: string };
};

export function getProductDraftStorageKey(sellerId: string) {
  return `zogular:seller-product-draft:v${DRAFT_VERSION}:${sellerId}`;
}

export function readProductDraft(storageKey: string): RecoverableProductDraft | null {
  if (typeof window === "undefined") return null;

  const rawDraft = window.localStorage.getItem(storageKey);
  if (!rawDraft) return null;

  try {
    const draft = JSON.parse(rawDraft) as RecoverableProductDraft;
    if (
      draft.version !== DRAFT_VERSION ||
      !Number.isFinite(draft.savedAt) ||
      Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS
    ) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return draft;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeProductDraft(storageKey: string, draft: RecoverableProductDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(draft));
}

export function clearProductDraft(storageKey: string | null) {
  if (typeof window === "undefined" || !storageKey) return;
  window.localStorage.removeItem(storageKey);
}

export function hasRecoverableProductDraft(draft: RecoverableProductDraft) {
  return Boolean(
    draft.productName.trim() ||
    draft.brand.trim() ||
    draft.description.trim() ||
    draft.price ||
    draft.salePrice ||
    draft.stock ||
    draft.sku.trim() ||
    draft.submittedCategory ||
    draft.categoryFieldValues.some((field) => field.value.trim()) ||
    draft.specs.some((spec) => spec.name.trim() || spec.value.trim()) ||
    draft.variantOptions.colors.trim() ||
    draft.variantOptions.sizes.trim() ||
    draft.packageWeight ||
    draft.seo.title.trim() ||
    draft.seo.description.trim() ||
    draft.dimensions.l ||
    draft.dimensions.w ||
    draft.dimensions.h
  );
}
