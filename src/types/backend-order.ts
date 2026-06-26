export interface BackendProduct {
  id: string;
  title?: string;
  name?: string;
  images?: string[];
  image?: string;
  price?: number;
  [key: string]: unknown;
}

export type BackendOrderStatus = 
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

export interface BackendOrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  lineTotal: number;
  vendorId: string;
  vendorStatus: string;
  product: BackendProduct;
}

export interface BackendOrder {
  id: string;
  orderNumber: string;
  userId: string;
  status: BackendOrderStatus;
  totalAmount: number;
  shippingAddress: Record<string, unknown> | string;
  deliveryMethod: string;
  notes?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  items: BackendOrderItem[];
}
