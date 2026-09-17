"use client";

/**
 * @file StatusBadge.tsx
 * @module features/admin-sellers/components
 * @description
 * Modular status chip badge indicating the current operational state of a seller application
 * in the admin review queue.
 */

import React from "react";
import {
  AlertTriangle,
  Ban,
  CheckCheck,
  Clock3,
  FileWarning,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SellerApplicationStatus, SellerType } from "@/types/seller";
import { getSellerTypeLabel } from "../lib/seller-formatters";

export const STATUS_META: Record<
  SellerApplicationStatus,
  {
    label: string;
    tone: string;
    chip: string;
    icon: React.ComponentType<{ className?: string }>;
    summary: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    tone: "text-zinc-600",
    chip: "border-zinc-300/70 bg-zinc-100/90 text-zinc-600",
    icon: FileWarning,
    summary: "Started but not submitted for review.",
  },
  SUBMITTED: {
    label: "Pending review",
    tone: "text-amber-700",
    chip: "border-amber-300/80 bg-amber-50 text-amber-700",
    icon: Clock3,
    summary: "Application submitted and waiting for admin review.",
  },
  NEEDS_INFO: {
    label: "More info needed",
    tone: "text-orange-700",
    chip: "border-orange-300/80 bg-orange-50 text-orange-700",
    icon: AlertTriangle,
    summary: "The seller has been asked to update their application before review can continue.",
  },
  PROVISIONAL: {
    label: "Provisional",
    tone: "text-sky-700",
    chip: "border-sky-300/80 bg-sky-50 text-sky-700",
    icon: ShieldCheck,
    summary: "Seller has provisional access. Draft product creation is open while full approval is pending.",
  },
  APPROVED: {
    label: "Approved",
    tone: "text-[#009E49]",
    chip: "border-emerald-300/80 bg-emerald-50 text-[#009E49]",
    icon: CheckCheck,
    summary: "Seller is fully approved. All selling capabilities are active.",
  },
  RESTRICTED: {
    label: "Restricted",
    tone: "text-orange-700",
    chip: "border-orange-300/80 bg-orange-50 text-orange-700",
    icon: ShieldAlert,
    summary: "Seller account is restricted. Key capabilities are limited but the store remains visible.",
  },
  SUSPENDED: {
    label: "Suspended",
    tone: "text-rose-600",
    chip: "border-rose-300/80 bg-rose-50 text-rose-600",
    icon: Ban,
    summary: "Seller is suspended. Selling actions are blocked.",
  },
  REJECTED: {
    label: "Rejected",
    tone: "text-rose-600",
    chip: "border-rose-300/80 bg-rose-50 text-rose-600",
    icon: Ban,
    summary: "This application was declined. The seller must start a new application before they can proceed.",
  },
};

export function getStatusMeta(status: SellerApplicationStatus) {
  return STATUS_META[status];
}

export function StatusBadge({ status }: { status: SellerApplicationStatus }) {
  const meta = getStatusMeta(status);
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
        meta.chip,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export function SellerTypeBadge({ sellerType }: { sellerType: SellerType }) {
  return (
    <span className="inline-flex rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
      {getSellerTypeLabel(sellerType)}
    </span>
  );
}
