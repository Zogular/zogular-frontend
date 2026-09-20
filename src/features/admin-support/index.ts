/**
 * @file index.ts
 * @module features/admin-support
 * @description
 * Public entrypoint for the Zogular Support Operations Center (F8).
 * Exports the primary workspace coordinator, components, domain types,
 * operational macros, and API hooks.
 */

// Components
export { AdminSupportWorkspace } from "./components/AdminSupportWorkspace";
export { SupportQueueTabs } from "./components/SupportQueueTabs";
export { SupportTicketTable } from "./components/SupportTicketTable";
export { SupportTicketMobileCards } from "./components/SupportTicketMobileCards";
export { SupportTicketDetailSheet } from "./components/SupportTicketDetailSheet";

// State hook
export { useAdminSupport } from "./hooks/use-admin-support";

// Macros
export {
  SUPPORT_MACROS,
  type SupportMacro,
} from "./config/macros";

// Types & SLA helpers
export {
  SUPPORT_QUEUE_TABS,
  TICKET_STATUS_METADATA,
  TICKET_PRIORITY_METADATA,
  TICKET_CATEGORY_METADATA,
  getTicketSlaStatus,
  type AdminSellerContext,
  type AdminSupportMessage,
  type AdminSupportTicket,
  type AdminTicketCategory,
  type AdminTicketPriority,
  type AdminTicketStatus,
  type FetchTicketsParams,
  type FetchTicketsResponse,
  type SupportQueueTabItem,
  type SupportQueueTabKey,
  type TicketCategoryMeta,
  type TicketPriorityMeta,
  type TicketSlaStatus,
  type TicketStatusMeta,
} from "./types";

// API
export {
  fetchAdminSupportTickets,
  getAdminSupportTicket,
  replyToAdminSupportTicket,
  updateAdminSupportTicketStatus,
  adminSupportApi,
} from "./api/admin-support";
