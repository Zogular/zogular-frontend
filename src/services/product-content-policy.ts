import { ApiError } from "@/services/api";

export const PRODUCT_CONTENT_POLICY_ERROR_CODE = "CONTENT_POLICY_VIOLATION" as const;
export const PRODUCT_CONTENT_POLICY_GUIDANCE =
  "Remove phone numbers, email addresses, social handles, links, or messaging-app details." as const;
export const PRODUCT_SNAPSHOT_CONFLICT_GUIDANCE =
  "This product changed while the action was in progress. Reload the latest version, review it, and try again." as const;

export const PRODUCT_CONTENT_POLICY_REASON_CODES = [
  "CONTACT_PHONE_ZM",
  "CONTACT_PHONE_INTERNATIONAL",
  "CONTACT_PHONE_OBFUSCATED",
  "CONTACT_EMAIL",
  "CONTACT_EMAIL_OBFUSCATED",
  "EXTERNAL_URL",
  "MESSAGING_WHATSAPP",
  "MESSAGING_TELEGRAM",
  "MESSAGING_EXTERNAL_OTHER",
  "SOCIAL_DOMAIN",
  "SOCIAL_HANDLE",
  "QR_EXTERNAL_DESTINATION",
  "OCR_CONTACT_TEXT",
  "UNICODE_EVASION",
] as const;

const CONTENT_POLICY_TARGETS = {
  title: { label: "Product name", targetId: "product-title" },
  description: { label: "Description", targetId: "product-description" },
  location: { label: "Product location", targetId: "product-location" },
  brand: { label: "Brand", targetId: "product-brand" },
  sku: { label: "SKU", targetId: "product-sku" },
  seoTitle: { label: "SEO title", targetId: "product-seo-title" },
  seoDescription: { label: "SEO description", targetId: "product-seo-description" },
  dimensions: { label: "Dimensions", targetId: "product-dimensions-length" },
  model: { label: "Model specification", targetId: "product-legacy-model" },
  ram: { label: "RAM specification", targetId: "product-legacy-ram" },
  storage: { label: "Storage specification", targetId: "product-legacy-storage" },
  batteryHealth: {
    label: "Battery specification",
    targetId: "product-legacy-batteryHealth",
  },
  size: { label: "Size specification", targetId: "product-legacy-size" },
  color: { label: "Color specification", targetId: "product-legacy-color" },
  material: { label: "Material specification", targetId: "product-legacy-material" },
  compatibility: {
    label: "Compatibility specification",
    targetId: "product-legacy-compatibility",
  },
} as const;

export type ProductContentPolicyField = keyof typeof CONTENT_POLICY_TARGETS;

export type ProductContentPolicyIssue = Readonly<{
  field: string;
  label: string;
  targetId: string;
  productId?: string;
}>;

export type StoredProductContentPolicyIssue = Readonly<{
  field: string;
  productId?: string;
}>;

type UnknownRecord = Record<string, unknown>;

const PRODUCT_CONTENT_POLICY_REASON_CODE_SET = new Set<string>(
  PRODUCT_CONTENT_POLICY_REASON_CODES,
);
const PRODUCT_CONTENT_POLICY_TOP_LEVEL_FIELDS = new Set<string>(
  Object.keys(CONTENT_POLICY_TARGETS),
);
const PRODUCT_CONTENT_POLICY_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_CONTENT_POLICY_IMAGE_FIELD_PATTERN =
  /^images\[(0|[1-9]\d*)]\.(alt|linkedVariantValue)$/;
const PRODUCT_CONTENT_POLICY_ATTRIBUTE_FIELD_PATTERN =
  /^attributes\[(0|[1-9]\d*)]\.(name|value)$/;

export function parseProductContentPolicyError(
  error: unknown,
): readonly ProductContentPolicyIssue[] | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;

  const details = asRecord(error.details);
  if (details?.code !== PRODUCT_CONTENT_POLICY_ERROR_CODE) return null;

  const errors = details.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;

  const parsed = errors.map(parseFinding);
  if (parsed.some((issue) => issue === null)) return null;

  return deduplicateIssues(parsed as ProductContentPolicyIssue[]);
}

export function isProductSnapshotConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function storeSafeProductContentPolicyIssues(
  issues: readonly ProductContentPolicyIssue[],
): readonly StoredProductContentPolicyIssue[] {
  const stored = issues.map(({ field, productId }) => {
    if (!isValidProductContentPolicyField(field)) return null;
    if (productId !== undefined && !isValidProductId(productId)) return null;

    return {
      field,
      ...(productId ? { productId } : {}),
    } satisfies StoredProductContentPolicyIssue;
  });

  if (stored.some((issue) => issue === null)) return [];
  return stored as StoredProductContentPolicyIssue[];
}

export function restoreProductContentPolicyIssues(
  issues: readonly StoredProductContentPolicyIssue[],
): readonly ProductContentPolicyIssue[] {
  if (!Array.isArray(issues) || issues.length === 0) return [];

  const restored = issues.map((issue) => {
    const record = asRecord(issue);
    if (!record || Object.keys(record).some((key) => key !== "field" && key !== "productId")) {
      return null;
    }

    const field = record.field;
    const productId = record.productId;
    if (typeof field !== "string" || !isValidProductContentPolicyField(field)) return null;
    if (productId !== undefined && (typeof productId !== "string" || !isValidProductId(productId))) {
      return null;
    }

    return createIssue(field, productId as string | undefined);
  });

  if (restored.some((issue) => issue === null)) return [];
  return deduplicateIssues(restored as ProductContentPolicyIssue[]);
}

