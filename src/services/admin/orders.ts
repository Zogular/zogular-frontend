import { throwBackendPendingFeature } from "@/services/backend-pending";

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" | "escalated";

export interface AdminOrderRecord {
  id: string;
  buyerName: string;
  sellerStoreName: string;
  totalAmount: number;
  status: OrderStatus;
  itemsCount: number;
  placedAt: string;
  deliveryAddress: string;
  logisticsPartner: "Zogular Delivery" | "Seller Arranged" | "Pickup";
  escalationReason?: string;
}

export const adminOrdersApi = {
  async fetchOrders(): Promise<AdminOrderRecord[]> {
    return [];
  },
  async overrideOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
    void orderId; void newStatus;
    throwBackendPendingFeature("Admin order status override");
  },
  async processRefund(orderId: string): Promise<void> {
    void orderId;
    throwBackendPendingFeature("Admin order refund");
  }
};
