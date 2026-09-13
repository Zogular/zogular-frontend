/**
 * @file types.ts
 * @module features/admin-finance/types
 * @description
 * TypeScript domain contracts, payout rails, transaction metadata,
 * and view tab definitions for the Zogular Finance, Treasury & MoMo Settlement Control Center (F10).
 */

import type { AdminTone } from "@/components/admin/AdminPrimitives";

// ============================================================================
// Treasury & Platform Metric Contracts
// ============================================================================

export interface TreasuryMetrics {
  totalEscrowHeld: number;
  netCommissionEarned: number;
  pendingDisbursements: number;
  collectedCodTotal: number;
  activeSellersCount: number;
}

// ============================================================================
// Payout Lifecycle & Rail Contracts
// ============================================================================

export type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "REJECTED";

export type PayoutRail = "MTN_MOMO" | "AIRTEL_MONEY" | "BANK_TRANSFER";

export const PAYOUT_RAIL_LABELS: Record<PayoutRail, string> = {
  MTN_MOMO: "MTN Mobile Money",
  AIRTEL_MONEY: "Airtel Money",
  BANK_TRANSFER: "Bank Transfer (ZANACO)",
};

export const PAYOUT_STATUS_METADATA: Record<
  PayoutStatus,
  { label: string; tone: AdminTone; description: string }
> = {
  PENDING: {
    label: "Pending Review",
    tone: "amber",
    description: "Requested by seller, awaiting compliance/balance check",
  },
  PROCESSING: {
    label: "Processing",
    tone: "sky",
    description: "Dispatched to MoMo carrier rail, pending settlement receipt",
  },
  COMPLETED: {
    label: "Completed",
    tone: "emerald",
    description: "Funds cleared and verified with telco transaction reference",
  },
  REJECTED: {
    label: "Rejected",
    tone: "rose",
    description: "Declined due to KYC, balance discrepancy, or suspected fraud",
  },
};

export interface AdminPayoutRecord {
  id: string;
  sellerId: string;
  storeName: string;
  ownerName: string;
  phone: string;
  payoutRail: PayoutRail;
  accountNumber: string;
  clearedAmount: number;
  pendingEscrowAmount: number;
  status: PayoutStatus;
  requestedAt: string;
  processedAt?: string | null;
  reference?: string | null;
  notes?: string | null;
}

// ============================================================================
// Auditable Ledger Contracts
// ============================================================================

export type TransactionType =
  | "ESCROW_HOLD"
  | "ESCROW_RELEASE"
  | "COMMISSION_WITHHELD"
  | "COD_CASH_COLLECTED"
  | "PAYOUT_DISBURSED";

export const TRANSACTION_TYPE_META: Record<
  TransactionType,
  { label: string; description: string; tone: AdminTone }
> = {
  ESCROW_HOLD: {
    label: "Escrow Locked",
    description: "Buyer payment held in custody until 72h post-delivery window",
    tone: "amber",
  },
  ESCROW_RELEASE: {
    label: "Escrow Released",
    description: "Funds cleared to seller wallet balance following delivery verification",
    tone: "emerald",
  },
  COMMISSION_WITHHELD: {
    label: "Commission Deducted",
    description: "Marketplace category commission retained by platform treasury",
    tone: "indigo",
  },
  COD_CASH_COLLECTED: {
    label: "COD Cash Collected",
    description: "Cash collected at doorstep by verified courier partner",
    tone: "zinc",
  },
  PAYOUT_DISBURSED: {
    label: "Disbursement",
    description: "Cleared funds pushed to seller MTN/Airtel/Bank wallet",
    tone: "sky",
  },
};

export interface AdminLedgerRecord {
  id: string;
  orderNumber?: string;
  type: TransactionType;
  storeName?: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  timestamp: string;
  notes?: string;
}

// ============================================================================
// View State & Navigation Tabs
// ============================================================================

export type FinanceTabKey = "overview" | "payouts" | "ledger";

export type PayoutQueueTabKey =
  | "all"
  | "needs_action"
  | "processing"
  | "completed"
  | "exceptions";

export interface PayoutQueueTabDefinition {
  key: PayoutQueueTabKey;
  label: string;
  statusFilter?: PayoutStatus;
}

export const PAYOUT_QUEUE_TABS: PayoutQueueTabDefinition[] = [
  { key: "all", label: "All Payouts" },
  { key: "needs_action", label: "Needs Action / Pending", statusFilter: "PENDING" },
  { key: "processing", label: "Processing", statusFilter: "PROCESSING" },
  { key: "completed", label: "Completed", statusFilter: "COMPLETED" },
  { key: "exceptions", label: "Exceptions / Rejected", statusFilter: "REJECTED" },
];
