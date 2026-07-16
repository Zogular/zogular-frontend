"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Send, TicketCheck } from "lucide-react";
import { toast } from "sonner";
import {
  AdminDetailSheet,
  AdminEmptyState,
  AdminPageHeader,
  AdminSearchField,
  AdminStatusBadge,
  AdminToolbar,
  type AdminTone,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import {
  adminSupportApi,
  type AdminSupportTicket,
  type AdminTicketCategory,
  type AdminTicketPriority,
  type AdminTicketStatus,
} from "@/services/admin/support";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { useAdminIdentity } from "@/components/admin/AdminShell";

const statusTone: Record<AdminTicketStatus, AdminTone> = {
  "open": "amber",
  "waiting-seller": "indigo",
  "waiting-support": "amber",
  "resolved": "emerald",
  "closed": "zinc",
};

const priorityTone: Record<AdminTicketPriority, AdminTone> = {
  "low": "zinc",
  "medium": "indigo",
  "high": "amber",
  "urgent": "rose",
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<AdminTicketCategory | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<AdminTicketPriority | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AdminTicketStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<AdminSupportTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reply, setReply] = useState("");
  const [isMutating, setIsMutating] = useState(false);

  const identity = useAdminIdentity();
  const canViewSupport = identity ? adminIdentityHasPermission(identity, "view_support_tickets") : false;
  const canReplySupport = identity ? adminIdentityHasPermission(identity, "reply_support_tickets") : false;
  const canManageSupport = identity ? adminIdentityHasPermission(identity, "manage_support_tickets") : false;

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setRequestError(null);
      const res = await adminSupportApi.fetchTickets({
        page,
        limit: 10,
        status: statusFilter === "all" ? undefined : statusFilter,
        priority: priorityFilter === "all" ? undefined : priorityFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        search: search.trim() || undefined
      });
      setTickets(res.tickets);
      setPagination(res.pagination);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load support tickets.";
      setRequestError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, categoryFilter, search, page]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const openTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailLoading(true);
    try {
      const ticket = await adminSupportApi.getTicket(ticketId);
      setSelectedTicketDetail(ticket);
    } catch {
      toast.error("Failed to load ticket details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (status: AdminTicketStatus) => {
    if (!selectedTicketDetail) return;

    try {
      setIsMutating(true);
      const updated = await adminSupportApi.updateTicketStatus(selectedTicketDetail.id, status);
      setSelectedTicketDetail({ ...selectedTicketDetail, ...updated });
      loadTickets(); // Refresh list to get new status
      toast.success(`Ticket moved to ${toTitleCase(status.replace('-', ' '))}.`);
    } catch {
      toast.error("Failed to update ticket status.");
    } finally {
      setIsMutating(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicketDetail || !reply.trim()) return toast.error("Write a reply before sending.");

    try {
      setIsMutating(true);
      const message = await adminSupportApi.replyToTicket(selectedTicketDetail.id, reply.trim());
      setSelectedTicketDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'waiting-seller',
          messages: [...(prev.messages || []), message]
        };
      });
      setReply("");
      loadTickets();
      toast.success("Reply sent.");
    } catch {
      toast.error("Failed to send reply.");
    } finally {
      setIsMutating(false);
    }
  };

  if (!canViewSupport) {
    return <AdminEmptyState title="Access denied" description="Your admin role cannot view support tickets." />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Hub"
        description="Seller support queue. Read and reply to seller issues."
      />

      <AdminToolbar>
        <AdminSearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tickets by subject, store, or email..." className="flex-1" />
        
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as AdminTicketStatus | "all"); setPage(1); }} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="waiting-support">Waiting on Support</option>
          <option value="waiting-seller">Waiting on Seller</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        
        <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value as AdminTicketCategory | "all"); setPage(1); }} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All categories</option>
          <option value="order">Order</option>
          <option value="payout">Payout</option>
          <option value="inventory">Inventory</option>
          <option value="tech">Tech</option>
          <option value="account">Account</option>
          <option value="general">General</option>
        </select>
        
        <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value as AdminTicketPriority | "all"); setPage(1); }} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </AdminToolbar>

      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
        {requestError && !loading ? (
          <div className="p-5"><AdminEmptyState title="Support inbox unavailable" description={requestError} /><div className="flex justify-center pb-4"><Button onClick={() => void loadTickets()} variant="outline" className="rounded-xl font-black">Retry support inbox</Button></div></div>
        ) : null}
        {!requestError ? (
        <>
        <div className="space-y-3 p-3 lg:hidden">
          {loading ? <div className="px-3 py-10 text-center text-sm font-bold text-zinc-500">Loading support inbox...</div> : tickets.length === 0 ? <AdminEmptyState title="No support tickets match this view" description="Change filters or search terms to widen the inbox." /> : tickets.map((ticket) => (
            <article key={ticket.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-zinc-950">{ticket.subject}</p><p className="mt-1 text-xs font-semibold text-zinc-500">{ticket.seller.displayName}</p></div><AdminStatusBadge tone={statusTone[ticket.status]}>{toTitleCase(ticket.status.replace('-', ' '))}</AdminStatusBadge></div>
              <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs font-medium text-zinc-500">Updated {formatAdminDateTime(ticket.updatedAt)}</p><Button variant="outline" onClick={() => openTicket(ticket.id)} className="h-9 rounded-xl text-xs font-black">Open</Button></div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-300">
              <tr>
                <th className="rounded-tl-3xl px-5 py-4 font-black">Ticket</th>
                <th className="px-5 py-4 font-black">Requester</th>
                <th className="px-5 py-4 font-black">Priority</th>
                <th className="px-5 py-4 font-black">Status</th>
                <th className="rounded-tr-3xl px-5 py-4 text-right font-black">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm font-bold text-zinc-500">Loading support inbox...</td></tr>
              ) : tickets.length === 0 ? (
                <tr><td colSpan={5}><AdminEmptyState title="No support tickets match this view" description="Change filters or search terms to widen the inbox." /></td></tr>
              ) : tickets.map((ticket) => (
                <tr key={ticket.id} className="bg-white/55 transition-colors hover:bg-sky-50/60">
                  <td className="px-5 py-4">
                    <p className="font-black text-zinc-950">{ticket.subject}</p>
                    <p className="text-xs font-bold text-zinc-500">{ticket.id} · {toTitleCase(ticket.category)}</p>
                    <p className="text-xs font-medium text-zinc-400">Updated {formatAdminDateTime(ticket.updatedAt)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-bold text-zinc-700">{ticket.seller.displayName}</p>
                    <p className="text-xs font-bold text-zinc-500">{ticket.seller.storeName || "No Store"}</p>
                  </td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={priorityTone[ticket.priority]}>{toTitleCase(ticket.priority)}</AdminStatusBadge></td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={statusTone[ticket.status]}>{toTitleCase(ticket.status.replace('-', ' '))}</AdminStatusBadge></td>
                  <td className="px-5 py-4 text-right">
                    <Button variant="outline" onClick={() => openTicket(ticket.id)} className="rounded-xl font-black">Open ticket</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        ) : null}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 bg-white/40">
            <span className="text-xs font-bold text-zinc-500">
              Page {pagination.page} of {pagination.pages} <span className="text-zinc-400">· {pagination.total} total</span>
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg font-bold text-xs"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg font-bold text-xs"
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>

      <AdminDetailSheet
        open={Boolean(selectedTicketId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicketId(null);
            setSelectedTicketDetail(null);
          }
        }}
        title={selectedTicketDetail?.subject ?? "Support ticket"}
        description={selectedTicketDetail ? `${selectedTicketDetail.id} · ${selectedTicketDetail.seller.storeName || selectedTicketDetail.seller.displayName}` : "Support ticket details"}
      >
        {detailLoading ? (
          <div className="py-12 text-center text-sm font-bold text-zinc-500">Loading ticket details...</div>
        ) : selectedTicketDetail ? (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-indigo-50 p-4">
                <p className="text-[10px] font-black uppercase text-indigo-700">Category</p>
                <p className="text-lg font-black text-zinc-950">{toTitleCase(selectedTicketDetail.category)}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-[10px] font-black uppercase text-amber-700">Priority</p>
                <div className="mt-2"><AdminStatusBadge tone={priorityTone[selectedTicketDetail.priority]}>{toTitleCase(selectedTicketDetail.priority)}</AdminStatusBadge></div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Seller Context</h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-700">
                <p><strong>Name:</strong> {selectedTicketDetail.seller.displayName}</p>
                <p><strong>Email:</strong> {selectedTicketDetail.seller.email}</p>
                <p><strong>Store:</strong> {selectedTicketDetail.seller.storeName || "N/A"}</p>
                <p><strong>Status:</strong> {selectedTicketDetail.seller.applicationStatus}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-100 bg-zinc-50 p-4">
              <h3 className="text-sm font-black text-zinc-950">Reply</h3>
              <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Type your reply to the seller..." disabled={isMutating || !canReplySupport} className="mt-3 min-h-28 rounded-2xl border-zinc-200 bg-white" />
              <Button onClick={sendReply} disabled={!reply.trim() || isMutating || !canReplySupport} className="mt-3 rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                <Send className="mr-2 h-4 w-4" /> Send Reply
              </Button>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <Button disabled={isMutating || selectedTicketDetail.status === "waiting-support" || !canManageSupport} variant="outline" onClick={() => updateStatus("waiting-support")} className="rounded-xl font-black">
                <MessageCircle className="mr-2 h-4 w-4" /> Mark Waiting Support
              </Button>
              <Button disabled={isMutating || selectedTicketDetail.status === "resolved" || !canManageSupport} onClick={() => updateStatus("resolved")} className="rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700">
                <TicketCheck className="mr-2 h-4 w-4" /> Mark Resolved
              </Button>
              <Button disabled={isMutating || selectedTicketDetail.status === "closed" || !canManageSupport} onClick={() => updateStatus("closed")} className="rounded-xl bg-zinc-950 font-black text-white hover:bg-zinc-800">
                Close Ticket
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-black text-zinc-950">Conversation</h3>
              <div className="mt-3 space-y-3">
                {selectedTicketDetail.messages?.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-zinc-100 bg-white p-3">
                    <p className="text-sm font-black text-zinc-950">{message.senderName}</p>
                    <p className="text-xs font-bold text-zinc-500">{toTitleCase(message.senderType)} · {formatAdminDateTime(message.createdAt)}</p>
                    <p className="mt-2 text-sm text-zinc-600 whitespace-pre-wrap">{message.body}</p>
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
