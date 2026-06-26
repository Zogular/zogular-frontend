export interface BackendProduct {
  id: string;
  title?: string;
  name?: string;
  images?: string[];
  image?: string;
  [key: string]: unknown;
}

export function getBackendProductImage(product: BackendProduct | undefined | null): string {
  if (!product) return "/placeholder.png";
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    const first = product.images[0];
    if (typeof first === "string") return first;
    if (typeof first === "object" && first !== null && "url" in first && typeof (first as Record<string, unknown>).url === "string") {
      return (first as Record<string, unknown>).url as string;
    }
  }
  if (typeof product.image === "string" && product.image) {
    return product.image;
  }
  return "/placeholder.png";
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
