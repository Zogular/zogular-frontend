import type { ProductCondition } from "@/services/seller-catalog";
import {
  restoreProductContentPolicyIssues,
  type StoredProductContentPolicyIssue,
} from "@/services/product-content-policy";
import type { CategoryFieldValue } from "../_components/CategorySpecificDetails";
import type { CategorySelection } from "./category-selection";

const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SUBMISSION_RECOVERY_VERSION = 1;
const SUBMISSION_RECOVERY_MAX_AGE_MS = 15 * 60 * 1000;

export const PRODUCT_SUBMISSION_RECOVERY_QUERY_PARAM = "submissionRecovery" as const;
export type ProductSubmissionRecoveryHint =
  | "content-policy"
  | "snapshot-conflict"
  | "submit-failed";

export type RecoverableProductDraft = {
  version: typeof DRAFT_VERSION;
  savedAt: number;
  productName: string;
  brand: string;
  location?: string;
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

export type ProductSubmissionRecovery =
  | {
      version: typeof SUBMISSION_RECOVERY_VERSION;
      savedAt: number;
      kind: "content-policy";
      issues: readonly StoredProductContentPolicyIssue[];
    }
  | {
      version: typeof SUBMISSION_RECOVERY_VERSION;
      savedAt: number;
      kind: "snapshot-conflict";
    };

export function getProductDraftStorageKey(sellerId: string) {
  return `zogular:seller-product-draft:v${DRAFT_VERSION}:${sellerId}`;
}

export function writeProductSubmissionRecovery(
  productId: string,
  recovery:
    | { kind: "content-policy"; issues: readonly StoredProductContentPolicyIssue[] }
    | { kind: "snapshot-conflict" },
) {
  if (typeof window === "undefined") return false;

  const storage = getBrowserStorage("session");
  if (!storage) return false;

  try {
    storage.setItem(
      getProductSubmissionRecoveryKey(productId),
      JSON.stringify({
        ...recovery,
        version: SUBMISSION_RECOVERY_VERSION,
        savedAt: Date.now(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function consumeProductSubmissionRecovery(
  productId: string,
): ProductSubmissionRecovery | null {
  if (typeof window === "undefined") return null;

  const storage = getBrowserStorage("session");
  if (!storage) return null;

  const key = getProductSubmissionRecoveryKey(productId);
  let rawRecovery: string | null;
  try {
    rawRecovery = storage.getItem(key);
  } catch {
    return null;
  }
  if (!rawRecovery) return null;

  try {
    storage.removeItem(key);
  } catch {
    // A denied cleanup must not hide an otherwise valid recovery payload.
  }

  try {
    const recovery = JSON.parse(rawRecovery) as unknown;
    if (!isProductSubmissionRecovery(recovery)) return null;
    if (Date.now() - recovery.savedAt > SUBMISSION_RECOVERY_MAX_AGE_MS) return null;
    return recovery;
  } catch {
    return null;
  }
}

export function readProductDraft(storageKey: string): RecoverableProductDraft | null {
  if (typeof window === "undefined") return null;

  const storage = getBrowserStorage("local");
  if (!storage) return null;

  let rawDraft: string | null;
  try {
    rawDraft = storage.getItem(storageKey);
  } catch {
    return null;
  }
  if (!rawDraft) return null;

  try {
    const draft = JSON.parse(rawDraft) as RecoverableProductDraft;
    if (
      draft.version !== DRAFT_VERSION ||
      !Number.isFinite(draft.savedAt) ||
      Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS
    ) {
      removeStorageItem(storage, storageKey);
      return null;
    }
    return draft;
  } catch {
    removeStorageItem(storage, storageKey);
    return null;
  }
}

export function writeProductDraft(storageKey: string, draft: RecoverableProductDraft) {
  if (typeof window === "undefined") return false;
  const storage = getBrowserStorage("local");
  if (!storage) return false;

  try {
    storage.setItem(storageKey, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearProductDraft(storageKey: string | null) {
  if (typeof window === "undefined" || !storageKey) return false;
  const storage = getBrowserStorage("local");
  return storage ? removeStorageItem(storage, storageKey) : false;
}

export function hasRecoverableProductDraft(draft: RecoverableProductDraft) {
  return Boolean(
    draft.productName.trim() ||
    draft.brand.trim() ||
    draft.location?.trim() ||
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

function getProductSubmissionRecoveryKey(productId: string) {
  return `zogular:product-submission-recovery:v${SUBMISSION_RECOVERY_VERSION}:${productId}`;
}

export function getProductSubmissionRecoveryHref(
  productId: string,
  hint: ProductSubmissionRecoveryHint,
) {
  return `/seller/products/${encodeURIComponent(productId)}/edit?${PRODUCT_SUBMISSION_RECOVERY_QUERY_PARAM}=${hint}`;
}

export function parseProductSubmissionRecoveryHint(
  value: string | null,
): ProductSubmissionRecoveryHint | null {
  return value === "content-policy" ||
    value === "snapshot-conflict" ||
    value === "submit-failed"
    ? value
    : null;
}

function isProductSubmissionRecovery(value: unknown): value is ProductSubmissionRecovery {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const record = value as Record<string, unknown>;
  if (
    record.version !== SUBMISSION_RECOVERY_VERSION ||
    typeof record.savedAt !== "number" ||
    !Number.isFinite(record.savedAt)
  ) {
    return false;
  }

  if (record.kind === "snapshot-conflict") return true;
  if (record.kind !== "content-policy" || !Array.isArray(record.issues) || !record.issues.length) {
    return false;
  }

  return restoreProductContentPolicyIssues(
    record.issues as StoredProductContentPolicyIssue[],
  ).length > 0;
}

function getBrowserStorage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function removeStorageItem(storage: Storage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
