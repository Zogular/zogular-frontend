/**
 * @file types.ts
 * @module features/admin-disputes/types
 * @description
 * Domain types, metadata mappings, SLA helpers, and queue tab contracts
 * for the Zogular Returns, Claims & Disputes Control Center (F10).
 */

import type { AdminTone } from "@/components/admin/AdminPrimitives";
import type {
  AdminDisputeRecord,
  DisputeCategory,
  DisputeEvidence,
  DisputeResolutionEvent,
  DisputeSeverity,
  DisputeStatus,
  LinkedDisputeOrder,
} from "@/services/admin/disputes";

// Re-export core service types
export type {
  AdminDisputeRecord,
  DisputeCategory,
  DisputeEvidence,
  DisputeResolutionEvent,
  DisputeSeverity,
  DisputeStatus,
  LinkedDisputeOrder,
};

// ============================================================================
// Queue Tab Definitions
// ============================================================================

export type DisputeQueueTabKey =
  | "needs_action"
  | "in_review"
  | "waiting_evidence"
  | "escalated"
  | "resolved"
  | "all";

export interface DisputeQueueTabItem {
  key: DisputeQueueTabKey;
  label: string;
  description: string;
}

export const DISPUTE_QUEUE_TABS: DisputeQueueTabItem[] = [
  {
    key: "needs_action",
    label: "Needs Action",
    description: "New claims and urgent returns requiring immediate triage",
  },
  {
    key: "in_review",
    label: "In Review",
    description: "Active disputes under operational or safety investigation",
  },
  {
    key: "waiting_evidence",
    label: "Waiting Evidence",
    description: "Awaiting customer photos, courier waybills, or seller counter-proof",
  },
  {
    key: "escalated",
    label: "Escalated",
    description: "High-value or deadlocked cases escalated to senior leadership",
  },
  {
    key: "resolved",
    label: "Resolved",
    description: "Concluded cases with buyer refunds or seller fund releases",
  },
  {
    key: "all",
    label: "All Disputes",
    description: "Complete unsegmented registry of returns and claims",
  },
];

// ============================================================================
// Status Metadata
// ============================================================================

export interface DisputeStatusMeta {
  label: string;
  tone: AdminTone;
  description: string;
}

export const DISPUTE_STATUS_METADATA: Record<DisputeStatus, DisputeStatusMeta> = {
  open: {
    label: "Open",
    tone: "amber",
    description: "Claim submitted and awaiting operational triage.",
  },
  waiting_evidence: {
    label: "Waiting Evidence",
    tone: "indigo",
    description: "Awaiting photos, inspection receipts, or merchant rebuttal.",
  },
  in_review: {
    label: "In Review",
    tone: "sky",
    description: "Case actively reviewed by operations and arbitration team.",
  },
  escalated: {
    label: "Escalated",
    tone: "rose",
    description: "Escalated to senior admin for executive arbitration.",
  },
  resolved_buyer: {
    label: "Resolved (Buyer)",
    tone: "emerald",
    description: "Claim upheld; buyer refund or escrow reversal authorized.",
  },
  resolved_seller: {
    label: "Resolved (Seller)",
    tone: "zinc",
    description: "Claim rejected; escrow funds released to merchant wallet.",
  },
};

// ============================================================================
// Severity Metadata
// ============================================================================

export interface DisputeSeverityMeta {
  label: string;
  tone: AdminTone;
}

export const DISPUTE_SEVERITY_METADATA: Record<DisputeSeverity, DisputeSeverityMeta> = {
  critical: {
    label: "Critical",
    tone: "rose",
  },
  high: {
    label: "High",
    tone: "orange",
  },
  medium: {
    label: "Medium",
    tone: "indigo",
  },
  low: {
    label: "Low",
    tone: "zinc",
  },
};

// ============================================================================
// Category Labels
// ============================================================================

export const DISPUTE_CATEGORY_LABELS: Record<DisputeCategory, string> = {
  delivery: "Delivery & Logistics",
  payment: "Payment & MoMo",
  refund: "Refund Request",
  product_quality: "Product Quality & Defect",
};

// ============================================================================
// SLA Calculation Helper
// ============================================================================

export interface DisputeSlaMeta {
  label: string;
  tone: AdminTone;
  isOverdue: boolean;
  hoursRemaining: number;
}

/**
 * Calculates human-readable SLA urgency and deadline indicators.
 */
export function getDisputeSlaMeta(dueAt?: string | null, status?: DisputeStatus): DisputeSlaMeta {
  if (status === "resolved_buyer" || status === "resolved_seller") {
    return {
      label: "Resolved",
      tone: "emerald",
      isOverdue: false,
      hoursRemaining: 0,
    };
  }

  if (!dueAt) {
    return {
      label: "No SLA",
      tone: "zinc",
      isOverdue: false,
      hoursRemaining: 999,
    };
  }

  const dueTime = new Date(dueAt).getTime();
  if (Number.isNaN(dueTime)) {
    return {
      label: "No SLA",
      tone: "zinc",
      isOverdue: false,
      hoursRemaining: 999,
    };
  }

  const diffMs = dueTime - Date.now();
  const hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs <= 0) {
    const overdueHours = Math.abs(hoursRemaining);
    const overdueLabel =
      overdueHours >= 24
        ? `${Math.max(1, Math.round(overdueHours / 24))}d overdue`
        : `${Math.max(1, overdueHours)}h overdue`;

    return {
      label: overdueLabel,
      tone: "rose",
      isOverdue: true,
      hoursRemaining,
    };
  }

  if (hoursRemaining <= 6) {
    return {
      label: `${hoursRemaining}h left`,
      tone: "rose",
      isOverdue: false,
      hoursRemaining,
    };
  }

  if (hoursRemaining <= 24) {
    return {
      label: `${hoursRemaining}h left`,
      tone: "amber",
      isOverdue: false,
      hoursRemaining,
    };
  }

  const daysRemaining = Math.max(1, Math.round(hoursRemaining / 24));
  return {
    label: `${daysRemaining}d left`,
    tone: "zinc",
    isOverdue: false,
    hoursRemaining,
  };
}

// ============================================================================
// Query & Pagination Contracts
// ============================================================================

export interface DisputesPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DisputesQuery {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  severity?: string;
  search?: string;
}
