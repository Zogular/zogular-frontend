import { z } from "zod";

export const SAFE_ADMIN_ERROR_CONTRACT_VERSION = 1 as const;

export const SafeAdminErrorKindSchema = z.enum([
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "validation",
  "timeout",
  "unavailable",
  "malformed",
  "unknown",
]);

export const SafeAdminErrorSchema = z
  .strictObject({
    version: z.literal(SAFE_ADMIN_ERROR_CONTRACT_VERSION),
    kind: SafeAdminErrorKindSchema,
    status: z.number().int().min(400).max(599).nullable(),
    title: z.string().min(1).max(80),
    message: z.string().min(1).max(240),
    action: z.enum([
      "sign_in",
      "request_access",
      "go_back",
      "review_input",
      "retry",
      "contact_support",
      "none",
    ]),
    retryEligible: z.boolean(),
  })
  .superRefine((value, context) => {
    const retryable = value.kind === "timeout" || value.kind === "unavailable";
    if (value.retryEligible !== retryable) {
      context.addIssue({
        code: "custom",
        path: ["retryEligible"],
        message: "Only timeout and unavailable errors can be retried safely.",
      });
    }
  });

export type SafeAdminErrorKind = z.infer<typeof SafeAdminErrorKindSchema>;
export type SafeAdminError = z.infer<typeof SafeAdminErrorSchema>;
