import { apiClient } from "@/services/api";
import type { AuthUser } from "@/types/auth";
import type { Invoice, OrderPage, OrderPagination, OrderSummary, OrderStatus } from "@/types/order";
import { type BackendOrder, type BackendOrderStatus, type BackendOrderItem, getBackendProductImage } from "@/types/backend-order";

const ORDER_PAGE_LIMIT = 20;
const MAX_COMPLETE_ORDER_PAGES = 100;
const BACKEND_ORDER_STATUSES = new Set<BackendOrderStatus>([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);

export class OrderContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderContractError";
  }
}

export class OrderListContractError extends OrderContractError {}

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

function mapOrderSummary(order: BackendOrder): OrderSummary {
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
}

function requirePaginationInteger(value: unknown, field: keyof OrderPagination, minimum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new OrderListContractError(`Order pagination has an invalid ${field}.`);
  }
  return value;
}

function assertBackendOrder(value: unknown): asserts value is BackendOrder {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrderContractError("Order response is malformed.");
  }
  const order = value as Record<string, unknown>;
  if (
    typeof order.id !== "string"
    || !order.id
    || typeof order.createdAt !== "string"
    || Number.isNaN(Date.parse(order.createdAt))
    || !BACKEND_ORDER_STATUSES.has(order.status as BackendOrderStatus)
    || !Array.isArray(order.items)
  ) {
    throw new OrderContractError("Order response is malformed.");
  }
}

function parseOrderPage(payload: unknown): OrderPage {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new OrderListContractError("Order list response is malformed.");
  }
  const root = payload as Record<string, unknown>;
  const data = root.data;
  const paginationValue = root.pagination;
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray((data as Record<string, unknown>).orders)) {
    throw new OrderListContractError("Order list response is missing orders.");
  }
  if (!paginationValue || typeof paginationValue !== "object" || Array.isArray(paginationValue)) {
    throw new OrderListContractError("Order list response is missing pagination.");
  }

  const backendOrders = (data as { orders: BackendOrder[] }).orders;
  const paginationRecord = paginationValue as Record<string, unknown>;
  const pagination: OrderPagination = {
    total: requirePaginationInteger(paginationRecord.total, "total", 0),
    page: requirePaginationInteger(paginationRecord.page, "page", 1),
    limit: requirePaginationInteger(paginationRecord.limit, "limit", 1),
    pages: requirePaginationInteger(paginationRecord.pages, "pages", 0),
  };
  const expectedPages = Math.ceil(pagination.total / pagination.limit);
  if (pagination.pages !== expectedPages || backendOrders.length > pagination.limit) {
    throw new OrderListContractError("Order pagination is inconsistent.");
  }
  const expectedResults = pagination.pages === 0
    ? 0
    : pagination.page < pagination.pages
      ? pagination.limit
      : pagination.total - pagination.limit * (pagination.pages - 1);
  if (pagination.page > Math.max(1, pagination.pages) || backendOrders.length !== expectedResults) {
    throw new OrderListContractError("Order page results are incomplete.");
  }
  if (typeof root.results === "number" && root.results !== backendOrders.length) {
    throw new OrderListContractError("Order result count is inconsistent.");
  }
  for (const value of backendOrders as unknown[]) {
    try {
      assertBackendOrder(value);
    } catch {
      throw new OrderListContractError("Order list contains a malformed order.");
    }
  }

  const ids = backendOrders.map((order) => order.id);
  if (ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== ids.length) {
    throw new OrderListContractError("Order list contains invalid or duplicate orders.");
  }

  try {
    return { orders: backendOrders.map(mapOrderSummary), pagination };
  } catch {
    throw new OrderListContractError("Order list contains a malformed order.");
  }
}

