"use client";

/**
 * @file use-admin-access.ts
 * @module features/admin-access/hooks
 * @description
 * Primary state management hook for Admin Access Control and Staff Governance.
 * Manages operator directory search, role & active filtering, pagination,
 * status toggle mutation, role elevation dialog state, and return scroll restoration.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useListScrollRestoration } from "@/hooks/use-list-scroll-restoration";
import {
  fetchAdminUsers,
  toggleAdminUserStatus,
  updateAdminUserRole,
} from "../api/admin-access";
import type { AdminUserRecord } from "../types";

const PAGE_SIZE = 10;

interface UseAdminAccessOptions {
  enabled?: boolean;
}

export function useAdminAccess({ enabled = true }: UseAdminAccessOptions = {}) {
  // Directory state
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked">("all");
  const [page, setPage] = useState(1);

  // Inspection Drawer
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUserRecord | null>(null);

  // Role Elevation Dialog
  const [elevationDialogOpen, setElevationDialogOpen] = useState(false);
  const [adminToElevate, setAdminToElevate] = useState<AdminUserRecord | null>(null);

  // Mutation states
  const [isMutating, setIsMutating] = useState(false);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Return navigation scroll preservation
  useListScrollRestoration("/admin/access", !loading);

  // Fetch admin staff list
  const loadAdmins = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminUsers();
      setAdmins(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load administrator directory.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  // Filtered admin records
  const filteredAdmins = useMemo(() => {
    return admins.filter((admin) => {
      // Search match
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase().trim();
        const fullName = `${admin.firstName} ${admin.lastName}`.toLowerCase();
        const email = admin.email.toLowerCase();
        if (!fullName.includes(query) && !email.includes(query)) {
          return false;
        }
      }

      // Role match
      if (roleFilter !== "all" && admin.role !== roleFilter) {
        return false;
      }

      // Status match
      if (statusFilter === "active" && !admin.isActive) {
        return false;
      }
      if (statusFilter === "revoked" && admin.isActive) {
        return false;
      }

      return true;
    });
  }, [admins, debouncedSearch, roleFilter, statusFilter]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredAdmins.length / PAGE_SIZE));
  const paginatedAdmins = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredAdmins.slice(start, start + PAGE_SIZE);
  }, [filteredAdmins, page]);

  // Directory KPI Metrics
  const metrics = useMemo(() => {
    const total = admins.length;
    const active = admins.filter((a) => a.isActive).length;
    const revoked = admins.filter((a) => !a.isActive).length;
    const superAdmins = admins.filter((a) => a.role === "SUPER_ADMIN").length;
    return { total, active, revoked, superAdmins };
  }, [admins]);

  // Handler: Open Role Elevation Dialog
  const openElevationDialog = useCallback((admin: AdminUserRecord) => {
    setAdminToElevate(admin);
    setElevationDialogOpen(true);
  }, []);

  const closeElevationDialog = useCallback(() => {
    setElevationDialogOpen(false);
    setAdminToElevate(null);
  }, []);

  // Mutation: Change Role
  const handleUpdateRole = useCallback(
    async (
      adminId: string,
      newRole: string,
      reason: string,
      reasonCode: string,
    ) => {
      try {
        setIsMutating(true);
        const updated = await updateAdminUserRole(
          adminId,
          newRole,
          reason,
          reasonCode,
        );

        toast.success(
          `Administrator role changed to ${newRole.replace(/_/g, " ")}. Active sessions revoked.`,
        );

        // Update local state
        setAdmins((prev) =>
          prev.map((a) => (a.id === adminId ? { ...a, role: updated.role } : a)),
        );

        if (selectedAdmin?.id === adminId) {
          setSelectedAdmin((prev) => (prev ? { ...prev, role: updated.role } : null));
        }

        closeElevationDialog();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update administrator role.";
        toast.error(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [closeElevationDialog, selectedAdmin?.id],
  );

  // Mutation: Toggle Active / Revoke Status
  const handleToggleStatus = useCallback(
    async (
      adminId: string,
      nextIsActive: boolean,
      reason: string,
      reasonCode: string,
    ) => {
      try {
        setIsMutating(true);
        const updated = await toggleAdminUserStatus(
          adminId,
          nextIsActive,
          reason,
          reasonCode,
        );

        toast.success(
          nextIsActive
            ? "Administrator access restored successfully."
            : "Administrator access revoked. Active sessions invalidated.",
        );

        setAdmins((prev) =>
          prev.map((a) =>
            a.id === adminId ? { ...a, isActive: updated.isActive } : a,
          ),
        );

        if (selectedAdmin?.id === adminId) {
          setSelectedAdmin((prev) =>
            prev ? { ...prev, isActive: updated.isActive } : null,
          );
        }

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to toggle administrator status.";
        toast.error(message);
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [selectedAdmin?.id],
  );

  return {
    admins: paginatedAdmins,
    allAdmins: admins,
    totalCount: filteredAdmins.length,
    totalPages,
    page,
    setPage,
    loading,
    error,
    reloadAdmins: loadAdmins,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    selectedAdmin,
    setSelectedAdmin,
    elevationDialogOpen,
    adminToElevate,
    openElevationDialog,
    closeElevationDialog,
    handleUpdateRole,
    handleToggleStatus,
    isMutating,
    metrics,
  };
}
