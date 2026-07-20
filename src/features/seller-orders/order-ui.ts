import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Package,
  RotateCcw,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { SellerOrderStatus } from "@/services/seller-orders";

export interface SellerOrderStatusMeta {
  id: SellerOrderStatus;
  title: string;
  icon: LucideIcon;
  color: string;
  background: string;
  border: string;
}

export const SELLER_ORDER_STATUSES: readonly SellerOrderStatusMeta[] = [
  { id: "new", title: "New", icon: Clock3, color: "text-blue-700", background: "bg-blue-50", border: "border-blue-200" },
  { id: "confirmed", title: "Confirmed", icon: CheckCircle2, color: "text-indigo-700", background: "bg-indigo-50", border: "border-indigo-200" },
  { id: "processing", title: "Preparing", icon: Package, color: "text-amber-700", background: "bg-amber-50", border: "border-amber-200" },
  { id: "shipped", title: "Shipped", icon: Truck, color: "text-purple-700", background: "bg-purple-50", border: "border-purple-200" },
  { id: "delivered", title: "Delivered", icon: CheckCircle2, color: "text-emerald-700", background: "bg-emerald-50", border: "border-emerald-200" },
  { id: "cancelled", title: "Cancelled", icon: XCircle, color: "text-red-700", background: "bg-red-50", border: "border-red-200" },
  { id: "refund", title: "Refunded", icon: RotateCcw, color: "text-orange-700", background: "bg-orange-50", border: "border-orange-200" },
  { id: "unknown", title: "Unavailable", icon: AlertCircle, color: "text-zinc-700", background: "bg-zinc-100", border: "border-zinc-200" },
] as const;

export function getSellerOrderStatusMeta(status: SellerOrderStatus) {
  return SELLER_ORDER_STATUSES.find((item) => item.id === status) ?? SELLER_ORDER_STATUSES.at(-1)!;
}

export function formatSellerOrderDate(value: string) {
  return new Intl.DateTimeFormat("en-ZM", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatSellerOrderCurrency(value: number) {
  return `K${value.toLocaleString("en-ZM", { maximumFractionDigits: 2 })}`;
}
