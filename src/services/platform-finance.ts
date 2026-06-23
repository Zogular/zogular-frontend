export type CommissionScope = "default" | "category";
export type FeeBearer = "platform" | "seller" | "buyer";

export interface CommissionRule {
  scope: CommissionScope;
  categorySlug?: string;
  percentage: number;
}

export interface PayoutFeeRule {
  percentage: number;
  minimumFee: number;
  maximumFee: number;
  minimumWithdrawal: number;
}

export interface PaymentProviderConfig {
  activeProvider: "flutterwave" | "pawapay";
  backupProvider: "pawapay";
  processingFeeBearer: FeeBearer;
}

export interface PlatformFinanceConfig {
  defaultCommissionPercentage: number;
  categoryCommissionRules: CommissionRule[];
  payoutFee: PayoutFeeRule;
  paymentProvider: PaymentProviderConfig;
}

export interface SellerWalletBalances {
  pendingBalance: number;
  availableBalance: number;
  totalSales: number;
  totalWithdrawn: number;
  totalCommissionPaid: number;
  totalPayoutFeesPaid: number;
  paymentProcessingFeesAbsorbed: number;
  totalRefunds: number;
}

export interface SellerOrderEarningsInput {
  productSubtotal: number;
  categorySlug?: string;
  sellerBorneAdjustments?: number;
}

export interface SellerOrderEarnings {
  productSubtotal: number;
  commission: number;
  sellerBorneAdjustments: number;
  sellerNet: number;
}

export interface PayoutQuote {
  requestedAmount: number;
  withdrawalFee: number;
  sellerReceives: number;
}

export const PLATFORM_FINANCE_PLACEHOLDER_NOTICE =
  "Frontend finance values are planning placeholders only. Commission, payout, refund, and fee truth must come from the backend before production use.";

export const DEFAULT_PLATFORM_FINANCE_CONFIG: PlatformFinanceConfig = {
  defaultCommissionPercentage: 10,
  categoryCommissionRules: [],
  payoutFee: {
    percentage: 1,
    minimumFee: 3,
    maximumFee: 15,
    minimumWithdrawal: 500,
  },
  paymentProvider: {
    activeProvider: "flutterwave",
    backupProvider: "pawapay",
    processingFeeBearer: "platform",
  },
};

let activePlatformFinanceConfig: PlatformFinanceConfig = DEFAULT_PLATFORM_FINANCE_CONFIG;

export async function getPlatformFinanceConfig(): Promise<PlatformFinanceConfig> {
  return structuredClone(activePlatformFinanceConfig);
}

export function getActivePlatformFinanceConfig(): PlatformFinanceConfig {
  return activePlatformFinanceConfig;
}

export async function updatePlatformFinanceConfig(
  nextConfig: PlatformFinanceConfig,
): Promise<PlatformFinanceConfig> {
  activePlatformFinanceConfig = structuredClone(nextConfig);
  return getPlatformFinanceConfig();
}

export function getCommissionPercentage(
  categorySlug: string | undefined,
  config: PlatformFinanceConfig = DEFAULT_PLATFORM_FINANCE_CONFIG,
): number {
  const categoryRule = config.categoryCommissionRules.find(
    (rule) => rule.scope === "category" && rule.categorySlug === categorySlug,
  );

  return categoryRule?.percentage ?? config.defaultCommissionPercentage;
}

export function calculateCommission(
  productSubtotal: number,
  categorySlug?: string,
  config: PlatformFinanceConfig = DEFAULT_PLATFORM_FINANCE_CONFIG,
): number {
  const percentage = getCommissionPercentage(categorySlug, config);
  return roundMoney(productSubtotal * (percentage / 100));
}

export function calculateSellerOrderEarnings(
  input: SellerOrderEarningsInput,
  config: PlatformFinanceConfig = DEFAULT_PLATFORM_FINANCE_CONFIG,
): SellerOrderEarnings {
  const commission = calculateCommission(input.productSubtotal, input.categorySlug, config);
  const sellerBorneAdjustments = Math.max(0, input.sellerBorneAdjustments ?? 0);

  return {
    productSubtotal: input.productSubtotal,
    commission,
    sellerBorneAdjustments,
    sellerNet: roundMoney(input.productSubtotal - commission - sellerBorneAdjustments),
  };
}

export function calculatePayoutQuote(
  amount: number,
  rule: PayoutFeeRule = DEFAULT_PLATFORM_FINANCE_CONFIG.payoutFee,
): PayoutQuote {
  const requestedAmount = Math.max(0, amount);
  const percentageFee = requestedAmount * (rule.percentage / 100);
  const withdrawalFee = roundMoney(Math.min(Math.max(percentageFee, rule.minimumFee), rule.maximumFee));

  return {
    requestedAmount,
    withdrawalFee,
    sellerReceives: roundMoney(requestedAmount - withdrawalFee),
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
