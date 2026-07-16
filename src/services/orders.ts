import { apiClient } from "@/services/api";
import { getStoredAuthUser } from "@/services/auth-session";
import type { Invoice, OrderSummary, OrderStatus } from "@/types/order";
import { type BackendOrder, type BackendOrderStatus, type BackendOrderItem, getBackendProductImage } from "@/types/backend-order";

function mapBackendStatusToFrontend(status: BackendOrderStatus): OrderStatus {
  switch (status) {
    case "PENDING":
    case "CONFIRMED":
    case "PROCESSING":
      return "processing";
    case "SHIPPED":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
    case "REFUNDED":
      return "cancelled";
    default:
      return "processing";
  }
}

function isOrderLegacyIncomplete(order: BackendOrder): boolean {
  return !(
    Boolean(order.paymentMethod) &&
    Boolean(order.paymentCollectionMode) &&
    Boolean(order.commitmentFeeStatus) &&
    typeof order.deliveryFeeAmount === "number" && order.deliveryFeeAmount >= 0 &&
    typeof order.cashDueOnDelivery === "number" && order.cashDueOnDelivery >= 0 &&
    typeof order.grandTotalAmount === "number" && order.grandTotalAmount > 0
  );
}

export async function getMyOrders(): Promise<OrderSummary[]> {
  const response = await apiClient<{ data: { orders: BackendOrder[] } }>("/orders");
  const orders = response.data.orders;
  
  return orders.map((order) => {
    const isLegacyIncomplete = isOrderLegacyIncomplete(order);

    const getOrderItemLineTotal = (item: BackendOrderItem) =>
      typeof item.lineTotal === "number" ? item.lineTotal : (item.price || 0) * (item.quantity || 1);

    const computedSubtotal = order.items.reduce((acc, item) => acc + getOrderItemLineTotal(item), 0);

    return {
      id: order.id,
      orderNumber: order.orderNumber || order.id,
      date: new Date(order.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      itemSubtotal: order.totalAmount ?? computedSubtotal,
      total: isLegacyIncomplete ? null : (order.grandTotalAmount ?? order.totalAmount ?? computedSubtotal),
      status: mapBackendStatusToFrontend(order.status),
      estDelivery: order.estimatedDelivery 
        ? new Date(order.estimatedDelivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "Pending",
      items: order.items.map((item) => ({
        name: item.product?.title || item.product?.name || "Unknown Product",
        image: getBackendProductImage(item.product),
        qty: item.quantity || 1,
      })),
      isLegacyIncomplete,
    };
  });
}

function formatPaymentMethod(method?: string): string {
  if (!method) return "Unavailable";
  if (method === "cash_on_delivery" || method === "CASH_ON_DELIVERY") return "Cash on Delivery";
  if (method === "mobile_money" || method === "MOBILE_MONEY") return "Mobile Money";
  return method;
}

export async function getInvoiceById(id: string): Promise<Invoice> {
  const response = await apiClient<{ data: { order: BackendOrder } }>(`/orders/${id}`);
  const order = response.data.order;
  const user = getStoredAuthUser();
  
  // Try to parse shipping address if it's JSON
  let shippingAddressStr = "N/A";
  let shippingArea = "N/A";
  let shippingCity = "N/A";
  
  if (order.shippingAddress) {
    if (typeof order.shippingAddress === 'string') {
       shippingAddressStr = order.shippingAddress;
    } else if (typeof order.shippingAddress === 'object') {
       const addr = order.shippingAddress as Record<string, string>;
       shippingAddressStr = addr.address || addr.addressLine || addr.street || "N/A";
       shippingArea = addr.area || addr.district || "N/A";
       shippingCity = addr.city || "N/A";
    }
  }

  const getOrderItemLineTotal = (item: BackendOrderItem) => 
    typeof item.lineTotal === "number" ? item.lineTotal : (item.price || 0) * (item.quantity || 1);

  const subtotal = order.items.reduce((acc, item) => acc + getOrderItemLineTotal(item), 0);
  
  const isLegacyIncomplete = isOrderLegacyIncomplete(order);

  return {
    id: order.id,
    orderNumber: order.orderNumber || order.id,
    date: new Date(order.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    status: mapBackendStatusToFrontend(order.status),
    customer: {
      name: user ? `${user.firstName} ${user.lastName}` : "Customer",
      email: user?.email || "N/A",
      phone: typeof order.shippingAddress === 'object' ? (order.shippingAddress as Record<string, string>).phone || "N/A" : "N/A",
    },
    shipping: {
      address: shippingAddressStr,
      area: shippingArea,
      city: shippingCity,
    },
    paymentMethod: isLegacyIncomplete ? "Unavailable" : formatPaymentMethod(order.paymentMethod),
    paymentCollectionMode: isLegacyIncomplete ? undefined : order.paymentCollectionMode,
    commitmentFeeAmount: isLegacyIncomplete ? undefined : order.deliveryFeeAmount,
    cashDueOnDelivery: isLegacyIncomplete ? undefined : order.cashDueOnDelivery,
    commitmentFeeStatus: isLegacyIncomplete ? undefined : order.commitmentFeeStatus,
    items: order.items.map((item) => ({
      productId: item.productId || "",
      slug: (item.product?.slug as string) || "",
      image: getBackendProductImage(item.product),
      name: item.product?.title || item.product?.name || "Unknown Product",
      qty: item.quantity || 1,
      price: item.price || 0,
    })),
    subtotal: isLegacyIncomplete ? (order.totalAmount ?? subtotal) : subtotal,
    shippingFee: isLegacyIncomplete ? null : (order.deliveryFeeAmount as number),
    discount: 0,
    total: isLegacyIncomplete ? null : (order.grandTotalAmount as number),
    isLegacyIncomplete,
  };
}
