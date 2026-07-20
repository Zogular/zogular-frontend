import { apiClient } from "@/services/api";

export type SellerOrderStatus =
  | "new"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refund"
  | "unknown";
export type SellerPaymentStatus = "paid" | "cod" | "refunded" | "failed" | "unavailable";
export type SellerOrderSort = "newest" | "oldest" | "recently-updated" | "order-number";

export interface SellerOrderQuery {
  page: number;
  limit: number;
  search?: string;
  status?: Exclude<SellerOrderStatus, "unknown">;
  createdFrom?: string;
  createdTo?: string;
  sort: SellerOrderSort;
}

export interface SellerOrderPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SellerOrderStatusFacet {
  status: SellerOrderStatus;
  count: number;
}

export interface SellerOrdersSummary {
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
}

export interface SellerOrderEarningsPreview {
  productSubtotal: number;
  commission: number | null;
  sellerBorneAdjustments: number | null;
  sellerNet: number | null;
  backendConfirmed: boolean;
}

export interface SellerOrderItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  image: string | null;
  categorySlug: string;
}

export interface SellerOrderSummary {
  id: string;
  orderNumber: string;
  customer: string;
  phone: string;
  items: number;
  total: number;
  status: SellerOrderStatus;
  allowedTransitions: SellerOrderStatus[];
  paymentStatus: SellerPaymentStatus;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellerOrderDetail extends Omit<SellerOrderSummary, "customer" | "items"> {
  paymentMethod: string | null;
  customer: { name: string; phone: string; email: string };
  itemCount: number;
  items: SellerOrderItem[];
  shipping: {
    address: string;
    area: string;
    city: string;
    instructions?: string;
    method: string;
    fee: number | null;
  };
  orderItems: SellerOrderItem[];
  totals: { subtotal: number; shipping: number | null; discount: number | null; total: number };
  earnings: SellerOrderEarningsPreview;
}

export interface SellerOrdersPageResult {
  orders: SellerOrderSummary[];
  pagination: SellerOrderPagination;
  summary: SellerOrdersSummary;
  facets: { statuses: SellerOrderStatusFacet[] };
}

interface BackendProductImage {
  url?: string;
}

interface BackendOrder {
  id: string;
  orderNumber: string;
  status: string;
  sellerStatus: string;
  allowedSellerTransitions?: string[];
  totalAmount: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  sellerCommissionAmount?: number | null;
  sellerNetAmount?: number | null;
  createdAt: string;
  updatedAt: string;
  deliveryMethod: string;
  notes?: string | null;
  shippingAddress?: {
    addressLine?: string | null;
    street?: string | null;
    area?: string | null;
    district?: string | null;
    city?: string | null;
  } | null;
  shipping?: {
    addressLine?: string | null;
    street?: string | null;
    area?: string | null;
    district?: string | null;
    city?: string | null;
    method?: string | null;
    fee?: number | null;
    instructions?: string | null;
  } | null;
  customer?: {
    name?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  user?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    telephone?: string | null;
    phone?: string | null;
  };
  sellerVisibleTotals?: {
    subtotal?: number | null;
    shipping?: number | null;
    discount?: number | null;
    total?: number | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    vendorStatus: string;
    product: {
      id: string;
      title: string;
      images?: BackendProductImage[];
      category?: string | null;
      brand?: string | null;
    };
  }>;
}

interface BackendOrderResponse {
  status: string;
  data: { order: BackendOrder };
}

interface BackendOrdersResponse {
  status: string;
  results: number;
  pagination: SellerOrderPagination;
  data: {
    orders: BackendOrder[];
    summary: SellerOrdersSummary;
    facets: { statuses: Array<{ status: string; count: number }> };
  };
}

function mapVendorStatus(status?: string | null): SellerOrderStatus {
  switch (status?.trim().toUpperCase()) {
    case "PENDING": return "new";
    case "CONFIRMED": return "confirmed";
    case "PROCESSING": return "processing";
    case "SHIPPED": return "shipped";
    case "DELIVERED": return "delivered";
    case "CANCELLED": return "cancelled";
    case "REFUNDED": return "refund";
    default: return "unknown";
  }
}

function toBackendVendorStatus(status: SellerOrderStatus): string {
  const statuses: Partial<Record<SellerOrderStatus, string>> = {
    new: "PENDING",
    confirmed: "CONFIRMED",
    processing: "PROCESSING",
    shipped: "SHIPPED",
    delivered: "DELIVERED",
    cancelled: "CANCELLED",
    refund: "REFUNDED",
  };
  const mapped = statuses[status];
  if (!mapped) throw new Error(`Seller order status ${status} cannot be submitted`);
  return mapped;
}

function mapPaymentStatus(status?: string | null): SellerPaymentStatus {
  const normalized = status?.trim().toUpperCase();
  if (["PAID", "SUCCESSFUL", "COMPLETED"].includes(normalized ?? "")) return "paid";
  if (["COD", "CASH_ON_DELIVERY"].includes(normalized ?? "")) return "cod";
  if (normalized === "REFUNDED") return "refunded";
  if (normalized === "FAILED") return "failed";
  return "unavailable";
}

function getCustomerName(order: BackendOrder): string {
  const name = order.customer?.name?.trim();
  if (name) return name;
  const composed = `${order.user?.firstName ?? ""} ${order.user?.lastName ?? ""}`.trim();
  return composed || "Customer";
}

function getSellerVisibleTotal(order: BackendOrder): number {
  if (typeof order.sellerVisibleTotals?.total === "number") return order.sellerVisibleTotals.total;
  return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function mapOrderToSummary(order: BackendOrder): SellerOrderSummary {
  const shipping = order.shipping ?? order.shippingAddress;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: getCustomerName(order),
    phone: order.customer?.phone ?? order.user?.phone ?? order.user?.telephone ?? "Not provided",
    items: order.items.reduce((sum, item) => sum + item.quantity, 0),
    total: getSellerVisibleTotal(order),
    status: mapVendorStatus(order.sellerStatus),
    allowedTransitions: (order.allowedSellerTransitions ?? []).map(mapVendorStatus),
    paymentStatus: mapPaymentStatus(order.paymentStatus),
    location: shipping?.district ?? shipping?.area ?? shipping?.city ?? "Not provided",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function mapOrderToDetail(order: BackendOrder): SellerOrderDetail {
  const summary = mapOrderToSummary(order);
  const shipping = order.shipping ?? order.shippingAddress;
  const subtotal = order.sellerVisibleTotals?.subtotal ?? summary.total;
  const commission = typeof order.sellerCommissionAmount === "number" ? order.sellerCommissionAmount : null;
  const sellerNet = typeof order.sellerNetAmount === "number" ? order.sellerNetAmount : null;

  const items = order.items.map((item) => ({
    id: item.id,
    name: item.product.title,
    brand: item.product.brand?.trim() || null,
    price: item.price,
    quantity: item.quantity,
    image: item.product.images?.[0]?.url ?? null,
    categorySlug: item.product.category ?? "others",
  }));

  return {
    ...summary,
    itemCount: summary.items,
    paymentMethod: order.paymentMethod?.trim() || null,
    customer: {
      name: summary.customer,
      phone: summary.phone,
      email: order.customer?.email ?? order.user?.email ?? "Not provided",
    },
    shipping: {
      address: shipping?.addressLine ?? shipping?.street ?? "Not provided",
      area: shipping?.district ?? shipping?.area ?? "Not provided",
      city: shipping?.city ?? "Not provided",
      instructions: order.shipping?.instructions ?? order.notes ?? undefined,
      method: order.shipping?.method ?? order.deliveryMethod ?? "Standard",
      fee: order.sellerVisibleTotals?.shipping ?? order.shipping?.fee ?? null,
    },
    items,
    orderItems: items,
    totals: {
      subtotal,
      shipping: order.sellerVisibleTotals?.shipping ?? null,
      discount: order.sellerVisibleTotals?.discount ?? null,
      total: order.sellerVisibleTotals?.total ?? summary.total,
    },
    earnings: {
      productSubtotal: subtotal,
      commission,
      sellerBorneAdjustments: null,
      sellerNet,
      backendConfirmed: commission !== null || sellerNet !== null,
    },
  };
}

function mapSort(sort: SellerOrderSort) {
  switch (sort) {
    case "oldest": return { sortBy: "createdAt", sortOrder: "asc" } as const;
    case "recently-updated": return { sortBy: "updatedAt", sortOrder: "desc" } as const;
    case "order-number": return { sortBy: "orderNumber", sortOrder: "asc" } as const;
    default: return { sortBy: "createdAt", sortOrder: "desc" } as const;
  }
}

export const sellerOrderQueryKeys = {
  all: ["seller", "orders"] as const,
  lists: () => [...sellerOrderQueryKeys.all, "list"] as const,
  list: (query: SellerOrderQuery) => [...sellerOrderQueryKeys.lists(), query] as const,
  detail: (orderId: string) => [...sellerOrderQueryKeys.all, "detail", orderId] as const,
};

export const sellerOrdersApi = {
  async fetchPage(query: SellerOrderQuery): Promise<SellerOrdersPageResult> {
    const sort = mapSort(query.sort);
    const response = await apiClient<BackendOrdersResponse>("/vendor/orders", {
      method: "GET",
      query: {
        page: query.page,
        limit: query.limit,
        search: query.search,
        status: query.status ? toBackendVendorStatus(query.status) : undefined,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        ...sort,
      },
    });
    return {
      orders: response.data.orders.map(mapOrderToSummary),
      pagination: response.pagination,
      summary: response.data.summary,
      facets: {
        statuses: response.data.facets.statuses.map((facet) => ({
          status: mapVendorStatus(facet.status),
          count: facet.count,
        })),
      },
    };
  },

  async fetchSummaries(): Promise<SellerOrderSummary[]> {
    const page = await this.fetchPage({ page: 1, limit: 20, sort: "newest" });
    return page.orders;
  },

  async fetchById(orderId: string): Promise<SellerOrderDetail> {
    const response = await apiClient<BackendOrderResponse>(`/vendor/orders/${orderId}`, {
      method: "GET",
    });
    return mapOrderToDetail(response.data.order);
  },

  async updateStatus(orderId: string, status: SellerOrderStatus): Promise<SellerOrderDetail> {
    const response = await apiClient<BackendOrderResponse>(`/vendor/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: toBackendVendorStatus(status) }),
      csrf: true,
    });
    return mapOrderToDetail(response.data.order);
  },

  async cancelOrder(orderId: string): Promise<SellerOrderDetail> {
    return this.updateStatus(orderId, "cancelled");
  },
};
