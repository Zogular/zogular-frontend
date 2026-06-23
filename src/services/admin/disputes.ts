import { throwBackendPendingFeature } from "@/services/backend-pending";

export type DisputeSeverity = "low" | "medium" | "high" | "critical";
export type DisputeStatus = "open" | "waiting_evidence" | "in_review" | "escalated" | "resolved_buyer" | "resolved_seller";
export type DisputeCategory = "delivery" | "payment" | "refund" | "product_quality";

export interface DisputeEvidence {
  buyer: string[];
  seller: string[];
}

export interface LinkedDisputeOrder {
  id: string;
  total: number;
  status: string;
  paymentProvider: string;
  shippingMethod: string;
}

export interface DisputeResolutionEvent {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  note: string;
}

export interface AdminDisputeRecord {
  id: string;
  title: string;
  category: DisputeCategory;
  severity: DisputeSeverity;
  status: DisputeStatus;
  buyerName: string;
  sellerName: string;
  assignedTo: string;
  openedAt: string;
  dueAt: string;
  claimAmount: number;
  linkedOrder: LinkedDisputeOrder;
  evidence: DisputeEvidence;
  internalNotes: string[];
  resolutionHistory: DisputeResolutionEvent[];
}

export const adminDisputesApi = {
  async fetchDisputes(): Promise<AdminDisputeRecord[]> {
    return [];
  },
  async assignDispute(disputeId: string, assignee: string): Promise<void> {
    void disputeId;
    void assignee;
    throwBackendPendingFeature("Admin dispute assignment");
  },
  async updateDisputeStatus(disputeId: string, status: DisputeStatus, note: string): Promise<void> {
    void disputeId;
    void status;
    void note;
    throwBackendPendingFeature("Admin dispute status update");
  },
  async addDisputeNote(disputeId: string, note: string): Promise<void> {
    void disputeId;
    void note;
    throwBackendPendingFeature("Admin dispute note");
  },
};
