import { throwBackendPendingFeature } from "@/services/backend-pending";

export type PayoutStatus = "pending" | "processing" | "completed" | "failed" | "rejected";
export type TransactionType = "escrow_deposit" | "commission_fee" | "payout_release" | "refund_debit";

export interface TreasuryMetrics {
  totalEscrow: number;
  netRevenue: number;
  pendingPayouts: number;
  availableLiquidity: number;
}

export interface PayoutRequest {
  id: string;
  sellerId: string;
  storeName: string;
  amount: number;
  method: "MTN Mobile Money" | "Airtel Money" | "Bank Transfer";
  accountDetails: string;
  status: PayoutStatus;
  requestedAt: string;
}

export interface LedgerEntry {
  id: string;
  orderId?: string;
  type: TransactionType;
  description: string;
  amount: number;
  balanceAfter: number;
  timestamp: string;
}

const EMPTY_METRICS: TreasuryMetrics = {
  totalEscrow: 0,
  netRevenue: 0,
  pendingPayouts: 0,
  availableLiquidity: 0,
};

export const adminFinanceApi = {
  async fetchTreasuryData(): Promise<{ metrics: TreasuryMetrics, payouts: PayoutRequest[], ledger: LedgerEntry[] }> {
    return {
      metrics: { ...EMPTY_METRICS },
      payouts: [],
      ledger: []
    };
  },
  async updatePayoutStatus(payoutId: string, newStatus: "completed" | "rejected", note?: string): Promise<void> {
    void payoutId; void newStatus; void note;
    throwBackendPendingFeature("Admin payout status update");
  }
};
