"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, Clock, FileWarning, HandCoins, Scale } from "lucide-react";
import { toast } from "sonner";
import {
  AdminDetailSheet,
  AdminEmptyState,
  AdminMetricCard,
  AdminPageHeader,
  AdminSearchField,
  AdminStatusBadge,
  AdminToolbar,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminCurrency, formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { BACKEND_INTEGRATION_PENDING_MESSAGE } from "@/services/backend-pending";
import { recordAdminAudit } from "@/services/admin/audit";
import {
  adminDisputesApi,
  type AdminDisputeRecord,
  type DisputeSeverity,
  type DisputeStatus,
} from "@/services/admin/disputes";
import { adminHasPermission, CURRENT_ADMIN_IDENTITY } from "@/services/admin/session";

const statusTone: Record<DisputeStatus, AdminTone> = {
  open: "amber",
  waiting_evidence: "sky",
  in_review: "indigo",
  escalated: "rose",
  resolved_buyer: "emerald",
  resolved_seller: "zinc",
};

const severityTone: Record<DisputeSeverity, AdminTone> = {
  low: "emerald",
  medium: "amber",
  high: "orange",
  critical: "rose",
};

const ADMIN_DISPUTES_BACKEND_PENDING = true;

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<AdminDisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<DisputeSeverity | "all">("all");
  const [selectedDispute, setSelectedDispute] = useState<AdminDisputeRecord | null>(null);
  const [assignee, setAssignee] = useState("");
  const [note, setNote] = useState("");
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const canManageDisputes = adminHasPermission("manage_disputes");

  const loadDisputes = useCallback(async () => {
    try {
      setLoading(true);
      setDisputes(await adminDisputesApi.fetchDisputes());
    } catch {
      toast.error("Failed to load dispute queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDisputes(); }, [loadDisputes]);

  const filteredDisputes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return disputes.filter((dispute) => {
      const matchesSearch = !normalizedSearch || [
        dispute.id,
        dispute.title,
        dispute.buyerName,
        dispute.sellerName,
        dispute.linkedOrder.id,
        dispute.assignedTo,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === "all" || dispute.status === statusFilter;
      const matchesSeverity = severityFilter === "all" || dispute.severity === severityFilter;
      return matchesSearch && matchesStatus && matchesSeverity;
    });
  }, [disputes, search, severityFilter, statusFilter]);

  const metrics = useMemo(() => {
    const open = disputes.filter((dispute) => !dispute.status.startsWith("resolved")).length;
    const escalated = disputes.filter((dispute) => dispute.status === "escalated").length;
    const critical = disputes.filter((dispute) => dispute.severity === "critical").length;
    const exposure = disputes.reduce((sum, dispute) => sum + dispute.claimAmount, 0);
    return { open, escalated, critical, exposure };
  }, [disputes]);

  const syncDispute = (updatedDispute: AdminDisputeRecord) => {
    setDisputes((current) => current.map((dispute) => dispute.id === updatedDispute.id ? updatedDispute : dispute));
    setSelectedDispute(updatedDispute);
  };

  const appendHistory = (dispute: AdminDisputeRecord, action: string, eventNote: string): AdminDisputeRecord => ({
    ...dispute,
    internalNotes: eventNote ? [eventNote, ...dispute.internalNotes] : dispute.internalNotes,
    resolutionHistory: [
      {
        id: `DRH-${Date.now()}`,
        actor: CURRENT_ADMIN_IDENTITY.name,
        action,
        timestamp: new Date().toISOString(),
        note: eventNote,
      },
      ...dispute.resolutionHistory,
    ],
  });

  const assignDispute = async () => {
    if (!selectedDispute || !assignee.trim()) return toast.error("Enter an assignee.");

    try {
      setIsMutating(true);
      await adminDisputesApi.assignDispute(selectedDispute.id, assignee.trim());
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "dispute_assigned",
        target: selectedDispute.id,
        severity: "warning",
        note: `Assigned to ${assignee.trim()}`,
      });
      syncDispute(appendHistory({ ...selectedDispute, assignedTo: assignee.trim(), status: "in_review" }, "Assigned", `Assigned to ${assignee.trim()}.`));
      setAssignee("");
      toast.success("Dispute assigned.");
    } catch {
      toast.error("Failed to assign dispute.");
    } finally {
      setIsMutating(false);
    }
  };

  const updateStatus = async (status: DisputeStatus, action: string, defaultNote: string) => {
    if (!selectedDispute) return;
    const actionNote = note.trim() || defaultNote;

    try {
      setIsMutating(true);
      await adminDisputesApi.updateDisputeStatus(selectedDispute.id, status, actionNote);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action,
        target: selectedDispute.id,
        severity: status === "escalated" ? "critical" : "warning",
        note: actionNote,
      });
      syncDispute(appendHistory({ ...selectedDispute, status }, toTitleCase(action), actionNote));
      setNote("");
      toast.success(`Dispute updated to ${toTitleCase(status)}.`);
    } catch {
      toast.error("Failed to update dispute.");
    } finally {
      setIsMutating(false);
    }
  };

  const setDecisionRecommendation = async (decision: "refund buyer" | "release funds") => {
    if (!selectedDispute) return;
    const actionNote = note.trim() || `Recommendation recorded: ${decision}.`;

    try {
      setIsMutating(true);
      await adminDisputesApi.addDisputeNote(selectedDispute.id, actionNote);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "dispute_resolution_recommendation",
        target: selectedDispute.id,
        severity: "warning",
        note: actionNote,
      });
      setRecommendation(`${toTitleCase(decision)} · ${formatAdminDateTime(new Date().toISOString())}`);
      syncDispute(appendHistory(selectedDispute, "Recommendation", actionNote));
      setNote("");
      toast.success("Resolution recommendation saved.");
    } catch {
      toast.error("Failed to save recommendation.");
    } finally {
      setIsMutating(false);
    }
  };

  if (!canManageDisputes) {
    return <AdminEmptyState title="Access denied" description="Your admin role cannot manage dispute operations." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dispute Queue"
        description="Operations-only preview for delivery, payment, refund, and seller-buyer disputes."
      />

      <FeaturePendingNotice
        title="Dispute actions disabled"
        description="Backend integration pending. Assignment, notes, status changes, refund recommendations, and fund-release recommendations are disabled until backend support is implemented."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminMetricCard title="Open disputes" value={metrics.open} note="Active operational workload" icon={<Scale className="h-5 w-5" />} tone="amber" />
        <AdminMetricCard title="Escalated" value={metrics.escalated} note="Needs senior review" icon={<AlertOctagon className="h-5 w-5" />} tone="rose" />
        <AdminMetricCard title="Critical severity" value={metrics.critical} note="Payment or trust exposure" icon={<FileWarning className="h-5 w-5" />} tone="orange" />
        <AdminMetricCard title="Claim exposure" value={formatAdminCurrency(metrics.exposure)} note="Total disputed amount" icon={<HandCoins className="h-5 w-5" />} tone="emerald" />
      </div>

      <AdminToolbar>
        <AdminSearchField value={search} onChange={setSearch} placeholder="Search dispute, order, buyer, seller, or assignee" className="flex-1" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DisputeStatus | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="waiting_evidence">Waiting evidence</option>
          <option value="in_review">In review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved_buyer">Resolved for buyer</option>
          <option value="resolved_seller">Resolved for seller</option>
        </select>
        <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as DisputeSeverity | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </AdminToolbar>

      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-300">
              <tr>
                <th className="rounded-tl-3xl px-5 py-4 font-black">Dispute</th>
                <th className="px-5 py-4 font-black">Parties</th>
                <th className="px-5 py-4 font-black">Severity</th>
                <th className="px-5 py-4 font-black">Status</th>
                <th className="px-5 py-4 font-black">Owner</th>
                <th className="rounded-tr-3xl px-5 py-4 text-right font-black">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm font-bold text-zinc-500">Loading dispute operations...</td></tr>
              ) : filteredDisputes.length === 0 ? (
                <tr><td colSpan={6}><AdminEmptyState title="No disputes match this view" description="Change filters to see more dispute records." /></td></tr>
              ) : filteredDisputes.map((dispute) => (
                <tr key={dispute.id} className="bg-white/55 transition-colors hover:bg-amber-50/60">
                  <td className="px-5 py-4">
                    <p className="font-black text-zinc-950">{dispute.title}</p>
                    <p className="text-xs font-bold text-zinc-500">{dispute.id} · {toTitleCase(dispute.category)} · {dispute.linkedOrder.id}</p>
                    <p className="text-xs font-medium text-zinc-400">Opened {formatAdminDateTime(dispute.openedAt)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-zinc-700">Buyer: {dispute.buyerName}</p>
                    <p className="text-xs font-bold text-zinc-500">Seller: {dispute.sellerName}</p>
                  </td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={severityTone[dispute.severity]}>{dispute.severity}</AdminStatusBadge></td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={statusTone[dispute.status]}>{toTitleCase(dispute.status)}</AdminStatusBadge></td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-zinc-700">{dispute.assignedTo}</p>
                    <p className="text-xs font-bold text-zinc-500">Due {formatAdminDateTime(dispute.dueAt)}</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="outline" onClick={() => { setSelectedDispute(dispute); setRecommendation(null); }} className="rounded-xl font-black">Open dispute</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AdminDetailSheet
        open={Boolean(selectedDispute)}
        onOpenChange={(open) => !open && setSelectedDispute(null)}
        title={selectedDispute?.title ?? "Dispute"}
        description={selectedDispute ? `${selectedDispute.id} · ${selectedDispute.linkedOrder.id}` : "Dispute details"}
      >
        {selectedDispute ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-rose-50 p-4">
                <p className="text-[10px] font-black uppercase text-rose-700">Claim amount</p>
                <p className="text-2xl font-black text-zinc-950">{formatAdminCurrency(selectedDispute.claimAmount)}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-[10px] font-black uppercase text-amber-700">Severity</p>
                <div className="mt-2"><AdminStatusBadge tone={severityTone[selectedDispute.severity]}>{selectedDispute.severity}</AdminStatusBadge></div>
              </div>
              <div className="rounded-2xl bg-indigo-50 p-4">
                <p className="text-[10px] font-black uppercase text-indigo-700">Status</p>
                <div className="mt-2"><AdminStatusBadge tone={statusTone[selectedDispute.status]}>{toTitleCase(selectedDispute.status)}</AdminStatusBadge></div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Linked order</h3>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <p className="font-bold text-zinc-600">Order: <span className="text-zinc-950">{selectedDispute.linkedOrder.id}</span></p>
                <p className="font-bold text-zinc-600">Total: <span className="text-zinc-950">{formatAdminCurrency(selectedDispute.linkedOrder.total)}</span></p>
                <p className="font-bold text-zinc-600">Payment: <span className="text-zinc-950">{selectedDispute.linkedOrder.paymentProvider}</span></p>
                <p className="font-bold text-zinc-600">Shipping: <span className="text-zinc-950">{selectedDispute.linkedOrder.shippingMethod}</span></p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Buyer evidence</h3>
                <div className="mt-3 space-y-2">
                  {selectedDispute.evidence.buyer.map((item, index) => <p key={`${selectedDispute.id}-buyer-evidence-${index}`} className="rounded-2xl bg-zinc-50 p-3 text-sm font-bold text-zinc-600">{item}</p>)}
                </div>
              </div>
              <div className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Seller evidence</h3>
                <div className="mt-3 space-y-2">
                  {selectedDispute.evidence.seller.map((item, index) => <p key={`${selectedDispute.id}-seller-evidence-${index}`} className="rounded-2xl bg-zinc-50 p-3 text-sm font-bold text-zinc-600">{item}</p>)}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Assignment</h3>
              <p className="mt-1 text-xs font-bold text-zinc-500">Current owner: {selectedDispute.assignedTo}</p>
              <div className="mt-3 flex gap-2">
                <Input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_DISPUTES_BACKEND_PENDING} className="h-11 rounded-xl border-zinc-200" />
                <Button onClick={assignDispute} disabled={ADMIN_DISPUTES_BACKEND_PENDING || isMutating} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">Backend pending</Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-950">Internal note / decision context</h3>
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE} disabled={ADMIN_DISPUTES_BACKEND_PENDING} className="mt-3 min-h-24 rounded-2xl border-zinc-200 bg-white" />
            </div>

            {recommendation ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">{recommendation}</div>
            ) : null}

            <div className="grid gap-2 md:grid-cols-2">
              <Button disabled={ADMIN_DISPUTES_BACKEND_PENDING || isMutating} variant="outline" onClick={() => updateStatus("waiting_evidence", "request_more_evidence", "Requested more evidence from buyer and seller.")} className="rounded-xl font-black">
                <Clock className="mr-2 h-4 w-4" /> Request more evidence
              </Button>
              <Button disabled={ADMIN_DISPUTES_BACKEND_PENDING || isMutating} variant="destructive" onClick={() => updateStatus("escalated", "dispute_escalated", "Escalated for senior operations review.")} className="rounded-xl font-black">
                <AlertOctagon className="mr-2 h-4 w-4" /> Escalate
              </Button>
              <Button disabled={ADMIN_DISPUTES_BACKEND_PENDING || isMutating} onClick={() => updateStatus("resolved_buyer", "resolved_for_buyer", "Resolved in favor of the buyer.")} className="rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve for buyer
              </Button>
              <Button disabled={ADMIN_DISPUTES_BACKEND_PENDING || isMutating} onClick={() => updateStatus("resolved_seller", "resolved_for_seller", "Resolved in favor of the seller.")} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve for seller
              </Button>
              <Button disabled={ADMIN_DISPUTES_BACKEND_PENDING || isMutating} variant="outline" onClick={() => setDecisionRecommendation("refund buyer")} className="rounded-xl font-black">
                Recommend refund
              </Button>
              <Button disabled={ADMIN_DISPUTES_BACKEND_PENDING || isMutating} variant="outline" onClick={() => setDecisionRecommendation("release funds")} className="rounded-xl font-black">
                Recommend release
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-950">Resolution history</h3>
              <div className="mt-3 space-y-3">
                {selectedDispute.resolutionHistory.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-zinc-100 bg-white p-3">
                    <p className="text-sm font-black text-zinc-950">{event.action}</p>
                    <p className="text-xs font-bold text-zinc-500">{event.actor} · {formatAdminDateTime(event.timestamp)}</p>
                    <p className="mt-1 text-sm text-zinc-600">{event.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </AdminDetailSheet>
    </div>
  );
}
