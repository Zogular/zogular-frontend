// src/services/support.ts

import { throwBackendPendingFeature } from "@/services/backend-pending";

export type TicketStatus = "open" | "waiting-seller" | "waiting-support" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = "order" | "payout" | "inventory" | "tech" | "account" | "general";

export interface SupportMessage {
  id: string;
  senderType: "support" | "seller" | "system";
  senderName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

export interface SupportStats {
  open: number;
  awaitingSeller: number;
  resolved: number;
  avgResponseHrs: number | null;
}

export const supportApi = {
  async fetchTickets(): Promise<SupportTicket[]> {
    return [];
  },
  async createTicket(subject: string, category: TicketCategory, priority: TicketPriority, message: string): Promise<SupportTicket> {
    void subject;
    void category;
    void priority;
    void message;
    throwBackendPendingFeature("Seller support ticket creation");
  },
  async replyToTicket(ticketId: string, message: string): Promise<SupportMessage> {
    void ticketId;
    void message;
    throwBackendPendingFeature("Seller support reply");
  },
  async resolveTicket(ticketId: string): Promise<void> {
    void ticketId;
    throwBackendPendingFeature("Seller support ticket resolution");
  }
};
