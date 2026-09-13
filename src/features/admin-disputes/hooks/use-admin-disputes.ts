"use client";

/**
 * @file use-admin-disputes.ts
 * @module features/admin-disputes/hooks
 * @description
 * Primary state management and lifecycle hook for the Returns, Claims & Disputes Control Center.
 * Handles queue tab switching, 250ms debounced search, category/severity/status filtering,
 * pagination, scroll restoration, detail inspection sheet, and status/note mutations with toast feedback.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import {
  addDisputeNote,
  fetchDisputeById,
  fetchDisputes,
  updateDisputeStatus,
} from "../api/admin-disputes";
import type {
  AdminDisputeRecord,
  DisputeCategory,
  DisputeQueueTabKey,
  DisputeSeverity,
  DisputesPagination,
  DisputeStatus,
} from "../types";
import { DISPUTE_STATUS_METADATA } from "../types";

const PAGE_SIZE = 15;

interface UseAdminDisputesOptions {
  enabled?: boolean;
}

export function useAdminDisputes({ enabled = true }: UseAdminDisputesOptions = {}) {
  // Collection State
  const [disputes, setDisputes] = useState<AdminDisputeRecord[]>([]);
  const [pagination, setPagination] = useState<DisputesPagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);

  // Queue & Filter State
  const [activeTab, setActiveTab] = useState<DisputeQueueTabKey>("needs_action");
  const [categoryFilter, setCategoryFilter] = useState<DisputeCategory | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<DisputeSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Detail Sheet State
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<AdminDisputeRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Mutation State
  const [isMutating, setIsMutating] = useState(false);

  // Debounce search query by 250ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);

    return () => clearTimeout(handler);
  }, [search]);

  // Return scroll position restoration mandate
  useListScrollRestoration("/admin/disputes", !loading);

  // Map active tab to effective query status
  const resolveEffectiveStatus = useCallback((): string | undefined => {
    if (statusFilter !== "all") {
      return statusFilter;
    }

    switch (activeTab) {
      case "needs_action":
        return "open";
      case "in_review":
        return "in_review";
      case "waiting_evidence":
        return "waiting_evidence";
      case "escalated":
        return "escalated";
      case "resolved":
        return "resolved";
      case "all":
      default:
        return undefined;
    }
  }, [activeTab, statusFilter]);

  // Load disputes from API
  const loadDisputes = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setRequestError(null);

      const effectiveStatus = resolveEffectiveStatus();

      const result = await fetchDisputes({
        page,
        limit: PAGE_SIZE,
        status: effectiveStatus,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
        search: debouncedSearch,
      });

      setDisputes(result.disputes);
      setPagination(result.pagination);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load dispute records. Please check connection.";
      setRequestError(message);
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, [
    enabled,
    page,
    resolveEffectiveStatus,
    categoryFilter,
    severityFilter,
    debouncedSearch,
  ]);

  // Trigger load on filter/tab/page changes
  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  // Load detail record when selectedDisputeId changes
  useEffect(() => {
    if (!selectedDisputeId) {
      setSelectedDispute(null);
      return;
    }

    // Immediately show existing item from list if available
    const existing = disputes.find((d) => d.id === selectedDisputeId);
    if (existing) {
      setSelectedDispute(existing);
    }

    let isCancelled = false;
    const fetchDetail = async () => {
      try {
        setDetailLoading(true);
        const detailed = await fetchDisputeById(selectedDisputeId);
        if (!isCancelled) {
          setSelectedDispute(detailed);
        }
      } catch {
        // Fall back to local list record if single fetch is unavailable
      } finally {
        if (!isCancelled) {
          setDetailLoading(false);
        }
      }
    };

    void fetchDetail();

    return () => {
      isCancelled = true;
    };
  }, [selectedDisputeId, disputes]);

  // Tab change handler
  const handleTabChange = useCallback((tab: DisputeQueueTabKey) => {
    setActiveTab(tab);
    setStatusFilter("all");
    setPage(1);
  }, []);

  // Update dispute status mutation with justification
  const handleUpdateStatus = useCallback(
    async (
      id: string,
      payload: { status: DisputeStatus; note: string; assignedTo?: string }
    ) => {
      try {
        setIsMutating(true);
        await updateDisputeStatus(id, payload);

        const statusLabel =
          DISPUTE_STATUS_METADATA[payload.status]?.label || payload.status;
        toast.success(`Dispute status updated to "${statusLabel}"`);

        // Refresh list and detail view
        await loadDisputes();

        if (selectedDisputeId === id) {
          try {
            const updated = await fetchDisputeById(id);
            setSelectedDispute(updated);
          } catch {
            // Retain existing local record
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update dispute status";
        toast.error(message);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [loadDisputes, selectedDisputeId]
  );

  // Add internal note mutation
  const handleAddNote = useCallback(
    async (id: string, note: string) => {
      try {
        setIsMutating(true);
        await addDisputeNote(id, note);
        toast.success("Internal note recorded successfully");

        // Optimistically update selected dispute notes
        setSelectedDispute((prev) => {
          if (!prev || prev.id !== id) return prev;
          return {
            ...prev,
            internalNotes: [...(prev.internalNotes || []), note],
          };
        });

        // Also refresh list to reflect latest state
        await loadDisputes();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to add internal note";
        toast.error(message);
        throw error;
      } finally {
        setIsMutating(false);
      }
    },
    [loadDisputes]
  );

  // Compute live queue tab counts and financial metrics
  const { tabCounts, metrics } = useMemo(() => {
    let needsActionCount = 0;
    let inReviewCount = 0;
    let waitingEvidenceCount = 0;
    let escalatedCount = 0;
    let resolvedCount = 0;
    let totalClaimValue = 0;
    let overdueCount = 0;

    for (const d of disputes) {
      if (d.status === "open") needsActionCount++;
      if (d.status === "in_review") inReviewCount++;
      if (d.status === "waiting_evidence") waitingEvidenceCount++;
      if (d.status === "escalated") escalatedCount++;
      if (d.status === "resolved_buyer" || d.status === "resolved_seller") {
        resolvedCount++;
      } else {
        totalClaimValue += d.claimAmount || 0;
      }

      if (
        d.dueAt &&
        new Date(d.dueAt).getTime() < Date.now() &&
        d.status !== "resolved_buyer" &&
        d.status !== "resolved_seller"
      ) {
        overdueCount++;
      }
    }

    const counts: Record<DisputeQueueTabKey, number> = {
      needs_action: needsActionCount,
      in_review: inReviewCount,
      waiting_evidence: waitingEvidenceCount,
      escalated: escalatedCount,
      resolved: resolvedCount,
      all: disputes.length,
    };

    return {
      tabCounts: counts,
      metrics: {
        totalOpen: needsActionCount + inReviewCount + waitingEvidenceCount + escalatedCount,
        overdueCount,
        escalatedCount,
        totalClaimValue,
      },
    };
  }, [disputes]);

  return {
    // Collection
    disputes,
    pagination,
    loading,
    requestError,
    loadDisputes,

    // Filters & Tabs
    activeTab,
    handleTabChange,
    tabCounts,
    metrics,
    categoryFilter,
    setCategoryFilter,
    severityFilter,
    setSeverityFilter,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,

    // Inspector
    selectedDisputeId,
    setSelectedDisputeId,
    selectedDispute,
    detailLoading,

    // Mutations
    isMutating,
    handleUpdateStatus,
    handleAddNote,
  };
}
