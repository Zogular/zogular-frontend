/**
 * @file types.ts
 * @module features/admin-support/types
 * @description
 * TypeScript domain contracts, SLA calculation helpers, status/priority/category
 * metadata, and queue tab definitions for the Zogular Support Operations Center (F8).
 */

import type { ComponentType } from "react";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Wallet,
  Wrench,
} from "lucide-react";
import type { AdminTone } from "@/components/admin/AdminPrimitives";
import type {
  AdminSellerContext,
  AdminSupportMessage,
  AdminSupportTicket,
  AdminTicketCategory,
  AdminTicketPriority,
  AdminTicketStatus,
  FetchTicketsParams,
  FetchTicketsResponse,
} from "@/services/admin/support";

// Re-export core service types
export type {
  AdminSellerContext,
  AdminSupportMessage,
  AdminSupportTicket,
  AdminTicketCategory,
  AdminTicketPriority,
  AdminTicketStatus,
  FetchTicketsParams,
  FetchTicketsResponse,
};

// ============================================================================
// Queue Tab Definitions
// ============================================================================

export type SupportQueueTabKey =
  | "needs_action"
  | "waiting_seller"
  | "resolved_closed"
  | "all";

export interface SupportQueueTabItem {
  key: SupportQueueTabKey;
  label: string;
  description: string;
}

export const SUPPORT_QUEUE_TABS: SupportQueueTabItem[] = [
  {
    key: "needs_action",
    label: "Needs Action",
    description: "Open tickets and replies awaiting support investigation",
  },
  {
    key: "waiting_seller",
    label: "Waiting on Seller",
    description: "Awaiting merchant feedback, KYC documentation, or clarification",
  },
  {
    key: "resolved_closed",
    label: "Resolved & Closed",
    description: "Successfully handled inquiries and archived disputes",
  },
  {
    key: "all",
    label: "All Tickets",
    description: "Complete unsegmented support ticket registry",
  },
];

// ============================================================================
// Status Metadata
// ============================================================================

export interface TicketStatusMeta {
  label: string;
  tone: AdminTone;
  icon: ComponentType<{ className?: string }>;
  description: string;
}

export const TICKET_STATUS_METADATA: Record<AdminTicketStatus, TicketStatusMeta> = {
  open: {
    label: "Open",
    tone: "amber",
    icon: AlertCircle,
    description: "Newly submitted ticket requiring initial triage.",
  },
  "waiting-support": {
    label: "Waiting on Support",
    tone: "amber",
    icon: MessageSquare,
    description: "Seller has responded; pending admin review.",
  },
  "waiting-seller": {
    label: "Waiting on Seller",
    tone: "indigo",
    icon: RotateCcw,
    description: "Support replied; awaiting seller verification or documents.",
  },
  resolved: {
    label: "Resolved",
    tone: "emerald",
    icon: CheckCircle2,
    description: "Issue resolved and confirmed with the merchant.",
  },
  closed: {
    label: "Closed",
    tone: "zinc",
    icon: Archive,
    description: "Ticket finalized and archived.",
  },
};

// ============================================================================
// Priority Metadata & SLA Targets
// ============================================================================

export interface TicketPriorityMeta {
  label: string;
  tone: AdminTone;
  icon: ComponentType<{ className?: string }>;
  description: string;
  slaTargetHours: number;
}

export const TICKET_PRIORITY_METADATA: Record<AdminTicketPriority, TicketPriorityMeta> = {
  urgent: {
    label: "Urgent",
    tone: "rose",
    icon: AlertOctagon,
    description: "Critical operational block (payment failure, account freeze). 2h SLA.",
    slaTargetHours: 2,
  },
  high: {
    label: "High",
    tone: "amber",
    icon: AlertTriangle,
    description: "Severe order or fulfillment disruption. 6h SLA.",
    slaTargetHours: 6,
  },
  medium: {
    label: "Medium",
    tone: "indigo",
    icon: Clock,
    description: "Standard inquiry or configuration query. 24h SLA.",
    slaTargetHours: 24,
  },
  low: {
    label: "Low",
    tone: "zinc",
    icon: Clock,
    description: "General inquiry or platform feedback. 48h SLA.",
    slaTargetHours: 48,
  },
};

