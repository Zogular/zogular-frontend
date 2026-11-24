import { z } from "zod";
import { SafeAdminErrorSchema } from "./errors";
import { AdminFreshnessSchema } from "./freshness";

export const ADMIN_COLLECTION_CONTRACT_VERSION = 1 as const;
export const ADMIN_REQUEST_STATE_CONTRACT_VERSION = 1 as const;

const TimestampSchema = z.iso.datetime({ offset: true });
const CursorSchema = z.string().min(1).max(500);

export const AdminCollectionSortSchema = z.strictObject({
  field: z.string().min(1).max(80).regex(/^[a-z][a-zA-Z0-9]*$/),
  direction: z.enum(["asc", "desc"]),
});

export const AdminCollectionFilterSchema = z.strictObject({
  key: z.string().min(1).max(80).regex(/^[a-z][a-zA-Z0-9]*$/),
  values: z.array(z.string().min(1).max(160)).min(1).max(50),
});

export const AdminCollectionFacetSchema = z.strictObject({
  key: z.string().min(1).max(80).regex(/^[a-z][a-zA-Z0-9]*$/),
  label: z.string().min(1).max(80),
  buckets: z
    .array(
      z.strictObject({
        value: z.string().min(1).max(160),
        label: z.string().min(1).max(160),
        count: z.number().int().nonnegative(),
      }),
    )
    .max(100),
});

export const AdminCollectionPaginationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("offset"),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(200),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
  z.strictObject({
    kind: z.literal("cursor"),
    nextCursor: CursorSchema.nullable(),
    previousCursor: CursorSchema.nullable(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
]);

export const AdminCollectionTotalSchema = z.discriminatedUnion("availability", [
  z.strictObject({
    availability: z.literal("available"),
    value: z.number().int().nonnegative(),
  }),
  z.strictObject({
    availability: z.literal("unavailable"),
    reason: z.enum([
      "permission_required",
      "not_supported",
      "data_source_unavailable",
    ]),
  }),
]);

export const AdminCollectionWarningSchema = z.strictObject({
  code: z.string().min(1).max(80).regex(/^[A-Z][A-Z0-9_]*$/),
  message: z.string().min(1).max(240),
});

export function createAdminCollectionSchema<ItemSchema extends z.ZodType>(
  itemSchema: ItemSchema,
) {
  return z
    .strictObject({
      version: z.literal(ADMIN_COLLECTION_CONTRACT_VERSION),
      items: z.array(itemSchema).max(200),
      sort: z.array(AdminCollectionSortSchema).min(1).max(5),
      filters: z.array(AdminCollectionFilterSchema).max(30),
      facets: z.array(AdminCollectionFacetSchema).max(30),
      pagination: AdminCollectionPaginationSchema,
      total: AdminCollectionTotalSchema,
      generatedAt: TimestampSchema,
      completeness: z.enum(["complete", "partial"]),
      warnings: z.array(AdminCollectionWarningSchema).max(20),
    })
    .superRefine((value, context) => {
      const sortFields = value.sort.map((sort) => sort.field);
      const filterKeys = value.filters.map((filter) => filter.key);
      const facetKeys = value.facets.map((facet) => facet.key);
      if (new Set(sortFields).size !== sortFields.length) {
        context.addIssue({ code: "custom", path: ["sort"], message: "Sort fields must be unique." });
      }
      if (new Set(filterKeys).size !== filterKeys.length) {
        context.addIssue({ code: "custom", path: ["filters"], message: "Filter keys must be unique." });
      }
      if (new Set(facetKeys).size !== facetKeys.length) {
        context.addIssue({ code: "custom", path: ["facets"], message: "Facet keys must be unique." });
      }
      for (const [facetIndex, facet] of value.facets.entries()) {
        const bucketValues = facet.buckets.map((bucket) => bucket.value);
        if (new Set(bucketValues).size !== bucketValues.length) {
          context.addIssue({
            code: "custom",
            path: ["facets", facetIndex, "buckets"],
            message: "Facet bucket values must be unique within a facet.",
          });
        }
      }
      if (value.completeness === "partial" && value.warnings.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["warnings"],
          message: "Partial collections require at least one warning.",
        });
      }
      if (value.completeness === "complete" && value.warnings.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["warnings"],
          message: "Complete collections cannot contain partial-data warnings.",
        });
      }
      if (value.pagination.kind === "offset") {
        const expectedTotalPages = Math.ceil(
          value.pagination.totalItems / value.pagination.pageSize,
        );
        if (value.items.length > value.pagination.pageSize) {
          context.addIssue({
            code: "custom",
            path: ["items"],
            message: "Collection items cannot exceed the bounded page size.",
          });
        }
        if (value.items.length > value.pagination.totalItems) {
          context.addIssue({
            code: "custom",
            path: ["items"],
            message: "A page cannot contain more items than the collection total.",
          });
        }
        if (value.pagination.totalPages !== expectedTotalPages) {
          context.addIssue({
            code: "custom",
            path: ["pagination", "totalPages"],
            message: "Total pages must match total items and page size.",
          });
        }
        if (
          (expectedTotalPages === 0 && value.pagination.page !== 1) ||
          (expectedTotalPages > 0 && value.pagination.page > expectedTotalPages)
        ) {
          context.addIssue({
            code: "custom",
            path: ["pagination", "page"],
            message: "Page must be in range; an empty collection uses page one.",
          });
        }
        if (value.total.availability === "available" && value.total.value !== value.pagination.totalItems) {
          context.addIssue({
            code: "custom",
            path: ["total"],
            message: "Available total must match offset pagination metadata.",
          });
        }
      }
      if (value.pagination.kind === "cursor") {
        if (value.pagination.hasNext !== (value.pagination.nextCursor !== null)) {
          context.addIssue({
            code: "custom",
            path: ["pagination", "nextCursor"],
            message: "Next cursor presence must match hasNext.",
          });
        }
        if (value.pagination.hasPrevious !== (value.pagination.previousCursor !== null)) {
          context.addIssue({
            code: "custom",
            path: ["pagination", "previousCursor"],
            message: "Previous cursor presence must match hasPrevious.",
          });
        }
      }
    });
}

