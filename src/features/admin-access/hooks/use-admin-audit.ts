"use client";

/**
 * @file use-admin-audit.ts
 * @module features/admin-access/hooks
 * @description
 * State management hook for Central Audit Log Explorer.
 * Controls real-time event filtering, entity categorization, search debouncing,
 * pagination, and single audit record inspection drawer state.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchAdminAuditLogs } from "../api/admin-access";
import type { AdminAuditLogRecord, AuditLogsQueryParams } from "../types";

const PAGE_SIZE = 12;

interface UseAdminAuditOptions {
  enabled?: boolean;
}

export function useAdminAudit({ enabled = true }: UseAdminAuditOptions = {}) {
  // Collection state
  const [logs, setLogs] = useState<AdminAuditLogRecord[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Inspection Drawer
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogRecord | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load audit logs
  const loadLogs = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params: AuditLogsQueryParams = {
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
        action: actionFilter !== "all" ? actionFilter : undefined,
        entityType: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      };

      const result = await fetchAdminAuditLogs(params);
      setLogs(result.logs);
      setPagination(result.pagination);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load audit trail.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, debouncedSearch, enabled, entityTypeFilter, page, statusFilter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // Drawer handlers
  const openLogDetail = useCallback((log: AdminAuditLogRecord) => {
    setSelectedLog(log);
  }, []);

  const closeLogDetail = useCallback(() => {
    setSelectedLog(null);
  }, []);

  // Summary counts for quick stats
  const auditMetrics = useMemo(() => {
    const totalEvents = pagination.total;
    const succeeded = logs.filter((l) => l.status.toUpperCase() === "SUCCEEDED").length;
    const denied = logs.filter((l) => l.status.toUpperCase() === "DENIED").length;
    const failed = logs.filter((l) => l.status.toUpperCase() === "FAILED").length;
    return { totalEvents, succeeded, denied, failed };
  }, [logs, pagination.total]);

  return {
    logs,
    pagination,
    loading,
    error,
    reloadLogs: loadLogs,
    search,
    setSearch,
    actionFilter,
    setActionFilter,
    entityTypeFilter,
    setEntityTypeFilter,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    selectedLog,
    openLogDetail,
    closeLogDetail,
    auditMetrics,
  };
}
