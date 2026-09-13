/**
 * @file AdminUsersTable.tsx
 * @module features/admin-access/components
 * @description
 * High-density desktop table and responsive mobile card presentation for Administrator directory.
 * Renders staff credentials, assigned authority role badge, operational active status,
 * joined timestamp, and direct inspection trigger.
 */

"use client";

import React from "react";
import { ChevronRight, Shield, UserCheck, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminEmptyState,
  AdminStatusBadge,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { formatAdminDateTime } from "@/lib/admin-format";
import type { AdminUserRecord } from "../types";

export function getRoleTone(role: string): AdminTone {
  switch (role) {
    case "SUPER_ADMIN":
      return "rose";
    case "TECH_ADMIN":
      return "sky";
    case "EXECUTIVE":
      return "indigo";
    case "OPERATIONS":
      return "orange";
    case "ADMIN":
      return "emerald";
    default:
      return "zinc";
  }
}

export function AdminRoleBadge({ role }: { role: string }) {
  const tone = getRoleTone(role);
  const formattedRole = role.replace(/_/g, " ");

  return (
    <AdminStatusBadge tone={tone} className="gap-1 shadow-xs">
      <Shield className="h-3 w-3" />
      {formattedRole}
    </AdminStatusBadge>
  );
}

export interface AdminUsersTableProps {
  admins: AdminUserRecord[];
  loading: boolean;
  onSelectAdmin: (admin: AdminUserRecord) => void;
  page?: number;
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
}

export function AdminUsersTable({
  admins,
  loading,
  onSelectAdmin,
  page = 1,
  totalPages = 1,
  totalCount = 0,
  onPageChange,
}: AdminUsersTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`loading-row-${i}`}
            className="h-16 w-full animate-pulse rounded-2xl border border-zinc-200/60 bg-white/60"
          />
        ))}
      </div>
    );
  }

  if (admins.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm">
        <AdminEmptyState
          title="No administrators found"
          description="No staff accounts match the current query or filter criteria."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* DESKTOP TABLE VIEW (MD & UP) */}
      {/* ========================================================================= */}
      <div className="hidden overflow-hidden rounded-3xl border border-[#063b29]/10 bg-white/85 shadow-lg shadow-zinc-900/5 backdrop-blur-xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-[#fff8ec]/80 text-[11px] font-black uppercase tracking-wider text-zinc-600">
                <th className="px-6 py-4">Administrator</th>
                <th className="px-6 py-4">Governance Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100/80">
              {admins.map((admin) => (
                <tr
                  key={admin.id}
                  onClick={() => onSelectAdmin(admin)}
                  className="group cursor-pointer transition-colors hover:bg-[#fff8ec]/40"
                >
                  <td className="px-6 py-4.5">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs shadow-xs",
                          admin.isActive
                            ? "bg-[#063b29] text-white"
                            : "bg-zinc-200 text-zinc-600",
                        )}
                      >
                        {admin.firstName.charAt(0)}
                        {admin.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-black text-zinc-950 group-hover:text-[#063b29]">
                          {admin.firstName} {admin.lastName}
                        </p>
                        <p className="text-xs font-semibold text-zinc-500">
                          {admin.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4.5">
                    <AdminRoleBadge role={admin.role} />
                  </td>
                  <td className="px-6 py-4.5">
                    <AdminStatusBadge tone={admin.isActive ? "emerald" : "rose"}>
                      {admin.isActive ? (
                        <>
                          <UserCheck className="h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX className="h-3 w-3" />
                          Revoked
                        </>
                      )}
                    </AdminStatusBadge>
                  </td>
                  <td className="px-6 py-4.5 text-xs font-bold text-zinc-600">
                    {formatAdminDateTime(admin.createdAt)}
                  </td>
                  <td className="px-6 py-4.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAdmin(admin);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-black text-zinc-700 shadow-xs transition-all hover:border-[#063b29]/30 hover:bg-[#063b29] hover:text-white"
                    >
                      Inspect / Manage
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE COMPACT CARDS VIEW (< MD) */}
      {/* ========================================================================= */}
      <div className="grid gap-3 md:hidden">
        {admins.map((admin) => (
          <div
            key={`mobile-${admin.id}`}
            onClick={() => onSelectAdmin(admin)}
            className="group flex flex-col gap-3 rounded-2xl border border-[#063b29]/10 bg-white/90 p-4 shadow-sm backdrop-blur-md active:bg-[#fff8ec]/50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs shadow-xs",
                    admin.isActive
                      ? "bg-[#063b29] text-white"
                      : "bg-zinc-200 text-zinc-600",
                  )}
                >
                  {admin.firstName.charAt(0)}
                  {admin.lastName.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-black text-zinc-950">
                    {admin.firstName} {admin.lastName}
                  </h4>
                  <p className="text-xs font-medium text-zinc-500">{admin.email}</p>
                </div>
              </div>
              <AdminStatusBadge tone={admin.isActive ? "emerald" : "rose"}>
                {admin.isActive ? "Active" : "Revoked"}
              </AdminStatusBadge>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
              <AdminRoleBadge role={admin.role} />
              <span className="text-[11px] font-bold text-zinc-500">
                {formatAdminDateTime(admin.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* PAGINATION FOOTER */}
      {/* ========================================================================= */}
      {totalPages > 1 && onPageChange ? (
        <div className="flex items-center justify-between px-2 pt-2 text-xs">
          <span className="font-semibold text-zinc-500">
            Showing page {page} of {totalPages} ({totalCount} total administrators)
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-bold text-zinc-700 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-bold text-zinc-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
