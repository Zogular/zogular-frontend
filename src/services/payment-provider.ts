import { getActivePlatformFinanceConfig } from "@/services/platform-finance";
import { throwBackendPendingFeature } from "@/services/backend-pending";

export type PaymentProviderName = "flutterwave" | "pawapay";
export type ProviderPaymentStatus = "pending" | "successful" | "failed" | "cancelled";
export type ProviderPayoutStatus = "pending" | "successful" | "failed";

export interface ProviderReference {
  providerName: PaymentProviderName;
  providerTransactionId: string;
  providerReference: string;
  providerStatus: ProviderPaymentStatus | ProviderPayoutStatus;
  rawProviderResponse?: unknown;
}

export interface InitializePaymentInput {
  orderId: string;
  amount: number;
  currency: "ZMW";
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  callbackUrl: string;
}

export interface InitializePaymentResult extends ProviderReference {
  checkoutUrl: string;
}

export interface VerifyPaymentInput {
  providerReference: string;
}

export interface CreatePayoutInput {
  payoutId: string;
  amount: number;
  currency: "ZMW";
  destination: {
    type: "mobile_money" | "bank";
    provider: string;
    accountName: string;
    accountNumber: string;
  };
}

export interface VerifyPayoutInput {
  providerReference: string;
}

export interface RefundPaymentInput {
  providerReference: string;
  amount: number;
  reason: string;
}

export interface WebhookEnvelope {
  providerName: PaymentProviderName;
  signature: string;
  payload: unknown;
  receivedAt: string;
  idempotencyKey: string;
}

export interface PaymentProviderAdapter {
  name: PaymentProviderName;
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<ProviderReference>;
  handleWebhook(envelope: WebhookEnvelope): Promise<ProviderReference>;
  createPayout(input: CreatePayoutInput): Promise<ProviderReference>;
  verifyPayout(input: VerifyPayoutInput): Promise<ProviderReference>;
  refundPayment(input: RefundPaymentInput): Promise<ProviderReference>;
}

export const PAYMENT_PROVIDER_PLACEHOLDER_NOTICE =
  "Development placeholder only. Payment verification, payouts, refunds, and webhooks are disabled until backend provider integration is implemented.";

class FlutterwaveProvider implements PaymentProviderAdapter {
  name: PaymentProviderName = "flutterwave";

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    void input;
    throwBackendPendingFeature("Flutterwave payment initialization placeholder");
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<ProviderReference> {
    void input;
    throwBackendPendingFeature("Flutterwave payment verification placeholder");
  }

  async handleWebhook(envelope: WebhookEnvelope): Promise<ProviderReference> {
    void envelope;
    throwBackendPendingFeature("Flutterwave webhook placeholder");
  }

  async createPayout(input: CreatePayoutInput): Promise<ProviderReference> {
    void input;
    throwBackendPendingFeature("Flutterwave payout creation placeholder");
  }

  async verifyPayout(input: VerifyPayoutInput): Promise<ProviderReference> {
    void input;
    throwBackendPendingFeature("Flutterwave payout verification placeholder");
  }

  async refundPayment(input: RefundPaymentInput): Promise<ProviderReference> {
    void input;
    throwBackendPendingFeature("Flutterwave refund placeholder");
  }
}

class PawaPayProvider implements PaymentProviderAdapter {
  name: PaymentProviderName = "pawapay";

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    void input;
    throwBackendPendingFeature("PawaPay payment initialization placeholder");
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<ProviderReference> {
    void input;
    throwBackendPendingFeature("PawaPay payment verification placeholder");
  }

  async handleWebhook(envelope: WebhookEnvelope): Promise<ProviderReference> {
    void envelope;
    throwBackendPendingFeature("PawaPay webhook placeholder");
  }

  async createPayout(input: CreatePayoutInput): Promise<ProviderReference> {
    void input;
    throwBackendPendingFeature("PawaPay payout creation placeholder");
  }

  async verifyPayout(input: VerifyPayoutInput): Promise<ProviderReference> {
    void input;
    throwBackendPendingFeature("PawaPay payout verification placeholder");
  }

  async refundPayment(input: RefundPaymentInput): Promise<ProviderReference> {
    void input;
    throwBackendPendingFeature("PawaPay refund placeholder");
  }
}

const providerAdapters: Record<PaymentProviderName, PaymentProviderAdapter> = {
  flutterwave: new FlutterwaveProvider(),
  pawapay: new PawaPayProvider(),
};

export const PaymentProviderService = {
  getActiveProvider(): PaymentProviderAdapter {
    return providerAdapters[getActivePlatformFinanceConfig().paymentProvider.activeProvider];
  },
  initializePayment(input: InitializePaymentInput) {
    return this.getActiveProvider().initializePayment(input);
  },
  verifyPayment(input: VerifyPaymentInput) {
    return this.getActiveProvider().verifyPayment(input);
  },
  handleWebhook(envelope: WebhookEnvelope) {
    if (!envelope.signature.trim()) {
      throw new Error("Payment webhook signature is required.");
    }
    return providerAdapters[envelope.providerName].handleWebhook(envelope);
  },
  createPayout(input: CreatePayoutInput) {
    return this.getActiveProvider().createPayout(input);
  },
  verifyPayout(input: VerifyPayoutInput) {
    return this.getActiveProvider().verifyPayout(input);
  },
  refundPayment(input: RefundPaymentInput) {
    return this.getActiveProvider().refundPayment(input);
  },
};
