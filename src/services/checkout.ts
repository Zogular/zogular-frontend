import type { CartItem } from "@/types/cart";
import { ApiError, apiClient } from "@/services/api";
import { parseBackendCartResponse } from "@/services/cart";

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
  cartGeneration?: string;
  itemSubtotal: number;
  deliveryFeeAmount: number;
  cashDueOnDelivery: number;
  grandTotalAmount: number;
  paymentMethod: typeof PAYMENT_METHOD;
  paymentCollectionMode: typeof PAYMENT_COLLECTION_MODE;
  commitmentFeeStatus: typeof COMMITMENT_FEE_STATUS;
}

type AcceptedQuote = Pick<CheckoutQuote, "itemSubtotal" | "deliveryFeeAmount" | "grandTotalAmount">;

// Frontend-first deployment compatibility. A present key is NEVER optional.
export type GenerationMode = "frontend-first" | "required";
export const FRONTEND_FIRST: GenerationMode = "frontend-first";
export function checkoutGeneration(value: unknown): string {
  if (typeof value !== "string" || value.length !== 36 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new CheckoutContractError("Invalid checkout generation.");
  }
  return value.toLowerCase();
}

function generationField(record: Record<string, unknown>, key: string, mode: GenerationMode) {
  if (!Object.hasOwn(record, key) && mode === FRONTEND_FIRST) return undefined;
  return checkoutGeneration(record[key]);
}

export async function readCheckoutCart(mode: GenerationMode, sessionBound = true) {
  const payload = await apiClient<unknown>("/cart", { method: "GET", cache: "no-store", noAutoReplay: sessionBound });
  const items = parseBackendCartResponse(payload);
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.cart)) throw new CheckoutContractError("Invalid cart.");
  return { items, generation: generationField(payload.data.cart, "generation", mode) };
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

export class CheckoutQuoteChangedError extends Error {
  constructor() {
    super("Your order total changed. Review the updated amounts before placing your order.");
    this.name = "CheckoutQuoteChangedError";
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

export function parseCheckoutQuoteResponse(payload: unknown, mode: GenerationMode = "required"): CheckoutQuote {
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

  const cartGeneration = generationField(quote, "cartGeneration", mode);
  return {
    ...(cartGeneration && { cartGeneration }),
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
  expectedQuote?: AcceptedQuote,
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
  if (expectedQuote && (
    !nearlyEqual(totalAmount, expectedQuote.itemSubtotal)
    || !nearlyEqual(deliveryFeeAmount, expectedQuote.deliveryFeeAmount)
    || !nearlyEqual(grandTotalAmount, expectedQuote.grandTotalAmount)
  )) {
    throw new CheckoutContractError("Order totals do not match the confirmed quote.");
  }

  return { id, orderNumber };
}

export async function quoteCheckoutOrder(input: CreateCheckoutOrderInput, mode: GenerationMode = FRONTEND_FIRST): Promise<CheckoutQuote> {
  const request = buildRequest(input, false);
  const response = await apiClient<unknown>("/orders/quote", {
    method: "POST",
    csrf: true,
    body: JSON.stringify(request),
  });
  return parseCheckoutQuoteResponse(response, mode);
}

// A receipt identifies an already-created order. Payment/fulfilment may have
// advanced since checkout; fresh-create invariants do not apply here.
export function parseCheckoutReceipt(payload: unknown, owner: string, generation: string) {
  if (!isRecord(payload) || payload.status !== "success" || !isRecord(payload.data)
    || checkoutGeneration(payload.data.cartGeneration) !== checkoutGeneration(generation)
    || !isRecord(payload.data.order) || !owner || payload.data.order.userId !== owner) {
    throw new CheckoutContractError("Checkout receipt does not match.");
  }
  const order = payload.data.order;
  if (!["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].includes(requireString(order.status, "order status"))
    || !Number.isFinite(Date.parse(requireString(order.createdAt, "creation time")))) {
    throw new CheckoutContractError("Invalid order receipt.");
  }
  return { id: requireUuid(order.id, "order id"), orderNumber: requireString(order.orderNumber, "order number") };
}

export async function readCheckoutReceipt(owner: string, generation: string) {
  const key = checkoutGeneration(generation);
  try {
    const payload = await apiClient<unknown>(`/orders/checkout-receipt/${key}`, { method: "GET", cache: "no-store", noAutoReplay: true });
    return parseCheckoutReceipt(payload, owner, key);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function inspectCheckoutOutcome(owner: string, generation: string, current: () => boolean) {
  if (!current()) return null;
  const receipt = await readCheckoutReceipt(owner, generation);
  if (!current()) return null;
  if (receipt) return { receipt, snapshot: null };
  const snapshot = await readCheckoutCart("required");
  if (!current()) return null;
  // A miss can race a commit. The authoritative generation transition must
  // precede the final receipt read, not be inferred from missing cart lines.
  const finalReceipt = snapshot.generation !== generation ? await readCheckoutReceipt(owner, generation) : null;
  return current() ? { receipt: finalReceipt, snapshot } : null;
}

export function prepareCheckoutOrder(
  input: CreateCheckoutOrderInput,
  acceptedQuote: AcceptedQuote & { cartGeneration?: string },
  owner?: string,
  mode: GenerationMode = "required",
) {
  const request = buildRequest(input, true);
  const expectedQuote: AcceptedQuote = {
    itemSubtotal: acceptedQuote.itemSubtotal,
    deliveryFeeAmount: acceptedQuote.deliveryFeeAmount,
    grandTotalAmount: acceptedQuote.grandTotalAmount,
  };
  const generation = generationField({ ...acceptedQuote }, "cartGeneration", mode);
  if (generation && !owner) throw new CheckoutContractError("Checkout owner is required.");
  const body = JSON.stringify({ ...request, expectedQuote, ...(generation && { cartGeneration: generation }) });
  return () => sendPreparedOrder(body, request.items, expectedQuote, generation, owner);
}

async function sendPreparedOrder(body: string, items: ReturnType<typeof buildOrderItems>, expectedQuote: AcceptedQuote,
  generation?: string, owner?: string) {
  let response: unknown;
  try {
    response = await apiClient<unknown>("/orders", {
      method: "POST",
      csrf: true,
      noAutoReplay: true,
      body,
    });
  } catch (error) {
    if (
      error instanceof ApiError
      && error.status === 409
      && isRecord(error.details)
      && error.details.code === "CHECKOUT_QUOTE_CHANGED"
    ) {
      throw new CheckoutQuoteChangedError();
    }
    if (error instanceof ApiError && (error.status === 408 || error.status >= 500)) {
      throw new CheckoutOrderOutcomeUnknownError(error);
    }
    throw error;
  }

  try {
    if (generation && owner) parseCheckoutReceipt(response, owner, generation);
    else if (isRecord(response) && isRecord(response.data) && "cartGeneration" in response.data) {
      throw new CheckoutContractError("Unexpected checkout generation.");
    }
    return parseCreatedOrderResponse(response, items, expectedQuote);
  } catch (error) {
    throw new CheckoutOrderOutcomeUnknownError(error);
  }
}

export async function createCheckoutOrder(input: CreateCheckoutOrderInput, quote: AcceptedQuote & { cartGeneration?: string }, owner?: string) {
  return prepareCheckoutOrder(input, quote, owner, FRONTEND_FIRST)();
}
