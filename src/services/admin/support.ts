import { z } from "zod";
import { ApiError, apiClient } from "@/services/api";

export function isSupportReadAuthorizationFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function isSupportSessionDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

const ticketStatus = z.enum(["open", "waiting-seller", "waiting-support", "resolved", "closed"]);
const ticketPriority = z.enum(["low", "medium", "high", "urgent"]);
const ticketCategory = z.enum(["order", "payout", "inventory", "tech", "account", "general"]);
export type AdminTicketStatus = z.infer<typeof ticketStatus>;
export type AdminTicketPriority = z.infer<typeof ticketPriority>;
export type AdminTicketCategory = z.infer<typeof ticketCategory>;

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
  displayName?: string;
  email?: string;
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

const timestamp = z.iso.datetime();
const counter = z.int().nonnegative();
const ticketListResponse = z.object({
  status: z.literal("success"),
  results: counter,
  pagination: z.object({ page: z.int().positive(), limit: z.int().positive(), total: counter, pages: counter }),
  data: z.object({ tickets: z.array(z.object({
    id: z.string().min(1),
    subject: z.string(),
    status: ticketStatus,
    priority: ticketPriority,
    category: ticketCategory,
    createdAt: timestamp,
    updatedAt: timestamp,
    resolvedAt: timestamp.nullable(),
    seller: z.object({
      userId: z.string().min(1),
      vendorApplicationId: z.string().min(1),
      displayName: z.string().optional(),
      email: z.string().optional(),
      storeName: z.string().nullable(),
      applicationStatus: z.string().nullable(),
    }),
  })) }),
}).refine(({ results, pagination, data }) => {
  const { page, limit, pages, total } = pagination;
  if (results !== data.tickets.length || pages !== Math.ceil(total / limit)) {
    return false;
  }
  // An empty out-of-range page can recover after the queue shrinks.
  if (page > pages) return results === 0;
  return results === Math.min(limit, total - (page - 1) * limit);
});

export const adminSupportApi = {
  async fetchTickets(params: FetchTicketsParams = {}, signal?: AbortSignal): Promise<FetchTicketsResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.status) searchParams.set("status", params.status);
    if (params.priority) searchParams.set("priority", params.priority);
    if (params.category) searchParams.set("category", params.category);
    if (params.search) searchParams.set("search", params.search);

    const response = await apiClient<unknown>(`/admin/support/tickets?${searchParams.toString()}`, { signal });
    const parsed = ticketListResponse.safeParse(response);
    if (
      !parsed.success ||
      (params.page !== undefined && parsed.data.pagination.page !== params.page) ||
      (params.limit !== undefined && parsed.data.pagination.limit !== params.limit)
    ) {
      throw new ApiError("Support inbox could not be verified.", 502);
    }
    const { results, pagination, data } = parsed.data;
    return { results, pagination, tickets: data.tickets };
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
