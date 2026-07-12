import { apiClient } from "@/services/api";

export type AdminTicketStatus = "open" | "waiting-seller" | "waiting-support" | "resolved" | "closed";
export type AdminTicketPriority = "low" | "medium" | "high" | "urgent";
export type AdminTicketCategory = "order" | "payout" | "inventory" | "tech" | "account" | "general";

export interface AdminSupportMessage {
  id: string;
  senderType: "seller" | "support" | "system";
  senderName: string;
  body: string;
  createdAt: string;
}

export interface AdminSellerContext {
  userId: string;
  vendorApplicationId: string;
  displayName: string;
  email: string;
  storeName: string | null;
  applicationStatus: string | null;
}

export interface AdminSupportTicket {
  id: string;
  subject: string;
  category: AdminTicketCategory;
  priority: AdminTicketPriority;
  status: AdminTicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  seller: AdminSellerContext;
  messages?: AdminSupportMessage[];
}

export interface FetchTicketsParams {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  category?: string;
  search?: string;
}

export interface FetchTicketsResponse {
  results: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  tickets: AdminSupportTicket[];
}

export const adminSupportApi = {
  async fetchTickets(params: FetchTicketsParams = {}): Promise<FetchTicketsResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.status) searchParams.set("status", params.status);
    if (params.priority) searchParams.set("priority", params.priority);
    if (params.category) searchParams.set("category", params.category);
    if (params.search) searchParams.set("search", params.search);

    const response = await apiClient<{
      data: {
        tickets: AdminSupportTicket[];
      };
      results: number;
      pagination: FetchTicketsResponse["pagination"];
    }>(`/admin/support/tickets?${searchParams.toString()}`);

    return {
      results: response.results || 0,
      pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 1 },
      tickets: Array.isArray(response.data?.tickets) ? response.data.tickets : [],
    };
  },

  async getTicket(id: string): Promise<AdminSupportTicket> {
    const response = await apiClient<{
      data: {
        ticket: AdminSupportTicket;
      };
    }>(`/admin/support/tickets/${id}`);
    
    return response.data.ticket;
  },

  async replyToTicket(ticketId: string, body: string): Promise<AdminSupportMessage> {
    const response = await apiClient<{
      data: {
        message: AdminSupportMessage;
      };
    }>(`/admin/support/tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message: body }),
      csrf: true,
    });
    
    return response.data.message;
  },

  async updateTicketStatus(ticketId: string, status: AdminTicketStatus): Promise<AdminSupportTicket> {
    const response = await apiClient<{
      data: {
        ticket: AdminSupportTicket;
      };
    }>(`/admin/support/tickets/${ticketId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      csrf: true,
    });
    
    return response.data.ticket;
  },
};
