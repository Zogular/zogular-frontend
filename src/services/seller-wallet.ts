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
  pendingBalance: 2300,
  availableBalance: 8450,
  totalSales: 58000,
  totalWithdrawn: 45000,
  totalCommissionPaid: 5800,
  totalPayoutFeesPaid: 48,
  paymentProcessingFeesAbsorbed: 940,
  totalRefunds: 510,
};

const METHODS: PayoutMethod[] = [
  { id: "pm-1", type: "mobile_money", provider: "MTN Mobile Money", accountName: "Zogular Store", maskedAccount: "******1111", accountNumber: "+260971111111", isDefault: true },
  { id: "pm-2", type: "mobile_money", provider: "Airtel Money", accountName: "Zogular Store", maskedAccount: "******2222", accountNumber: "+260972222222", isDefault: false },
];

const HISTORY: PayoutTransaction[] = [
  buildPayout("WD-8892", 4500, "successful", "MTN Mobile Money", "2026-04-10T09:00:00Z", "2026-04-10T11:30:00Z"),
  buildPayout("WD-8891", 1200, "pending", "MTN Mobile Money", "2026-04-15T14:20:00Z", null),
  buildPayout("WD-8885", 8500, "failed", "Zanaco Bank", "2026-03-28T10:00:00Z", null, "Invalid account routing number."),
  buildPayout("WD-8880", 3200, "successful", "MTN Mobile Money", "2026-03-15T08:15:00Z", "2026-03-15T09:45:00Z"),
];

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

function buildPayout(
  id: string,
  amount: number,
  status: PayoutStatus,
  method: string,
  requestedAt: string,
  paidAt: string | null,
  failureReason?: string,
): PayoutTransaction {
  const quote = calculatePayoutQuote(amount);
  return {
    id,
    reference: `REF-${id}`,
    requestedAmount: quote.requestedAmount,
    withdrawalFee: quote.withdrawalFee,
    sellerReceives: quote.sellerReceives,
    status,
    method,
    requestedAt,
    paidAt,
    provider: {
      providerName: DEFAULT_PLATFORM_FINANCE_CONFIG.paymentProvider.activeProvider,
      providerTransactionId: `payout-${id}`,
      providerReference: `REF-${id}`,
      providerStatus: status === "successful" ? "successful" : status === "failed" ? "failed" : "pending",
    },
    failureReason,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