export async function getMyOrdersPage(options: { page?: number; limit?: number } = {}): Promise<OrderPage> {
  const page = options.page ?? 1;
  const limit = options.limit ?? ORDER_PAGE_LIMIT;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new OrderListContractError("Order page request is invalid.");
  }
  const response = await apiClient<unknown>("/orders", { query: { page, limit } });
  const parsed = parseOrderPage(response);
  if (parsed.pagination.page !== page || parsed.pagination.limit !== limit) {
    throw new OrderListContractError("Order pagination does not match the requested page.");
  }
  return parsed;
}

export function appendOrderPage(current: OrderPage, next: OrderPage): OrderPage {
  if (
    next.pagination.page !== current.pagination.page + 1
    || next.pagination.limit !== current.pagination.limit
    || next.pagination.total !== current.pagination.total
    || next.pagination.pages !== current.pagination.pages
  ) {
    throw new OrderListContractError("Order pagination changed while loading more orders.");
  }

  const orders = [...current.orders, ...next.orders];
  const uniqueIds = new Set(orders.map((order) => order.id));
  if (uniqueIds.size !== orders.length || orders.length > next.pagination.total) {
    throw new OrderListContractError("Order history contains duplicate or inconsistent orders.");
  }
  if (next.pagination.page === next.pagination.pages && orders.length !== next.pagination.total) {
    throw new OrderListContractError("Complete order history is inconsistent.");
  }

  return { orders, pagination: next.pagination };
}

export async function getMyOrders(): Promise<OrderSummary[]> {
  const firstPage = await getMyOrdersPage({ page: 1, limit: 100 });
  if (firstPage.pagination.pages > MAX_COMPLETE_ORDER_PAGES) {
    throw new OrderListContractError("Order history is too large to retrieve safely.");
  }
  const orders = [...firstPage.orders];
  for (let page = 2; page <= firstPage.pagination.pages; page += 1) {
    const nextPage = await getMyOrdersPage({ page, limit: firstPage.pagination.limit });
    if (
      nextPage.pagination.total !== firstPage.pagination.total
      || nextPage.pagination.pages !== firstPage.pagination.pages
    ) {
      throw new OrderListContractError("Order pagination changed during retrieval.");
    }
    orders.push(...nextPage.orders);
  }
  if (orders.length !== firstPage.pagination.total || new Set(orders.map((order) => order.id)).size !== orders.length) {
    throw new OrderListContractError("Complete order history is inconsistent.");
  }
  return orders;
}

function formatPaymentMethod(method?: string): string {
  if (!method) return "Unavailable";
  if (method === "cash_on_delivery" || method === "CASH_ON_DELIVERY") return "Cash on Delivery";
  if (method === "mobile_money" || method === "MOBILE_MONEY") return "Mobile Money";
  return method;
}

export async function getInvoiceById(id: string, verifiedUser?: AuthUser): Promise<Invoice> {
  const response = await apiClient<unknown>(`/orders/${id}`);
  if (!response || typeof response !== "object" || !("data" in response)) {
    throw new OrderContractError("Order response is malformed.");
  }
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== "object" || !("order" in data)) {
    throw new OrderContractError("Order response is malformed.");
  }
  const order = (data as { order?: unknown }).order;
  assertBackendOrder(order);
  
  // Try to parse shipping address if it's JSON
  let shippingAddressStr = "N/A";
  let shippingArea = "N/A";
  let shippingCity = "N/A";
  let shippingName = "Customer";
  let shippingPhone = "N/A";
  
  if (order.shippingAddress) {
    if (typeof order.shippingAddress === 'string') {
       shippingAddressStr = order.shippingAddress;
    } else if (typeof order.shippingAddress === 'object') {
       const addr = order.shippingAddress as Record<string, string>;
       shippingAddressStr = addr.address || addr.addressLine || addr.street || "N/A";
       shippingArea = addr.area || addr.district || "N/A";
       shippingCity = addr.city || "N/A";
       shippingName = addr.fullName || addr.name || shippingName;
       shippingPhone = addr.phone || shippingPhone;
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
      name: verifiedUser ? `${verifiedUser.firstName} ${verifiedUser.lastName}`.trim() : shippingName,
      email: verifiedUser?.email || "N/A",
      phone: shippingPhone,
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
