import { apiClient } from "@/services/api";

const ADMIN_ORDERS_ENDPOINT = "/admin/orders";

export type AdminOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface AdminOrderRecord {
  id: string;
  orderNumber: string;
  status: AdminOrderStatus;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  estimatedDelivery: string | null;
  trackingNumber: string | null;
  notes: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  payment: {
    method: string;
    collectionMode: string;
    commitmentFeeStatus: string;
  };
  totals: {
    itemSubtotal: number;
    deliveryFeeAmount: number;
    cashDueOnDelivery: number;
    grandTotalAmount: number;
  };
  delivery: {
    method: string;
    trackingMode: string;
    shippingAddress: {
      fullName: string | null;
      phone: string | null;
      addressLine: string | null;
      city: string | null;
      district: string | null;
      postalCode: string | null;
      country: string | null;
    };
  };
  items: Array<{
    id: string;
    productId: string;
    title: string;
    slug: string;
    quantity: number;
    price: number;
    lineTotal: number;
    vendorId: string;
    vendorStatus: string;
    seller: {
      userId: string;
      name: string;
      storeName: string | null;
      applicationStatus: string | null;
    };
  }>;
  sellerSummaries: Array<{
    userId: string;
    storeName: string | null;
    applicationStatus: string | null;
    itemCount: number;
  }>;
}

export interface AdminOrdersPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminOrdersQuery {
  page?: number;
  limit?: number;
  status?: AdminOrderStatus;
  search?: string;
  sortBy?: "createdAt" | "updatedAt" | "totalAmount" | "grandTotalAmount" | "status";
  sortOrder?: "asc" | "desc";
}

interface BackendAdminOrdersResponse {
  data: {
    orders: AdminOrderRecord[];
  };
  pagination: AdminOrdersPagination;
}

export const adminOrdersApi = {
  async fetchOrders(query: AdminOrdersQuery = {}) {
    const normalizedQuery: Record<string, string | number | boolean | null | undefined> = {
      page: query.page,
      limit: query.limit,
      status: query.status,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    const response = await apiClient<BackendAdminOrdersResponse>(ADMIN_ORDERS_ENDPOINT, {
      method: "GET",
      query: normalizedQuery,
    });

    return {
      orders: response.data.orders,
      pagination: response.pagination,
    };
  },
  async updateOrder(
    orderId: string,
    input: { status: AdminOrderStatus; trackingNumber?: string; notes?: string },
  ) {
    const response = await apiClient<{ data: { order: AdminOrderRecord } }>(
      `/admin/orders/${orderId}/status`,
      { method: "PATCH", body: JSON.stringify(input), csrf: true },
    );
    return response.data.order;
  },
};
