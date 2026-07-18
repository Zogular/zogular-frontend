import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InventoryStatus } from "../types/inventory-types";

export type StatusInfo = {
  state: InventoryStatus;
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: LucideIcon;
};

export function getStatusInfo(stock: number, threshold: number, isSold: boolean): StatusInfo {
  if (isSold || stock === 0) {
    return {
      state: "out-of-stock",
      label: "Out of Stock",
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
      icon: XCircle,
    };
  }

  if (stock <= threshold) {
    return {
      state: "low-stock",
      label: "Low Stock",
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: AlertTriangle,
    };
  }

  return {
    state: "in-stock",
    label: "In Stock",
    bg: "bg-[#009E49]/10",
    text: "text-[#009E49]",
    border: "border-[#009E49]/20",
    icon: CheckCircle2,
  };
}

export function parseStockInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) return null;
  return parsed;
}

export function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}
