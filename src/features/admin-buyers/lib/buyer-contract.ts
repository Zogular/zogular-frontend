/**
 * @file buyer-contract.ts
 * @module features/admin-buyers/lib
 * @description
 * Runtime Zod validation schemas, contract error classes, and display normalization helpers
 * for Customer Management (CM-F1).
 *
 * Contract Guarantees:
 * 1. Rejection of non-CUSTOMER records: Ensures vendors, admins, and operations records are never
 *    mistakenly parsed or presented as customers.
 * 2. Distinction between omitted restricted fields and actual null values:
 *    - `firstName === undefined` / `lastName === undefined` -> identity masked by role policy.
 *    - `email === undefined` / `telephone === undefined` -> contact masked by role policy.
 *    - `telephone === null` -> telephone was not provided by user, but contact fields are accessible.
 * 3. Enforces valid positive pagination boundaries, timestamps, and status flags.
 */

import { z } from "zod";
import type {
  AdminBuyerRecord,
  AdminBuyerDetailRecord,
  AdminBuyerListResponse,
  AdminBuyerDetailResponse,
} from "../types/admin-buyer.types";

export type AdminBuyerContractErrorKind =
  | "malformed"
  | "non_customer"
  | "unavailable"
  | "network";

export class AdminBuyerContractError extends Error {
  readonly kind: AdminBuyerContractErrorKind;
  readonly details?: unknown;

  constructor(
    message: string,
    kind: AdminBuyerContractErrorKind = "malformed",
    details?: unknown,
  ) {
    super(message);
    this.name = "AdminBuyerContractError";
    this.kind = kind;
    this.details = details;
  }
}

/**
 * Base record schema for a customer user.
 * Enforces strict key policy to reject unexpected expanded fields at the record boundary.
 */
export const adminBuyerRecordSchema = z
  .object({
    id: z.string().min(1, "Customer ID must not be empty"),
    role: z.literal("CUSTOMER", {
      error: "Record is not a CUSTOMER account",
    }),
    isActive: z.boolean(),
    emailVerified: z.boolean(),
    phoneVerified: z.boolean(),
    emailVerifiedAt: z.string().datetime().nullable().optional(),
    phoneVerifiedAt: z.string().datetime().nullable().optional(),
    createdAt: z.string().datetime({ message: "createdAt must be an ISO 8601 timestamp" }),
    updatedAt: z.string().datetime({ message: "updatedAt must be an ISO 8601 timestamp" }),
    mustChangePassword: z.boolean().optional(),

    // Omitted if actor lacks view_user_sensitive_fields
    firstName: z.string().optional(),
    lastName: z.string().optional(),

    // Omitted if actor lacks view_user_sensitive_fields; telephone can be null if not provided
    email: z.string().optional(),
    telephone: z.string().nullable().optional(),
  })
  .strict()
  .refine(
    (record) => {
      // Sensitive field shape parity:
      // If firstName is present, lastName should be present (or both omitted)
      const hasFirst = record.firstName !== undefined;
      const hasLast = record.lastName !== undefined;
      return (hasFirst && hasLast) || (!hasFirst && !hasLast);
    },
    {
      message: "Partial identity sensitive field shape is invalid; both names must be provided or omitted together",
    },
  )
  .refine(
    (record) => {
      // If email is present, telephone must be present (string or null). If email is omitted, telephone must be omitted.
      const hasEmail = record.email !== undefined;
      const hasPhone = record.telephone !== undefined;
      return (hasEmail && hasPhone) || (!hasEmail && !hasPhone);
    },
    {
      message: "Partial contact sensitive field shape is invalid; email and telephone must be provided or omitted together",
    },
  );

export const adminBuyersPaginationSchema = z
  .object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    pages: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (p) => {
      if (p.total === 0) {
        return p.pages === 0;
      }
      return p.pages === Math.ceil(p.total / p.limit);
    },
    {
      message: "Pagination pages count is inconsistent with total and limit (pages must be 0 when total is 0)",
    },
  );

