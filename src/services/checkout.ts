import type { CartItem } from "@/types/cart";
import { readLocalStorageValue } from "@/lib/persisted-storage";
import { apiClient } from "@/services/api";

export type CheckoutPaymentMethod = "cash_on_delivery" | "mobile_money";
export type CheckoutOrderStatus = "processing";

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

export interface CheckoutOrderItem {
  id: string | number;
  slug: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string | null;
}

export interface CheckoutQuote {
  itemSubtotal: number;
  deliveryFeeAmount: number;
  cashDueOnDelivery: number;
  grandTotalAmount: number;
  paymentMethod: string;
  paymentCollectionMode: string;
  commitmentFeeStatus: string;
}

interface CreateCheckoutOrderInput {
  items: CartItem[];
  contact: CheckoutContact;
  delivery: CheckoutDelivery;
  paymentMethod: CheckoutPaymentMethod;
}

const latestOrderKey = "zogular-checkout-latest-order";
const ordersKey = "zogular-checkout-orders";
const legacyLatestOrderKeys = ["zamoyo-checkout-latest-order"];

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function writeOrderId(orderId: string) {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(latestOrderKey, orderId);
}

function buildEstimatedDeliveryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  return date.toLocaleDateString("en-ZM", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export async function quoteCheckoutOrder(input: CreateCheckoutOrderInput): Promise<CheckoutQuote> {
  const orderItems = input.items.map((item) => ({
    productId: String(item.id),
    quantity: item.quantity,
  }));

  const shippingAddress = {
    fullName: `${input.contact.firstName} ${input.contact.lastName}`.trim(),
    phone: input.contact.phone.trim(),
    addressLine: input.delivery.street.trim(),
    city: "Lusaka",
    district: input.delivery.area.trim(),
    country: "Zambia",
  };

  const payload = {
    items: orderItems,
    shippingAddress,
    deliveryMethod: "standard",
    paymentMethod: "CASH_ON_DELIVERY", // MVP enforcement
  };

  const response = await apiClient<{
    status: string;
    data: { quote: CheckoutQuote };
  }>("/orders/quote", {
    method: "POST",
    csrf: true,
    body: JSON.stringify(payload),
  });

  return response.data.quote;
}

export async function createCheckoutOrder(input: CreateCheckoutOrderInput): Promise<{ id: string }> {
  const orderItems = input.items.map((item) => ({
    productId: String(item.id),
    quantity: item.quantity,
  }));

  const shippingAddress = {
    fullName: `${input.contact.firstName} ${input.contact.lastName}`.trim(),
    phone: input.contact.phone.trim(),
    addressLine: input.delivery.street.trim(),
    city: "Lusaka",
    district: input.delivery.area.trim(),
    country: "Zambia",
  };

  const payload = {
    items: orderItems,
    shippingAddress,
    deliveryMethod: "standard",
    paymentMethod: "CASH_ON_DELIVERY", // MVP enforcement
    notes: input.delivery.instructions?.trim() || undefined,
  };

  const response = await apiClient<{
    status: string;
    message: string;
    data: {
      order: {
        id: string;
        orderNumber: string;
        createdAt: string;
        totalAmount: number;
        estimatedDelivery?: string;
        items: Array<{
          productId: string;
          price: number;
          quantity: number;
          product: {
            title: string;
            slug: string;
            images: unknown;
          };
        }>;
      };
    };
  }>("/orders", {
    method: "POST",
    csrf: true,
    body: JSON.stringify(payload),
  });

  const backendOrder = response.data.order;
  writeOrderId(backendOrder.id);
  
  return { id: backendOrder.id } as any;
}

export function getStoredCheckoutOrderId(): string | null {
  const storage = getStorage();
  if (!storage) return null;

  return readLocalStorageValue(latestOrderKey, legacyLatestOrderKeys);
}
