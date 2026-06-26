import type { CartItem } from "@/types/cart";
import { readLocalStorageValue } from "@/lib/persisted-storage";
import { apiClient } from "@/services/api";

// Temporary frontend-only delivery estimate. Replace with a backend delivery quote before production pricing.
export const CHECKOUT_DELIVERY_FEE = 50;
export const CHECKOUT_DELIVERY_FEE_NOTICE =
  "Temporary delivery estimate. Backend delivery quote pending.";

export type CheckoutPaymentMethod = "mobile-money" | "bank-card";
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

export interface CheckoutOrder {
  id: string;
  orderNumber?: string;
  createdAt: string;
  status: CheckoutOrderStatus;
  contact: CheckoutContact;
  delivery: CheckoutDelivery;
  paymentMethod: CheckoutPaymentMethod;
  items: CheckoutOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  estimatedDelivery: string;
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

function readOrders(): Record<string, CheckoutOrder> {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const stored = localStorage.getItem(ordersKey);
    return stored ? (JSON.parse(stored) as Record<string, CheckoutOrder>) : {};
  } catch {
    return {};
  }
}

function writeOrder(order: CheckoutOrder) {
  const storage = getStorage();
  if (!storage) return;

  const orders = readOrders();
  orders[order.id] = order;
  storage.setItem(ordersKey, JSON.stringify(orders));
  storage.setItem(latestOrderKey, order.id);
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

function resolveProductImage(images: unknown): string {
  if (Array.isArray(images) && typeof images[0] === "string") {
    return images[0];
  }

  if (typeof images === "string") {
    try {
      const parsed = JSON.parse(images) as unknown;
      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        return parsed[0];
      }
    } catch {
      return images;
    }
  }

  if (images && typeof images === "object" && "0" in images) {
    const firstImage = (images as Record<string, unknown>)["0"];
    if (typeof firstImage === "string") {
      return firstImage;
    }
  }

  return "/brand/zogular-icon-rounded-dark.png";
}

export async function createCheckoutOrder(input: CreateCheckoutOrderInput): Promise<CheckoutOrder> {
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

  const normalizedItems = backendOrder.items.map((item) => ({
      id: item.productId,
      slug: item.product.slug,
      name: item.product.title,
      image: resolveProductImage(item.product.images),
      price: item.price,
      quantity: item.quantity,
      variant: null,
    }));

  const estimatedDeliveryDate = backendOrder.estimatedDelivery
    ? new Date(backendOrder.estimatedDelivery).toLocaleDateString("en-ZM", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : buildEstimatedDeliveryDate();

  const checkoutOrder: CheckoutOrder = {
    id: backendOrder.id,
    orderNumber: backendOrder.orderNumber,
    createdAt: backendOrder.createdAt,
    status: "processing",
    contact: input.contact,
    delivery: input.delivery,
    paymentMethod: input.paymentMethod,
    items: normalizedItems,
    subtotal: backendOrder.totalAmount,
    deliveryFee: CHECKOUT_DELIVERY_FEE,
    total: backendOrder.totalAmount + CHECKOUT_DELIVERY_FEE,
    estimatedDelivery: estimatedDeliveryDate,
  };

  writeOrder(checkoutOrder);
  return checkoutOrder;
}

export function getStoredCheckoutOrder(orderId?: string | null): CheckoutOrder | null {
  const storage = getStorage();
  if (!storage) return null;

  const resolvedOrderId = orderId || readLocalStorageValue(latestOrderKey, legacyLatestOrderKeys);
  if (!resolvedOrderId) return null;

  return readOrders()[resolvedOrderId] ?? null;
}
