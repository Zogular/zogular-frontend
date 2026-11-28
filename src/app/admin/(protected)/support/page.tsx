"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useSupportInbox } from "@/features/admin-support/hooks/use-support-inbox";
import { useSupportReplyOutcome } from "@/features/admin-support/hooks/use-support-reply-outcome";
import {
  adminSupportApi,
  isSupportReadAuthorizationFailure,
  isSupportSessionDenied,
  type AdminSupportTicket,
  type AdminTicketCategory,
  type AdminTicketPriority,
  type AdminTicketStatus,
} from "@/services/admin/support";
import { adminIdentityHasPermission, type AdminIdentity } from "@/services/admin/session";
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

const replyNotices = {
  invalid: "The reply was not accepted. Edit it before trying again.",
  denied: "You couldn’t send this reply. Reload Support to check your access before trying again.",
  missing: "This ticket is no longer available. Your reply was not sent.",
  conflict: "The ticket changed before this reply was saved. Check the conversation before sending.",
  uncertain: "We couldn’t confirm whether your reply was sent. Check the conversation before sending again.",
  dismissed: "Draft dismissed. Sending another reply to this ticket is disabled for this visit.",
} as const;

interface TicketSelection {
  id: string;
  mutating: boolean;
}

export default function AdminSupportPage() {
  const identity = useAdminIdentity();
  if (!identity || !adminIdentityHasPermission(identity, "view_support_tickets")) {
    return <AdminEmptyState title="Access denied" description="Your admin role cannot view support tickets." />;
  }

  // A new verified authority must not inherit another projection or draft.
  const { id, claims } = identity;
  const authority = JSON.stringify([id, claims.role, claims.issuedAt, [...new Set(claims.permissions)].sort()]);
  return <SupportAccessBoundary key={authority} identity={identity} />;
}

function SupportAccessBoundary({ identity }: { identity: AdminIdentity }) {
  const [denied, setDenied] = useState(false);
  const denyAccess = useCallback(() => setDenied(true), []);
  if (denied) {
    return (
      <div role="alert">
        <AdminEmptyState title="Support access could not be verified" description="Reload Support to check your access again." />
        <Button onClick={() => window.location.reload()} variant="outline">Reload Support</Button>
      </div>
    );
  }
  return <SupportWorkspace identity={identity} onAuthorizationDenied={denyAccess} />;
}

