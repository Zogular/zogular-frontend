/**
 * @file use-admin-support.ts
 * @module features/admin-support/hooks
 * @description
 * Primary state management and lifecycle hook for the Support Operations Center.
 * Handles queue tab switching, debounced search, status/priority/category filters,
 * pagination, live metrics, detail inspection, ticket replies, and scroll restoration.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import { toTitleCase } from "@/lib/admin-format";
import {
  fetchAdminSupportTickets,
  getAdminSupportTicket,
  replyToAdminSupportTicket,
  updateAdminSupportTicketStatus,
} from "../api/admin-support";
import type {
  AdminSupportTicket,
  AdminTicketCategory,
  AdminTicketPriority,
  AdminTicketStatus,
  SupportQueueTabKey,
} from "../types";
import { getTicketSlaStatus } from "../types";

const PAGE_SIZE = 15;

interface UseAdminSupportOptions {
  enabled?: boolean;
}

export function useAdminSupport({ enabled = true }: UseAdminSupportOptions = {}) {
  // Collection State
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Filter & Queue Tab State
  const [activeTab, setActiveTab] = useState<SupportQueueTabKey>("needs_action");
  const [statusFilter, setStatusFilter] = useState<AdminTicketStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<AdminTicketCategory | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<AdminTicketPriority | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Inspector & Sheet State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Mutation State
  const [isMutating, setIsMutating] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);

    return () => clearTimeout(handler);
  }, [search]);

  // Return navigation scroll position restoration
  useListScrollRestoration("/admin/support", !loading);

  // Determine query parameters based on active tab & filters
  const resolveEffectiveStatus = useCallback((): string | undefined => {
    if (statusFilter !== "all") {
      return statusFilter;
    }
    if (activeTab === "waiting_seller") {
      return "waiting-seller";
    }
    return undefined;
  }, [activeTab, statusFilter]);

  // Load tickets from API
  const loadTickets = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setRequestError(null);

      const effectiveStatus = resolveEffectiveStatus();

      const response = await fetchAdminSupportTickets({
        page,
        limit: PAGE_SIZE,
        status: effectiveStatus,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        search: debouncedSearch.trim() || undefined,
      });

      setTickets(response.tickets);
      setPagination(response.pagination);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load support tickets.";
      setTickets([]);
      setRequestError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    enabled,
    page,
    priorityFilter,
    categoryFilter,
    resolveEffectiveStatus,
  ]);

  // Fetch tickets when dependencies update
  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  // Filter tickets according to active tab
  const filteredTickets = useMemo(() => {
    if (statusFilter !== "all") {
      return tickets.filter((t) => t.status === statusFilter);
    }

    if (activeTab === "needs_action") {
      return tickets.filter(
        (t) => t.status === "open" || t.status === "waiting-support"
      );
    }

    if (activeTab === "waiting_seller") {
      return tickets.filter((t) => t.status === "waiting-seller");
    }

    if (activeTab === "resolved_closed") {
      return tickets.filter(
        (t) => t.status === "resolved" || t.status === "closed"
      );
    }

    return tickets;
  }, [activeTab, statusFilter, tickets]);

  // Tab Badge Counts derived from current operational snapshot
  const tabCounts = useMemo<Record<SupportQueueTabKey, number | null>>(() => {
    const needsActionCount = tickets.filter(
      (t) => t.status === "open" || t.status === "waiting-support"
    ).length;
    const waitingSellerCount = tickets.filter(
      (t) => t.status === "waiting-seller"
    ).length;
    const resolvedClosedCount = tickets.filter(
      (t) => t.status === "resolved" || t.status === "closed"
    ).length;

    return {
      all: pagination.total,
      needs_action:
        activeTab === "needs_action" ? filteredTickets.length : needsActionCount,
      waiting_seller:
        activeTab === "waiting_seller" ? pagination.total : waitingSellerCount,
      resolved_closed:
        activeTab === "resolved_closed"
          ? filteredTickets.length
          : resolvedClosedCount,
    };
  }, [activeTab, filteredTickets.length, pagination.total, tickets]);

  // Queue Summary Metrics
  const summaryMetrics = useMemo(() => {
    let overdueCount = 0;
    for (const t of tickets) {
      if (t.status !== "resolved" && t.status !== "closed") {
        const sla = getTicketSlaStatus(t);
        if (sla.isOverdue) overdueCount++;
      }
    }

    const needsActionCount = tickets.filter(
      (t) => t.status === "open" || t.status === "waiting-support"
    ).length;
    const waitingSellerCount = tickets.filter(
      (t) => t.status === "waiting-seller"
    ).length;
    const resolvedCount = tickets.filter(
      (t) => t.status === "resolved" || t.status === "closed"
    ).length;

    return {
      total: pagination.total,
      needsAction: needsActionCount,
      waitingSeller: waitingSellerCount,
      resolved: resolvedCount,
      urgentOverdue: overdueCount,
    };
  }, [pagination.total, tickets]);

  // Tab switcher handler
  const handleTabChange = useCallback((newTab: SupportQueueTabKey) => {
    setActiveTab(newTab);
    setStatusFilter("all");
    setPage(1);
  }, []);

  // Open ticket details in inspection sheet
  const openTicket = useCallback(
    async (ticketId: string) => {
      setSelectedTicketId(ticketId);
      const existing = tickets.find((t) => t.id === ticketId);
      if (existing) {
        setSelectedTicket(existing);
      }
      setDetailLoading(true);

      try {
        const detail = await getAdminSupportTicket(ticketId);
        setSelectedTicket(detail);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load ticket details.";
        toast.error(message);
      } finally {
        setDetailLoading(false);
      }
    },
    [tickets]
  );

  // Close inspection sheet
  const closeTicketDetail = useCallback(() => {
    setSelectedTicketId(null);
    setSelectedTicket(null);
  }, []);

  // Reply to ticket mutation
  const handleReply = useCallback(
    async (body: string, nextStatus?: AdminTicketStatus): Promise<boolean> => {
      if (!selectedTicket || !body.trim()) {
        toast.error("Write a response before sending.");
        return false;
      }

      try {
        setIsMutating(true);
        const newMessage = await replyToAdminSupportTicket(
          selectedTicket.id,
          body.trim()
        );

        let finalTicket: AdminSupportTicket = {
          ...selectedTicket,
          status: nextStatus || "waiting-seller",
          updatedAt: new Date().toISOString(),
          messages: [...(selectedTicket.messages || []), newMessage],
        };

        if (nextStatus && nextStatus !== "waiting-seller") {
          const statusRes = await updateAdminSupportTicketStatus(
            selectedTicket.id,
            nextStatus
          );
          finalTicket = {
            ...finalTicket,
            status: statusRes.status,
            resolvedAt: statusRes.resolvedAt,
          };
        }

        setSelectedTicket(finalTicket);
        setTickets((prev) =>
          prev.map((t) =>
            t.id === finalTicket.id
              ? { ...t, status: finalTicket.status, updatedAt: finalTicket.updatedAt }
              : t
          )
        );

        toast.success("Reply submitted successfully.");
        void loadTickets();
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to submit reply.";
        toast.error(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [loadTickets, selectedTicket]
  );

  // Status update mutation
  const handleUpdateStatus = useCallback(
    async (status: AdminTicketStatus): Promise<boolean> => {
      if (!selectedTicket) return false;

      try {
        setIsMutating(true);
        const updated = await updateAdminSupportTicketStatus(
          selectedTicket.id,
          status
        );

        setSelectedTicket((prev) => (prev ? { ...prev, ...updated } : null));
        setTickets((prev) =>
          prev.map((t) =>
            t.id === updated.id
              ? { ...t, status: updated.status, updatedAt: updated.updatedAt }
              : t
          )
        );

        toast.success(`Ticket moved to ${toTitleCase(status.replace("-", " "))}.`);
        void loadTickets();
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update ticket status.";
        toast.error(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [loadTickets, selectedTicket]
  );

  return {
    tickets,
    filteredTickets,
    pagination,
    loading,
    requestError,
    activeTab,
    handleTabChange,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    priorityFilter,
    setPriorityFilter,
    search,
    setSearch,
    page,
    setPage,
    tabCounts,
    summaryMetrics,
    selectedTicketId,
    selectedTicket,
    detailLoading,
    openTicket,
    closeTicketDetail,
    handleReply,
    handleUpdateStatus,
    isMutating,
    reloadTickets: loadTickets,
  };
}
