"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Store, ShieldCheck, AlertOctagon, 
  MoreHorizontal, CheckCircle2, Ban, Download, Activity, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Architecture Imports
import { adminSellersApi, AdminSellerRecord, SellerVerificationStatus, SellerOperationalStatus } from "@/services/admin/sellers";
import { recordAdminAudit } from "@/services/admin/audit";
import { adminHasPermission, CURRENT_ADMIN_IDENTITY } from "@/services/admin/session";

// ============================================================================
// LOGIC HELPERS & UI MAPS
// ============================================================================
function formatCurrency(value: number) { return `K${value.toLocaleString()}`; }
function formatDate(isoString: string) { return new Intl.DateTimeFormat("en-ZM", { month: "short", day: "numeric", year: "numeric" }).format(new Date(isoString)); }

// Strictly typed custom SVG component
function ClockIcon(props: React.SVGProps<SVGSVGElement>) { 
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ); 
}

const VERIFICATION_UI: Record<SellerVerificationStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  "approved": { label: "Verified", bg: "bg-emerald-950", text: "text-emerald-100", border: "border-emerald-400/50", icon: ShieldCheck },
  "pending": { label: "Pending Review", bg: "bg-amber-950", text: "text-amber-100", border: "border-amber-400/50", icon: ClockIcon },
  "rejected": { label: "Rejected", bg: "bg-rose-950", text: "text-rose-100", border: "border-rose-400/50", icon: Ban },
  "incomplete": { label: "Incomplete", bg: "bg-zinc-900", text: "text-zinc-200", border: "border-zinc-500/50", icon: FileText },
};

const STATUS_UI: Record<SellerOperationalStatus, { label: string; bg: string; text: string; border: string }> = {
  "active": { label: "Active", bg: "bg-emerald-950", text: "text-emerald-100", border: "border-emerald-400/50" },
  "suspended": { label: "Suspended", bg: "bg-rose-950", text: "text-rose-100", border: "border-rose-400/50" },
  "vacation": { label: "Vacation", bg: "bg-indigo-950", text: "text-indigo-100", border: "border-indigo-400/50" },
};

