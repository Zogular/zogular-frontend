import { apiClient } from "@/services/api";
import { getStoredAuthUser } from "@/services/auth-session";
import type { Invoice, OrderSummary, OrderStatus } from "@/types/order";
import { type BackendOrder, type BackendOrderStatus, type BackendOrderItem, getBackendProductImage } from "@/types/backend-order";
import { PAYMENT_COLLECTION_MODE } from "@/config/checkout";

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

export async function getMyOrders(): Promise<OrderSummary[]> {
  const response = await apiClient<{ data: { orders: BackendOrder[] } }>("/orders");
  const orders = response.data.orders;
  
  return orders.map((order) => {
    return {
      id: order.id,
      orderNumber: order.orderNumber || order.id,
      date: new Date(order.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
      total: order.grandTotalAmount ?? order.totalAmount,
      status: mapBackendStatusToFrontend(order.status),
      estDelivery: order.estimatedDelivery 
        ? new Date(order.estimatedDelivery).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "Pending",
      items: order.items.map((item) => ({
        name: item.product?.title || item.product?.name || "Unknown Product",
        image: getBackendProductImage(item.product),
        qty: item.quantity || 1,
      })),
    };
  });
}

function formatPaymentMethod(method?: string): string {
  if (!method) return "Pending Configuration";
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
  
  const rawPaymentMethod = order.paymentMethod || "cash_on_delivery";
  const isCod = rawPaymentMethod === "cash_on_delivery" || rawPaymentMethod === "CASH_ON_DELIVERY";

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
    paymentMethod: formatPaymentMethod(rawPaymentMethod),
    paymentCollectionMode: order.paymentCollectionMode || (isCod ? PAYMENT_COLLECTION_MODE : undefined),
    commitmentFeeAmount: order.deliveryFeeAmount,
    cashDueOnDelivery: order.cashDueOnDelivery,
    commitmentFeeStatus: order.commitmentFeeStatus,
    items: order.items.map((item) => ({
      productId: item.productId || "",
      slug: (item.product?.slug as string) || "",
      image: getBackendProductImage(item.product),
      name: item.product?.title || item.product?.name || "Unknown Product",
      qty: item.quantity || 1,
      price: item.price || 0,
    })),
    subtotal: subtotal,
    shippingFee: order.deliveryFeeAmount ?? Math.max(order.totalAmount - subtotal, 0),
    discount: 0,
    total: order.grandTotalAmount ?? order.totalAmount,
  };
}
