import { z } from "zod";
import { ApiError, apiClient } from "@/services/api";

export function isSupportReadAuthorizationFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function isSupportSessionDenied(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function supportReplyRejection(error: unknown) {
  if (!(error instanceof ApiError)) return undefined;
  switch (error.status) {
    case 400: return "invalid";
    case 403: return "denied";
    case 404: return "missing";
    case 409: return "conflict";
    default: return undefined;
  }
}

const ticketStatus = z.enum(["open", "waiting-seller", "waiting-support", "resolved", "closed"]);
const ticketPriority = z.enum(["low", "medium", "high", "urgent"]);
const ticketCategory = z.enum(["order", "payout", "inventory", "tech", "account", "general"]);
export type AdminTicketStatus = z.infer<typeof ticketStatus>;
export type AdminTicketPriority = z.infer<typeof ticketPriority>;
export type AdminTicketCategory = z.infer<typeof ticketCategory>;

export type AdminSupportMessage = z.infer<typeof supportMessage>;
export type AdminSellerContext = z.infer<typeof sellerContext>;
export type AdminSupportTicket = z.infer<typeof ticketSummary> & { messages?: AdminSupportMessage[] };

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
const identifier = z.string().min(1);

// The backend omits protected contact and message text fields for masked actors.
const sellerContext = z.object({
  userId: identifier,
  vendorApplicationId: identifier,
  displayName: z.string().optional(),
  email: z.string().optional(),
  storeName: z.string().nullable(),
  applicationStatus: z.enum([
    "DRAFT", "SUBMITTED", "NEEDS_INFO", "PROVISIONAL", "APPROVED", "RESTRICTED", "SUSPENDED", "REJECTED",
  ]).nullable(),
});

const supportMessage = z.object({
  id: identifier,
  ticketId: identifier,
  senderType: z.enum(["seller", "support", "system"]),
  senderUserId: identifier.nullable(),
  createdAt: timestamp,
  senderName: z.string().optional(),
  body: z.string().optional(),
});

const ticketSummary = z.object({
  id: identifier,
  subject: z.string(),
  status: ticketStatus,
  priority: ticketPriority,
  category: ticketCategory,
  createdAt: timestamp,
  updatedAt: timestamp,
  resolvedAt: timestamp.nullable(),
  seller: sellerContext,
});

const ticketDetail = ticketSummary.extend({ messages: z.array(supportMessage) });
const ticketDetailResponse = z.object({
  status: z.literal("success"),
  data: z.object({ ticket: ticketDetail }),
});

const replyReceipt = z.object({
  status: z.literal("success"),
  data: z.object({
    message: supportMessage.extend({
      senderType: z.literal("support"),
      senderUserId: identifier,
    }),
  }),
});

function matchesSensitiveProjection(canViewSensitiveFields: boolean, ...fields: (string | undefined)[]) {
  return fields.every((field) => (field !== undefined) === canViewSensitiveFields);
}

const counter = z.int().nonnegative();
const ticketListResponse = z.object({
  status: z.literal("success"),
  results: counter,
  pagination: z.object({ page: z.int().positive(), limit: z.int().positive(), total: counter, pages: counter }),
  data: z.object({ tickets: z.array(ticketSummary) }),
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

  async getTicket(id: string, canViewSensitiveFields: boolean): Promise<z.infer<typeof ticketDetail>> {
    const response = await apiClient<unknown>(`/admin/support/tickets/${id}`);
    const parsed = ticketDetailResponse.safeParse(response);
    if (!parsed.success) throw new ApiError("Support conversation could not be verified.", 502);
    const { ticket } = parsed.data.data;
    if (
      ticket.id !== id ||
      !matchesSensitiveProjection(canViewSensitiveFields, ticket.seller.displayName, ticket.seller.email) ||
      ticket.messages.some((message) => message.ticketId !== id ||
        !matchesSensitiveProjection(canViewSensitiveFields, message.senderName, message.body))
    ) {
      throw new ApiError("Support conversation could not be verified.", 502);
    }
    return ticket;
  },

  async replyToTicket(
    ticketId: string,
    body: string,
    actorId: string,
    canViewSensitiveFields: boolean,
  ): Promise<AdminSupportMessage> {
    const response = await apiClient<unknown>(`/admin/support/tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message: body }),
      csrf: true,
      noAutoReplay: true,
      redirect: "error",
    });

    const parsed = replyReceipt.safeParse(response);
    if (!parsed.success) throw new Error("Support reply receipt could not be verified.");
    const { message } = parsed.data.data;
    if (message.ticketId !== ticketId || message.senderUserId !== actorId ||
        !matchesSensitiveProjection(canViewSensitiveFields, message.senderName, message.body)) {
      throw new Error("Support reply receipt could not be verified.");
    }
    return message;
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