export const adminBuyerListResponseSchema = z
  .object({
    status: z.literal("success"),
    results: z.number().int().nonnegative().optional(),
    pagination: adminBuyersPaginationSchema,
    data: z
      .object({
        users: z.array(adminBuyerRecordSchema),
      })
      .strict(),
  })
  .strict()
  .refine(
    (res) => {
      const resultsCount = res.results ?? res.data.users.length;
      return resultsCount === res.data.users.length;
    },
    {
      message: "List response results field does not match data.users array length",
    },
  );

export const adminBuyerDetailRecordSchema = adminBuyerRecordSchema.extend({
  createdBy: z.string().nullable().optional(),
  investorId: z.string().nullable().optional(),
}).strict();

export const adminBuyerDetailResponseSchema = z
  .object({
    status: z.literal("success"),
    data: z
      .object({
        user: adminBuyerDetailRecordSchema,
      })
      .strict(),
  })
  .strict();

/**
 * Validates raw backend response for customer list.
 */
export function validateBuyerListResponse(raw: unknown): AdminBuyerListResponse {
  if (!raw || typeof raw !== "object") {
    throw new AdminBuyerContractError("Invalid response envelope received from server", "malformed");
  }

  // Pre-check for non-customer accounts if raw has users array
  const rawObj = raw as Record<string, unknown>;
  const dataObj = rawObj.data as Record<string, unknown> | undefined;
  if (dataObj && Array.isArray(dataObj.users)) {
    const nonCustomer = dataObj.users.find(
      (u: unknown) => u && typeof u === "object" && (u as Record<string, unknown>).role !== "CUSTOMER",
    );
    if (nonCustomer) {
      throw new AdminBuyerContractError(
        `Received non-CUSTOMER record in customer list (role: ${(nonCustomer as Record<string, unknown>).role})`,
        "non_customer",
      );
    }
  }

  const result = adminBuyerListResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new AdminBuyerContractError(
      `Customer list response validation failed: ${result.error.issues.map((i) => i.message).join("; ")}`,
      "malformed",
      result.error.issues,
    );
  }

  return {
    status: result.data.status,
    results: result.data.results ?? result.data.data.users.length,
    pagination: result.data.pagination,
    data: {
      users: result.data.data.users as AdminBuyerRecord[],
    },
  };
}

/**
 * Validates raw backend response for customer detail.
 */
export function validateBuyerDetailResponse(raw: unknown): AdminBuyerDetailResponse {
  if (!raw || typeof raw !== "object") {
    throw new AdminBuyerContractError("Invalid response envelope received from server", "malformed");
  }

  const rawObj = raw as Record<string, unknown>;
  const dataObj = rawObj.data as Record<string, unknown> | undefined;
  if (dataObj && dataObj.user && typeof dataObj.user === "object") {
    const userRole = (dataObj.user as Record<string, unknown>).role;
    if (userRole !== "CUSTOMER") {
      throw new AdminBuyerContractError(
        `User is not a CUSTOMER account (role: ${String(userRole)})`,
        "non_customer",
      );
    }
  }

  const result = adminBuyerDetailResponseSchema.safeParse(raw);
  if (!result.success) {
    throw new AdminBuyerContractError(
      `Customer detail response validation failed: ${result.error.issues.map((i) => i.message).join("; ")}`,
      "malformed",
      result.error.issues,
    );
  }

  return {
    status: result.data.status,
    data: {
      user: result.data.data.user as AdminBuyerDetailRecord,
    },
  };
}

/**
 * Formatting helper: returns customer full name or honest restricted label.
 */
export function formatBuyerDisplayName(buyer: Pick<AdminBuyerRecord, "firstName" | "lastName">): string {
  const parts = [buyer.firstName, buyer.lastName].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }
  return "(Name Restricted)";
}

/**
 * Returns true if customer identity fields are omitted / masked.
 */
export function isBuyerIdentityMasked(buyer: Pick<AdminBuyerRecord, "firstName" | "lastName">): boolean {
  return buyer.firstName === undefined && buyer.lastName === undefined;
}

/**
 * Returns true if customer contact fields are omitted / masked.
 */
export function isBuyerContactMasked(buyer: Pick<AdminBuyerRecord, "email" | "telephone">): boolean {
  return buyer.email === undefined && buyer.telephone === undefined;
}
