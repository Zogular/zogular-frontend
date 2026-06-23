import { apiClient } from "@/services/api";
import { type SellerOrderEarnings } from "@/services/platform-finance";

export type SellerOrderStatus = "new" | "processing" | "shipped" | "delivered" | "cancelled" | "refund";
export type SellerPaymentStatus = "paid" | "cod" | "refunded" | "failed";

export interface SellerOrderItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  quantity: number;
  image: string | null;
  categorySlug: string;
}

export interface SellerOrderSummary {
  id: string;
  customer: string;
  phone: string;
  items: number;
  total: number;
  status: SellerOrderStatus;
  paymentStatus: SellerPaymentStatus;
  location: string;
  createdAt: string;
}

export interface SellerOrderDetail {
  id: string;
  status: SellerOrderStatus;
  createdAt: string;
  paymentStatus: SellerPaymentStatus;
  paymentMethod: string;
  customer: { name: string; phone: string; email: string };
  shipping: { address: string; area: string; city: string; instructions?: string; method: string; fee: number };
  items: SellerOrderItem[];
  totals: { subtotal: number; shipping: number; discount: number; total: number };
  earnings: SellerOrderEarnings;
}

// Backend Response Types
interface BackendOrderResponse {
  status: string;
  data: {
    order: BackendOrder;
  }
}

interface BackendOrdersResponse {
  status: string;
  results: number;
  data: {
    orders: BackendOrder[];
  }
}

interface BackendShippingAddress {
  street?: string;
  area?: string;
  city?: string;
}

interface BackendProductImage {
  url?: string;
}

interface BackendOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  shippingAddress: BackendShippingAddress | null;
  deliveryMethod: string;
  status: string;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    vendorStatus: string;
    product: {
      id: string;
      title: string;
      images: BackendProductImage[];
      category: string;
    }
  }>;
}

function mapVendorStatus(status: string): SellerOrderStatus {
  const s = status.toUpperCase();
  if (s === "PENDING") return "new";
  if (s === "PROCESSING") return "processing";
  if (s === "SHIPPED") return "shipped";
  if (s === "DELIVERED") return "delivered";
  if (s === "CANCELLED") return "cancelled";
  if (s === "REFUNDED") return "refund";
  return "new";
}

function mapToBackendVendorStatus(status: SellerOrderStatus): string {
  if (status === "new") return "PENDING";
  if (status === "processing") return "PROCESSING";
  if (status === "shipped") return "SHIPPED";
  if (status === "delivered") return "DELIVERED";
  if (status === "cancelled") return "CANCELLED";
  if (status === "refund") return "REFUNDED";
  return "PENDING";
}

function mapOrderToSummary(order: BackendOrder): SellerOrderSummary {
  const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const total = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // A vendor order might have multiple items with different statuses. We'll take the lowest status, or just the first item's status.
  const status = mapVendorStatus(order.items[0]?.vendorStatus || "PENDING");

  return {
    id: order.id,
    customer: `${order.user?.firstName || "Guest"} ${order.user?.lastName || ""}`.trim(),
    phone: order.user?.phone || "N/A",
    items: itemsCount,
    total,
    status,
    paymentStatus: "paid", // Assuming paid for now
    location: order.shippingAddress?.city || "Unknown",
    createdAt: order.createdAt,
  };
}

function mapOrderToDetail(order: BackendOrder): SellerOrderDetail {
  const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const status = mapVendorStatus(order.items[0]?.vendorStatus || "PENDING");

  return {
    id: order.id,
    status,
    createdAt: order.createdAt,
    paymentStatus: "paid",
    paymentMethod: "Online",
    customer: { 
      name: `${order.user?.firstName || "Guest"} ${order.user?.lastName || ""}`.trim(), 
      phone: order.user?.phone || "N/A", 
      email: order.user?.email || "N/A" 
    },
    shipping: { 
      address: order.shippingAddress?.street || "N/A", 
      area: order.shippingAddress?.area || "N/A", 
      city: order.shippingAddress?.city || "Unknown", 
      method: order.deliveryMethod || "Standard", 
      fee: 0 // Zogular might handle shipping fee centrally, vendors only see their subtotal
    },
    items: order.items.map(item => ({
      id: item.id, // Using the orderItem id
      name: item.product.title,
      brand: "Zogular", // Could extract from product if needed
      price: item.price,
      quantity: item.quantity,
      image: item.product.images?.[0]?.url || null,
      categorySlug: item.product.category || "others"
    })),
    totals: { 
      subtotal, 
      shipping: 0, 
      discount: 0, 
      total: subtotal 
    },
    earnings: {
      productSubtotal: subtotal,
      commission: subtotal * 0.1, // Mock 10%
      sellerBorneAdjustments: 0,
      sellerNet: subtotal * 0.9,
    }
  };
}

export const sellerOrdersApi = {
  async fetchSummaries(): Promise<SellerOrderSummary[]> {
    const response = await apiClient<BackendOrdersResponse>("/vendor/orders", {
      method: "GET",
    });
    return response.data.orders.map(mapOrderToSummary);
  },
  async fetchById(orderId: string): Promise<SellerOrderDetail> {
    const response = await apiClient<BackendOrderResponse>(`/vendor/orders/${orderId}`, {
      method: "GET",
    });
    return mapOrderToDetail(response.data.order);
  },
  async updateStatus(orderId: string, status: SellerOrderStatus): Promise<SellerOrderDetail> {
    const backendStatus = mapToBackendVendorStatus(status);
    const response = await apiClient<BackendOrderResponse>(`/vendor/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: backendStatus }),
      csrf: true,
    });
    return mapOrderToDetail(response.data.order);
  },
  async cancelOrder(orderId: string): Promise<SellerOrderDetail> {
    return this.updateStatus(orderId, "cancelled");
  },
};
