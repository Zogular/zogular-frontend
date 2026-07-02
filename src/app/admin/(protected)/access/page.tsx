"use client";

import type { FormEvent } from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldAlert, Search, Plus, MoreHorizontal, 
  Mail, X, AlertTriangle, Key, Ban, RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Architecture Imports
import { adminAccessApi, AdminUserRecord, AdminStatus } from "@/services/admin/access";
import { recordAdminAudit } from "@/services/admin/audit";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { AdminRole, ROLE_PERMISSIONS } from "@/services/rbac";

// ============================================================================
// LOGIC HELPERS & UI MAPS
// ============================================================================
function formatDate(isoString?: string) { 
  if (!isoString) return "Never";
  return new Intl.DateTimeFormat("en-ZM", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(isoString)); 
}

const STATUS_UI: Record<AdminStatus, { label: string; bg: string; text: string; border: string }> = {
  "active": { label: "Active", bg: "bg-emerald-950", text: "text-emerald-100", border: "border-emerald-400/50" },
  "invited": { label: "Pending Invite", bg: "bg-amber-950", text: "text-amber-100", border: "border-amber-400/50" },
  "revoked": { label: "Access Revoked", bg: "bg-rose-950", text: "text-rose-100", border: "border-rose-400/50" },
};

const ROLE_UI: Record<AdminRole, { label: string; color: string }> = {
  "super_admin": { label: "Super Admin", color: "text-purple-600 bg-purple-50 border-purple-200" },
  "executive_admin": { label: "Executive", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  "ops_manager": { label: "Ops Manager", color: "text-blue-600 bg-blue-50 border-blue-200" },
  "finance_admin": { label: "Treasury", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  "support_admin": { label: "Support", color: "text-amber-600 bg-amber-50 border-amber-200" },
  "content_admin": { label: "Content", color: "text-pink-600 bg-pink-50 border-pink-200" },
  "viewer": { label: "Investor (Read-Only)", color: "text-zinc-600 bg-zinc-100 border-zinc-200" },
};

// ============================================================================
// MAIN PAGE EXPORT
// ============================================================================
export default function AdminAccessPage() {
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminRole | "all">("all");

  // Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>("ops_manager");
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUserRecord | null>(null);
  const [editedRole, setEditedRole] = useState<AdminRole>("ops_manager");
  const [securityEvents, setSecurityEvents] = useState<Record<string, string[]>>({});

  // RBAC Action-Level Guards
  const identity = useAdminIdentity()!;
  const canManageAdmins = adminIdentityHasPermission(identity, "manage_admins");

  const loadAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminAccessApi.fetchAdmins();
      setAdmins(data);
    } catch {
      toast.error("Failed to load admin records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  const filteredAdmins = useMemo(() => {
    return admins.filter(a => {
      const matchesSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === "all" || a.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [admins, searchQuery, roleFilter]);

  // --- MUTATION HANDLERS ---
  const handleInviteSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManageAdmins) return toast.error("Unauthorized action.");
    if (!newAdminName.trim() || !newAdminEmail.trim()) return toast.error("Name and email are required.");

    setIsInviting(true);
    try {
      const newAdmin = await adminAccessApi.inviteAdmin(newAdminName, newAdminEmail, newAdminRole);
      await recordAdminAudit({
        actorId: identity.id,
        action: "admin_invited",
        target: newAdmin.id,
        severity: "critical",
        note: `${newAdmin.email} as ${newAdmin.role}`,
      });
      setAdmins(prev => [newAdmin, ...prev]);
      setIsInviteModalOpen(false);
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminRole("ops_manager");
      toast.success(`Invite sent to ${newAdminEmail}`);
    } catch {
      toast.error("Failed to send invite.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleToggleAccess = async (adminId: string, currentStatus: AdminStatus) => {
    if (!canManageAdmins) return toast.error("Unauthorized action.");
    if (adminId === identity.id) return toast.error("You cannot revoke your own access.");

    const isRevoking = currentStatus === "active" || currentStatus === "invited";
    
    try {
      if (isRevoking) {
        await adminAccessApi.revokeAccess(adminId);
        await recordAdminAudit({ actorId: identity.id, action: "admin_access_revoked", target: adminId, severity: "critical" });
        setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, status: "revoked" } : a));
        setSecurityEvents(prev => ({ ...prev, [adminId]: ["Access revoked by current admin.", ...(prev[adminId] ?? [])] }));
        toast.success("Access securely revoked.");
      } else {
        await adminAccessApi.restoreAccess(adminId);
        await recordAdminAudit({ actorId: identity.id, action: "admin_access_restored", target: adminId, severity: "critical" });
        setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, status: "active" } : a));
        setSecurityEvents(prev => ({ ...prev, [adminId]: ["Access restored by current admin.", ...(prev[adminId] ?? [])] }));
        toast.success("Access restored.");
      }
    } catch {
      toast.error("Failed to update access status.");
    }
  };

  const handleMemberOptions = (admin: AdminUserRecord) => {
    setSelectedAdmin(admin);
    setEditedRole(admin.role);
  };

  const handleSaveRole = async () => {
    if (!selectedAdmin || editedRole === selectedAdmin.role) return;
    if (selectedAdmin.id === identity.id) return toast.error("You cannot change your own role in-session.");

    await recordAdminAudit({
      actorId: identity.id,
      action: "admin_role_updated",
      target: selectedAdmin.id,
      severity: "critical",
      note: `${selectedAdmin.role} -> ${editedRole}`,
    });
    const updatedAdmin = { ...selectedAdmin, role: editedRole };
    setAdmins(prev => prev.map(admin => admin.id === selectedAdmin.id ? updatedAdmin : admin));
    setSelectedAdmin(updatedAdmin);
    setSecurityEvents(prev => ({ ...prev, [selectedAdmin.id]: [`Role changed to ${ROLE_UI[editedRole].label}.`, ...(prev[selectedAdmin.id] ?? [])] }));
    toast.success("Admin role updated.");
  };

  const handleSecurityAction = async (action: "mfa_reset" | "sessions_revoked") => {
    if (!selectedAdmin) return;
    await recordAdminAudit({
      actorId: identity.id,
      action: `admin_${action}`,
      target: selectedAdmin.id,
      severity: "critical",
    });
    setSecurityEvents(prev => ({
      ...prev,
      [selectedAdmin.id]: [action === "mfa_reset" ? "MFA reset link issued." : "Active sessions revoked.", ...(prev[selectedAdmin.id] ?? [])],
    }));
    toast.success(action === "mfa_reset" ? "MFA reset recorded." : "Sessions revoked.");
  };

  // --- SYSTEM STATES ---
  if (!canManageAdmins) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center animate-in fade-in zoom-in-95">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-50 border-8 border-rose-100/50 mb-6">
          <ShieldAlert className="h-8 w-8 text-rose-600" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900">Access Restricted</h2>
        <p className="mt-2 text-sm font-medium text-zinc-500 max-w-md">Your current role ({identity.claims.role.replace(/_/g, " ")}) does not have clearance to view or modify platform access controls.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="animate-pulse space-y-6">
      <div className="flex justify-between"><div className="h-10 w-64 rounded-xl bg-zinc-200" /><div className="h-10 w-32 rounded-xl bg-zinc-200" /></div>
      <div className="h-125 rounded-3xl bg-zinc-200" />
    </div>
  );

  return (
    <div className="mx-auto max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-12">
      
      {/* 1. HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Access Control</h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage internal team roles, permissions, and security overrides.</p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)} className="h-10 rounded-xl bg-zinc-950 px-4 font-bold text-white shadow-md shadow-zinc-900/20 hover:bg-zinc-800 md:w-auto transition-all active:scale-95">
          <Plus className="mr-2 h-4 w-4" /> Invite Team Member
        </Button>
      </div>

      {/* 2. FILTERS TOOLBAR */}
      <div className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/75 p-4 shadow-md shadow-zinc-900/5 backdrop-blur-xl md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            placeholder="Search team member by name or email..." 
            className="h-11 w-full rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium focus-visible:ring-zinc-900 shadow-inner transition-all hover:bg-white" 
          />
        </div>
        <select 
          aria-label="Filter by Role" 
          value={roleFilter} 
          onChange={(e) => setRoleFilter(e.target.value as AdminRole | "all")} 
          className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 pr-8 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer transition-all hover:bg-white"
        >
          <option value="all">All Roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="executive_admin">Executive</option>
          <option value="ops_manager">Ops Manager</option>
          <option value="finance_admin">Treasury</option>
          <option value="support_admin">Support</option>
          <option value="content_admin">Content</option>
          <option value="viewer">Investor / Viewer</option>
        </select>
      </div>

      {/* 3. PREMIUM DATA GRID */}
      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/75 shadow-md shadow-zinc-900/5 backdrop-blur-xl">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left text-sm min-w-250">
            <thead className="border-b border-zinc-100 bg-zinc-100/80 backdrop-blur-sm">
              <tr>
                <th className="rounded-tl-2xl p-4 pl-6 text-[10px] font-black uppercase tracking-wider text-zinc-500">Team Member</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Security Role</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">Last Active</th>
                <th className="rounded-tr-2xl p-4 pr-6 text-right text-[10px] font-black uppercase tracking-wider text-zinc-500">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredAdmins.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center"><p className="text-sm font-bold text-zinc-500">No team members match your search.</p></td></tr>
              ) : (
                filteredAdmins.map((admin) => {
                  const statUI = STATUS_UI[admin.status];
                  const roleUI = ROLE_UI[admin.role];
                  const isSelf = admin.id === identity.id;

                  return (
                    <tr key={admin.id} className="group transition-colors hover:bg-indigo-50/35">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-emerald-300 font-black shadow-md shadow-zinc-900/10">
                            {admin.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-zinc-900 group-hover:text-indigo-600 transition-colors">
                              {admin.name} {isSelf && <span className="ml-1 text-[10px] text-zinc-400 font-bold">(You)</span>}
                            </p>
                            <p className="text-xs font-medium text-zinc-500">{admin.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", roleUI.color)}>
                          {roleUI.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider", statUI.bg, statUI.text, statUI.border)}>
                           {statUI.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-zinc-700">{formatDate(admin.lastLogin)}</p>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            disabled={isSelf}
                            onClick={() => handleToggleAccess(admin.id, admin.status)}
                            className={cn("h-8 rounded-lg text-xs font-bold transition-all shadow-sm", 
                              admin.status === 'revoked' 
                                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" 
                                : "border-rose-200 text-rose-700 hover:bg-rose-50"
                            )}
                          >
                            {admin.status === 'revoked' ? <RefreshCcw className="mr-1.5 h-3 w-3" /> : <Ban className="mr-1.5 h-3 w-3" />}
                            {admin.status === 'revoked' ? 'Restore' : 'Revoke'}
                          </Button>
                          <Button onClick={() => handleMemberOptions(admin)} variant="ghost" size="icon" aria-label={`More access actions for ${admin.name}`} className="h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
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

      {/* 4. PREMIUM GLASS MODAL (INVITE TEAM) */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity" onClick={() => !isInviting && setIsInviteModalOpen(false)} aria-hidden="true" />
          
          <div className="relative w-full max-w-lg animate-in zoom-in-95 fade-in rounded-3xl border border-white/50 bg-white/85 p-6 shadow-2xl shadow-zinc-950/20 backdrop-blur-2xl overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-emerald-400 via-amber-300 to-indigo-400" />
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="icon" disabled={isInviting} onClick={() => setIsInviteModalOpen(false)} aria-label="Close modal" className="h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-emerald-300 border border-zinc-800 shadow-lg shadow-zinc-900/20"><Key className="h-5 w-5" /></div>
              <div>
                <h2 className="text-xl font-black text-zinc-900 leading-tight">Invite Team Member</h2>
                <p className="text-xs font-medium text-zinc-500">Grant secure access to the Zogular Admin Hub.</p>
              </div>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Full Name</label>
                <Input 
                  value={newAdminName} 
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="e.g. John Doe" 
                  className="h-11 rounded-xl bg-zinc-50 text-sm font-medium shadow-inner focus-visible:ring-zinc-900"
                  disabled={isInviting}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Corporate Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input 
                    type="email"
                    value={newAdminEmail} 
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="name@zogular.com"
                    className="h-11 rounded-xl bg-zinc-50 pl-9 text-sm font-medium shadow-inner focus-visible:ring-zinc-900"
                    disabled={isInviting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Security Clearance (Role)</label>
                <select 
                  aria-label="Select Security Role"
                  value={newAdminRole} 
                  onChange={(e) => setNewAdminRole(e.target.value as AdminRole)} 
                  className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer"
                  disabled={isInviting}
                >
                  <option value="executive_admin">Executive (Full view, limited override)</option>
                  <option value="ops_manager">Ops Manager (Sellers & Orders)</option>
                  <option value="finance_admin">Treasury (Payouts & Refunds)</option>
                  <option value="support_admin">Support (Tickets & Disputes)</option>
                  <option value="content_admin">Content (Marketing & Banners)</option>
                  <option value="viewer">Investor (Read-Only Dashboards)</option>
                </select>
                {newAdminRole === "executive_admin" && <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center"><AlertTriangle className="mr-1 h-3 w-3" /> Warning: Grants deep financial visibility.</p>}
              </div>

              <div className="pt-4 mt-2 border-t border-zinc-100">
                <Button type="submit" disabled={isInviting || !newAdminName.trim() || !newAdminEmail.trim()} className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-black text-white shadow-md hover:bg-zinc-800 disabled:opacity-50">
                  {isInviting ? "Sending Encryption Keys..." : "Send Secure Invite"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAdmin && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setSelectedAdmin(null)} aria-hidden="true" />
          <div className="relative flex h-full w-full max-w-xl flex-col border-l border-white/40 bg-white/95 shadow-2xl shadow-zinc-950/30 backdrop-blur-2xl animate-in slide-in-from-right duration-300">
            <div className="border-b border-zinc-100 bg-zinc-950 px-6 py-5 text-white">
              <h2 className="text-lg font-black">{selectedAdmin.name}</h2>
              <p className="text-xs font-bold text-zinc-400">{selectedAdmin.email} · {selectedAdmin.id}</p>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <section className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Role detail</h3>
                <p className="mt-1 text-xs font-bold text-zinc-500">Current role: {ROLE_UI[selectedAdmin.role].label}</p>
                <div className="mt-3 flex gap-2">
                  <select value={editedRole} onChange={(event) => setEditedRole(event.target.value as AdminRole)} disabled={selectedAdmin.id === identity.id} className="h-11 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold text-zinc-700 shadow-inner">
                    {Object.entries(ROLE_UI).map(([role, ui]) => <option key={role} value={role}>{ui.label}</option>)}
                  </select>
                  <Button onClick={handleSaveRole} disabled={editedRole === selectedAdmin.role || selectedAdmin.id === identity.id} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">Save</Button>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Permission matrix</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ROLE_PERMISSIONS[selectedAdmin.role].map((permission) => (
                    <span key={permission} className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-600">{permission.replace(/_/g, " ")}</span>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">MFA and session controls</h3>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <Button onClick={() => handleSecurityAction("mfa_reset")} variant="outline" className="rounded-xl font-black">
                    <Key className="mr-2 h-4 w-4" /> Reset MFA
                  </Button>
                  <Button onClick={() => handleSecurityAction("sessions_revoked")} variant="destructive" className="rounded-xl font-black">
                    <Ban className="mr-2 h-4 w-4" /> Revoke sessions
                  </Button>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-100 bg-white p-4">
                <h3 className="text-sm font-black text-zinc-950">Invite lifecycle / audit trail</h3>
                <div className="mt-3 space-y-2">
                  <p className="rounded-2xl bg-zinc-50 p-3 text-sm font-bold text-zinc-600">Created {formatDate(selectedAdmin.createdAt)}</p>
                  <p className="rounded-2xl bg-zinc-50 p-3 text-sm font-bold text-zinc-600">Last active {formatDate(selectedAdmin.lastLogin)}</p>
                  {(securityEvents[selectedAdmin.id] ?? []).map((event, index) => (
                    <p key={`${selectedAdmin.id}-security-${index}`} className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{event}</p>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
