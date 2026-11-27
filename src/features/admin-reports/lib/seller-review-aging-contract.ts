import { z } from "zod";

export const ADMIN_SELLER_REVIEW_AGING_CONTRACT_VERSION =
  "admin-seller-review-aging-v1" as const;

export const SELLER_REVIEW_AGING_SCOPE =
  "marketplace_current_submitted_seller_applications" as const;

export const SELLER_REVIEW_AGING_CLOCK = "utc_elapsed_instants" as const;

const nonNegativeInt = z.number().int().min(0);

export const adminSellerReviewAgingBandsSchema = z
  .object({
    under24Hours: nonNegativeInt,
    hours24To72: nonNegativeInt,
    hours72To168: nonNegativeInt,
    over168Hours: nonNegativeInt,
  })
  .strict();

export const adminSellerReviewAgingReportSchema = z
  .object({
    contractVersion: z.literal(ADMIN_SELLER_REVIEW_AGING_CONTRACT_VERSION),
    asOf: z.string().datetime({ offset: true }),
    scope: z.literal(SELLER_REVIEW_AGING_SCOPE),
    clock: z.literal(SELLER_REVIEW_AGING_CLOCK),
    total: nonNegativeInt,
    bands: adminSellerReviewAgingBandsSchema,
    ageUnavailable: nonNegativeInt,
  })
  .strict()
  .refine(
    (value) =>
      value.total ===
      value.bands.under24Hours +
        value.bands.hours24To72 +
        value.bands.hours72To168 +
        value.bands.over168Hours +
        value.ageUnavailable,
    {
      message: "Seller review aging total does not match the sum of bands.",
    },
  );

export const adminSellerReviewAgingResponseSchema = z
  .object({
    status: z.literal("success"),
    data: z
      .object({
        report: adminSellerReviewAgingReportSchema,
      })
      .strict(),
  })
  .strict();

export type AdminSellerReviewAgingReport = z.infer<
  typeof adminSellerReviewAgingReportSchema
>;

export class AdminSellerReviewAgingContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminSellerReviewAgingContractError";
  }
}

export function parseAdminSellerReviewAgingResponse(
  payload: unknown,
): AdminSellerReviewAgingReport {
  const parsed = adminSellerReviewAgingResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AdminSellerReviewAgingContractError(
      "Seller review aging report response is invalid.",
    );
  }
  return parsed.data.data.report;
}

export function formatLusakaTimestamp(asOfIso: string): string {
  const date = new Date(asOfIso);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }
  const formatted = new Intl.DateTimeFormat("en-ZM", {
    timeZone: "Africa/Lusaka",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(date);
  return `${formatted} CAT (Africa/Lusaka)`;
}
