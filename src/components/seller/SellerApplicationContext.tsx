"use client";

import { createContext, useContext } from "react";
import type {
  SellerApplicationStatus,
  SellerCapability,
  VendorApplication,
} from "@/types/seller";
import { hasSellerCapability } from "@/services/vendor-application";

export interface SellerApplicationContextValue {
  application: VendorApplication | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setApplication: (application: VendorApplication | null) => void;
  status: SellerApplicationStatus | null;
}

export const SellerApplicationContext = createContext<SellerApplicationContextValue | null>(null);

export function useSellerApplication() {
  const context = useContext(SellerApplicationContext);
  if (!context) {
    throw new Error("useSellerApplication must be used inside SellerApplicationContext.");
  }
  return context;
}

export function useSellerCapability(capability: SellerCapability): boolean {
  const { status } = useSellerApplication();
  return hasSellerCapability(status, capability);
}
