import type { ClosedOrderStatus, OrderStatus } from "@/types/order";

export const ORDERS_PATH = "/account/orders";
export const MAX_ORDER_RETURN_PAGES = 5;
export type OrderFilter = OrderStatus | "all";

export function isClosedOrderStatus(status: unknown): status is ClosedOrderStatus {
  return status === "cancelled" || status === "refunded";
}

export function parseOrderFilter(value: unknown): OrderFilter {
  return value === "processing" || value === "shipped" || value === "delivered" || isClosedOrderStatus(value)
    ? value
    : "all";
}

export function orderHistoryHref(filter: OrderFilter, orderId?: string) {
  const path = orderId ? `${ORDERS_PATH}/${encodeURIComponent(orderId)}` : ORDERS_PATH;
  return filter === "all" ? path : `${path}?status=${filter}`;
}

export function orderLinkId(orderId: string) {
  return `buyer-order-link-${orderId}`;
}

export type OrderReturnSnapshot = {
  filter: OrderFilter;
  search: string;
  page: number;
  orderId: string;
  rowIds: string[];
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  viewportOffset: number;
  listOffset: number;
  savedAt: number;
};
