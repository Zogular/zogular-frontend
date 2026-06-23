"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Download, ShieldCheck, UserCheck, Users } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminCurrency, formatAdminDate, formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import { CollectionViewToggle, type CollectionViewMode } from "@/components/shared/CollectionViewToggle";
import { recordAdminAudit } from "@/services/admin/audit";
import { adminBuyersApi, type AdminBuyerRecord, type BuyerRiskLevel, type BuyerStatus } from "@/services/admin/buyers";
import { adminHasPermission, CURRENT_ADMIN_IDENTITY } from "@/services/admin/session";

const statusTone: Record<BuyerStatus, AdminTone> = {
  active: "emerald",
  under_review: "amber",
  banned: "rose",
};

const riskTone: Record<BuyerRiskLevel, AdminTone> = {
  low: "emerald",
  medium: "amber",
  high: "rose",
};

export default function AdminBuyersPage() {
  const [buyers, setBuyers] = useState<AdminBuyerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BuyerStatus | "all">("all");
  const [riskFilter, setRiskFilter] = useState<BuyerRiskLevel | "all">("all");
  const [mobileView, setMobileView] = useState<CollectionViewMode>("list");
  const [selectedBuyer, setSelectedBuyer] = useState<AdminBuyerRecord | null>(null);
  const [note, setNote] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);

  const canBanBuyers = adminHasPermission("ban_buyers");
  const canViewBuyers = adminHasPermission("view_buyers");

  const loadBuyers = useCallback(async () => {
    try {
      setLoading(true);
      setBuyers(await adminBuyersApi.fetchBuyers());
    } catch {
      toast.error("Failed to load buyer records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBuyers(); }, [loadBuyers]);

  const filteredBuyers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return buyers.filter((buyer) => {
      const matchesSearch = !normalizedSearch || [buyer.name, buyer.email, buyer.phone, buyer.location, buyer.id]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesStatus = statusFilter === "all" || buyer.status === statusFilter;
      const matchesRisk = riskFilter === "all" || buyer.riskLevel === riskFilter;
      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [buyers, riskFilter, search, statusFilter]);

  const metrics = useMemo(() => {
    const banned = buyers.filter((buyer) => buyer.status === "banned").length;
    const underReview = buyers.filter((buyer) => buyer.status === "under_review").length;
    const highRisk = buyers.filter((buyer) => buyer.riskLevel === "high").length;
    const totalSpend = buyers.reduce((sum, buyer) => sum + buyer.orderSummary.totalSpend, 0);
    return { banned, underReview, highRisk, totalSpend };
  }, [buyers]);

  const syncBuyer = (updatedBuyer: AdminBuyerRecord) => {
    setBuyers((current) => current.map((buyer) => buyer.id === updatedBuyer.id ? updatedBuyer : buyer));
    setSelectedBuyer(updatedBuyer);
  };

  const updateBuyerStatus = async (buyer: AdminBuyerRecord, status: BuyerStatus, actionNote: string) => {
    if (!canBanBuyers) {
      toast.error("You do not have permission to change buyer account state.");
      return;
    }

    try {
      setIsMutating(true);
      await adminBuyersApi.updateBuyerStatus(buyer.id, status, actionNote);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: `buyer_${status}`,
        target: buyer.id,
        severity: status === "banned" ? "critical" : "warning",
        note: actionNote,
      });
      syncBuyer({
        ...buyer,
        status,
        internalNotes: [actionNote, ...buyer.internalNotes],
        timeline: [
          {
            id: `BTL-${Date.now()}`,
            label: toTitleCase(status),
            note: actionNote,
            timestamp: new Date().toISOString(),
          },
          ...buyer.timeline,
        ],
      });
      setNote("");
      toast.success(`${buyer.name} updated to ${toTitleCase(status)}.`);
    } catch {
      toast.error("Failed to update buyer account state.");
    } finally {
      setIsMutating(false);
    }
  };

  const addInternalNote = async () => {
    if (!selectedBuyer || !note.trim()) return toast.error("Add a note before saving.");

    try {
      setIsMutating(true);
      await adminBuyersApi.addBuyerNote(selectedBuyer.id, note.trim());
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "buyer_note_added",
        target: selectedBuyer.id,
        note: note.trim(),
      });
      syncBuyer({
        ...selectedBuyer,
        internalNotes: [note.trim(), ...selectedBuyer.internalNotes],
      });
      setNote("");
      toast.success("Buyer note saved.");
    } catch {
      toast.error("Failed to save buyer note.");
    } finally {
      setIsMutating(false);
    }
  };

  const exportBuyers = () => {
    const header = ["id", "name", "email", "phone", "status", "risk_level", "total_orders", "total_spend"];
    const rows = filteredBuyers.map((buyer) => [
      buyer.id,
      buyer.name,
      buyer.email,
      buyer.phone,
      buyer.status,
      buyer.riskLevel,
      String(buyer.orderSummary.totalOrders),
      String(buyer.orderSummary.totalSpend),
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zogular-buyers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setLastExportedAt(new Date().toISOString());
    toast.success("Buyer CSV exported.");
  };

  if (!canViewBuyers) {
    return <AdminEmptyState title="Access denied" description="Your admin role cannot view buyer records." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Buyers CRM"
        description="Search buyers, review fraud signals, inspect history, and manage account restrictions."
        actions={(
          <Button onClick={exportBuyers} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
            <Download className="mr-2 h-4 w-4" /> Export buyers
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminMetricCard title="Buyer records" value={buyers.length} note="Loaded into admin CRM" icon={<Users className="h-5 w-5" />} tone="indigo" />
        <AdminMetricCard title="Under review" value={metrics.underReview} note="Manual fraud or trust review" icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
        <AdminMetricCard title="High risk" value={metrics.highRisk} note="Requires stricter handling" icon={<ShieldCheck className="h-5 w-5" />} tone="rose" />
        <AdminMetricCard title="Buyer GMV" value={formatAdminCurrency(metrics.totalSpend)} note="Lifetime buyer spend" icon={<UserCheck className="h-5 w-5" />} tone="emerald" />
      </div>

      <AdminToolbar>
        <AdminSearchField value={search} onChange={setSearch} placeholder="Search by buyer, phone, email, location, or ID" className="flex-1" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as BuyerStatus | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All account statuses</option>
          <option value="active">Active</option>
          <option value="under_review">Under review</option>
          <option value="banned">Banned</option>
        </select>
        <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as BuyerRiskLevel | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All risk levels</option>
          <option value="low">Low risk</option>
          <option value="medium">Medium risk</option>
          <option value="high">High risk</option>
        </select>
      </AdminToolbar>

      <CollectionViewToggle
        value={mobileView}
        onChange={setMobileView}
        className="md:hidden"
      />

      {lastExportedAt ? <p className="text-xs font-bold text-zinc-500">Last export: {formatAdminDateTime(lastExportedAt)}</p> : null}

      <section className={cn("md:hidden", mobileView === "grid" ? "grid grid-cols-1 gap-3" : "overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl")}>
        {loading ? (
          <div className="p-10 text-center text-sm font-bold text-zinc-500">Loading buyer intelligence...</div>
        ) : filteredBuyers.length === 0 ? (
          <div className="p-10 text-center text-sm font-bold text-zinc-500">No buyers match this view.</div>
        ) : mobileView === "list" ? (
          <div className="divide-y divide-zinc-100">
            {filteredBuyers.map((buyer) => (
              <div key={buyer.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-black text-zinc-900">{buyer.name}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{buyer.email}</p>
                  </div>
                  <AdminStatusBadge tone={statusTone[buyer.status]}>{toTitleCase(buyer.status)}</AdminStatusBadge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Risk</span>
                    <span>{buyer.riskLevel}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Orders</span>
                    <span>{buyer.orderSummary.totalOrders}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-400">Spend</span>
                    <span>{formatAdminCurrency(buyer.orderSummary.totalSpend)}</span>
                  </span>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button variant="outline" onClick={() => setSelectedBuyer(buyer)} className="h-8 rounded-xl text-[10px] font-bold">View buyer</Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          filteredBuyers.map((buyer) => (
            <article key={buyer.id} className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-zinc-900">{buyer.name}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">{buyer.phone}</p>
                </div>
                <AdminStatusBadge tone={statusTone[buyer.status]}>{toTitleCase(buyer.status)}</AdminStatusBadge>
              </div>
              <div className="mt-2.5 rounded-[1rem] border border-zinc-200 bg-zinc-50/80 px-3">
                <MobileDetailRow label="Risk" value={`${buyer.riskLevel} risk`} />
                <MobileDetailRow label="Orders" value={`${buyer.orderSummary.totalOrders} orders`} />
                <MobileDetailRow label="Spend" value={formatAdminCurrency(buyer.orderSummary.totalSpend)} />
                <MobileDetailRow label="Joined" value={formatAdminDate(buyer.joinedAt)} isLast />
              </div>
              <div className="mt-2.5 flex justify-end">
                <Button variant="outline" onClick={() => setSelectedBuyer(buyer)} className="h-9 rounded-xl text-[11px] font-bold">View buyer</Button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="hidden overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-300">
              <tr>
                <th className="rounded-tl-3xl px-5 py-4 font-black">Buyer</th>
                <th className="px-5 py-4 font-black">Account</th>
                <th className="px-5 py-4 font-black">Risk</th>
                <th className="px-5 py-4 font-black">Orders</th>
                <th className="px-5 py-4 font-black">Disputes</th>
                <th className="rounded-tr-3xl px-5 py-4 text-right font-black">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm font-bold text-zinc-500">Loading buyer intelligence...</td></tr>
              ) : filteredBuyers.length === 0 ? (
                <tr><td colSpan={6}><AdminEmptyState title="No buyers match this view" description="Adjust search or filters to widen the CRM results." /></td></tr>
              ) : filteredBuyers.map((buyer) => (
                <tr key={buyer.id} className="bg-white/55 transition-colors hover:bg-emerald-50/60">
                  <td className="px-5 py-4">
                    <p className="font-black text-zinc-950">{buyer.name}</p>
                    <p className="text-xs font-bold text-zinc-500">{buyer.email} · {buyer.phone}</p>
                    <p className="text-xs font-medium text-zinc-400">{buyer.location}</p>
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={statusTone[buyer.status]}>{toTitleCase(buyer.status)}</AdminStatusBadge>
                    <p className="mt-2 text-xs font-bold text-zinc-500">Joined {formatAdminDate(buyer.joinedAt)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <AdminStatusBadge tone={riskTone[buyer.riskLevel]}>{buyer.riskLevel} risk</AdminStatusBadge>
                    <p className="mt-2 text-xs font-bold text-zinc-500">{buyer.riskSignals.length} risk signals</p>
                  </td>
                  <td className="px-5 py-4 font-bold text-zinc-700">
                    {buyer.orderSummary.totalOrders} orders
                    <p className="text-xs text-zinc-500">{formatAdminCurrency(buyer.orderSummary.totalSpend)}</p>
                  </td>
                  <td className="px-5 py-4 font-bold text-zinc-700">
                    {buyer.disputeSummary.open} open
                    <p className="text-xs text-zinc-500">{buyer.disputeSummary.refundRate}% refund rate</p>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="outline" onClick={() => setSelectedBuyer(buyer)} className="rounded-xl font-black">View buyer</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AdminDetailSheet
        open={Boolean(selectedBuyer)}
        onOpenChange={(open) => !open && setSelectedBuyer(null)}
        title={selectedBuyer?.name ?? "Buyer details"}
        description={selectedBuyer ? `${selectedBuyer.id} · ${selectedBuyer.email}` : "Buyer record"}
        contentClassName="sm:max-w-5xl"
        bodyClassName="p-5 lg:p-6"
      >
        {selectedBuyer ? (
          <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Account status</p>
                  <div className="mt-2"><AdminStatusBadge tone={statusTone[selectedBuyer.status]}>{toTitleCase(selectedBuyer.status)}</AdminStatusBadge></div>
                </div>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Risk level</p>
                  <div className="mt-2"><AdminStatusBadge tone={riskTone[selectedBuyer.riskLevel]}>{selectedBuyer.riskLevel} risk</AdminStatusBadge></div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-[10px] font-black uppercase text-emerald-700">Orders</p>
                  <p className="text-2xl font-black text-zinc-950">{selectedBuyer.orderSummary.totalOrders}</p>
                </div>
                <div className="rounded-2xl bg-indigo-50 p-4">
                  <p className="text-[10px] font-black uppercase text-indigo-700">Spend</p>
                  <p className="text-2xl font-black text-zinc-950">{formatAdminCurrency(selectedBuyer.orderSummary.totalSpend)}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-[10px] font-black uppercase text-amber-700">Disputes</p>
                  <p className="text-2xl font-black text-zinc-950">{selectedBuyer.disputeSummary.open} open</p>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Account actions</h3>
                <p className="mt-1 text-xs font-bold text-zinc-500">Actions use the note field on the right when provided.</p>
                <div className="mt-4 grid gap-2">
                  <Button disabled={isMutating || selectedBuyer.status === "under_review"} variant="outline" onClick={() => updateBuyerStatus(selectedBuyer, "under_review", note.trim() || "Flagged for manual trust review.")} className="rounded-xl font-black">
                    <AlertTriangle className="mr-2 h-4 w-4" /> Flag review
                  </Button>
                  <Button disabled={isMutating || selectedBuyer.status === "banned"} variant="destructive" onClick={() => updateBuyerStatus(selectedBuyer, "banned", note.trim() || "Buyer banned by admin review.")} className="rounded-xl font-black">
                    <Ban className="mr-2 h-4 w-4" /> Ban buyer
                  </Button>
                  <Button disabled={isMutating || selectedBuyer.status === "active"} onClick={() => updateBuyerStatus(selectedBuyer, "active", note.trim() || "Buyer access restored after admin review.")} className="rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                    <UserCheck className="mr-2 h-4 w-4" /> Unban buyer
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-zinc-950">Risk indicators</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {selectedBuyer.riskSignals.length ? selectedBuyer.riskSignals.map((signal) => (
                    <div key={signal.id} className="rounded-2xl border border-zinc-100 bg-white p-3">
                      <AdminStatusBadge tone={riskTone[signal.severity]}>{signal.severity}</AdminStatusBadge>
                      <p className="mt-2 text-sm font-bold text-zinc-700">{signal.label}</p>
                    </div>
                  )) : <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">No current risk signals.</p>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-zinc-950">Timeline</h3>
                <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1 overscroll-contain">
                  {selectedBuyer.timeline.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-zinc-100 bg-white p-3">
                      <p className="text-sm font-black text-zinc-950">{event.label}</p>
                      <p className="text-xs font-bold text-zinc-500">{formatAdminDateTime(event.timestamp)}</p>
                      <p className="mt-1 text-sm text-zinc-600">{event.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-zinc-950">Internal notes</h3>
                <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1 overscroll-contain">
                  {selectedBuyer.internalNotes.map((item, index) => (
                    <p key={`${selectedBuyer.id}-note-${index}`} className="rounded-2xl bg-zinc-50 p-3 text-sm font-bold text-zinc-600">{item}</p>
                  ))}
                </div>
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add trust, fraud, or support note..." className="mt-3 min-h-24 rounded-2xl border-zinc-200 bg-white" />
                <Button onClick={addInternalNote} disabled={isMutating} className="mt-3 rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">Save note</Button>
              </div>
            </div>
          </div>
        ) : null}
      </AdminDetailSheet>
    </div>
  );
}

function MobileDetailRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 py-2", !isLast && "border-b border-zinc-100")}>
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</span>
      <span className="truncate text-right text-[11px] font-bold text-zinc-900">{value}</span>
    </div>
  );
}