// ============================================================================
// Category Metadata
// ============================================================================

export interface TicketCategoryMeta {
  label: string;
  tone: AdminTone;
  icon: ComponentType<{ className?: string }>;
  description: string;
}

export const TICKET_CATEGORY_METADATA: Record<AdminTicketCategory, TicketCategoryMeta> = {
  order: {
    label: "Order & Dispatch",
    tone: "sky",
    icon: ShoppingBag,
    description: "Order fulfillment, Lusaka 3PL delivery, COD collection.",
  },
  payout: {
    label: "Payouts & MoMo",
    tone: "emerald",
    icon: Wallet,
    description: "Tuesday/Friday settlements, Airtel/MTN MoMo verification.",
  },
  inventory: {
    label: "Inventory & Catalog",
    tone: "indigo",
    icon: Layers,
    description: "Stock synchronization, SKU issues, bulk uploads.",
  },
  tech: {
    label: "Technical & Bug",
    tone: "orange",
    icon: Wrench,
    description: "Storefront glitches, mobile responsiveness, login errors.",
  },
  account: {
    label: "Account & KYC",
    tone: "amber",
    icon: ShieldCheck,
    description: "NRC verification, PACRA documents, store branding.",
  },
  general: {
    label: "General Inquiries",
    tone: "zinc",
    icon: HelpCircle,
    description: "Policy clarifications and marketplace onboarding questions.",
  },
};

// ============================================================================
// SLA Calculation Helper
// ============================================================================

export interface TicketSlaStatus {
  label: string;
  tone: AdminTone;
  isOverdue: boolean;
  hoursRemaining: number;
}

/**
 * Computes SLA deadline status based on priority target and elapsed time.
 * - URGENT: 2h target.
 * - HIGH: 6h target.
 * - MEDIUM: 24h target.
 * - LOW: 48h target.
 * 
 * Computes elapsed time from ticket.createdAt (or ticket.updatedAt if waiting-support).
 */
export function getTicketSlaStatus(ticket: AdminSupportTicket): TicketSlaStatus {
  if (ticket.status === "resolved" || ticket.status === "closed") {
    return {
      label: "Completed",
      tone: "emerald",
      isOverdue: false,
      hoursRemaining: 0,
    };
  }

  const normalizedPriority = (ticket.priority?.toLowerCase() || "medium") as AdminTicketPriority;
  const meta = TICKET_PRIORITY_METADATA[normalizedPriority] || TICKET_PRIORITY_METADATA.medium;
  const targetHours = meta.slaTargetHours;

  const startTimeStr =
    ticket.status === "waiting-support" ? ticket.updatedAt || ticket.createdAt : ticket.createdAt;
  const startTime = new Date(startTimeStr).getTime();
  const now = Date.now();

  const elapsedMs = Math.max(0, now - startTime);
  const targetMs = targetHours * 3600 * 1000;
  const remainingMs = targetMs - elapsedMs;
  const hoursRemaining = Math.round((remainingMs / (3600 * 1000)) * 10) / 10;
  const isOverdue = hoursRemaining <= 0;

  if (isOverdue) {
    const overdueHours = Math.abs(Math.round(hoursRemaining));
    return {
      label: overdueHours <= 0 ? "Overdue (< 1h)" : `Overdue (${overdueHours}h)`,
      tone: "rose",
      isOverdue: true,
      hoursRemaining,
    };
  }

  if (hoursRemaining < 2) {
    return {
      label: "< 2h",
      tone: "amber",
      isOverdue: false,
      hoursRemaining,
    };
  }

  if (hoursRemaining <= 12) {
    return {
      label: `Due today (${Math.round(hoursRemaining)}h)`,
      tone: "amber",
      isOverdue: false,
      hoursRemaining,
    };
  }

  return {
    label: `${Math.round(hoursRemaining)}h remaining`,
    tone: "indigo",
    isOverdue: false,
    hoursRemaining,
  };
}