export function focusProductContentPolicyIssue(
  issue: ProductContentPolicyIssue,
  root: Document = document,
): boolean {
  const target = issue.targetId === "product-content-policy-feedback"
    ? Array.from(root.querySelectorAll<HTMLElement>("[data-testid='product-content-policy-feedback']"))
        .find((candidate) => candidate.getClientRects().length > 0)
    : root.getElementById(issue.targetId);
  if (!(target instanceof HTMLElement)) return false;

  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.focus({ preventScroll: true });
  return true;
}

export function getLegacyProductContentTargetId(
  specificationName: string,
): string | undefined {
  const normalized = normalizeLabel(specificationName);
  const field = LEGACY_SPECIFICATION_FIELDS.find(({ aliases }) =>
    aliases.includes(normalized),
  )?.field;

  return field ? CONTENT_POLICY_TARGETS[field].targetId : undefined;
}

function parseFinding(value: unknown): ProductContentPolicyIssue | null {
  const finding = asRecord(value);
  if (!finding) return null;

  if (
    typeof finding.code !== "string" ||
    !PRODUCT_CONTENT_POLICY_REASON_CODE_SET.has(finding.code) ||
    finding.severity !== "BLOCK" ||
    finding.source !== "TEXT"
  ) return null;

  const parsedField = parseProductContentPolicyField(finding.field);
  return parsedField ? createIssue(parsedField.field, parsedField.productId) : null;
}

function createIssue(field: string, productId?: string): ProductContentPolicyIssue {
  const imageMatch = /^images\[(\d+)]\.(alt|linkedVariantValue)$/.exec(field);
  if (imageMatch) {
    const imageNumber = Number(imageMatch[1]) + 1;
    const isAlt = imageMatch[2] === "alt";
    return {
      field,
      label: `Image ${imageNumber} ${isAlt ? "alt text" : "variant tag"}`,
      targetId: `product-image-${imageMatch[1]}-${isAlt ? "alt" : "variant"}`,
      ...(productId ? { productId } : {}),
    };
  }

  const attributeMatch = /^attributes\[(\d+)]\.(name|value)$/.exec(field);
  if (attributeMatch) {
    return {
      field,
      label: `Category detail ${Number(attributeMatch[1]) + 1}`,
      targetId: `product-attribute-${attributeMatch[1]}`,
      ...(productId ? { productId } : {}),
    };
  }

  const target = CONTENT_POLICY_TARGETS[field as ProductContentPolicyField];
  if (target) {
    return {
      field,
      ...target,
      ...(productId ? { productId } : {}),
    };
  }

  return {
    field,
    label: "Listing content",
    targetId: "product-content-policy-feedback",
    ...(productId ? { productId } : {}),
  };
}

function parseProductContentPolicyField(
  value: unknown,
): { field: string; productId?: string } | null {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) return null;
  if (isValidProductContentPolicyField(value)) return { field: value };

  const bulkMatch = /^products\.([^.]+)\.(.+)$/.exec(value);
  if (!bulkMatch || !isValidProductId(bulkMatch[1]) || !isValidProductContentPolicyField(bulkMatch[2])) {
    return null;
  }

  return { productId: bulkMatch[1], field: bulkMatch[2] };
}

function isValidProductContentPolicyField(field: string): boolean {
  if (PRODUCT_CONTENT_POLICY_TOP_LEVEL_FIELDS.has(field)) return true;

  const indexedMatch =
    PRODUCT_CONTENT_POLICY_IMAGE_FIELD_PATTERN.exec(field) ??
    PRODUCT_CONTENT_POLICY_ATTRIBUTE_FIELD_PATTERN.exec(field);
  if (!indexedMatch) return false;

  const index = Number(indexedMatch[1]);
  return Number.isSafeInteger(index) && index >= 0;
}

function isValidProductId(value: string): boolean {
  return PRODUCT_CONTENT_POLICY_UUID_PATTERN.test(value);
}

function deduplicateIssues(
  issues: readonly ProductContentPolicyIssue[],
): readonly ProductContentPolicyIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.productId ?? ""}:${issue.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split("-")
    .join(" ")
    .split("_")
    .join(" ")
    .split(" ")
    .filter(Boolean)
    .join(" ");
}

const LEGACY_SPECIFICATION_FIELDS: ReadonlyArray<{
  field: Extract<
    ProductContentPolicyField,
    | "model"
    | "ram"
    | "storage"
    | "batteryHealth"
    | "size"
    | "color"
    | "material"
    | "compatibility"
  >;
  aliases: readonly string[];
}> = [
  { field: "model", aliases: ["model"] },
  { field: "ram", aliases: ["ram", "memory"] },
  { field: "storage", aliases: ["storage", "capacity"] },
  {
    field: "batteryHealth",
    aliases: ["battery health", "battery", "battery capacity"],
  },
  { field: "size", aliases: ["size", "shoe size"] },
  { field: "color", aliases: ["color", "colour"] },
  { field: "material", aliases: ["material"] },
  { field: "compatibility", aliases: ["compatibility"] },
];
