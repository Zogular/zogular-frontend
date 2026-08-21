import { throwBackendPendingFeature } from "@/services/backend-pending";
import { type ProviderReference } from "@/services/payment-provider";
import { type SellerWalletBalances } from "@/services/platform-finance";

export type PayoutStatus = "pending" | "successful" | "failed" | "cancelled";

export interface PayoutMethod {
  id: string;
  type: "mobile_money" | "bank";
  provider: string;
  accountName: string;
  maskedAccount: string;
  accountNumber: string;
  isDefault: boolean;
}

export interface PayoutTransaction {
  id: string;
  reference: string;
  requestedAmount: number;
  withdrawalFee: number;
  sellerReceives: number;
  status: PayoutStatus;
  method: string;
  requestedAt: string;
  paidAt: string | null;
  provider: ProviderReference;
  failureReason?: string;
}

export interface SellerWalletDashboard {
  balances: SellerWalletBalances;
  history: PayoutTransaction[];
  methods: PayoutMethod[];
}

export const SELLER_WALLET_BACKEND_PENDING_NOTICE =
  "Wallet balances, payout methods, fees, and transfers are not available yet. This page does not show or move real money.";

export const sellerWalletApi = {
  async fetchDashboard(): Promise<SellerWalletDashboard> {
    throwBackendPendingFeature("Seller payout dashboard");
  },
  async requestPayout(amount: number, method: PayoutMethod): Promise<PayoutTransaction> {
    void amount;
    void method;
    throwBackendPendingFeature("Seller payout request");
  },
  async markPayoutSuccessful(payoutId: string): Promise<PayoutTransaction> {
    void payoutId;
    throwBackendPendingFeature("Seller payout success mutation");
  },
  async markPayoutFailed(payoutId: string, failureReason: string): Promise<PayoutTransaction> {
    void payoutId;
    void failureReason;
    throwBackendPendingFeature("Seller payout failure mutation");
  },
};