export function createAdminRequestStateSchema<DataSchema extends z.ZodType>(
  dataSchema: DataSchema,
) {
  return z.discriminatedUnion("status", [
    z.strictObject({
      version: z.literal(ADMIN_REQUEST_STATE_CONTRACT_VERSION),
      status: z.literal("idle"),
    }),
    z.strictObject({
      version: z.literal(ADMIN_REQUEST_STATE_CONTRACT_VERSION),
      status: z.literal("loading"),
    }),
    z.strictObject({
      version: z.literal(ADMIN_REQUEST_STATE_CONTRACT_VERSION),
      status: z.literal("success"),
      data: dataSchema,
      freshness: AdminFreshnessSchema,
    }),
    z.strictObject({
      version: z.literal(ADMIN_REQUEST_STATE_CONTRACT_VERSION),
      status: z.literal("empty"),
      freshness: AdminFreshnessSchema,
    }),
    z.strictObject({
      version: z.literal(ADMIN_REQUEST_STATE_CONTRACT_VERSION),
      status: z.literal("refreshing"),
      data: dataSchema,
      freshness: AdminFreshnessSchema,
    }),
    z.strictObject({
      version: z.literal(ADMIN_REQUEST_STATE_CONTRACT_VERSION),
      status: z.literal("degraded_with_data"),
      data: dataSchema,
      freshness: AdminFreshnessSchema,
      error: SafeAdminErrorSchema,
    }),
    z.strictObject({
      version: z.literal(ADMIN_REQUEST_STATE_CONTRACT_VERSION),
      status: z.literal("forbidden"),
      error: SafeAdminErrorSchema,
    }),
    z.strictObject({
      version: z.literal(ADMIN_REQUEST_STATE_CONTRACT_VERSION),
      status: z.literal("failed"),
      error: SafeAdminErrorSchema,
    }),
  ]).superRefine((value, context) => {
    if (
      value.status === "forbidden" &&
      "error" in value &&
      value.error.kind !== "forbidden"
    ) {
      context.addIssue({
        code: "custom",
        path: ["error", "kind"],
        message: "Forbidden request state requires a forbidden safe error.",
      });
    }
    if (
      value.status === "failed" &&
      "error" in value &&
      (value.error.kind === "unauthenticated" || value.error.kind === "forbidden")
    ) {
      context.addIssue({
        code: "custom",
        path: ["error", "kind"],
        message: "Authentication and authorization failures require their dedicated flow.",
      });
    }
    if (value.status === "degraded_with_data" && "freshness" in value && "error" in value) {
      if (value.freshness.status !== "degraded") {
        context.addIssue({
          code: "custom",
          path: ["freshness", "status"],
          message: "Degraded-with-data state requires degraded freshness.",
        });
      }
      if (value.error.kind === "unauthenticated" || value.error.kind === "forbidden") {
        context.addIssue({
          code: "custom",
          path: ["error", "kind"],
          message: "Degraded data cannot mask authentication or authorization failure.",
        });
      }
    }
    if (
      (value.status === "success" || value.status === "empty" || value.status === "refreshing") &&
      "freshness" in value &&
      value.freshness.status === "degraded"
    ) {
      context.addIssue({
        code: "custom",
        path: ["freshness", "status"],
        message: "Degraded freshness requires the degraded-with-data request state.",
      });
    }
  });
}

export type AdminCollectionSort = z.infer<typeof AdminCollectionSortSchema>;
export type AdminCollectionFilter = z.infer<typeof AdminCollectionFilterSchema>;
export type AdminCollectionPagination = z.infer<typeof AdminCollectionPaginationSchema>;
export type AdminCollectionTotal = z.infer<typeof AdminCollectionTotalSchema>;
