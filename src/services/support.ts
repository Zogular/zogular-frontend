// src/services/support.ts

import { apiClient } from "@/services/api";

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

function requireString(val: unknown, fieldName: string): string {
  if (typeof val !== "string" || val.trim() === "") {
    throw new Error(`Missing required string field: ${fieldName}`);
  }
  return val;
}

function normalizeStatus(val: unknown): TicketStatus {
  const status = typeof val === "string" ? val.toLowerCase() : "";
  if (["open", "waiting-seller", "waiting-support", "resolved", "closed"].includes(status)) {
    return status as TicketStatus;
  }
  throw new Error(`Invalid ticket status: ${val}`);
}

function normalizePriority(val: unknown): TicketPriority {
  const priority = typeof val === "string" ? val.toLowerCase() : "";
  if (["low", "medium", "high", "urgent"].includes(priority)) {
    return priority as TicketPriority;
  }
  throw new Error(`Invalid ticket priority: ${val}`);
}

function normalizeCategory(val: unknown): TicketCategory {
  const category = typeof val === "string" ? val.toLowerCase() : "";
  if (["order", "payout", "inventory", "tech", "account", "general"].includes(category)) {
    return category as TicketCategory;
  }
  throw new Error(`Invalid ticket category: ${val}`);
}

function normalizeSenderType(val: unknown): "support" | "seller" | "system" {
  const type = typeof val === "string" ? val.toLowerCase() : "";
  if (["support", "seller", "system"].includes(type)) {
    return type as "support" | "seller" | "system";
  }
  throw new Error(`Invalid sender type: ${val}`);
}

function normalizeMessage(val: unknown): SupportMessage {
  const data = val as Record<string, unknown> | null;
  if (!data) throw new Error("Missing message data");
  return {
    id: requireString(data.id, "message.id"),
    senderType: normalizeSenderType(data.senderType),
    senderName: requireString(data.senderName, "message.senderName"),
    body: requireString(data.body, "message.body"),
    createdAt: requireString(data.createdAt, "message.createdAt"),
  };
}

function normalizeTicket(val: unknown): SupportTicket {
  const data = val as Record<string, unknown> | null;
  if (!data) throw new Error("Missing ticket data");
  const messages = Array.isArray(data.messages) ? data.messages.map(normalizeMessage) : [];

  return {
    id: requireString(data.id, "ticket.id"),
    subject: requireString(data.subject, "ticket.subject"),
    status: normalizeStatus(data.status),
    priority: normalizePriority(data.priority),
    category: normalizeCategory(data.category),
    createdAt: requireString(data.createdAt, "ticket.createdAt"),
    updatedAt: requireString(data.updatedAt, "ticket.updatedAt"),
    messages,
  };
}

function normalizeTicketsList(payload: unknown): SupportTicket[] {
  const root = payload as Record<string, unknown> | null;
  const data = root?.data ?? root;
  if (!Array.isArray(data)) {
    throw new Error("Invalid payload: expected an array of tickets");
  }
  return data.map(normalizeTicket);
}

export const supportApi = {
  async fetchTickets(): Promise<SupportTicket[]> {
    const payload = await apiClient<unknown>("/vendor/support/tickets", { method: "GET" });
    return normalizeTicketsList(payload);
  },
  async getTicket(ticketId: string): Promise<SupportTicket> {
    const payload = await apiClient<unknown>(`/vendor/support/tickets/${ticketId}`, { method: "GET" });
    const root = payload as Record<string, unknown> | null;
    return normalizeTicket(root?.data ?? root);
  },
  async createTicket(subject: string, category: TicketCategory, priority: TicketPriority, message: string): Promise<SupportTicket> {
    const payload = await apiClient<unknown>("/vendor/support/tickets", {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ subject, category, priority, message })
    });
    const root = payload as Record<string, unknown> | null;
    return normalizeTicket(root?.data ?? root);
  },
  async replyToTicket(ticketId: string, message: string): Promise<SupportMessage> {
    const payload = await apiClient<unknown>(`/vendor/support/tickets/${ticketId}/messages`, {
      method: "POST",
      csrf: true,
      body: JSON.stringify({ message })
    });
    const root = payload as Record<string, unknown> | null;
    return normalizeMessage(root?.data ?? root);
  },
  async resolveTicket(ticketId: string): Promise<void> {
    await apiClient<unknown>(`/vendor/support/tickets/${ticketId}/resolve`, {
      method: "PATCH",
      csrf: true,
      body: JSON.stringify({})
    });
  }
};
