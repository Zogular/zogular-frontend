/**
 * @file admin-finance.ts
 * @module features/admin-finance/api
 * @description
 * Typed API clients for Zogular Admin Finance, Treasury & MoMo Settlement Operations.
 * Interacts with /admin/finance endpoints (summary, payouts, status mutations, ledger).
 * Provides graceful fallback handling if backend is running in development/mock fallback mode.
 */

import { apiClient } from "@/services/api";
import type {
  AdminLedgerRecord,
  AdminPayoutRecord,
  PayoutStatus,
  TreasuryMetrics,
} from "../types";

const FINANCE_ENDPOINT = "/admin/finance";

// ============================================================================
// Response Shapes
// ============================================================================

interface TreasurySummaryResponse {
  data?: TreasuryMetrics;
  metrics?: TreasuryMetrics;
  totalEscrowHeld?: number;
  netCommissionEarned?: number;
  pendingDisbursements?: number;
  collectedCodTotal?: number;
  activeSellersCount?: number;
}

interface PayoutsListResponse {
  data?: {
    payouts?: AdminPayoutRecord[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
  payouts?: AdminPayoutRecord[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface LedgerListResponse {
  data?: {
    transactions?: AdminLedgerRecord[];
    pagination?: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
  transactions?: AdminLedgerRecord[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Retrieves platform treasury summary metrics.
 * Calls GET /admin/finance/summary.
 */
export async function fetchTreasurySummary(): Promise<TreasuryMetrics> {
  const response = await apiClient<TreasurySummaryResponse>(
    `${FINANCE_ENDPOINT}/summary`,
    {
      method: "GET",
    }
  );

  if (response.data) {
    return response.data;
  }
  if (response.metrics) {
    return response.metrics;
  }

  return {
    totalEscrowHeld: response.totalEscrowHeld ?? 0,
    netCommissionEarned: response.netCommissionEarned ?? 0,
    pendingDisbursements: response.pendingDisbursements ?? 0,
    collectedCodTotal: response.collectedCodTotal ?? 0,
    activeSellersCount: response.activeSellersCount ?? 0,
  };
}

/**
 * Retrieves paginated, filtered admin payout requests.
 * Calls GET /admin/finance/payouts.
 */
export async function fetchPayoutRequests(query: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
} = {}): Promise<{
  payouts: AdminPayoutRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
}> {
  const normalizedQuery: Record<string, string | number | boolean | null | undefined> = {
    page: query.page,
    limit: query.limit,
    status: query.status,
    search: query.search?.trim() || undefined,
  };

  const response = await apiClient<PayoutsListResponse>(
    `${FINANCE_ENDPOINT}/payouts`,
    {
      method: "GET",
      query: normalizedQuery,
    }
  );

  const payouts = response.data?.payouts ?? response.payouts ?? [];
  const pagination = response.data?.pagination ?? response.pagination ?? {
    total: payouts.length,
    page: query.page || 1,
    limit: query.limit || 12,
    pages: Math.max(1, Math.ceil(payouts.length / (query.limit || 12))),
  };

  return {
    payouts,
    pagination,
  };
}

/**
 * Updates a payout request's status, telco reference, or operational notes.
 * Calls PATCH /admin/finance/payouts/${payoutId}/status with CSRF token authentication.
 */
export async function updatePayoutStatus(
  payoutId: string,
  payload: {
    status: PayoutStatus;
    reference?: string;
    notes: string;
  }
): Promise<void> {
  await apiClient<void>(`${FINANCE_ENDPOINT}/payouts/${payoutId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    csrf: true,
  });
}

/**
 * Retrieves auditable ledger transactions.
 * Calls GET /admin/finance/ledger.
 */
export async function fetchLedgerTransactions(query: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<{
  transactions: AdminLedgerRecord[];
  pagination: { total: number; page: number; limit: number; pages: number };
}> {
  const normalizedQuery: Record<string, string | number | boolean | null | undefined> = {
    page: query.page,
    limit: query.limit,
    search: query.search?.trim() || undefined,
  };

  const response = await apiClient<LedgerListResponse>(
    `${FINANCE_ENDPOINT}/ledger`,
    {
      method: "GET",
      query: normalizedQuery,
    }
  );

  const transactions =
    response.data?.transactions ?? response.transactions ?? [];
  const pagination = response.data?.pagination ?? response.pagination ?? {
    total: transactions.length,
    page: query.page || 1,
    limit: query.limit || 12,
    pages: Math.max(1, Math.ceil(transactions.length / (query.limit || 12))),
  };

  return {
    transactions,
    pagination,
  };
}
