/**
 * @file AuditLogTable.tsx
 * @module features/admin-access/components
 * @description
 * High-density desktop table and compact mobile cards for authoritative Central Audit Log events.
 * Displays action category badge, entity target pill, authenticated operator credentials,
 * machine-verified outcome status, and inspection trigger.
 */

"use client";

import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminEmptyState,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { formatAdminDateTime } from "@/lib/admin-format";
import {
  AUDIT_OUTCOME_TONES,
  getAuditActionMeta,
  type AdminAuditLogRecord,
} from "../types";

export interface AuditLogTableProps {
  logs: AdminAuditLogRecord[];
  loading: boolean;
  onSelectLog: (log: AdminAuditLogRecord) => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function AuditLogTable({
  logs,
  loading,
  onSelectLog,
  page,
  totalPages,
  totalCount,
  onPageChange,
}: AuditLogTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`loading-audit-${i}`}
            className="h-16 w-full animate-pulse rounded-2xl border border-zinc-200/60 bg-white/60"
          />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-3xl border border-zinc-200/70 bg-white/70 p-8 shadow-sm">
        <AdminEmptyState
          title="No audit events found"
          description="No governance or operational log events match the query filters."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* DESKTOP HIGH-DENSITY AUDIT TABLE (MD & UP) */}
      {/* ========================================================================= */}
      <div className="hidden overflow-hidden rounded-3xl border border-[#063b29]/10 bg-white/90 shadow-lg shadow-zinc-900/5 backdrop-blur-xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-[#fff8ec]/90 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                <th className="px-5 py-4">Action & Target Entity</th>
                <th className="px-5 py-4">Operator / Actor</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Timestamp</th>
                <th className="px-5 py-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {logs.map((log) => {
                const actionMeta = getAuditActionMeta(log.action);
                const outcomeTone =
                  AUDIT_OUTCOME_TONES[log.status] || "zinc";

                return (
                  <tr
                    key={log.id}
                    onClick={() => onSelectLog(log)}
                    className="group cursor-pointer transition-colors hover:bg-[#fff8ec]/35"
                  >
                    {/* Action & Target Entity */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wide",
                              actionMeta.categoryColor,
                            )}
                          >
                            {actionMeta.label}
                          </span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-600">
                            {log.entityType}
                            {log.entityId ? `: ${log.entityId.slice(0, 16)}` : ""}
                          </span>
                        </div>
                        {log.message ? (
                          <p className="line-clamp-1 max-w-md text-[11px] font-medium text-zinc-500">
                            {log.message}
                          </p>
                        ) : null}
                      </div>
                    </td>

                    {/* Operator Credentials */}
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <p className="font-black text-zinc-900 group-hover:text-[#063b29]">
                          {log.actor?.firstName
                            ? `${log.actor.firstName} ${log.actor.lastName || ""}`
                            : log.actorUserId}
                        </p>
                        <p className="text-[11px] font-medium text-zinc-500">
                          {log.actor?.email || log.actorRole}
                        </p>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-3.5">
                      <AdminStatusBadge tone={outcomeTone}>
                        {log.status.toUpperCase()}
                      </AdminStatusBadge>
                    </td>

                    {/* Timestamp */}
                    <td className="px-5 py-3.5 font-semibold text-zinc-600">
                      {formatAdminDateTime(log.createdAt)}
                    </td>

                    {/* Action button */}
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLog(log);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-bold text-zinc-700 shadow-xs transition-all hover:border-[#063b29] hover:bg-[#063b29] hover:text-white"
                      >
                        <Eye className="h-3 w-3" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE AUDIT CARDS (< MD) */}
      {/* ========================================================================= */}
      <div className="grid gap-3 md:hidden">
        {logs.map((log) => {
          const actionMeta = getAuditActionMeta(log.action);
          const outcomeTone = AUDIT_OUTCOME_TONES[log.status] || "zinc";

          return (
            <div
              key={`mob-${log.id}`}
              onClick={() => onSelectLog(log)}
              className="flex flex-col gap-2.5 rounded-2xl border border-[#063b29]/10 bg-white/90 p-4 shadow-sm backdrop-blur-md active:bg-[#fff8ec]/50"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-black",
                    actionMeta.categoryColor,
                  )}
                >
                  {actionMeta.label}
                </span>
                <AdminStatusBadge tone={outcomeTone}>
                  {log.status.toUpperCase()}
                </AdminStatusBadge>
              </div>

              <div className="text-xs">
                <p className="font-black text-zinc-950">
                  {log.actor?.firstName
                    ? `${log.actor.firstName} ${log.actor.lastName || ""}`
                    : log.actorUserId}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {log.actor?.email || log.actorRole}
                </p>
                {log.message ? (
                  <p className="mt-1 text-[11px] text-zinc-600 line-clamp-2">
                    {log.message}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center justify-between border-t border-zinc-100 pt-2 text-[10px] font-semibold text-zinc-500">
                <span>{log.entityType}</span>
                <span>{formatAdminDateTime(log.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* PAGINATION FOOTER */}
      {/* ========================================================================= */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between px-2 pt-2 text-xs">
          <span className="font-semibold text-zinc-500">
            Showing page {page} of {totalPages} ({totalCount} total events)
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
