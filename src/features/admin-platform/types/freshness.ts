import { z } from "zod";

export const ADMIN_FRESHNESS_CONTRACT_VERSION = 1 as const;

const TimestampSchema = z.iso.datetime({ offset: true });

export const AdminFreshnessSchema = z
  .strictObject({
    version: z.literal(ADMIN_FRESHNESS_CONTRACT_VERSION),
    generatedAt: TimestampSchema,
    lastSuccessfulAt: TimestampSchema,
    status: z.enum(["fresh", "stale", "degraded"]),
    retryEligible: z.boolean(),
  })
  .superRefine((value, context) => {
    // generatedAt is the backend snapshot time; lastSuccessfulAt is when that
    // snapshot was last accepted by the client, so the snapshot cannot be newer.
    if (Date.parse(value.generatedAt) > Date.parse(value.lastSuccessfulAt)) {
      context.addIssue({
        code: "custom",
        path: ["generatedAt"],
        message: "Generated time cannot be later than the last successful update.",
      });
    }
    const retryExpected = value.status === "stale" || value.status === "degraded";
    if (value.retryEligible !== retryExpected) {
      context.addIssue({
        code: "custom",
        path: ["retryEligible"],
        message: "Only stale or degraded data can offer a safe freshness retry.",
      });
    }
  });

export type AdminFreshness = z.infer<typeof AdminFreshnessSchema>;
