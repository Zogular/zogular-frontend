/**
 * @file types.ts
 * @module features/admin-orders/types
 * @description
 * TypeScript domain contracts, status transition graph, tab filter definitions,
 * and UI metadata for the Zogular Orders & Fulfillment Control Center (F6).
 */

import type { ComponentType } from "react";
import {
  CheckCircle2,
  Clock,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import type { AdminTone } from "@/components/admin/AdminPrimitives";

// ============================================================================
// Core Order Status Domain Types
// ============================================================================

export type AdminOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export type OrderCancellationReason =
  | "BUYER_REQUESTED"
  | "BUYER_UNREACHABLE"
  | "SELLER_OUT_OF_STOCK"
  | "INCORRECT_ADDRESS"
  | "SUSPECTED_FRAUD"
  | "OPERATIONAL_EXCEPTION";

export const CANCELLATION_REASON_LABELS: Record<OrderCancellationReason, string> = {
  BUYER_REQUESTED: "Customer Requested Cancellation",
  BUYER_UNREACHABLE: "Buyer Unreachable (Phone / WhatsApp)",
  SELLER_OUT_OF_STOCK: "Seller Out of Stock / Inventory Issue",
  INCORRECT_ADDRESS: "Incorrect / Undeliverable Delivery Address",
  SUSPECTED_FRAUD: "Suspected Fraud / Suspicious Order",
  OPERATIONAL_EXCEPTION: "Operational Exception / Logistic Failure",
};

export interface AdminOrderCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface AdminOrderPayment {
  method: string;
  collectionMode: string;
  commitmentFeeStatus: string;
}

export interface AdminOrderTotals {
  itemSubtotal: number;
  deliveryFeeAmount: number;
  cashDueOnDelivery: number;
  grandTotalAmount: number;
}

export interface AdminOrderShippingAddress {
  fullName: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface AdminOrderDelivery {
  method: string;
  trackingMode: string;
  shippingAddress: AdminOrderShippingAddress;
}

export interface AdminOrderItem {
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
}

export interface AdminOrderSellerSummary {
  userId: string;
  storeName: string | null;
  applicationStatus: string | null;
  itemCount: number;
}

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
  cancellationReason?: OrderCancellationReason | null;
  customer: AdminOrderCustomer;
  payment: AdminOrderPayment;
  totals: AdminOrderTotals;
  delivery: AdminOrderDelivery;
  items: AdminOrderItem[];
  sellerSummaries: AdminOrderSellerSummary[];
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

// ============================================================================
// Queue Tabs & Status Filtering
// ============================================================================

export type OrderQueueTabKey =
  | "all"
  | "needs_action"
  | "in_motion"
  | "delivered"
  | "exceptions";

export interface OrderQueueTabConfig {
  key: OrderQueueTabKey;
  label: string;
  description: string;
  statuses: AdminOrderStatus[] | null;
}

export const ORDER_QUEUE_TABS: OrderQueueTabConfig[] = [
  {
    key: "all",
    label: "All Orders",
    description: "Complete order registry across all lifecycle stages",
    statuses: null,
  },
  {
    key: "needs_action",
    label: "Needs Action",
    description: "Orders awaiting store confirmation or manual dispatch triage",
    statuses: ["PENDING", "CONFIRMED"],
  },
  {
    key: "in_motion",
    label: "In Motion",
    description: "Active parcels preparing or shipped for manual rider delivery",
    statuses: ["PROCESSING", "SHIPPED"],
  },
  {
    key: "delivered",
    label: "Delivered",
    description: "Successfully handed over to recipients with COD settled",
    statuses: ["DELIVERED"],
  },
  {
    key: "exceptions",
    label: "Exceptions",
    description: "Orders cancelled before dispatch or refunded post-delivery",
    statuses: ["CANCELLED", "REFUNDED"],
  },
];

// ============================================================================
// Status Transition Map & Metadata
// ============================================================================

export const NEXT_STATUSES: Record<AdminOrderStatus, AdminOrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export interface OrderStatusMeta {
  label: string;
  tone: AdminTone;
  icon: ComponentType<{ className?: string }>;
  description: string;
}

export const ORDER_STATUS_METADATA: Record<AdminOrderStatus, OrderStatusMeta> = {
  PENDING: {
    label: "Pending",
    tone: "amber",
    icon: Clock,
    description: "Order placed, awaiting confirmation and seller dispatch prep",
  },
  CONFIRMED: {
    label: "Confirmed",
    tone: "indigo",
    icon: CheckCircle2,
    description: "Order verified, routing to vendor stores for item packing",
  },
  PROCESSING: {
    label: "Processing",
    tone: "sky",
    icon: Package,
    description: "Goods prepared, packaged, and staged for courier handover",
  },
  SHIPPED: {
    label: "Shipped",
    tone: "indigo",
    icon: Truck,
    description: "Dispatched with delivery rider, en route to buyer address",
  },
  DELIVERED: {
    label: "Delivered",
    tone: "emerald",
    icon: CheckCircle2,
    description: "Physical handoff completed and cash/commitment confirmed",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "rose",
    icon: XCircle,
    description: "Order terminated before fulfillment; inventory returned",
  },
  REFUNDED: {
    label: "Refunded",
    tone: "zinc",
    icon: RotateCcw,
    description: "Post-handoff financial return or dispute settlement recorded",
  },
};

// ============================================================================
// Order Stepper & Visual Timeline Contract
// ============================================================================

export interface OrderTimelineStep {
  key: string;
  label: string;
  description: string;
  status: "completed" | "current" | "upcoming" | "cancelled";
  timestamp?: string | null;
}

/**
 * Derives the visual linear timeline progression for an order.
 * Standard path: Received -> Confirmed -> Preparing -> Shipped -> Delivered
 */
export function getOrderTimelineSteps(order: AdminOrderRecord): OrderTimelineStep[] {
  const isCancelled = order.status === "CANCELLED";
  const isRefunded = order.status === "REFUNDED";

  // Standard ordered pipeline
  const pipeline: Array<{
    key: string;
    label: string;
    desc: string;
    activeStatus: AdminOrderStatus;
  }> = [
    { key: "received", label: "Received", desc: "Order recorded in launch registry", activeStatus: "PENDING" },
    { key: "confirmed", label: "Confirmed", desc: "Dispatch verification verified", activeStatus: "CONFIRMED" },
    { key: "preparing", label: "Preparing", desc: "Packaging items with sellers", activeStatus: "PROCESSING" },
    { key: "shipped", label: "Shipped", desc: "In motion with manual courier", activeStatus: "SHIPPED" },
    { key: "delivered", label: "Delivered", desc: "Handoff & COD settled", activeStatus: "DELIVERED" },
  ];

  const statusOrder: Record<AdminOrderStatus, number> = {
    PENDING: 0,
    CONFIRMED: 1,
    PROCESSING: 2,
    SHIPPED: 3,
    DELIVERED: 4,
    CANCELLED: -1,
    REFUNDED: 5,
  };

  const currentOrderIdx = statusOrder[order.status];

  return pipeline.map((step, idx) => {
    if (isCancelled) {
      return {
        key: step.key,
        label: step.label,
        description: idx === 0 ? "Order originally placed" : "Pipeline cancelled",
        status: idx === 0 ? "completed" : "cancelled",
        timestamp: idx === 0 ? order.createdAt : null,
      };
    }

    if (isRefunded) {
      return {
        key: step.key,
        label: step.label,
        description: "Order completed before refund",
        status: "completed",
        timestamp: idx === 0 ? order.createdAt : (idx === 4 ? order.deliveredAt : null),
      };
    }

    if (idx < currentOrderIdx) {
      return {
        key: step.key,
        label: step.label,
        description: step.desc,
        status: "completed",
        timestamp: idx === 0 ? order.createdAt : (idx === 4 ? order.deliveredAt : null),
      };
    }

    if (idx === currentOrderIdx) {
      return {
        key: step.key,
        label: step.label,
        description: step.desc,
        status: "current",
        timestamp: idx === 0 ? order.createdAt : (idx === 4 ? order.deliveredAt : order.updatedAt),
      };
    }

    return {
      key: step.key,
      label: step.label,
      description: step.desc,
      status: "upcoming",
      timestamp: null,
    };
  });
}
