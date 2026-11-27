import { z } from "zod";

// A5 keeps the live product projection distinct from the proposed catalog fields.
const version = z.int32().nonnegative();
const reviewedFields = z.strictObject({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20).max(5000),
  price: z.number().min(1),
  salePrice: z.number().nonnegative().nullable(),
});

export const listingRevisionSubmissionSchema = z.strictObject({
  baseVersion: version,
  submissionKey: z.uuid().transform((key) => key.toLowerCase()),
  changes: reviewedFields.partial().refine((changes) =>
    Object.values(changes).some((value) => value !== undefined)),
});
export const listingRevisionDecisionSchema = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("approve") }),
  z.strictObject({ decision: z.literal("needs_changes"), reason: z.string().trim().min(1).max(500) }),
]);
export const listingCategoryRemediationSchema = z.strictObject({
  baseVersion: version,
  confirmTakeOffline: z.literal(true),
});
export const listingRevisionQueueQuerySchema = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

const liveProduct = z.strictObject({
  id: z.uuid(),
  listingVersion: version,
  title: z.string(),
  description: z.string(),
  price: z.number(),
  salePrice: z.number().nullable(),
});
const revisionIdentity = z.strictObject({
  id: z.uuid(),
  productId: z.uuid(),
  baseVersion: version,
  createdAt: z.iso.datetime(),
});
const revision = revisionIdentity.extend({
  payload: reviewedFields.extend({ schemaVersion: z.literal(1) }),
  status: z.enum(["PENDING_REVIEW", "APPROVED", "NEEDS_CHANGES", "WITHDRAWN"]),
  sellerVisibleReason: z.string().nullable(),
  decidedAt: z.iso.datetime().nullable(),
});

export const listingRevisionProjections = {
  sellerHistory: z.strictObject({ product: liveProduct, revisions: z.array(revision).max(20) }),
  mutation: z.strictObject({ revision }),
  remediation: z.strictObject({ product: liveProduct.extend({ status: z.literal("DRAFT") }) }),
  adminDetail: z.strictObject({ product: liveProduct, revision }),
  adminQueue: z.strictObject({
    items: z.array(revisionIdentity.extend({
      status: z.literal("PENDING_REVIEW"),
      product: liveProduct.pick({ title: true, listingVersion: true }),
    })).max(50),
    nextCursor: z.uuid().nullable(),
  }),
};

export type ListingRevisionSubmission = z.input<typeof listingRevisionSubmissionSchema>;
export type ListingRevisionDecision = z.input<typeof listingRevisionDecisionSchema>;
export type ListingCategoryRemediation = z.input<typeof listingCategoryRemediationSchema>;
export type ListingRevisionQueueQuery = z.input<typeof listingRevisionQueueQuerySchema>;
export type ListingRevision = z.output<typeof revision>;
