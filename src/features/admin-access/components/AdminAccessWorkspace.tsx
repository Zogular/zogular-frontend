/**
 * @file AdminAccessWorkspace.tsx
 * @module features/admin-access/components
 * @description
 * Master feature coordinator for F9 Access Control, Governance & Central Audit Log Explorer.
 * Unifies live directory state, security metrics, tab navigation, role elevation modals,
 * and high-density audit inspection drawers into a cohesive tactile operational workspace.
 */

"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  History,
  RotateCw,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSearchField,
  AdminToolbar,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminAccess } from "../hooks/use-admin-access";
import { useAdminAudit } from "../hooks/use-admin-audit";
import { AccessTabNavigation } from "./AccessTabNavigation";
import { AdminUsersTable } from "./AdminUsersTable";
import { AdminRoleElevationDialog } from "./AdminRoleElevationDialog";
import { AdminUserDetailSheet } from "./AdminUserDetailSheet";
import { RolePermissionMatrixView } from "./RolePermissionMatrixView";
import { AuditLogTable } from "./AuditLogTable";
import { AuditLogDetailSheet } from "./AuditLogDetailSheet";
import { AddStaffMemberDialog } from "./AddStaffMemberDialog";
import type { AccessTabKey } from "../types";

export function AdminAccessWorkspace() {
  const identity = useAdminIdentity();
  const searchParams = useSearchParams();

  const canViewAccess = identity
    ? adminIdentityHasPermission(identity, "access_admin_panel")
    : false;

  const canViewLogs = identity
    ? adminIdentityHasPermission(identity, "view_logs")
    : false;

  // Active Tab state with URL deep-linking support (?tab=audit, ?tab=matrix, ?tab=admins)
  const tabParam = searchParams.get("tab");
  const resolvedTab: AccessTabKey =
    tabParam === "audit" || tabParam === "matrix" || tabParam === "admins"
      ? tabParam
      : "admins";

  const [localTab, setLocalTab] = useState<AccessTabKey | null>(null);
  const activeTab = localTab ?? resolvedTab;

  const handleTabChange = (tab: AccessTabKey) => {
    setLocalTab(tab);
  };

  // Admin Directory Hook
  const {
    admins,
    totalCount: totalAdminsCount,
    totalPages: adminTotalPages,
    page: adminPage,
    setPage: setAdminPage,
    loading: adminsLoading,
    reloadAdmins,
    search: adminSearch,
    setSearch: setAdminSearch,
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
    isMutating: isUserMutating,
    metrics: adminMetrics,
  } = useAdminAccess();

  // Audit Logs Hook (permission-gated)
  const {
    logs,
    pagination: auditPagination,
    loading: auditLoading,
    reloadLogs,
    search: auditSearch,
    setSearch: setAuditSearch,
    actionFilter,
    setActionFilter,
    entityTypeFilter,
    setEntityTypeFilter,
    statusFilter: auditStatusFilter,
    setStatusFilter: setAuditStatusFilter,
    page: auditPage,
    setPage: setAuditPage,
    selectedLog,
    openLogDetail,
    closeLogDetail,
    auditMetrics,
  } = useAdminAudit({ enabled: canViewLogs });

  if (!canViewAccess) {
    return (
      <AdminEmptyState
        title="Access Restricted"
        description="Your operator credentials lack access_admin_panel permission required for access governance."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 1. HEADER & REFRESH ACTION */}
      {/* ========================================================================= */}
      <AdminPageHeader
        title="Access Control & Governance Explorer"
        description="Authoritative identity directory, 33-capability role permission matrix, and real-time immutable audit trail."
        actions={
          <div className="flex items-center gap-2">
            {/* Add Staff Member — SUPER_ADMIN only, admins tab only */}
            {activeTab === "admins" && identity?.claims?.role === "SUPER_ADMIN" && (
              <AddStaffMemberDialog onSuccess={() => void reloadAdmins()} />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void reloadAdmins();
                if (canViewLogs) {
                  void reloadLogs();
                }
              }}
              className="rounded-2xl border-zinc-200/80 bg-white/80 font-bold shadow-xs hover:border-[#063b29] hover:bg-[#fff8ec]"
            >
              <RotateCw className="mr-1.5 h-3.5 w-3.5 text-zinc-600" />
              Refresh Telemetry
            </Button>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* 2. GOVERNANCE METRICS SUMMARY STRIP */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdminMetricCard
          title="Total Staff"
          value={adminMetrics.total}
          note={`${adminMetrics.superAdmins} Super Admin account(s)`}
          icon={<Users className="h-5 w-5" />}
          tone="zinc"
        />
        <AdminMetricCard
          title="Active Operators"
          value={adminMetrics.active}
          note={`${adminMetrics.revoked} account(s) revoked`}
          icon={<UserCheck className="h-5 w-5" />}
          tone="emerald"
        />
        <AdminMetricCard
          title="Audited Events"
          value={canViewLogs ? auditMetrics.totalEvents : "Restricted"}
          note={
            canViewLogs
              ? `${auditMetrics.succeeded} verified transactions`
              : "Requires view_logs permission"
          }
          icon={<History className="h-5 w-5" />}
          tone="amber"
        />
        <AdminMetricCard
          title="Canonical Rules"
          value="33"
          note="Active & reserved boundaries"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="sky"
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. TACTILE TAB NAVIGATION */}
      {/* ========================================================================= */}
      <AccessTabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        adminCount={adminMetrics.active}
        auditCount={auditMetrics.totalEvents}
        canViewLogs={canViewLogs}
      />

      {/* ========================================================================= */}
      {/* 4. TAB SPECIFIC TOOLBAR & CONTROLS */}
      {/* ========================================================================= */}
      {activeTab === "admins" ? (
        <AdminToolbar>
          <div className="flex-1">
            <AdminSearchField
              value={adminSearch}
              onChange={setAdminSearch}
              placeholder="Search staff by name or email..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-800 shadow-xs focus:border-[#063b29] focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="TECH_ADMIN">Tech Admin</option>
              <option value="EXECUTIVE">Executive</option>
              <option value="OPERATIONS">Operations</option>
              <option value="ADMIN">Legacy Admin</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "revoked")
              }
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-800 shadow-xs focus:border-[#063b29] focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Staff</option>
              <option value="revoked">Revoked Staff</option>
            </select>
          </div>
        </AdminToolbar>
      ) : activeTab === "audit" && canViewLogs ? (
        <AdminToolbar>
          <div className="flex-1">
            <AdminSearchField
              value={auditSearch}
              onChange={setAuditSearch}
              placeholder="Search by action, message, actor email, target ID..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-800 shadow-xs focus:border-[#063b29] focus:outline-none"
            >
              <option value="all">All Actions</option>
              <option value="ADMIN_USER_ROLE_CHANGED">Role Elevated / Reassigned</option>
              <option value="ADMIN_USER_DEACTIVATED">Access Revoked</option>
              <option value="ADMIN_USER_REACTIVATED">Access Restored</option>
              <option value="PRODUCT_APPROVED">Product Approved</option>
              <option value="ORDER_STATUS_UPDATED">Order Status Updated</option>
              <option value="CLOUDINARY_CLEANUP_EXECUTION">Storage Purge</option>
            </select>

            {/* Entity Filter */}
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-800 shadow-xs focus:border-[#063b29] focus:outline-none"
            >
              <option value="all">All Entities</option>
              <option value="USER">User Account</option>
              <option value="PRODUCT">Catalog Product</option>
              <option value="ORDER">Customer Order</option>
              <option value="CATEGORY">Taxonomy Category</option>
              <option value="SUPPORT_TICKET">Support Ticket</option>
              <option value="CLOUDINARY_CLEANUP_EXECUTION">Storage Purge</option>
            </select>

            {/* Status Filter */}
            <select
              value={auditStatusFilter}
              onChange={(e) => setAuditStatusFilter(e.target.value)}
              className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-800 shadow-xs focus:border-[#063b29] focus:outline-none"
            >
              <option value="all">All Outcomes</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="DENIED">Denied</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </AdminToolbar>
      ) : null}

      {/* ========================================================================= */}
      {/* 5. TAB VIEW CONTENT */}
      {/* ========================================================================= */}
      {activeTab === "admins" ? (
        <AdminUsersTable
          admins={admins}
          loading={adminsLoading}
          onSelectAdmin={setSelectedAdmin}
          page={adminPage}
          totalPages={adminTotalPages}
          totalCount={totalAdminsCount}
          onPageChange={setAdminPage}
        />
      ) : activeTab === "audit" ? (
        !canViewLogs ? (
          <AdminEmptyState
            title="Audit Trail Restricted"
            description="Your administrator role lacks the view_logs permission required to inspect the central audit log."
          />
        ) : (
          <AuditLogTable
            logs={logs}
            loading={auditLoading}
            onSelectLog={openLogDetail}
            page={auditPage}
            totalPages={auditPagination.pages}
            totalCount={auditPagination.total}
            onPageChange={setAuditPage}
          />
        )
      ) : (
        <RolePermissionMatrixView />
      )}

      {/* ========================================================================= */}
      {/* 6. DRAWERS & DIALOGS */}
      {/* ========================================================================= */}
      {/* Admin User Inspector Drawer */}
      <AdminUserDetailSheet
        admin={selectedAdmin}
        onClose={() => setSelectedAdmin(null)}
        onOpenElevation={openElevationDialog}
        onToggleStatus={handleToggleStatus}
        isMutating={isUserMutating}
      />

      {/* Role Elevation Modal Dialog */}
      <AdminRoleElevationDialog
        open={elevationDialogOpen}
        onClose={closeElevationDialog}
        admin={adminToElevate}
        onConfirm={handleUpdateRole}
        isMutating={isUserMutating}
      />

      {/* Audit Log Detail Sheet */}
      <AuditLogDetailSheet
        log={selectedLog}
        onClose={closeLogDetail}
      />
    </div>
  );
}
