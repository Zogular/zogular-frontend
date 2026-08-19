export type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled";

export interface OrderLineItem {
  name: string;
  image: string;
  qty: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  date: string;
  total: number | null;
  itemSubtotal: number;
  status: OrderStatus;
  estDelivery: string;
  items: OrderLineItem[];
  isLegacyIncomplete?: boolean;
}

export interface OrderPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface OrderPage {
  orders: OrderSummary[];
  pagination: OrderPagination;
}

export interface InvoiceItem {
  productId: string;
  slug?: string;
  image?: string;
  name: string;
  qty: number;
  price: number;
}

export interface Invoice {
  id: string;
  orderNumber?: string;
  date: string;
  status: OrderStatus;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shipping: {
    address: string;
    area: string;
    city: string;
  };
  paymentMethod: string;
  paymentCollectionMode?: string;
  commitmentFeeAmount?: number;
  cashDueOnDelivery?: number;
  commitmentFeeStatus?: string;
  items: InvoiceItem[];
  subtotal: number;
  shippingFee: number | null;
  discount: number;
  total: number | null;
  isLegacyIncomplete?: boolean;
}
