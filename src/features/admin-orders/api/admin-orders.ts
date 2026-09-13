/**
 * @file admin-orders.ts
 * @module features/admin-orders/api
 * @description
 * Typed API clients for Zogular Admin Order & Fulfillment Operations.
 * Interacts with /admin/orders and order status transitions with CSRF protection.
 */

import { apiClient, ApiError } from "@/services/api";
import type {
  AdminOrderRecord,
  AdminOrdersPagination,
  AdminOrdersQuery,
  AdminOrderStatus,
  OrderCancellationReason,
} from "../types";

const ADMIN_ORDERS_ENDPOINT = "/admin/orders";

interface BackendAdminOrdersResponse {
  data: {
    orders: AdminOrderRecord[];
  };
  pagination: AdminOrdersPagination;
}

interface BackendSingleOrderResponse {
  data: {
    order: AdminOrderRecord;
  };
}

/**
 * Retrieves paginated, filtered admin orders with search and status support.
 * Calls GET /admin/orders.
 */
export async function fetchAdminOrders(query: AdminOrdersQuery = {}): Promise<{
  orders: AdminOrderRecord[];
  pagination: AdminOrdersPagination;
}> {
  const normalizedQuery: Record<string, string | number | boolean | null | undefined> = {
    page: query.page,
    limit: query.limit,
    status: query.status,
    search: query.search?.trim() || undefined,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };

  const response = await apiClient<BackendAdminOrdersResponse>(ADMIN_ORDERS_ENDPOINT, {
    method: "GET",
    query: normalizedQuery,
  });

  return {
    orders: response.data?.orders ?? [],
    pagination: response.pagination ?? {
      total: 0,
      page: 1,
      limit: query.limit || 12,
      pages: 1,
    },
  };
}

/**
 * Retrieves a single order record by ID.
 * Primary target: GET /admin/orders/${orderId}.
 * Fallback: GET /orders/${orderId} if canonical admin router is mounted across versions.
 */
export async function fetchAdminOrderById(orderId: string): Promise<AdminOrderRecord> {
  try {
    const response = await apiClient<BackendSingleOrderResponse>(
      `${ADMIN_ORDERS_ENDPOINT}/${orderId}`,
      { method: "GET" }
    );
    return response.data.order;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      // Graceful fallback to shared order endpoint with admin credentials if not directly on /admin/orders
      const fallback = await apiClient<BackendSingleOrderResponse>(
        `/orders/${orderId}`,
        { method: "GET" }
      );
      return fallback.data.order;
    }
    throw error;
  }
}

/**
 * Updates an order's fulfillment status, courier reference, or operations note.
 * Calls PATCH /admin/orders/${orderId}/status with CSRF token authentication.
 */
export async function updateAdminOrderStatus(
  orderId: string,
  payload: {
    status: AdminOrderStatus;
    trackingNumber?: string;
    notes?: string;
    cancellationReason?: OrderCancellationReason;
  }
): Promise<AdminOrderRecord> {
  const response = await apiClient<BackendSingleOrderResponse>(
    `${ADMIN_ORDERS_ENDPOINT}/${orderId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
      csrf: true,
    }
  );

  return response.data.order;
}
