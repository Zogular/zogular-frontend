/**
 * @file product-list-contract.ts
 * @module features/admin-products/lib
 * @description
 * Strict Zod validation and normalization for the PR #80 bounded admin product list API.
 * Enforces pagination bounds, exact status enums, timestamp validity, and masked seller
 * field preservation without consulting seller-catalog.ts or localStorage enrichment.
 */

import { z, ZodError } from "zod";
import { ApiError } from "@/services/api";
import type {
  AdminProductBackendStatus,
  AdminProductListItem,
  AdminProductListResponse,
  AdminProductListSafeError,
  AdminProductListSeller,
} from "../types/admin-product-list.types";

export class AdminProductListContractError extends Error {
  readonly code: string;

  constructor(message: string, code = "ADMIN_PRODUCT_LIST_CONTRACT_ERROR") {
    super(message);
    this.name = "AdminProductListContractError";
    this.code = code;
  }
}

const BACKEND_STATUS_VALUES = [
  "DRAFT",
  "PENDING_REVIEW",
  "NEEDS_CHANGES",
  "APPROVED",
  "PUBLISHED",
  "PAUSED",
  "SUSPENDED",
] as const;

const BackendStatusSchema = z.enum(BACKEND_STATUS_VALUES);

const IsoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine((val) => Number.isFinite(Date.parse(val)), "Invalid ISO timestamp");

const ProductImageSchema = z.union([
  z.string().trim().min(1),
  z
    .object({
      url: z.string().trim().min(1),
      isPrimary: z.boolean().optional(),
    })
    .passthrough(),
]);

const RawSellerSchema = z
  .object({
    id: z.string().trim().min(1),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    telephone: z.string().nullable().optional(),
  })
  .passthrough();

const CategoryRefSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1),
    slug: z.string().optional(),
    parentId: z.string().nullable().optional(),
  })
  .passthrough();

const RawAdminProductSchema = z
  .object({
    id: z.string().trim().min(1),
    userId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1),
    slug: z.string().optional().default(""),
    sku: z.string().nullable().optional(),
    status: BackendStatusSchema,
    price: z.number().finite(),
    salePrice: z.number().finite().nullable().optional(),
    stock: z.number().finite().nullable().optional(),
    isSold: z.boolean().optional(),
    isApproved: z.boolean().optional(),
    category: z.string().nullable().optional(),
    categorySlug: z.string().nullable().optional(),
    subcategorySlug: z.string().nullable().optional(),
    categoryRef: CategoryRefSchema.nullable().optional(),
    images: z.array(ProductImageSchema).optional().default([]),
    user: RawSellerSchema,
    rejectionReason: z.string().nullable().optional(),
    reviewNotes: z.string().nullable().optional(),
    views: z.number().finite().optional(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
    approvedAt: IsoTimestampSchema.nullable().optional(),
  })
  .passthrough();

const PaginationSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().min(1).max(100),
  pages: z.number().int().nonnegative(),
});

const RawAdminProductListResponseSchema = z
  .object({
    status: z.literal("success"),
    results: z.number().int().nonnegative(),
    pagination: PaginationSchema,
    data: z.object({
      products: z.array(RawAdminProductSchema),
    }),
  })
  .passthrough();

