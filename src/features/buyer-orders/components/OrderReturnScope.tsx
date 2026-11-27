"use client";

import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import type { OrderReturnSnapshot } from "../lib/order-return-state";

const OrderReturnContext = createContext<RefObject<OrderReturnSnapshot | null> | null>(null);

export function OrderReturnScope({ children }: { children: ReactNode }) {
  // The authenticated account layout remounts this scope when identity changes.
  const snapshot = useRef<OrderReturnSnapshot | null>(null);
  return <OrderReturnContext.Provider value={snapshot}>{children}</OrderReturnContext.Provider>;
}

export function useOrderReturnScope() {
  const snapshot = useContext(OrderReturnContext);
  if (!snapshot) throw new Error("Order history must be rendered in its account scope.");
  return snapshot;
}
