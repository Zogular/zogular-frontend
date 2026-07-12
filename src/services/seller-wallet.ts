import { type SellerWalletBalances } from "@/services/platform-finance";
import { throwBackendPendingFeature } from "@/services/backend-pending";
import { type ProviderReference } from "@/services/payment-provider";

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
  "Seller wallet and payout balances are an operations-only preview. Real balances, payout methods, fees, and provider transfers require backend support.";

const WALLET: SellerWalletBalances = {
  pendingBalance: 0,
  availableBalance: 0,
  totalSales: 0,
  totalWithdrawn: 0,
  totalCommissionPaid: 0,
  totalPayoutFeesPaid: 0,
  paymentProcessingFeesAbsorbed: 0,
  totalRefunds: 0,
};

const METHODS: PayoutMethod[] = [];

const HISTORY: PayoutTransaction[] = [];

export const sellerWalletApi = {
  async fetchDashboard(): Promise<SellerWalletDashboard> {
    await delay(350);
    return {
      balances: { ...WALLET },
      history: HISTORY.map((item) => ({ ...item })),
      methods: METHODS.map((item) => ({ ...item })),
    };
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