function SupportWorkspace({ identity, onAuthorizationDenied }: {
  identity: AdminIdentity;
  onAuthorizationDenied: () => void;
}) {
  // Each opening owns its async work, including when the same ticket is reopened.
  const activeTicket = useRef<TicketSelection | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<AdminSupportTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFailed, setDetailFailed] = useState(false);

  const [isMutating, setIsMutating] = useState(false);

  const canReplySupport = adminIdentityHasPermission(identity, "reply_support_tickets");
  const canManageSupport = adminIdentityHasPermission(identity, "manage_support_tickets");
  const canViewSensitiveFields = adminIdentityHasPermission(identity, "view_support_sensitive_fields");
  const replies = useSupportReplyOutcome(identity.id, canViewSensitiveFields, onAuthorizationDenied);
  const reply = replies.replyFor(selectedTicketId);
  const replyBusy = reply.phase === "pending" || reply.check === "checking";
  const canEditReply = reply.phase === "editing" || reply.phase === "invalid";
  const canCheckConversation = reply.phase === "uncertain" || reply.phase === "conflict";

  const {
    tickets, loading, queueFailed, pagination, goToPage, refreshQueue,
    search, statusFilter, priorityFilter, categoryFilter,
    setSearch, setStatusFilter, setPriorityFilter, setCategoryFilter,
  } = useSupportInbox(onAuthorizationDenied);

  useEffect(() => () => {
    activeTicket.current = null;
  }, []);

  const resetDrawer = (selection: TicketSelection | null) => {
    activeTicket.current = selection;
    setSelectedTicketId(selection?.id ?? null);
    setSelectedTicketDetail(null);
    setDetailLoading(selection !== null);
    setDetailFailed(false);
    setIsMutating(false);
  };

  const openTicket = async (ticketId: string) => {
    const selection = { id: ticketId, mutating: false };
    resetDrawer(selection);
    try {
      const ticket = await adminSupportApi.getTicket(ticketId, canViewSensitiveFields);
      if (activeTicket.current !== selection) return;
      setSelectedTicketDetail(ticket);
    } catch (error) {
      const ownsDrawer = activeTicket.current === selection;
      // A 401 applies to this authority even after the operator changes tickets.
      if (isSupportSessionDenied(error) || (ownsDrawer && isSupportReadAuthorizationFailure(error))) {
        onAuthorizationDenied();
        return;
      }
      if (ownsDrawer) setDetailFailed(true);
    } finally {
      if (activeTicket.current === selection) setDetailLoading(false);
    }
  };

  const beginTicketMutation = () => {
    const selection = activeTicket.current;
    if (!selection || selection.id !== selectedTicketDetail?.id || selection.mutating || replies.isBusy(selection.id)) return null;
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

  const sendReply = () => {
    const selection = activeTicket.current;
    if (!canReplySupport || !selection || selection.id !== selectedTicketDetail?.id || selection.mutating) return;
    void replies.send(selection.id, (message) => {
      refreshQueue();
      if (activeTicket.current !== selection) {
        // A reopened drawer may still have the thread snapshot from before this confirmed send.
        if (activeTicket.current?.id === selection.id) void openTicket(selection.id);
        return;
      }
      setSelectedTicketDetail((current) => {
        if (current?.id !== selection.id) return current;
        const messages = current.messages ?? [];
        if (messages.some((existing) => existing.id === message.id)) return current;
        return {
          ...current,
          status: "waiting-seller",
          messages: [...messages, message],
        };
      });
      toast.success("Reply sent.");
    });
  };

  const checkConversation = () => {
    const selection = activeTicket.current;
    if (!selection || selection.id !== selectedTicketDetail?.id || selection.mutating) return;
    const ownsDrawer = () => activeTicket.current === selection;
    void replies.checkConversation(selection.id, (ticket) => {
      if (!ownsDrawer()) return false;
      setSelectedTicketDetail(ticket);
      return true;
    }, ownsDrawer);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Hub"
        description="Seller support queue. Read and reply to seller issues."
      />

      <AdminToolbar>
        <AdminSearchField value={search} onChange={setSearch} placeholder="Search tickets" className="flex-1" />
        
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AdminTicketStatus | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="waiting-support">Waiting on Support</option>
          <option value="waiting-seller">Waiting on Seller</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as AdminTicketCategory | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All categories</option>
          <option value="order">Order</option>
          <option value="payout">Payout</option>
          <option value="inventory">Inventory</option>
          <option value="tech">Tech</option>
          <option value="account">Account</option>
          <option value="general">General</option>
        </select>
        
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as AdminTicketPriority | "all")} className="h-11 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 shadow-sm">
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </AdminToolbar>

      <section className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
        {queueFailed && !loading ? (
          <div className="p-5">
            <div role="alert">
              <AdminEmptyState title="Support inbox unavailable" description="We couldn't load your tickets. Try again." />
            </div>
            <div className="flex justify-center pb-4">
              <Button onClick={refreshQueue} variant="outline" className="rounded-xl font-black">Retry support inbox</Button>
            </div>
          </div>
        ) : null}
        {!queueFailed ? (
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
        {!loading && !queueFailed && pagination.pages > 1 && (
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
                onClick={() => goToPage(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg font-bold text-xs"
                disabled={pagination.page >= pagination.pages || loading}
                onClick={() => goToPage(pagination.page + 1)}
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
        ) : detailFailed && selectedTicketId ? (
          <div className="min-w-0 space-y-3 py-6 text-center">
            <p role="alert" className="text-sm font-semibold text-zinc-700">
              We couldn&apos;t load this ticket.
            </p>
            <Button variant="outline" onClick={() => void openTicket(selectedTicketId)}>
              Retry ticket details
            </Button>
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
              <Textarea value={reply.draft} onChange={(event) => replies.edit(selectedTicketDetail.id, event.target.value)} placeholder="Type your reply to the seller..." disabled={isMutating || !canReplySupport || !canEditReply} className="mt-3 min-h-28 w-full min-w-0 rounded-2xl border-zinc-200 bg-white" />
              {reply.phase === "pending" ? <p role="status" className="mt-2 text-sm">Sending reply…</p> : null}
              {reply.phase !== "editing" && reply.phase !== "pending" ? (
                <div role="alert" className="mt-3 space-y-2 text-sm text-zinc-700">
                  <p>{replyNotices[reply.phase]}</p>
                  {reply.phase === "uncertain" ? <p>This draft and sending restriction last only while this Support page is open.</p> : null}
                  {reply.check === "checked" ? <p>The conversation is up to date, but we still can’t confirm the earlier send.</p> : null}
                  {reply.check === "failed" ? <p>We couldn’t check the conversation. Your draft is still here.</p> : null}
                </div>
              ) : null}
              <Button onClick={sendReply} disabled={!reply.draft.trim() || isMutating || !canReplySupport || reply.phase !== "editing"} className="mt-3 w-full rounded-xl bg-emerald-600 font-black text-white hover:bg-emerald-700 sm:w-auto">
                <Send className="mr-2 h-4 w-4 shrink-0" /> Send Reply
              </Button>
              {canCheckConversation ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button type="button" variant="outline" onClick={checkConversation} disabled={isMutating || replyBusy}>
                    {reply.check === "checking" ? "Checking conversation…" : "Check conversation"}
                  </Button>
                  {reply.phase === "uncertain" && reply.check === "checked" ? (
                    <Button type="button" variant="outline" onClick={() => replies.dismiss(selectedTicketDetail.id)}>
                      Dismiss draft
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button disabled={isMutating || replyBusy || selectedTicketDetail.status === "waiting-support" || !canManageSupport} variant="outline" onClick={() => updateStatus("waiting-support")} className="h-auto min-h-10 w-full whitespace-normal rounded-xl py-2 text-center leading-snug font-black sm:w-auto sm:flex-1">
                <MessageCircle className="mr-2 h-4 w-4 shrink-0" /> Mark Waiting Support
              </Button>
              <Button disabled={isMutating || replyBusy || selectedTicketDetail.status === "resolved" || !canManageSupport} onClick={() => updateStatus("resolved")} className="h-auto min-h-10 w-full whitespace-normal rounded-xl bg-emerald-600 py-2 text-center leading-snug font-black text-white hover:bg-emerald-700 sm:w-auto sm:flex-1">
                <TicketCheck className="mr-2 h-4 w-4 shrink-0" /> Mark Resolved
              </Button>
              <Button disabled={isMutating || replyBusy || selectedTicketDetail.status === "closed" || !canManageSupport} onClick={() => updateStatus("closed")} className="h-auto min-h-10 w-full whitespace-normal rounded-xl bg-zinc-950 py-2 text-center leading-snug font-black text-white hover:bg-zinc-800 sm:w-auto sm:flex-1">
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
