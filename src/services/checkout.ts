import type { CartItem } from "@/types/cart";
import { ApiError, apiClient } from "@/services/api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAYMENT_METHOD = "CASH_ON_DELIVERY";
const PAYMENT_COLLECTION_MODE = "DELIVERY_FEE_THEN_CASH";
const COMMITMENT_FEE_STATUS = "PENDING";

export type CheckoutPaymentMethod = "cash_on_delivery";

export interface CheckoutContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface CheckoutDelivery {
  street: string;
  area: string;
  instructions?: string;
}

export interface CheckoutQuote {
  itemSubtotal: number;
  deliveryFeeAmount: number;
  cashDueOnDelivery: number;
  grandTotalAmount: number;
  paymentMethod: typeof PAYMENT_METHOD;
  paymentCollectionMode: typeof PAYMENT_COLLECTION_MODE;
  commitmentFeeStatus: typeof COMMITMENT_FEE_STATUS;
}

export interface CreateCheckoutOrderInput {
  items: CartItem[];
  contact: CheckoutContact;
  delivery: CheckoutDelivery;
  paymentMethod: CheckoutPaymentMethod;
}

export class CheckoutContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutContractError";
  }
}

export class CheckoutOrderOutcomeUnknownError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("Your order outcome could not be confirmed.");
    this.name = "CheckoutOrderOutcomeUnknownError";
    this.cause = cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new CheckoutContractError(`Checkout response has an invalid ${field}.`);
}

function requireUuid(value: unknown, field: string): string {
  const id = requireString(value, field);
  if (UUID_PATTERN.test(id)) return id;
  throw new CheckoutContractError(`Checkout response has an invalid ${field}.`);
}

function requireMoney(value: unknown, field: string, allowZero = false): number {
  if (
    typeof value === "number"
    && Number.isFinite(value)
    && (allowZero ? value >= 0 : value > 0)
  ) return value;
  throw new CheckoutContractError(`Checkout response has an invalid ${field}.`);
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.005;
}

function requireLiteral<T extends string>(value: unknown, expected: T, field: string): T {
  if (value === expected) return expected;
  throw new CheckoutContractError(`Checkout response has an invalid ${field}.`);
}

function buildOrderItems(items: CartItem[]): Array<{ productId: string; quantity: number }> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutContractError("Checkout requires at least one valid item.");
  }
  const orderItems = items.map((item) => {
    const productId = String(item.id);
    if (!UUID_PATTERN.test(productId)) {
      throw new CheckoutContractError("Checkout contains an invalid product.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new CheckoutContractError("Checkout contains an invalid quantity.");
    }
    return { productId, quantity: item.quantity };
  });
  if (new Set(orderItems.map((item) => item.productId)).size !== orderItems.length) {
    throw new CheckoutContractError("Checkout contains duplicate products.");
  }
  return orderItems;
}

function buildRequest(input: CreateCheckoutOrderInput, includeNotes: boolean) {
  const fullName = `${input.contact.firstName} ${input.contact.lastName}`.trim();
  const phone = input.contact.phone.trim();
  const addressLine = input.delivery.street.trim();
  const district = input.delivery.area.trim();
  if (fullName.length < 3 || phone.length < 10 || addressLine.length < 5 || district.length < 2) {
    throw new CheckoutContractError("Checkout delivery details are incomplete.");
  }

  return {
    items: buildOrderItems(input.items),
    shippingAddress: {
      fullName,
      phone,
      addressLine,
      city: "Lusaka",
      district,
      country: "Zambia",
    },
    deliveryMethod: "standard",
    paymentMethod: PAYMENT_METHOD,
    ...(includeNotes && input.delivery.instructions?.trim()
      ? { notes: input.delivery.instructions.trim() }
      : {}),
  };
}

