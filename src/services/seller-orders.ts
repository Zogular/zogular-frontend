import { calculateSellerOrderEarnings, type SellerOrderEarnings } from "@/services/platform-finance";

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

const SELLER_ORDERS: SellerOrderDetail[] = [
  buildOrder({
    id: "ORD-9921",
    status: "new",
    paymentStatus: "paid",
    paymentMethod: "Mobile Money (MTN)",
    createdAt: "2026-04-12T10:30:00Z",
    customer: { name: "Chanda Mwila", phone: "+260971111111", email: "chanda.m@example.com" },
    shipping: { address: "Plot 123, Independence Ave", area: "Kabulonga", city: "Lusaka", instructions: "Call when at the gate.", method: "Standard Delivery (1-2 Days)", fee: 150 },
    items: [
      { id: "ZM-P-101", name: "MacBook Air M2 - 256GB Midnight", brand: "Apple", price: 18500, quantity: 1, image: null, categorySlug: "computing" },
    ],
  }),
  buildOrder({
    id: "ORD-9920",
    status: "new",
    paymentStatus: "cod",
    paymentMethod: "Cash on Delivery",
    createdAt: "2026-04-11T13:00:00Z",
    customer: { name: "Bupe Kunda", phone: "+260972222222", email: "bupe.k@example.com" },
    shipping: { address: "Woodlands Main Road", area: "Woodlands", city: "Lusaka", method: "Pickup Coordination", fee: 50 },
    items: [
      { id: "ZM-P-102", name: "Samsung 45W Fast Charger Type-C", brand: "Samsung", price: 450, quantity: 1, image: null, categorySlug: "phones-and-tablets" },
    ],
  }),
  buildOrder({
    id: "ORD-9918",
    status: "processing",
    paymentStatus: "paid",
    paymentMethod: "Mobile Money (Airtel)",
    createdAt: "2026-04-10T10:20:00Z",
    customer: { name: "Emmanuel Banda", phone: "+260973333333", email: "emmanuel.b@example.com" },
    shipping: { address: "Market Road", area: "Matero", city: "Lusaka", method: "Standard Delivery (1-2 Days)", fee: 120 },
    items: [
      { id: "ZM-P-103", name: "Apple AirPods Pro (2nd Generation)", brand: "Apple", price: 4200, quantity: 1, image: null, categorySlug: "electronics" },
    ],
  }),
  buildOrder({
    id: "ORD-9915",
    status: "shipped",
    paymentStatus: "paid",
    paymentMethod: "Bank Card",
    createdAt: "2026-04-09T15:30:00Z",
    customer: { name: "Sarah Tembo", phone: "+260974444444", email: "sarah.t@example.com" },
    shipping: { address: "Chilenje South", area: "Chilenje", city: "Lusaka", method: "Standard Delivery (1-2 Days)", fee: 150 },
    items: [
      { id: "ZM-P-104", name: "JBL Flip 6 Portable Bluetooth Speaker", brand: "JBL", price: 2100, quantity: 1, image: null, categorySlug: "electronics" },
    ],
  }),
  buildOrder({
    id: "ORD-9910",
    status: "delivered",
    paymentStatus: "paid",
    paymentMethod: "Mobile Money (MTN)",
    createdAt: "2026-04-08T10:10:00Z",
    customer: { name: "David Lungu", phone: "+260975555555", email: "david.l@example.com" },
    shipping: { address: "Avondale", area: "Avondale", city: "Lusaka", method: "Standard Delivery (1-2 Days)", fee: 150 },
    items: [
      { id: "ZM-P-105", name: "PlayStation 5 DualSense Controller", brand: "Sony", price: 1450, quantity: 1, image: null, categorySlug: "electronics" },
    ],
  }),
  buildOrder({
    id: "ORD-9907",
    status: "cancelled",
    paymentStatus: "failed",
    paymentMethod: "Mobile Money",
    createdAt: "2026-04-07T09:15:00Z",
    customer: { name: "Mwaka Phiri", phone: "+260976666666", email: "mwaka.p@example.com" },
    shipping: { address: "Chelstone", area: "Chelstone", city: "Lusaka", method: "Standard Delivery (1-2 Days)", fee: 100 },
    items: [
      { id: "ZM-P-102", name: "Samsung 45W Fast Charger Type-C", brand: "Samsung", price: 400, quantity: 2, image: null, categorySlug: "phones-and-tablets" },
    ],
  }),
  buildOrder({
    id: "ORD-9905",
    status: "refund",
    paymentStatus: "refunded",
    paymentMethod: "Mobile Money (MTN)",
    createdAt: "2026-04-06T11:40:00Z",
    customer: { name: "Joseph Ngosa", phone: "+260977777777", email: "joseph.n@example.com" },
    shipping: { address: "Roma", area: "Roma", city: "Lusaka", method: "Standard Delivery (1-2 Days)", fee: 100 },
    items: [
      { id: "ZM-P-106", name: "Nike Air Max 270", brand: "Nike", price: 1200, quantity: 1, image: null, categorySlug: "fashion" },
    ],
  }),
];

export const sellerOrdersApi = {
  async fetchSummaries(): Promise<SellerOrderSummary[]> {
    await delay(350);
    return SELLER_ORDERS.map(toSummary);
  },
  async fetchById(orderId: string): Promise<SellerOrderDetail> {
    await delay(350);
    const order = SELLER_ORDERS.find((item) => item.id === orderId);
    if (!order) throw new Error("Order not found.");
    return structuredClone(order);
  },
  async updateStatus(orderId: string, status: SellerOrderStatus): Promise<SellerOrderDetail> {
    await delay(300);
    const order = SELLER_ORDERS.find((item) => item.id === orderId);
    if (!order) throw new Error("Order not found.");
    order.status = status;
    return structuredClone(order);
  },
  async cancelOrder(orderId: string): Promise<SellerOrderDetail> {
    return this.updateStatus(orderId, "cancelled");
  },
};

function buildOrder(input: Omit<SellerOrderDetail, "totals" | "earnings">): SellerOrderDetail {
  const subtotal = input.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = 0;
  const categorySlug = input.items[0]?.categorySlug;

  return {
    ...input,
    totals: {
      subtotal,
      shipping: input.shipping.fee,
      discount,
      total: subtotal + input.shipping.fee - discount,
    },
    earnings: calculateSellerOrderEarnings({ productSubtotal: subtotal, categorySlug }),
  };
}

function toSummary(order: SellerOrderDetail): SellerOrderSummary {
  return {
    id: order.id,
    customer: order.customer.name,
    phone: order.customer.phone,
    items: order.items.reduce((sum, item) => sum + item.quantity, 0),
    total: order.totals.total,
    status: order.status,
    paymentStatus: order.paymentStatus,
    location: order.shipping.area,
    createdAt: order.createdAt,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
