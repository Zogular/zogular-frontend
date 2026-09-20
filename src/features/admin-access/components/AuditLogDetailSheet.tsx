/**
 * @file AuditLogDetailSheet.tsx
 * @module features/admin-access/components
 * @description
 * Slide-out inspection drawer for authoritative Central Audit Log entries.
 * Highlights actor identity, request provenance, operator reason codes,
 * and an interactive Before vs. After state diff viewer.
 */

"use client";

import React, { useState } from "react";
import {
  Code2,
  Copy,
  Check,
  Globe,
  Hash,
  Shield,
  User,
} from "lucide-react";
import {
  AdminDetailSheet,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { formatAdminDateTime } from "@/lib/admin-format";
import {
  AUDIT_OUTCOME_TONES,
  getAuditActionMeta,
  type AdminAuditLogRecord,
} from "../types";

export interface AuditLogDetailSheetProps {
  log: AdminAuditLogRecord | null;
  onClose: () => void;
}

export function AuditLogDetailSheet({
  log,
  onClose,
}: AuditLogDetailSheetProps) {
  const [diffViewMode, setDiffViewMode] = useState<"side-by-side" | "unified">(
    "side-by-side",
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!log) return null;

  const actionMeta = getAuditActionMeta(log.action);
  const outcomeTone = AUDIT_OUTCOME_TONES[log.status] || "zinc";

  const beforeState = (log.metadata?.before as Record<string, unknown>) || null;
  const afterState = (log.metadata?.after as Record<string, unknown>) || null;
  const reasonCode =
    (log.metadata?.operatorReasonCode as string) ||
    (log.metadata?.reasonCode as string) ||
    "STANDARD_ACTION";

  function copyToClipboard(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  return (
    <AdminDetailSheet
      open={Boolean(log)}
      onOpenChange={(open) => !open && onClose()}
      title={actionMeta.label}
      description={`Target: ${log.entityType} ${log.entityId ? `(${log.entityId})` : ""}`}
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* EVENT OVERVIEW CARD */}
        {/* ========================================================================= */}
        <div className="rounded-3xl border border-[#063b29]/15 bg-white/95 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
            <span
              className={`rounded-md border px-2.5 py-0.5 text-xs font-black ${actionMeta.categoryColor}`}
            >
              {actionMeta.category}
            </span>
            <AdminStatusBadge tone={outcomeTone}>
              {log.status.toUpperCase()}
            </AdminStatusBadge>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="font-bold text-zinc-400">Target Entity</span>
              <p className="font-mono font-bold text-zinc-800">
                {log.entityType}
              </p>
            </div>
            <div>
              <span className="font-bold text-zinc-400">Target ID</span>
              <p className="font-mono font-bold text-zinc-800 break-all">
                {log.entityId || "N/A"}
              </p>
            </div>
            <div>
              <span className="font-bold text-zinc-400">Event Timestamp</span>
              <p className="font-bold text-zinc-800">
                {formatAdminDateTime(log.createdAt)}
              </p>
            </div>
            <div>
              <span className="font-bold text-zinc-400">Action Code</span>
              <p className="font-mono text-[11px] font-bold text-zinc-700">
                {log.action}
              </p>
            </div>
          </div>

          {log.message ? (
            <div className="mt-3 rounded-2xl bg-[#fff8ec]/80 p-3 text-xs font-medium text-zinc-800 border border-[#063b29]/10">
              <strong className="block text-zinc-900 mb-0.5">Operator Message:</strong>
              {log.message}
            </div>
          ) : null}
        </div>

        {/* ========================================================================= */}
        {/* ACTOR & REQUEST PROVENANCE */}
        {/* ========================================================================= */}
        <div className="rounded-3xl border border-[#063b29]/15 bg-white/95 p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-3">
            Actor & Request Provenance
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5">
              <span className="flex items-center gap-2 font-bold text-zinc-600">
                <User className="h-3.5 w-3.5 text-zinc-400" />
                Actor Identity
              </span>
              <div className="text-right">
                <span className="font-black text-zinc-950">
                  {log.actor?.firstName
                    ? `${log.actor.firstName} ${log.actor.lastName || ""}`
                    : log.actorUserId}
                </span>
                {log.actor?.email ? (
                  <span className="block text-[11px] text-zinc-500 font-medium">
                    {log.actor.email}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5">
              <span className="flex items-center gap-2 font-bold text-zinc-600">
                <Shield className="h-3.5 w-3.5 text-zinc-400" />
                Actor Role
              </span>
              <span className="font-black text-zinc-900 uppercase">
                {log.actorRole || "UNKNOWN"}
              </span>
            </div>

            {log.ipAddress ? (
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5">
                <span className="flex items-center gap-2 font-bold text-zinc-600">
                  <Globe className="h-3.5 w-3.5 text-zinc-400" />
                  IP Address
                </span>
                <span className="font-mono text-zinc-800">{log.ipAddress}</span>
              </div>
            ) : null}

            {log.requestId ? (
              <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-2.5">
                <span className="flex items-center gap-2 font-bold text-zinc-600">
                  <Hash className="h-3.5 w-3.5 text-zinc-400" />
                  Request ID
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(log.requestId!, "reqId")}
                  className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-zinc-700 hover:text-zinc-950"
                >
                  {log.requestId.slice(0, 20)}
                  {copiedKey === "reqId" ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3 text-zinc-400" />
                  )}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* OPERATIONAL REASON & REASON CODE */}
        {/* ========================================================================= */}
        <div className="rounded-3xl border border-[#063b29]/15 bg-white/95 p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 mb-2">
            Operational Justification
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-zinc-500">Reason Code:</span>
            <code className="rounded-md bg-amber-100/70 px-2 py-0.5 font-mono text-xs font-black text-amber-900 border border-amber-300/60">
              {reasonCode}
            </code>
          </div>
          <p className="text-xs text-zinc-700 leading-relaxed font-medium">
            {log.message || "No custom justification recorded."}
          </p>
        </div>

        {/* ========================================================================= */}
        {/* STATE DIFF VIEWER (BEFORE VS AFTER) */}
        {/* ========================================================================= */}
        <div className="rounded-3xl border border-[#063b29]/15 bg-white/95 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#063b29]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700">
                State Mutation Diff
              </h3>
            </div>
            <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setDiffViewMode("side-by-side")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  diffViewMode === "side-by-side"
                    ? "bg-white text-zinc-950 shadow-xs font-black"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setDiffViewMode("unified")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  diffViewMode === "unified"
                    ? "bg-white text-zinc-950 shadow-xs font-black"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Metadata
              </button>
            </div>
          </div>

          {diffViewMode === "side-by-side" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Before Block */}
              <div className="rounded-2xl border border-rose-200/70 bg-rose-50/40 p-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block mb-1.5">
                  State: Before
                </span>
                {beforeState ? (
                  <pre className="max-h-48 overflow-auto font-mono text-[11px] text-zinc-800 leading-tight">
                    {JSON.stringify(beforeState, null, 2)}
                  </pre>
                ) : (
                  <p className="text-[11px] text-zinc-400 italic">No prior state recorded.</p>
                )}
              </div>

              {/* After Block */}
              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block mb-1.5">
                  State: After
                </span>
                {afterState ? (
                  <pre className="max-h-48 overflow-auto font-mono text-[11px] text-zinc-800 leading-tight">
                    {JSON.stringify(afterState, null, 2)}
                  </pre>
                ) : (
                  <p className="text-[11px] text-zinc-400 italic">No target state recorded.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-3 text-zinc-100">
              <pre className="max-h-64 overflow-auto font-mono text-[11px] leading-relaxed">
                {JSON.stringify(log.metadata || {}, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </AdminDetailSheet>
  );
}
