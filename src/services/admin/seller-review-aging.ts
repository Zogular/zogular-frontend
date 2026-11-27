import { apiClient } from "@/services/api";
import {
  toSafeAdminFetchError,
  type SafeAdminError,
} from "@/features/admin-platform";
import {
  AdminSellerReviewAgingContractError,
  parseAdminSellerReviewAgingResponse,
  type AdminSellerReviewAgingReport,
} from "@/features/admin-reports/lib/seller-review-aging-contract";

const SELLER_REVIEW_AGING_ENDPOINT = "/admin/reports/seller-review-aging";

export async function fetchAdminSellerReviewAgingReport(
  signal?: AbortSignal,
): Promise<AdminSellerReviewAgingReport> {
  const payload = await apiClient<unknown>(SELLER_REVIEW_AGING_ENDPOINT, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  return parseAdminSellerReviewAgingResponse(payload);
}

export function getAdminReportSafeError(error: unknown): SafeAdminError {
  if (error instanceof AdminSellerReviewAgingContractError) {
    return {
      version: 1,
      kind: "malformed",
      status: null,
      title: "Report unavailable",
      message: "Seller review aging report is temporarily unavailable.",
      action: "retry",
      retryEligible: true,
    };
  }
  return toSafeAdminFetchError(error);
}
