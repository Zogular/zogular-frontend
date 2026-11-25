"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
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

interface TicketSelection {
  id: string;
  mutating: boolean;
}

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
  const [queueRevision, refreshQueue] = useReducer((revision: number) => revision + 1, 0);

  // Each opening owns its async work, including when the same ticket is reopened.
  const activeTicket = useRef<TicketSelection | null>(null);
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

  useEffect(() => { void loadTickets(); }, [loadTickets, queueRevision]);

  const resetDrawer = (selection: TicketSelection | null) => {
    activeTicket.current = selection;
    setSelectedTicketId(selection?.id ?? null);
    setSelectedTicketDetail(null);
    setDetailLoading(selection !== null);
    setReply("");
    setIsMutating(false);
  };

  const openTicket = async (ticketId: string) => {
    const selection = { id: ticketId, mutating: false };
    resetDrawer(selection);
    try {
      const ticket = await adminSupportApi.getTicket(ticketId);
      if (activeTicket.current !== selection) return;
      if (ticket.id !== selection.id) throw new Error("Unexpected ticket in detail response.");
      setSelectedTicketDetail(ticket);
    } catch {
      if (activeTicket.current === selection) toast.error("Failed to load ticket details.");
    } finally {
      if (activeTicket.current === selection) setDetailLoading(false);
    }
  };

  const beginTicketMutation = () => {
    const selection = activeTicket.current;
    if (!selection || selection.id !== selectedTicketDetail?.id || selection.mutating) return null;
    selection.mutating = true;
    setIsMutating(true);
    return selection;
  };

  const finishTicketMutation = (selection: TicketSelection) => {
    if (activeTicket.current !== selection) return;
    selection.mutating = false;
    setIsMutating(false);
  };

  const updateStatus = async (status: AdminTicketStatus) => {
    const selection = beginTicketMutation();
    if (!selection) return;

    try {
      const updated = await adminSupportApi.updateTicketStatus(selection.id, status);
      if (updated.id !== selection.id) throw new Error("Unexpected ticket in status response.");
      // A committed mutation still refreshes the inbox using its current filters.
      refreshQueue();
      if (activeTicket.current !== selection) return;
      setSelectedTicketDetail((current) => current?.id === selection.id ? { ...current, ...updated } : current);
      toast.success(`Ticket moved to ${toTitleCase(status.replace('-', ' '))}.`);
    } catch {
      if (activeTicket.current === selection) toast.error("Failed to update ticket status.");
    } finally {
      finishTicketMutation(selection);
    }
  };

  const sendReply = async () => {
    const draft = reply.trim();
    if (!draft) return toast.error("Write a reply before sending.");
    const selection = beginTicketMutation();
    if (!selection) return;

    try {
      const message = await adminSupportApi.replyToTicket(selection.id, draft);
      refreshQueue();
      if (activeTicket.current !== selection) return;
      setSelectedTicketDetail((current) => {
        if (current?.id !== selection.id) return current;
        return {
          ...current,
          status: 'waiting-seller',
          messages: [...(current.messages || []), message]
        };
      });
      setReply("");
      toast.success("Reply sent.");
    } catch {
      if (activeTicket.current === selection) toast.error("Failed to send reply.");
    } finally {
      finishTicketMutation(selection);
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
        <AdminSearchField value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tickets" className="flex-1" />
        
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
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-200/50" />
              ))}
            </div>
          ) : tickets.length === 0 ? <AdminEmptyState title="No support tickets match this view" description="Change filters or search terms to widen the inbox." /> : tickets.map((ticket) => (
            <article key={ticket.id} className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="line-clamp-2 font-black text-zinc-950 [overflow-wrap:anywhere]">{ticket.subject}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold text-zinc-500">{ticket.seller.displayName}</p>
                <AdminStatusBadge tone={statusTone[ticket.status]} className="shrink-0">{toTitleCase(ticket.status.replace('-', ' '))}</AdminStatusBadge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3"><p className="min-w-0 text-xs font-medium text-zinc-500">Updated {formatAdminDateTime(ticket.updatedAt)}</p><Button variant="outline" onClick={() => openTicket(ticket.id)} className="h-9 shrink-0 rounded-xl text-xs font-black">Open</Button></div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-300">
              <tr>
                <th className="rounded-tl-3xl px-5 py-4 font-black">Ticket</th>
                <th className="w-1/4 px-5 py-4 font-black">Requester</th>
                <th className="w-24 px-3 py-4 font-black">Priority</th>
                <th className="w-36 px-3 py-4 font-black">Status</th>
                <th className="w-32 rounded-tr-3xl px-4 py-4 text-right font-black">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`loading-${i}`}>
                    <td colSpan={5} className="px-5 py-4">
                      <div className="h-14 w-full animate-pulse rounded-xl bg-zinc-200/50" />
                    </td>
                  </tr>
                ))
              ) : tickets.length === 0 ? (
                <tr><td colSpan={5}><AdminEmptyState title="No support tickets match this view" description="Change filters or search terms to widen the inbox." /></td></tr>
              ) : tickets.map((ticket) => (
                <tr key={ticket.id} className="bg-white/55 transition-colors hover:bg-sky-50/60">
                  <td className="px-5 py-4 [overflow-wrap:anywhere]">
                    <p className="font-black text-zinc-950">{ticket.subject}</p>
                    <p className="text-xs font-bold text-zinc-500">{ticket.id} · {toTitleCase(ticket.category)}</p>
                    <p className="text-xs font-medium text-zinc-400">Updated {formatAdminDateTime(ticket.updatedAt)}</p>
                  </td>
                  <td className="px-5 py-4 [overflow-wrap:anywhere]">
                    <p className="font-bold text-zinc-700">{ticket.seller.displayName}</p>
                    <p className="text-xs font-bold text-zinc-500">{ticket.seller.storeName || "No Store"}</p>
                  </td>
                  <td className="px-3 py-4"><AdminStatusBadge tone={priorityTone[ticket.priority]}>{toTitleCase(ticket.priority)}</AdminStatusBadge></td>
                  <td className="px-3 py-4"><AdminStatusBadge tone={statusTone[ticket.status]}>{toTitleCase(ticket.status.replace('-', ' '))}</AdminStatusBadge></td>
                  <td className="px-4 py-4 text-right">
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
        contained
        open={Boolean(selectedTicketId)}
        onOpenChange={(open) => {
          if (!open) resetDrawer(null);
        }}
        title={selectedTicketDetail?.subject ?? "Support ticket"}
        description={selectedTicketDetail ? `${selectedTicketDetail.id} · ${selectedTicketDetail.seller.storeName || selectedTicketDetail.seller.displayName}` : "Support ticket details"}
      >
        {detailLoading ? (
          <div className="min-w-0 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-24 animate-pulse rounded-3xl bg-zinc-100" />
              <div className="h-24 animate-pulse rounded-3xl bg-zinc-100" />
            </div>
            <div className="h-64 animate-pulse rounded-3xl bg-zinc-100" />
            <div className="h-32 animate-pulse rounded-3xl bg-zinc-100" />
          </div>
        ) : selectedTicketDetail ? (
          <div className="min-w-0 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-2xl bg-indigo-50 p-4">
                <p className="text-[10px] font-black uppercase text-indigo-700">Category</p>
                <p className="break-words [overflow-wrap:anywhere] text-lg font-black text-zinc-950">{toTitleCase(selectedTicketDetail.category)}</p>
              </div>
              <div className="min-w-0 rounded-2xl bg-amber-50 p-4">
                <p className="text-[10px] font-black uppercase text-amber-700">Priority</p>
                <div className="mt-2"><AdminStatusBadge tone={priorityTone[selectedTicketDetail.priority]}>{toTitleCase(selectedTicketDetail.priority)}</AdminStatusBadge></div>
              </div>
            </div>

            <div className="min-w-0 rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Seller Context</h3>
              <div className="mt-3 grid min-w-0 gap-2 text-sm text-zinc-700">
                <p className="min-w-0 break-words [overflow-wrap:anywhere]"><strong>Name:</strong> {selectedTicketDetail.seller.displayName}</p>
                <p className="min-w-0 break-words [overflow-wrap:anywhere]"><strong>Email:</strong> {selectedTicketDetail.seller.email}</p>
                <p className="min-w-0 break-words [overflow-wrap:anywhere]"><strong>Store:</strong> {selectedTicketDetail.seller.storeName || "N/A"}</p>
                <p className="min-w-0 break-words [overflow-wrap:anywhere]"><strong>Status:</strong> {selectedTicketDetail.seller.applicationStatus}</p>
              </div>
            </div>

            <div className="min-w-0 rounded-3xl border border-zinc-100 bg-zinc-50 p-4">
              <h3 className="text-sm font-black text-zinc-950">Reply</h3>
              <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Type your reply to the seller..." disabled={isMutating || !canReplySupport} className="mt-3 min-h-28 w-full min-w-0 rounded-2xl border-zinc-200 bg-white" />
              <Button onClick={sendReply} disabled={!reply.trim() || isMutating || !canReplySupport} className="mt-3 w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700 sm:w-auto">
                <Send className="mr-2 h-4 w-4 shrink-0" /> Send Reply
              </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button disabled={isMutating || selectedTicketDetail.status === "waiting-support" || !canManageSupport} variant="outline" onClick={() => updateStatus("waiting-support")} className="h-auto min-h-10 w-full whitespace-normal rounded-xl py-2 text-center leading-snug font-black sm:w-auto sm:flex-1">
                <MessageCircle className="mr-2 h-4 w-4 shrink-0" /> Mark Waiting Support
              </Button>
              <Button disabled={isMutating || selectedTicketDetail.status === "resolved" || !canManageSupport} onClick={() => updateStatus("resolved")} className="h-auto min-h-10 w-full whitespace-normal rounded-xl bg-emerald-600 py-2 text-center leading-snug font-black text-white hover:bg-emerald-700 sm:w-auto sm:flex-1">
                <TicketCheck className="mr-2 h-4 w-4 shrink-0" /> Mark Resolved
              </Button>
              <Button disabled={isMutating || selectedTicketDetail.status === "closed" || !canManageSupport} onClick={() => updateStatus("closed")} className="h-auto min-h-10 w-full whitespace-normal rounded-xl bg-zinc-950 py-2 text-center leading-snug font-black text-white hover:bg-zinc-800 sm:w-auto sm:flex-1">
                Close Ticket
              </Button>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-black text-zinc-950">Conversation</h3>
              <div className="mt-3 min-w-0 space-y-3">
                {selectedTicketDetail.messages?.map((message) => (
                  <div key={message.id} className="min-w-0 rounded-2xl border border-zinc-100 bg-white p-3">
                    <p className="min-w-0 break-words [overflow-wrap:anywhere] text-sm font-black text-zinc-950">{message.senderName}</p>
                    <p className="min-w-0 break-words [overflow-wrap:anywhere] text-xs font-bold text-zinc-500">{toTitleCase(message.senderType)} · {formatAdminDateTime(message.createdAt)}</p>
                    <p className="mt-2 min-w-0 break-words [overflow-wrap:anywhere] whitespace-pre-wrap text-sm text-zinc-600">{message.body}</p>
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