// ============================================================================
// MAIN PAGE EXPORT
// ============================================================================
export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<AdminSellerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SellerOperationalStatus | "all">("all");
  const [verificationFilter, setVerificationFilter] = useState<SellerVerificationStatus | "all">("all");
  const [selectedSeller, setSelectedSeller] = useState<AdminSellerRecord | null>(null);
  const [commissionDraft, setCommissionDraft] = useState("");
  const [complianceNote, setComplianceNote] = useState("");
  const [sellerNotes, setSellerNotes] = useState<Record<string, string[]>>({});
  const [isDetailSaving, setIsDetailSaving] = useState(false);

  // RBAC Action-Level Guards
  const canApprove = adminHasPermission("approve_sellers");
  const canSuspend = adminHasPermission("suspend_sellers");
  const canExport = adminHasPermission("export_reports");
  const canEditCommission = adminHasPermission("edit_commission");

  const loadSellers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminSellersApi.fetchSellers();
      setSellers(data);
    } catch {
      toast.error("Failed to load seller records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSellers(); }, [loadSellers]);

  const filteredSellers = useMemo(() => {
    return sellers.filter(s => {
      const matchesSearch = !searchQuery || s.storeName.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesVer = verificationFilter === "all" || s.verificationStatus === verificationFilter;
      return matchesSearch && matchesStatus && matchesVer;
    });
  }, [sellers, searchQuery, statusFilter, verificationFilter]);

  // --- MUTATION HANDLERS ---
  const handleApprove = async (id: string) => {
    if (!canApprove) return toast.error("Unauthorized action.");
    try {
      await adminSellersApi.approveVerification(id);
      await recordAdminAudit({ actorId: CURRENT_ADMIN_IDENTITY.id, action: "seller_verified", target: id });
      setSellers(prev => prev.map(s => s.id === id ? { ...s, verificationStatus: "approved", status: "active" } : s));
      toast.success("Seller verification approved.");
    } catch {
      toast.error("Failed to approve seller.");
    }
  };

  const handleToggleSuspension = async (id: string, currentStatus: SellerOperationalStatus) => {
    if (!canSuspend) return toast.error("Unauthorized action.");
    const isSuspending = currentStatus === "active";
    
    try {
      if (isSuspending) {
        await adminSellersApi.suspendSeller(id, "Admin manual suspension");
        await recordAdminAudit({ actorId: CURRENT_ADMIN_IDENTITY.id, action: "seller_suspended", target: id, severity: "critical", note: "Admin manual suspension" });
        setSellers(prev => prev.map(s => s.id === id ? { ...s, status: "suspended" } : s));
        setSellerNotes(prev => ({ ...prev, [id]: ["Suspended: Admin manual suspension", ...(prev[id] ?? [])] }));
        toast.success("Seller suspended.");
      } else {
        await adminSellersApi.reactivateSeller(id);
        await recordAdminAudit({ actorId: CURRENT_ADMIN_IDENTITY.id, action: "seller_reactivated", target: id, severity: "warning" });
        setSellers(prev => prev.map(s => s.id === id ? { ...s, status: "active" } : s));
        setSellerNotes(prev => ({ ...prev, [id]: ["Reactivated after admin review.", ...(prev[id] ?? [])] }));
        toast.success("Seller reactivated.");
      }
    } catch {
      toast.error("Failed to update seller status.");
    }
  };

  const handleExport = () => {
    const header = ["id", "store", "owner", "email", "status", "verification", "commission_rate", "lifetime_gmv"];
    const rows = filteredSellers.map((seller) => [
      seller.id,
      seller.storeName,
      seller.ownerName,
      seller.email,
      seller.status,
      seller.verificationStatus,
      seller.commissionRate.toFixed(1),
      String(seller.lifetimeGmv),
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zogular-sellers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredSellers.length} seller records.`);
  };

  const handleMoreActions = (seller: AdminSellerRecord) => {
    setSelectedSeller(seller);
    setCommissionDraft(seller.commissionRate.toFixed(1));
    setComplianceNote("");
  };

  const handleBulkApproveVisible = async () => {
    if (!canApprove) return toast.error("Unauthorized action.");
    const pending = filteredSellers.filter((seller) => seller.verificationStatus === "pending");
    if (pending.length === 0) return toast.error("No visible pending sellers to approve.");

    try {
      await Promise.all(pending.map((seller) => adminSellersApi.approveVerification(seller.id)));
      await recordAdminAudit({ actorId: CURRENT_ADMIN_IDENTITY.id, action: "seller_bulk_approved", target: `${pending.length} visible sellers`, severity: "warning" });
      setSellers((current) => current.map((seller) => pending.some((pendingSeller) => pendingSeller.id === seller.id) ? { ...seller, verificationStatus: "approved", status: "active" } : seller));
      toast.success(`${pending.length} visible pending sellers approved.`);
    } catch {
      toast.error("Failed to bulk approve sellers.");
    }
  };

  const handleSaveCommission = async () => {
    if (!selectedSeller || !canEditCommission) return toast.error("Unauthorized action.");
    const nextRate = Number(commissionDraft);
    if (!Number.isFinite(nextRate) || nextRate < 0 || nextRate > 30) return toast.error("Commission must be between 0 and 30%.");

    try {
      setIsDetailSaving(true);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "seller_commission_updated",
        target: selectedSeller.id,
        severity: "critical",
        note: `${selectedSeller.commissionRate.toFixed(1)}% -> ${nextRate.toFixed(1)}%`,
      });
      const updatedSeller = { ...selectedSeller, commissionRate: nextRate };
      setSellers((current) => current.map((seller) => seller.id === selectedSeller.id ? updatedSeller : seller));
      setSelectedSeller(updatedSeller);
      toast.success("Seller commission updated.");
    } finally {
      setIsDetailSaving(false);
    }
  };

  const handleSaveComplianceNote = async () => {
    if (!selectedSeller || !complianceNote.trim()) return toast.error("Add a compliance note first.");

    await recordAdminAudit({
      actorId: CURRENT_ADMIN_IDENTITY.id,
      action: "seller_compliance_note_added",
      target: selectedSeller.id,
      note: complianceNote.trim(),
    });
    setSellerNotes((current) => ({
      ...current,
      [selectedSeller.id]: [complianceNote.trim(), ...(current[selectedSeller.id] ?? [])],
    }));
    setComplianceNote("");
    toast.success("Compliance note saved.");
  };

  if (loading) return (
    <div className="animate-pulse space-y-6">
      <div className="flex justify-between"><div className="h-10 w-48 rounded-xl bg-zinc-200" /><div className="h-10 w-32 rounded-xl bg-zinc-200" /></div>
      <div className="h-14 rounded-2xl bg-zinc-200" />
      <div className="h-150 rounded-3xl bg-zinc-200" />
    </div>
  );

  return (
    <div className="mx-auto max-w-400 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-12">
      
      {/* 1. HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Sellers CRM</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage onboarding, compliance, and operational status.</p>
        </div>
        {canExport && (
          <Button onClick={handleExport} variant="outline" className="h-10 rounded-xl border-emerald-200/70 bg-white/80 px-4 font-bold text-emerald-800 shadow-md shadow-emerald-900/5 backdrop-blur-xl hover:bg-emerald-50 md:w-auto">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        )}
        {canApprove && (
          <Button onClick={handleBulkApproveVisible} className="h-10 rounded-xl bg-zinc-950 px-4 font-bold text-white shadow-md shadow-zinc-900/20 hover:bg-zinc-800 md:w-auto">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Visible Pending
          </Button>
        )}
      </div>

      {/* 2. FILTERS TOOLBAR */}
      <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-md shadow-zinc-900/5 backdrop-blur-xl md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search by Store Name or ID..." 
            className="h-11 w-full rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium shadow-inner transition-all hover:bg-white focus-visible:ring-zinc-900" 
          />
        </div>
        <div className="flex gap-3">
          <select 
            aria-label="Verification Status Filter" 
            value={verificationFilter} 
            onChange={(e) => setVerificationFilter(e.target.value as SellerVerificationStatus | "all")} 
            className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 pr-8 text-sm font-bold text-zinc-700 shadow-inner outline-none transition-all hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer"
          >
            <option value="all">All Verification</option>
            <option value="approved">Verified</option>
            <option value="pending">Pending Review</option>
            <option value="rejected">Rejected</option>
          </select>
          <select 
            aria-label="Operational Status Filter" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as SellerOperationalStatus | "all")} 
            className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 pr-8 text-sm font-bold text-zinc-700 shadow-inner outline-none transition-all hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* 3. DATA GRID */}
      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left text-sm min-w-250">
            <thead className="border-b border-zinc-100 bg-zinc-100/80 backdrop-blur-sm">
              <tr>
                <th className="rounded-tl-2xl p-4 pl-6 text-[10px] font-black uppercase tracking-wider text-zinc-500">Store & Owner</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Compliance</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Tier / Risk</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Lifetime GMV</th>
                <th className="rounded-tr-2xl p-4 pr-6 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredSellers.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center"><p className="text-sm font-bold text-zinc-500">No sellers match your criteria.</p></td></tr>
              ) : (
                filteredSellers.map((seller) => {
                  const verUI = VERIFICATION_UI[seller.verificationStatus];
                  const VerIcon = verUI.icon;
                  const statUI = STATUS_UI[seller.status];

                  return (
                    <tr key={seller.id} className="group transition-colors hover:bg-emerald-50/35">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-emerald-300 shadow-md shadow-zinc-900/10"><Store className="h-5 w-5" /></div>
                          <div>
                            <p className="font-bold text-zinc-900 transition-colors group-hover:text-emerald-700">{seller.storeName}</p>
                            <p className="text-[10px] font-bold text-zinc-500">{seller.id} • {seller.ownerName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wider", verUI.bg, verUI.text, verUI.border)}>
                          <VerIcon className="h-3 w-3" /> {verUI.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn("inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", statUI.bg, statUI.text, statUI.border)}>
                          {statUI.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-zinc-700">{seller.commissionRate.toFixed(1)}% Commission</span>
                          {seller.riskFlags > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600"><AlertOctagon className="h-3 w-3" /> {seller.riskFlags} Flags</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-black text-zinc-900">{formatCurrency(seller.lifetimeGmv)}</p>
                        <p className="text-[10px] font-bold text-zinc-400">Since {formatDate(seller.joinedAt)}</p>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Action-Level RBAC Enforcement */}
                          {canApprove && seller.verificationStatus === "pending" && (
                            <Button size="sm" onClick={() => handleApprove(seller.id)} className="h-8 rounded-lg bg-[#009E49] text-xs font-bold text-white hover:bg-[#00853d]">
                              <CheckCircle2 className="mr-1.5 h-3 w-3" /> Approve
                            </Button>
                          )}
                          {canSuspend && seller.verificationStatus === "approved" && (
                            <Button variant="outline" size="sm" onClick={() => handleToggleSuspension(seller.id, seller.status)} className={cn("h-8 rounded-lg text-xs font-bold", seller.status === 'active' ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50")}>
                              {seller.status === 'active' ? <Ban className="mr-1.5 h-3 w-3" /> : <Activity className="mr-1.5 h-3 w-3" />}
                              {seller.status === 'active' ? 'Suspend' : 'Reactivate'}
                            </Button>
                          )}
                          <Button onClick={() => handleMoreActions(seller)} variant="ghost" size="icon" aria-label={`More actions for ${seller.storeName}`} className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSeller && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setSelectedSeller(null)} aria-hidden="true" />
          <div className="relative flex h-full w-full max-w-xl flex-col border-l border-white/40 bg-white/95 shadow-2xl shadow-zinc-950/30 backdrop-blur-2xl animate-in slide-in-from-right duration-300">
            <div className="border-b border-zinc-100 bg-zinc-950 px-6 py-5 text-white">
              <h2 className="text-lg font-black">{selectedSeller.storeName}</h2>
              <p className="text-xs font-bold text-zinc-400">{selectedSeller.id} · {selectedSeller.ownerName}</p>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <p className="text-[10px] font-black uppercase text-emerald-700">Lifetime GMV</p>
                  <p className="text-2xl font-black text-zinc-950">{formatCurrency(selectedSeller.lifetimeGmv)}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-[10px] font-black uppercase text-amber-700">Risk flags</p>
                  <p className="text-2xl font-black text-zinc-950">{selectedSeller.riskFlags}</p>
                </div>
              </div>

              <section className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Verification document review</h3>
                <div className="mt-3 grid gap-2">
                  {["NRC or passport", "Business registration", "Payout account proof"].map((documentLabel) => (
                    <div key={documentLabel} className="flex items-center justify-between rounded-2xl bg-zinc-50 p-3">
                      <span className="text-sm font-bold text-zinc-700">{documentLabel}</span>
                      <span className="rounded-lg border border-emerald-400/50 bg-emerald-950 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">Review ready</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Commission controls</h3>
                <p className="mt-1 text-xs font-bold text-zinc-500">Current default rate can be replaced by backend commission contracts later.</p>
                <div className="mt-3 flex gap-2">
                  <Input value={commissionDraft} onChange={(event) => setCommissionDraft(event.target.value)} className="h-11 rounded-xl border-zinc-200" />
                  <Button disabled={isDetailSaving || !canEditCommission} onClick={handleSaveCommission} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">Save</Button>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Compliance notes</h3>
                <Textarea value={complianceNote} onChange={(event) => setComplianceNote(event.target.value)} placeholder="Add compliance note or suspension rationale..." className="mt-3 min-h-24 rounded-2xl border-zinc-200 bg-white" />
                <Button onClick={handleSaveComplianceNote} className="mt-3 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">Save note</Button>
                <div className="mt-3 space-y-2">
                  {(sellerNotes[selectedSeller.id] ?? ["No compliance notes recorded in this frontend session."]).map((note, index) => (
                    <p key={`${selectedSeller.id}-note-${index}`} className="rounded-2xl bg-zinc-50 p-3 text-sm font-bold text-zinc-600">{note}</p>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Seller timeline</h3>
                <div className="mt-3 space-y-2 text-sm font-bold text-zinc-600">
                  <p className="rounded-2xl bg-zinc-50 p-3">Joined Zogular on {formatDate(selectedSeller.joinedAt)}</p>
                  <p className="rounded-2xl bg-zinc-50 p-3">Verification status: {VERIFICATION_UI[selectedSeller.verificationStatus].label}</p>
                  <p className="rounded-2xl bg-zinc-50 p-3">Operational status: {STATUS_UI[selectedSeller.status].label}</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
