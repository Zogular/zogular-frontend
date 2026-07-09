"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LifeBuoy, Search, Filter, MessageSquare, Clock, CheckCircle2,
  AlertCircle, ArrowLeft, AlertTriangle, Info, ShieldAlert,
  Inbox
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";

// Import from our new service layer
import { supportApi, SupportTicket, SupportStats, TicketStatus, TicketPriority } from "@/services/support";
import { ContactSupportModal } from "@/app/seller/ContactSupportModal";

// ============================================================================
// LOGIC HELPERS & UI MAPS
// ============================================================================
function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat("en-ZM", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(isoString));
}

const STATUS_UI: Record<TicketStatus, { label: string; bg: string; text: string; border: string }> = {
  "open": { label: "Open", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "waiting-support": { label: "Waiting on Support", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "waiting-seller": { label: "Action Needed", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300" },
  "resolved": { label: "Resolved", bg: "bg-[#009E49]/10", text: "text-[#009E49]", border: "border-[#009E49]/20" },
  "closed": { label: "Closed", bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-200" },
};

const PRIORITY_UI: Record<TicketPriority, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "low": { icon: Info, color: "text-zinc-500" },
  "medium": { icon: AlertCircle, color: "text-blue-500" },
  "high": { icon: AlertTriangle, color: "text-amber-500" },
  "urgent": { icon: ShieldAlert, color: "text-red-500" },
};

// ============================================================================
// SUBCOMPONENTS
// ============================================================================
function StatCard({ title, value, icon: Icon, colorClass }: { title: string; value: number | string; icon: React.ComponentType<{ className?: string }>; colorClass: string }) {
  return (
    <div className={cn("rounded-3xl border p-5 shadow-sm transition-all hover:shadow-md", colorClass)}>
      <div className="mb-3 flex items-center justify-between opacity-80">
        <p className="text-[10px] font-bold uppercase tracking-wider">{title}</p>
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-2xl font-black">{value}</h3>
    </div>
  );
}

// ============================================================================
// MAIN PAGE EXPORT
// ============================================================================
export default function SellerSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");

  // Thread & Modal State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedTicketData, setSelectedTicketData] = useState<SupportTicket | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [resolving, setResolving] = useState(false);

  // --- 1. DATA FETCHING ---
  const loadTickets = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      const data = await supportApi.fetchTickets();
      setTickets(data);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // --- 2. DERIVED STATE ---
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchesSearch = !searchQuery || t.id.toLowerCase().includes(searchQuery.toLowerCase()) || t.subject.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [tickets, searchQuery, statusFilter, priorityFilter]);

  const stats = useMemo<SupportStats>(() => {
    const open = tickets.filter(t => t.status === "open" || t.status === "waiting-support").length;
    const waiting = tickets.filter(t => t.status === "waiting-seller").length;
    const resolved = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;
    return { open, awaitingSeller: waiting, resolved, avgResponseHrs: null };
  }, [tickets]);

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicketData(null);
      setDetailError(null);
      setReplyText("");
      return;
    }
    let isMounted = true;
    const fetchDetail = async () => {
      setLoadingTicket(true);
      setDetailError(null);
      try {
        const detail = await supportApi.getTicket(selectedTicketId);
        if (isMounted) setSelectedTicketData(detail);
      } catch (err) {
        if (isMounted) setDetailError(err instanceof Error ? err.message : "Failed to load ticket.");
      } finally {
        if (isMounted) setLoadingTicket(false);
      }
    };
    fetchDetail();
    return () => { isMounted = false; };
  }, [selectedTicketId]);

  const canReplyToTicket =
    selectedTicketData?.status !== "resolved" &&
    selectedTicketData?.status !== "closed";

  const handleReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;

    try {
      setReplying(true);
      setDetailError(null);
      await supportApi.replyToTicket(selectedTicketId, replyText.trim());
      setReplyText("");
      const updatedTicket = await supportApi.getTicket(selectedTicketId);
      setSelectedTicketData(updatedTicket);
      loadTickets(true);
    } catch (replyError) {
      setDetailError(
        replyError instanceof Error
          ? replyError.message
          : "Failed to send reply.",
      );
    } finally {
      setReplying(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedTicketId) return;

    try {
      setResolving(true);
      setDetailError(null);
      await supportApi.resolveTicket(selectedTicketId);
      const updatedTicket = await supportApi.getTicket(selectedTicketId);
      setSelectedTicketData(updatedTicket);
      loadTickets(true);
    } catch (resolveError) {
      setDetailError(
        resolveError instanceof Error
          ? resolveError.message
          : "Failed to resolve ticket.",
      );
    } finally {
      setResolving(false);
    }
  };

  // --- SYSTEM STATES ---
  if (loading) return (
    <div className="mx-auto max-w-350 animate-pulse space-y-6 pb-24 md:pb-12">
      <div className="h-10 w-48 rounded-xl bg-zinc-200" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4"><div className="h-28 rounded-3xl bg-zinc-200" /><div className="h-28 rounded-3xl bg-zinc-200" /><div className="h-28 rounded-3xl bg-zinc-200" /><div className="h-28 rounded-3xl bg-zinc-200" /></div>
      <div className="h-14 rounded-2xl bg-zinc-200" />
      <div className="flex gap-6"><div className="h-125 w-full md:w-95 rounded-3xl bg-zinc-200" /><div className="hidden flex-1 h-125 rounded-3xl bg-zinc-200 md:block" /></div>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-red-100 bg-red-50 p-8 text-center mt-6">
      <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
      <h3 className="text-base font-bold text-red-900">System Error</h3>
      <p className="mt-1 text-sm text-red-700">{error}</p>
      <Button onClick={() => loadTickets()} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">Try Again</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-24 md:pb-12 h-full flex flex-col">
      
      {/* 1. HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Support Center</h1>
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">Manage your support tickets and communicate directly with ZOGULAR operations.</p>
        </div>
        <Button onClick={() => setIsContactModalOpen(true)} className="h-11 w-full rounded-xl bg-zinc-900 px-6 font-bold text-white shadow-md hover:bg-zinc-800 md:w-auto transition-all active:scale-95">
          Contact Support
        </Button>
      </div>

      <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Direct Contact Fallback</p>
            <p className="mt-1 text-sm font-medium text-zinc-600">
              You can also email support directly if you are unable to open a ticket.
            </p>
          </div>
          <a
            href={`mailto:${BRAND.supportEmail}?subject=Seller%20support%20request`}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-900 shadow-sm transition-colors hover:bg-white"
          >
            {BRAND.supportEmail}
          </a>
        </div>
      </div>

      {/* 2. SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 shrink-0">
        <StatCard title="Open Tickets" value={stats.open} icon={LifeBuoy} colorClass="bg-blue-50/50 border-blue-100 text-blue-950" />
        <StatCard title="Action Needed" value={stats.awaitingSeller} icon={AlertCircle} colorClass="border-amber-200 bg-amber-50/50 text-amber-950" />
        <StatCard title="Resolved" value={stats.resolved} icon={CheckCircle2} colorClass="bg-[#009E49]/5 border-[#009E49]/20 text-[#007a38]" />
        <StatCard title="Avg Response" value={stats.avgResponseHrs === null ? "Unavailable" : `${stats.avgResponseHrs}h`} icon={Clock} colorClass="bg-zinc-50 border-zinc-200/80 text-zinc-900" />
      </div>

      {/* 3. FILTERS TOOLBAR */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-sm md:flex-row md:items-center shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search ticket ID or subject..." className="h-11 w-full rounded-xl border-zinc-200 bg-zinc-50 pl-9 text-sm font-medium focus-visible:ring-zinc-900 shadow-inner" />
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <select aria-label="Filter by Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")} className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-8 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer">
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="waiting-seller">Action Needed</option>
              <option value="waiting-support">Waiting on Support</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <select aria-label="Filter by Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | "all")} className="h-11 appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-700 shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 cursor-pointer">
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* 4. TWO-COLUMN SUPPORT DESK */}
      <div className="flex flex-1 gap-6 min-h-125 overflow-hidden">
        
        {/* LEFT COLUMN: TICKET LIST */}
        <div className={cn("w-full md:w-95 shrink-0 flex-col gap-3 overflow-y-auto hide-scrollbar", selectedTicketId ? "hidden md:flex" : "flex")}>
          {filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 bg-white py-16 text-center shadow-sm">
                 <Inbox className="mb-3 h-8 w-8 text-zinc-300" />
                 <h3 className="text-sm font-bold text-zinc-900">No tickets found</h3>
                 <p className="text-xs text-zinc-500">Open a support ticket when you need help, or use direct email as a fallback.</p>
              </div>
          ) : (
            filteredTickets.map(ticket => {
              const statUI = STATUS_UI[ticket.status];
              const PriIcon = PRIORITY_UI[ticket.priority].icon;
              const isSelected = selectedTicketId === ticket.id;
              
              return (
                <div 
                  key={ticket.id} 
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={cn("cursor-pointer rounded-2xl border p-4 transition-all duration-200", 
                    isSelected ? "border-zinc-900 bg-zinc-900 text-white shadow-md" : "border-zinc-200 bg-white hover:border-zinc-300 shadow-sm"
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", isSelected ? "border-zinc-700 bg-zinc-800 text-zinc-300" : `${statUI.bg} ${statUI.text} ${statUI.border}`)}>
                      {statUI.label}
                    </span>
                    <span className={cn("text-[10px] font-bold", isSelected ? "text-zinc-400" : "text-zinc-400")}>{formatTime(ticket.updatedAt)}</span>
                  </div>
                  <h4 className={cn("mb-1 text-sm font-black line-clamp-2", isSelected ? "text-white" : "text-zinc-900")}>{ticket.subject}</h4>
                  <div className="flex items-center justify-between mt-3">
                    <p className={cn("text-[10px] font-bold uppercase tracking-wider", isSelected ? "text-zinc-500" : "text-zinc-500")}>{ticket.id}</p>
                    <div className="flex items-center gap-1">
                      <PriIcon className={cn("h-3.5 w-3.5", isSelected ? "text-zinc-400" : PRIORITY_UI[ticket.priority].color)} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: LIVE TICKET DETAIL */}
        <div className={cn("flex-1 min-w-0 flex-col rounded-3xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden", selectedTicketId ? "flex" : "hidden md:flex md:items-center md:justify-center md:bg-zinc-50/50")}>
          {loadingTicket ? (
            <div className="flex flex-col items-center justify-center p-8 h-full">
               <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
            </div>
          ) : detailError ? (
            <div className="flex flex-col items-center justify-center p-8 h-full text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-red-500" />
              <h3 className="text-sm font-bold text-red-900">Failed to load ticket</h3>
              <p className="mt-1 text-xs text-red-700">{detailError}</p>
            </div>
          ) : !selectedTicketData ? (
            <div className="text-center p-8">
              <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
              <h3 className="text-sm font-bold text-zinc-500">Select a ticket to view conversation</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs font-medium leading-relaxed text-zinc-500">
                Ticket replies stay in-app when support is active. You can still use direct email if you need an offline fallback.
              </p>
              <a
                href={`mailto:${BRAND.supportEmail}?subject=Seller%20support%20request`}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-xs font-black text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
              >
                {BRAND.supportEmail}
              </a>
            </div>
          ) : (
            <>
              {/* Ticket Header */}
              <div className="border-b border-zinc-100 bg-white p-4 md:p-6 shrink-0">
                <Button variant="ghost" size="sm" className="mb-3 h-8 -ml-2 text-xs font-bold text-zinc-500 md:hidden" onClick={() => setSelectedTicketId(null)}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to list
                </Button>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-zinc-900 md:text-lg leading-tight">{selectedTicketData.subject}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{selectedTicketData.id}</span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{selectedTicketData.category}</span>
                    </div>
                  </div>
                  {canReplyToTicket ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResolve}
                      disabled={resolving}
                      className="rounded-xl border-zinc-200 bg-zinc-50 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      {resolving ? "Resolving..." : "Mark as Resolved"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Ticket Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-zinc-50/30">
                {selectedTicketData.messages.map((msg) => {
                  const isSeller = msg.senderType === "seller";
                  const isSystem = msg.senderType === "system";

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{msg.body}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={cn("flex max-w-[85%]", isSeller ? "ml-auto justify-end" : "mr-auto justify-start")}>
                      <div className={cn("rounded-2xl p-4 shadow-sm", isSeller ? "bg-zinc-900 text-white rounded-br-sm" : "bg-white border border-zinc-200 rounded-bl-sm")}>
                        <div className="mb-1.5 flex items-center justify-between gap-4">
                          <span className={cn("text-[10px] font-bold", isSeller ? "text-zinc-400" : "text-zinc-900")}>{msg.senderName}</span>
                          <span className={cn("text-[9px] font-medium uppercase tracking-wider", isSeller ? "text-zinc-500" : "text-zinc-400")}>{formatTime(msg.createdAt)}</span>
                        </div>
                        <p className={cn("text-sm whitespace-pre-wrap leading-relaxed", isSeller ? "text-zinc-100" : "text-zinc-700")}>{msg.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {canReplyToTicket ? (
                <div className="border-t border-zinc-100 bg-white p-4 md:p-6 shrink-0">
                  <div className="flex items-end gap-3">
                    <textarea
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder="Type your reply..."
                      className="h-20 flex-1 resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                    />
                    <Button
                      onClick={handleReply}
                      disabled={replying || !replyText.trim()}
                      className="h-11 rounded-xl bg-zinc-900 px-6 font-bold text-white shadow-md hover:bg-zinc-800 transition-all active:scale-95"
                    >
                      {replying ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* 5. CONTACT SUPPORT MODAL */}
      <ContactSupportModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSuccess={(ticketId) => {
          setIsContactModalOpen(false);
          void loadTickets(true);
          setSelectedTicketId(ticketId);
        }}
      />
    </div>
  );
}