function humanizeSlug(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function humanizeLegacyCategory(category?: string | null): string {
  switch (category) {
    case "PHONES":
      return "Phones & Tablets";
    case "LAPTOPS":
      return "Computing";
    case "ACCESSORIES":
      return "Accessories";
    case "FASHIONS":
      return "Fashion";
    case "ELECTRONICS":
      return "Electronics";
    default:
      return category ? humanizeSlug(category) : "Uncategorized";
  }
}

function resolvePrimaryImageUrl(
  images: ReadonlyArray<z.infer<typeof ProductImageSchema>>,
): string | null {
  if (images.length === 0) return null;
  for (const img of images) {
    if (typeof img !== "string" && img.isPrimary) {
      return img.url;
    }
  }
  const first = images[0];
  return typeof first === "string" ? first : first.url;
}

function normalizeSeller(raw: z.infer<typeof RawSellerSchema>): AdminProductListSeller {
  const hasFirst = Object.prototype.hasOwnProperty.call(raw, "firstName");
  const hasLast = Object.prototype.hasOwnProperty.call(raw, "lastName");
  const hasEmail = Object.prototype.hasOwnProperty.call(raw, "email");
  const hasTelephone = Object.prototype.hasOwnProperty.call(raw, "telephone");

  const identityMasked = !hasFirst && !hasLast;
  const contactMasked = !hasEmail && !hasTelephone;

  return {
    id: raw.id,
    firstName: raw.firstName ?? null,
    lastName: raw.lastName ?? null,
    email: raw.email ?? null,
    telephone: raw.telephone ?? null,
    identityMasked,
    contactMasked,
  };
}

function mapRawProduct(raw: z.infer<typeof RawAdminProductSchema>): AdminProductListItem {
  const categoryLabel =
    raw.categoryRef?.name ||
    (raw.categorySlug ? humanizeSlug(raw.categorySlug) : "") ||
    humanizeLegacyCategory(raw.category);

  const subcategoryLabel = raw.subcategorySlug
    ? humanizeSlug(raw.subcategorySlug)
    : null;

  return {
    id: raw.id,
    userId: raw.userId ?? raw.user.id,
    title: raw.title,
    slug: raw.slug,
    sku: raw.sku ?? null,
    status: raw.status,
    price: raw.price,
    salePrice: raw.salePrice ?? null,
    stock: raw.stock ?? null,
    isSold: raw.isSold === true,
    isApproved: raw.isApproved === true,
    categoryLabel,
    subcategoryLabel,
    primaryImageUrl: resolvePrimaryImageUrl(raw.images),
    seller: normalizeSeller(raw.user),
    rejectionReason: raw.rejectionReason ?? null,
    reviewNotes: raw.reviewNotes ?? null,
    views: raw.views ?? 0,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    approvedAt: raw.approvedAt ?? null,
  };
}

/**
 * Parses and validates the PR #80 bounded admin product list response.
 */
export function parseAdminProductListResponse(
  payload: unknown,
  options: { excludeDrafts?: boolean } = {},
): AdminProductListResponse {
  const parsed = RawAdminProductListResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AdminProductListContractError(
      `Invalid admin product list response: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
      "INVALID_ENVELOPE",
    );
  }

  const { pagination, results, data } = parsed.data;

  if (results !== data.products.length) {
    throw new AdminProductListContractError(
      "Response results count does not match products array length.",
      "RESULTS_MISMATCH",
    );
  }

  if (data.products.length > pagination.limit) {
    throw new AdminProductListContractError(
      "Returned products exceed requested pagination limit.",
      "LIMIT_EXCEEDED",
    );
  }

  const expectedPages =
    pagination.total === 0 ? 0 : Math.ceil(pagination.total / pagination.limit);
  if (pagination.pages !== expectedPages) {
    throw new AdminProductListContractError(
      "Pagination pages count does not match total and limit.",
      "PAGINATION_MISMATCH",
    );
  }

  if (options.excludeDrafts) {
    const hasDraft = data.products.some((product) => product.status === "DRAFT");
    if (hasDraft) {
      throw new AdminProductListContractError(
        "Draft product returned while excludeDrafts=true was requested.",
        "UNEXPECTED_DRAFT",
      );
    }
  }

  return {
    status: "success",
    results,
    pagination,
    items: data.products.map(mapRawProduct),
  };
}

export function formatAdminProductSellerLabel(seller: AdminProductListSeller): string {
  if (seller.identityMasked) {
    return "Masked (permission required)";
  }
  const fullName = [seller.firstName, seller.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  if (fullName) return fullName;
  return `Seller ${seller.id.slice(0, 8)}`;
}

export function formatAdminProductSellerContact(seller: AdminProductListSeller): string {
  if (seller.contactMasked) {
    return "Contact masked";
  }
  return seller.email || seller.telephone || "No contact recorded";
}

export function getAdminProductStatusBadgeMeta(status: AdminProductBackendStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "DRAFT":
      return {
        label: "Draft",
        className: "border-zinc-200 bg-zinc-100 text-zinc-700",
      };
    case "PENDING_REVIEW":
      return {
        label: "Pending Review",
        className: "border-amber-400/50 bg-amber-950 text-amber-100",
      };
    case "NEEDS_CHANGES":
      return {
        label: "Needs Changes",
        className: "border-orange-400/50 bg-orange-950 text-orange-100",
      };
    case "APPROVED":
      return {
        label: "Approved",
        className: "border-emerald-400/50 bg-emerald-950 text-emerald-100",
      };
    case "PUBLISHED":
      return {
        label: "Published",
        className: "border-[#00b358]/40 bg-[#014d2b] text-emerald-100",
      };
    case "PAUSED":
      return {
        label: "Paused",
        className: "border-amber-400/50 bg-amber-950 text-amber-100",
      };
    case "SUSPENDED":
      return {
        label: "Suspended",
        className: "border-red-400/50 bg-red-950 text-red-100",
      };
  }
}

export function getProductListSafeError(error: unknown): AdminProductListSafeError {
  if (error instanceof AdminProductListContractError || error instanceof ZodError) {
    return {
      kind: "malformed",
      message: "Product moderation data was in an unexpected format and could not be verified.",
    };
  }

  if (error instanceof ApiError) {
    if (error.status === 400) {
      return {
        kind: "malformed",
        status: 400,
        message: "Invalid filter or pagination parameters. Reset filters and try again.",
      };
    }
    if (error.status === 401) {
      return {
        kind: "unauthenticated",
        status: 401,
        message: "Your admin session has expired. Please sign in again.",
      };
    }
    if (error.status === 403) {
      return {
        kind: "forbidden",
        status: 403,
        message: "You do not have permission to view the product moderation queue.",
      };
    }
    if (error.status === 404) {
      return {
        kind: "not_found",
        status: 404,
        message: "The product moderation resource was not found.",
      };
    }
    if (error.status === 408 || error.status === 504) {
      return {
        kind: "timeout",
        status: error.status,
        message: "The server took too long to respond. Please try again.",
      };
    }
    if (error.status === 409) {
      return {
        kind: "conflict",
        status: 409,
        message: "A state conflict occurred while loading products. Please refresh.",
      };
    }
    if (error.status === 429) {
      return {
        kind: "rate_limited",
        status: 429,
        message: "Too many requests. Please wait a moment before retrying.",
      };
    }
    if (error.status >= 500) {
      return {
        kind: "unavailable",
        status: error.status,
        message: "Product moderation services are temporarily unavailable. Please retry shortly.",
      };
    }
    return {
      kind: "unavailable",
      status: error.status,
      message: error.message || "Failed to load the product moderation queue.",
    };
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return {
        kind: "timeout",
        message: "Request was cancelled.",
      };
    }
    if (error.message.toLowerCase().includes("fetch") || error.message.toLowerCase().includes("network")) {
      return {
        kind: "unavailable",
        message: "Network connection lost. Please check your connection and retry.",
      };
    }
  }

  return {
    kind: "unavailable",
    message: "An unexpected error occurred while loading the product moderation queue.",
  };
}
