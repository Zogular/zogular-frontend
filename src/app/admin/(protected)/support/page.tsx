"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, LifeBuoy, MessageSquareReply, Send, Siren, TicketCheck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { recordAdminAudit } from "@/services/admin/audit";
import {
  adminSupportApi,
  type AdminSupportTicket,
  type SupportCategory,
  type SupportMacro,
  type SupportPriority,
  type SupportTicketStatus,
} from "@/services/admin/support";
import { adminHasPermission, CURRENT_ADMIN_IDENTITY } from "@/services/admin/session";

const statusTone: Record<SupportTicketStatus, AdminTone> = {
  open: "amber",
  pending: "sky",
  escalated: "rose",
  closed: "zinc",
};

const priorityTone: Record<SupportPriority, AdminTone> = {
  low: "zinc",
  normal: "indigo",
  high: "amber",
  urgent: "rose",
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [macros, setMacros] = useState<SupportMacro[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<SupportCategory | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<SupportPriority | "all">("all");
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [assignee, setAssignee] = useState("");
  const [isMutating, setIsMutating] = useState(false);

  const canManageSupport = adminHasPermission("manage_support");

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const workspace = await adminSupportApi.fetchTickets();
      setTickets(workspace.tickets);
      setMacros(workspace.macros);
    } catch {
      toast.error("Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesSearch = !normalizedSearch || [
        ticket.id,
        ticket.subject,
        ticket.requester,
        ticket.assignedTo,
        ticket.linkedEntities.map((entity) => `${entity.id} ${entity.label}`).join(" "),
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      return matchesSearch && matchesCategory && matchesPriority;
    });
  }, [categoryFilter, priorityFilter, search, tickets]);

  const metrics = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === "open").length;
    const escalated = tickets.filter((ticket) => ticket.status === "escalated").length;
    const urgent = tickets.filter((ticket) => ticket.priority === "urgent").length;
    const overdue = tickets.filter((ticket) => new Date(ticket.slaDueAt).getTime() < Date.now() && ticket.status !== "closed").length;
    return { open, escalated, urgent, overdue };
  }, [tickets]);

  const syncTicket = (updatedTicket: AdminSupportTicket) => {
    setTickets((current) => current.map((ticket) => ticket.id === updatedTicket.id ? updatedTicket : ticket));
    setSelectedTicket(updatedTicket);
  };

  const updateStatus = async (status: SupportTicketStatus) => {
    if (!selectedTicket) return;

    try {
      setIsMutating(true);
      await adminSupportApi.updateTicketStatus(selectedTicket.id, status);
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: `support_ticket_${status}`,
        target: selectedTicket.id,
        severity: status === "escalated" ? "warning" : "info",
      });
      syncTicket({
        ...selectedTicket,
        status,
        lastActivityAt: new Date().toISOString(),
        messages: [
          {
            id: `MSG-${Date.now()}`,
            author: CURRENT_ADMIN_IDENTITY.name,
            role: "admin",
            timestamp: new Date().toISOString(),
            body: `Ticket status changed to ${toTitleCase(status)}.`,
          },
          ...selectedTicket.messages,
        ],
      });
      toast.success(`Ticket moved to ${toTitleCase(status)}.`);
    } catch {
      toast.error("Failed to update ticket status.");
    } finally {
      setIsMutating(false);
    }
  };

  const assignTicket = async () => {
    if (!selectedTicket || !assignee.trim()) return toast.error("Enter an assignee.");

    try {
      setIsMutating(true);
      await adminSupportApi.assignTicket(selectedTicket.id, assignee.trim());
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "support_ticket_assigned",
        target: selectedTicket.id,
        note: `Assigned to ${assignee.trim()}`,
      });
      syncTicket({
        ...selectedTicket,
        assignedTo: assignee.trim(),
        lastActivityAt: new Date().toISOString(),
        internalNotes: [`Assigned to ${assignee.trim()}.`, ...selectedTicket.internalNotes],
      });
      setAssignee("");
      toast.success("Ticket assigned.");
    } catch {
      toast.error("Failed to assign ticket.");
    } finally {
      setIsMutating(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !reply.trim()) return toast.error("Write a reply before sending.");

    try {
      setIsMutating(true);
      await adminSupportApi.replyToTicket(selectedTicket.id, reply.trim());
      await recordAdminAudit({
        actorId: CURRENT_ADMIN_IDENTITY.id,
        action: "support_ticket_replied",
        target: selectedTicket.id,
      });
      syncTicket({
        ...selectedTicket,
        status: selectedTicket.status === "closed" ? "open" : selectedTicket.status,
        lastActivityAt: new Date().toISOString(),
        messages: [
          {
            id: `MSG-${Date.now()}`,
            author: CURRENT_ADMIN_IDENTITY.name,
            role: "admin",
            timestamp: new Date().toISOString(),
            body: reply.trim(),
          },
          ...selectedTicket.messages,
        ],
      });
      setReply("");
      toast.success("Reply sent.");
    } catch {
      toast.error("Failed to send reply.");
    } finally {
      setIsMutating(false);
    }
  };

  if (!canManageSupport) {
    return <AdminEmptyState title="Access denied" description="Your admin role cannot manage support tickets." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Hub"
        description="Handle seller and buyer tickets with SLA views, linked context, macros, and assignment controls."
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <AdminMetricCard title="Open tickets" value={metrics.open} note="Awaiting support response" icon={<LifeBuoy className="h-5 w-5" />} tone="indigo" />
        <AdminMetricCard title="Escalated" value={metrics.escalated} note="Linked to ops or disputes" icon={<Siren className="h-5 w-5" />} tone="rose" />
        <AdminMetricCard title="Urgent priority" value={metrics.urgent} note="Highest service risk" icon={<TicketCheck className="h-5 w-5" />} tone="amber" />
        <AdminMetricCard title="SLA overdue" value={metrics.overdue} note="Needs immediate attention" icon={<Clock className="h-5 w-5" />} tone={metrics.overdue ? "rose" : "emerald"} />
      </div>

      <AdminToolbar>
        <AdminSearchField value={search} onChange={setSearch} placeholder="Search tickets, requester, linked order, or owner" className="flex-1" />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as SupportCategory | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All categories</option>
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
          <option value="orders">Orders</option>
          <option value="payments">Payments</option>
          <option value="account">Account</option>
        </select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as SupportPriority | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </AdminToolbar>

      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-300">
              <tr>
                <th className="rounded-tl-3xl px-5 py-4 font-black">Ticket</th>
                <th className="px-5 py-4 font-black">Requester</th>
                <th className="px-5 py-4 font-black">Priority</th>
                <th className="px-5 py-4 font-black">Status</th>
                <th className="px-5 py-4 font-black">SLA</th>
                <th className="rounded-tr-3xl px-5 py-4 text-right font-black">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-sm font-bold text-zinc-500">Loading support inbox...</td></tr>
              ) : filteredTickets.length === 0 ? (
                <tr><td colSpan={6}><AdminEmptyState title="No support tickets match this view" description="Change filters or search terms to widen the inbox." /></td></tr>
              ) : filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="bg-white/55 transition-colors hover:bg-sky-50/60">
                  <td className="px-5 py-4">
                    <p className="font-black text-zinc-950">{ticket.subject}</p>
                    <p className="text-xs font-bold text-zinc-500">{ticket.id} · {toTitleCase(ticket.category)}</p>
                    <p className="text-xs font-medium text-zinc-400">Last activity {formatAdminDateTime(ticket.lastActivityAt)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-zinc-700">{ticket.requester}</p>
                    <p className="text-xs font-bold text-zinc-500">{toTitleCase(ticket.requesterType)}</p>
                  </td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={priorityTone[ticket.priority]}>{ticket.priority}</AdminStatusBadge></td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={statusTone[ticket.status]}>{ticket.status}</AdminStatusBadge></td>
                  <td className="px-5 py-4 text-xs font-bold text-zinc-600">{formatAdminDateTime(ticket.slaDueAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="outline" onClick={() => setSelectedTicket(ticket)} className="rounded-xl font-black">Open ticket</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <AdminDetailSheet
        open={Boolean(selectedTicket)}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
        title={selectedTicket?.subject ?? "Support ticket"}
        description={selectedTicket ? `${selectedTicket.id} · ${selectedTicket.requester}` : "Support ticket details"}
      >
        {selectedTicket ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-indigo-50 p-4">
                <p className="text-[10px] font-black uppercase text-indigo-700">Category</p>
                <p className="text-lg font-black text-zinc-950">{toTitleCase(selectedTicket.category)}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-[10px] font-black uppercase text-amber-700">Priority</p>
                <div className="mt-2"><AdminStatusBadge tone={priorityTone[selectedTicket.priority]}>{selectedTicket.priority}</AdminStatusBadge></div>
              </div>
              <div className="rounded-2xl bg-sky-50 p-4">
                <p className="text-[10px] font-black uppercase text-sky-700">SLA due</p>
                <p className="text-sm font-black text-zinc-950">{formatAdminDateTime(selectedTicket.slaDueAt)}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Linked context</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedTicket.linkedEntities.map((entity) => (
                  <AdminStatusBadge key={`${entity.type}-${entity.id}`} tone="zinc">{toTitleCase(entity.type)} · {entity.id}</AdminStatusBadge>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Assignment</h3>
              <p className="mt-1 text-xs font-bold text-zinc-500">Current owner: {selectedTicket.assignedTo}</p>
              <div className="mt-3 flex gap-2">
                <Input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Assign to agent, queue, or team" className="h-11 rounded-xl border-zinc-200" />
                <Button onClick={assignTicket} disabled={isMutating} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">Assign</Button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-950">Macros</h3>
              <div className="mt-3 grid gap-2">
                {macros.filter((macro) => macro.category === selectedTicket.category || macro.category === "orders").map((macro) => (
                  <button key={macro.id} type="button" onClick={() => setReply(macro.body)} className="rounded-2xl border border-zinc-100 bg-white p-3 text-left text-sm font-bold text-zinc-700 transition hover:border-emerald-200 hover:bg-emerald-50">
                    {macro.title}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-950">Reply</h3>
              <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a clear buyer/seller support reply..." className="mt-3 min-h-28 rounded-2xl border-zinc-200 bg-white" />
              <Button onClick={sendReply} disabled={isMutating} className="mt-3 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                <Send className="mr-2 h-4 w-4" /> Send reply
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-4">
              <Button disabled={isMutating} variant="outline" onClick={() => updateStatus("pending")} className="rounded-xl font-black">Pending</Button>
              <Button disabled={isMutating} variant="destructive" onClick={() => updateStatus("escalated")} className="rounded-xl font-black">
                <Siren className="mr-2 h-4 w-4" /> Escalate
              </Button>
              <Button disabled={isMutating} onClick={() => updateStatus("closed")} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
                <TicketCheck className="mr-2 h-4 w-4" /> Close
              </Button>
              <Button disabled={isMutating} variant="outline" onClick={() => updateStatus("open")} className="rounded-xl font-black">
                <MessageSquareReply className="mr-2 h-4 w-4" /> Reopen
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-950">Conversation</h3>
              <div className="mt-3 space-y-3">
                {selectedTicket.messages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-zinc-100 bg-white p-3">
                    <p className="text-sm font-black text-zinc-950">{message.author}</p>
                    <p className="text-xs font-bold text-zinc-500">{toTitleCase(message.role)} · {formatAdminDateTime(message.timestamp)}</p>
                    <p className="mt-2 text-sm text-zinc-600">{message.body}</p>
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
