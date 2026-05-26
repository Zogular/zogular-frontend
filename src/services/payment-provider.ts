import { getActivePlatformFinanceConfig } from "@/services/platform-finance";

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

function buildProviderReference(
  providerName: PaymentProviderName,
  prefix: string,
  reference: string,
): ProviderReference {
  return {
    providerName,
    providerTransactionId: `${prefix}-${reference}`,
    providerReference: reference,
    providerStatus: "pending",
  };
}

class FlutterwaveProvider implements PaymentProviderAdapter {
  name: PaymentProviderName = "flutterwave";

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const providerReference = `FLW-${input.orderId}`;
    return {
      ...buildProviderReference(this.name, "txn", providerReference),
      checkoutUrl: `/checkout?provider=flutterwave&order=${input.orderId}`,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<ProviderReference> {
    return { ...buildProviderReference(this.name, "verify", input.providerReference), providerStatus: "successful" };
  }

  async handleWebhook(envelope: WebhookEnvelope): Promise<ProviderReference> {
    return buildProviderReference(this.name, "webhook", envelope.idempotencyKey);
  }

  async createPayout(input: CreatePayoutInput): Promise<ProviderReference> {
    return buildProviderReference(this.name, "payout", input.payoutId);
  }

  async verifyPayout(input: VerifyPayoutInput): Promise<ProviderReference> {
    return { ...buildProviderReference(this.name, "payout-verify", input.providerReference), providerStatus: "pending" };
  }

  async refundPayment(input: RefundPaymentInput): Promise<ProviderReference> {
    return buildProviderReference(this.name, "refund", input.providerReference);
  }
}

class PawaPayProvider implements PaymentProviderAdapter {
  name: PaymentProviderName = "pawapay";

  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const providerReference = `PAWA-${input.orderId}`;
    return {
      ...buildProviderReference(this.name, "txn", providerReference),
      checkoutUrl: `/checkout?provider=pawapay&order=${input.orderId}`,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<ProviderReference> {
    return { ...buildProviderReference(this.name, "verify", input.providerReference), providerStatus: "successful" };
  }

  async handleWebhook(envelope: WebhookEnvelope): Promise<ProviderReference> {
    return buildProviderReference(this.name, "webhook", envelope.idempotencyKey);
  }

  async createPayout(input: CreatePayoutInput): Promise<ProviderReference> {
    return buildProviderReference(this.name, "payout", input.payoutId);
  }

  async verifyPayout(input: VerifyPayoutInput): Promise<ProviderReference> {
    return { ...buildProviderReference(this.name, "payout-verify", input.providerReference), providerStatus: "pending" };
  }

  async refundPayment(input: RefundPaymentInput): Promise<ProviderReference> {
    return buildProviderReference(this.name, "refund", input.providerReference);
  }
}

const providerAdapters: Record<PaymentProviderName, PaymentProviderAdapter> = {
  flutterwave: new FlutterwaveProvider(),
  pawapay: new PawaPayProvider(),
};

const processedWebhookKeys = new Set<string>();

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
    if (processedWebhookKeys.has(envelope.idempotencyKey)) {
      return Promise.resolve({
        providerName: envelope.providerName,
        providerTransactionId: `duplicate-${envelope.idempotencyKey}`,
        providerReference: envelope.idempotencyKey,
        providerStatus: "pending",
      } satisfies ProviderReference);
    }
    processedWebhookKeys.add(envelope.idempotencyKey);
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
