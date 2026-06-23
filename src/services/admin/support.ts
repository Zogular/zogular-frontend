import { throwBackendPendingFeature } from "@/services/backend-pending";

export type SupportTicketStatus = "open" | "pending" | "escalated" | "closed";
export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SupportCategory = "buyer" | "seller" | "orders" | "payments" | "account";

export interface SupportMessage {
  id: string;
  author: string;
  role: "customer" | "seller" | "admin" | "system";
  timestamp: string;
  body: string;
}

export interface LinkedSupportEntity {
  type: "buyer" | "seller" | "order" | "dispute";
  id: string;
  label: string;
}

export interface AdminSupportTicket {
  id: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportTicketStatus;
  requester: string;
  requesterType: "buyer" | "seller";
  assignedTo: string;
  createdAt: string;
  lastActivityAt: string;
  slaDueAt: string;
  linkedEntities: LinkedSupportEntity[];
  messages: SupportMessage[];
  internalNotes: string[];
}

export interface SupportMacro {
  id: string;
  title: string;
  category: SupportCategory;
  body: string;
}

export const adminSupportApi = {
  async fetchTickets(): Promise<{ tickets: AdminSupportTicket[]; macros: SupportMacro[] }> {
    return { tickets: [], macros: [] };
  },
  async replyToTicket(ticketId: string, body: string): Promise<void> {
    void ticketId;
    void body;
    throwBackendPendingFeature("Admin support reply");
  },
  async assignTicket(ticketId: string, assignee: string): Promise<void> {
    void ticketId;
    void assignee;
    throwBackendPendingFeature("Admin support assignment");
  },
  async updateTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<void> {
    void ticketId;
    void status;
    throwBackendPendingFeature("Admin support status update");
  },
};
