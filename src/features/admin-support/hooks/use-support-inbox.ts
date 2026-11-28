"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import {
  adminSupportApi,
  isSupportReadAuthorizationFailure,
  type AdminSupportTicket,
  type AdminTicketCategory,
  type AdminTicketPriority,
  type AdminTicketStatus,
} from "@/services/admin/support";

// Owns the inbox read lifecycle separately from ticket detail and mutations.
export function useSupportInbox(onAuthorizationDenied: () => void) {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueFailed, setQueueFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<AdminTicketCategory | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<AdminTicketPriority | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AdminTicketStatus | "all">("all");
  // The next read's target can change during recovery without scheduling a second effect.
  const requestedPage = useRef(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [queueRevision, refreshQueue] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const loadTickets = async () => {
      setLoading(true);
      setQueueFailed(false);
      const page = requestedPage.current;
      const filters = {
        limit: 10,
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        search: search.trim() || undefined,
      };
      try {
        let res = await adminSupportApi.fetchTickets({ ...filters, page }, signal);
        if (signal.aborted) return;
        if (res.tickets.length === 0 && res.pagination.pages > 0 && page > res.pagination.pages) {
          requestedPage.current = res.pagination.pages;
          res = await adminSupportApi.fetchTickets({ ...filters, page: res.pagination.pages }, signal);
        }
        if (signal.aborted) return;
        // A second shrink or a count/read race must not present a nonempty queue as empty.
        if (res.tickets.length === 0 && res.pagination.total > 0) throw new Error("Inconsistent support page.");
        requestedPage.current = res.pagination.total === 0 ? 1 : res.pagination.page;
        setTickets(res.tickets);
        setPagination(res.pagination);
      } catch (error) {
        if (signal.aborted) return;
        if (isSupportReadAuthorizationFailure(error)) {
          onAuthorizationDenied();
          return;
        }
        setQueueFailed(true);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    };
    void loadTickets();
    return () => controller.abort();
  }, [onAuthorizationDenied, statusFilter, priorityFilter, categoryFilter, search, queueRevision]);

  const goToPage = (page: number) => {
    requestedPage.current = page;
    refreshQueue();
  };

  const resetPage = () => { requestedPage.current = 1; };

  return {
    tickets, loading, queueFailed, pagination, goToPage, refreshQueue,
    search, statusFilter, priorityFilter, categoryFilter,
    setSearch(value: string) { resetPage(); setSearch(value); },
    setStatusFilter(value: AdminTicketStatus | "all") { resetPage(); setStatusFilter(value); },
    setPriorityFilter(value: AdminTicketPriority | "all") { resetPage(); setPriorityFilter(value); },
    setCategoryFilter(value: AdminTicketCategory | "all") { resetPage(); setCategoryFilter(value); },
  };
}