export function parseCheckoutQuoteResponse(payload: unknown): CheckoutQuote {
  if (!isRecord(payload) || payload.status !== "success" || !isRecord(payload.data)) {
    throw new CheckoutContractError("Checkout quote response is malformed.");
  }
  const quote = payload.data.quote;
  if (!isRecord(quote)) {
    throw new CheckoutContractError("Checkout quote response is missing its quote.");
  }

  const itemSubtotal = requireMoney(quote.itemSubtotal, "item subtotal");
  const deliveryFeeAmount = requireMoney(quote.deliveryFeeAmount, "delivery fee", true);
  const cashDueOnDelivery = requireMoney(quote.cashDueOnDelivery, "cash due on delivery");
  const grandTotalAmount = requireMoney(quote.grandTotalAmount, "order total");
  if (
    !nearlyEqual(cashDueOnDelivery, itemSubtotal)
    || !nearlyEqual(grandTotalAmount, itemSubtotal + deliveryFeeAmount)
  ) {
    throw new CheckoutContractError("Checkout quote totals are inconsistent.");
  }

  return {
    itemSubtotal,
    deliveryFeeAmount,
    cashDueOnDelivery,
    grandTotalAmount,
    paymentMethod: requireLiteral(quote.paymentMethod, PAYMENT_METHOD, "payment method"),
    paymentCollectionMode: requireLiteral(
      quote.paymentCollectionMode,
      PAYMENT_COLLECTION_MODE,
      "payment collection mode",
    ),
    commitmentFeeStatus: requireLiteral(
      quote.commitmentFeeStatus,
      COMMITMENT_FEE_STATUS,
      "payment status",
    ),
  };
}

export function parseCreatedOrderResponse(
  payload: unknown,
  expectedItems: Array<{ productId: string; quantity: number }>,
): { id: string; orderNumber: string } {
  if (!isRecord(payload) || payload.status !== "success" || !isRecord(payload.data)) {
    throw new CheckoutContractError("Order response is malformed.");
  }
  const order = payload.data.order;
  if (!isRecord(order) || !Array.isArray(order.items)) {
    throw new CheckoutContractError("Order response is missing its order.");
  }

  const id = requireUuid(order.id, "order id");
  const orderNumber = requireString(order.orderNumber, "order number");
  const createdAt = requireString(order.createdAt, "creation time");
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new CheckoutContractError("Order response has an invalid creation time.");
  }

  const totalAmount = requireMoney(order.totalAmount, "item subtotal");
  const deliveryFeeAmount = requireMoney(order.deliveryFeeAmount, "delivery fee", true);
  const cashDueOnDelivery = requireMoney(order.cashDueOnDelivery, "cash due on delivery");
  const grandTotalAmount = requireMoney(order.grandTotalAmount, "order total");
  requireLiteral(order.paymentMethod, PAYMENT_METHOD, "payment method");
  requireLiteral(order.paymentCollectionMode, PAYMENT_COLLECTION_MODE, "payment collection mode");
  requireLiteral(order.commitmentFeeStatus, COMMITMENT_FEE_STATUS, "payment status");

  const responseItems = order.items.map((value) => {
    if (!isRecord(value)) throw new CheckoutContractError("Order contains a malformed item.");
    const productId = requireUuid(value.productId, "product id");
    const quantity = value.quantity;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new CheckoutContractError("Order contains an invalid quantity.");
    }
    const price = requireMoney(value.price, "item price");
    return { productId, quantity, price };
  });

  if (new Set(responseItems.map((item) => item.productId)).size !== responseItems.length) {
    throw new CheckoutContractError("Order contains duplicate products.");
  }
  const expectedByProduct = new Map(expectedItems.map((item) => [item.productId, item.quantity]));
  if (
    responseItems.length !== expectedByProduct.size
    || responseItems.some((item) => expectedByProduct.get(item.productId) !== item.quantity)
  ) {
    throw new CheckoutContractError("Order items do not match the checkout request.");
  }
  const computedSubtotal = responseItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );
  if (
    !nearlyEqual(totalAmount, computedSubtotal)
    || !nearlyEqual(cashDueOnDelivery, totalAmount)
    || !nearlyEqual(grandTotalAmount, totalAmount + deliveryFeeAmount)
  ) {
    throw new CheckoutContractError("Order totals are inconsistent.");
  }

  return { id, orderNumber };
}

export async function quoteCheckoutOrder(input: CreateCheckoutOrderInput): Promise<CheckoutQuote> {
  const request = buildRequest(input, false);
  const response = await apiClient<unknown>("/orders/quote", {
    method: "POST",
    csrf: true,
    body: JSON.stringify(request),
  });
  return parseCheckoutQuoteResponse(response);
}

export async function createCheckoutOrder(
  input: CreateCheckoutOrderInput,
): Promise<{ id: string; orderNumber: string }> {
  const request = buildRequest(input, true);
  let response: unknown;
  try {
    response = await apiClient<unknown>("/orders", {
      method: "POST",
      csrf: true,
      body: JSON.stringify(request),
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 408 || error.status >= 500)) {
      throw new CheckoutOrderOutcomeUnknownError(error);
    }
    throw error;
  }

  try {
    return parseCreatedOrderResponse(response, request.items);
  } catch (error) {
    throw new CheckoutOrderOutcomeUnknownError(error);
  }
}
