/**
 * @file admin-support.ts
 * @module features/admin-support/api
 * @description
 * HTTP client wrappers and re-exports for the Admin Support API.
 */

import {
  adminSupportApi,
  type AdminSellerContext,
  type AdminSupportMessage,
  type AdminSupportTicket,
  type AdminTicketCategory,
  type AdminTicketPriority,
  type AdminTicketStatus,
  type FetchTicketsParams,
  type FetchTicketsResponse,
} from "@/services/admin/support";

export const fetchAdminSupportTickets = async (
  params?: FetchTicketsParams
): Promise<FetchTicketsResponse> => {
  return adminSupportApi.fetchTickets(params);
};

export const getAdminSupportTicket = async (
  id: string
): Promise<AdminSupportTicket> => {
  return adminSupportApi.getTicket(id);
};

export const replyToAdminSupportTicket = async (
  ticketId: string,
  body: string
): Promise<AdminSupportMessage> => {
  return adminSupportApi.replyToTicket(ticketId, body);
};

export const updateAdminSupportTicketStatus = async (
  ticketId: string,
  status: AdminTicketStatus
): Promise<AdminSupportTicket> => {
  return adminSupportApi.updateTicketStatus(ticketId, status);
};

export {
  adminSupportApi,
  type AdminSellerContext,
  type AdminSupportMessage,
  type AdminSupportTicket,
  type AdminTicketCategory,
  type AdminTicketPriority,
  type AdminTicketStatus,
  type FetchTicketsParams,
  type FetchTicketsResponse,
};
