import { OrderReturnScope } from "@/features/buyer-orders/components/OrderReturnScope";
import type { ReactNode } from "react";

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <OrderReturnScope>{children}</OrderReturnScope>;
}
