import { calculatePayoutQuote, DEFAULT_PLATFORM_FINANCE_CONFIG, type SellerWalletBalances } from "@/services/platform-finance";
import { PaymentProviderService, type ProviderReference } from "@/services/payment-provider";

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
    await delay(500);

    if (amount < DEFAULT_PLATFORM_FINANCE_CONFIG.payoutFee.minimumWithdrawal) {
      throw new Error(`Minimum withdrawal is K${DEFAULT_PLATFORM_FINANCE_CONFIG.payoutFee.minimumWithdrawal.toLocaleString()}.`);
    }
    if (amount > WALLET.availableBalance) {
      throw new Error("Amount exceeds available balance.");
    }

    const id = `WD-${Date.now().toString().slice(-5)}`;
    const quote = calculatePayoutQuote(amount);
    const provider = await PaymentProviderService.createPayout({
      payoutId: id,
      amount: quote.sellerReceives,
      currency: "ZMW",
      destination: {
        type: method.type,
        provider: method.provider,
        accountName: method.accountName,
        accountNumber: method.accountNumber,
      },
    });
    const transaction: PayoutTransaction = {
      id,
      reference: provider.providerReference,
      requestedAmount: quote.requestedAmount,
      withdrawalFee: quote.withdrawalFee,
      sellerReceives: quote.sellerReceives,
      status: "pending",
      method: method.provider,
      requestedAt: new Date().toISOString(),
      paidAt: null,
      provider,
    };

    WALLET.availableBalance -= quote.requestedAmount;
    WALLET.pendingBalance += quote.requestedAmount;
    WALLET.totalWithdrawn += quote.requestedAmount;
    WALLET.totalPayoutFeesPaid += quote.withdrawalFee;
    HISTORY.unshift(transaction);
    return transaction;
  },
  async markPayoutSuccessful(payoutId: string): Promise<PayoutTransaction> {
    await delay(300);
    const transaction = getPayoutTransaction(payoutId);
    if (transaction.status === "successful") return transaction;
    transaction.status = "successful";
    transaction.paidAt = new Date().toISOString();
    WALLET.pendingBalance = Math.max(0, WALLET.pendingBalance - transaction.requestedAmount);
    return { ...transaction };
  },
  async markPayoutFailed(payoutId: string, failureReason: string): Promise<PayoutTransaction> {
    await delay(300);
    const transaction = getPayoutTransaction(payoutId);
    if (transaction.status === "failed") return transaction;
    transaction.status = "failed";
    transaction.failureReason = failureReason;
    WALLET.pendingBalance = Math.max(0, WALLET.pendingBalance - transaction.requestedAmount);
    WALLET.availableBalance += transaction.requestedAmount;
    WALLET.totalWithdrawn = Math.max(0, WALLET.totalWithdrawn - transaction.requestedAmount);
    WALLET.totalPayoutFeesPaid = Math.max(0, WALLET.totalPayoutFeesPaid - transaction.withdrawalFee);
    return { ...transaction };
  },
};

function getPayoutTransaction(payoutId: string): PayoutTransaction {
  const transaction = HISTORY.find((item) => item.id === payoutId);
  if (!transaction) throw new Error("Payout transaction not found.");
  return transaction;
}


function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
