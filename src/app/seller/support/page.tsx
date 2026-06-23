"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LifeBuoy, Search, Filter, MessageSquare, Clock, CheckCircle2,
  AlertCircle, ArrowLeft, Send, AlertTriangle, Info, ShieldAlert,
  Inbox
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BackendPendingBadge, FeaturePendingNotice } from "@/components/shared/FeaturePendingNotice";

// Import from our new service layer
import { supportApi, SupportTicket, SupportStats, TicketStatus, TicketPriority } from "@/services/support";
import { CreateTicketModal } from "@/app/seller/CreateTicketModal";
import { BACKEND_INTEGRATION_PENDING_MESSAGE } from "@/services/backend-pending";

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

const SELLER_SUPPORT_BACKEND_PENDING = true;

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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");

  // Thread & Modal State
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // --- 1. DATA FETCHING ---
  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await supportApi.fetchTickets();
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
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
    return { open, awaitingSeller: waiting, resolved, avgResponseHrs: 2.4 };
  }, [tickets]);

  const selectedTicket = useMemo(() => tickets.find(t => t.id === selectedTicketId) || null, [tickets, selectedTicketId]);

  // --- 3. MUTATION HANDLERS ---
  const handleSendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;

    setIsReplying(true);
    try {
      const newMsg = await supportApi.replyToTicket(selectedTicketId, replyText);
      setTickets(prev => prev.map(t => {
        if (t.id === selectedTicketId) {
          return {
            ...t,
            status: "waiting-support", 
            updatedAt: newMsg.createdAt,
            messages: [...t.messages, newMsg]
          };
        }
        return t;
      }));
      setReplyText("");
      toast.success("Reply sent successfully.");
    } catch {
      toast.error("Failed to send reply. Try again.");
    } finally {
      setIsReplying(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedTicketId) return;
    try {
      await supportApi.resolveTicket(selectedTicketId);
      setTickets(prev => prev.map(t => t.id === selectedTicketId ? { ...t, status: "resolved", updatedAt: new Date().toISOString() } : t));
      toast.success("Ticket marked as resolved.");
    } catch {
      toast.error("Failed to resolve ticket.");
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
      <Button onClick={loadTickets} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">Try Again</Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-350 animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 min-w-0 pb-24 md:pb-12 h-full flex flex-col">
      
      {/* 1. HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end shrink-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">Support Center</h1>
            <BackendPendingBadge />
          </div>
          <p className="mt-1 text-sm font-medium text-zinc-500">Operations-only preview for seller support workflows.</p>
        </div>
        <Button disabled={SELLER_SUPPORT_BACKEND_PENDING} onClick={() => setIsCreateModalOpen(true)} className="h-11 w-full rounded-xl bg-zinc-900 px-6 font-bold text-white shadow-md hover:bg-zinc-800 md:w-auto">
          Backend integration pending
        </Button>
      </div>

      <FeaturePendingNotice
        title="Support actions unavailable"
        description="Seller support tickets are not available in MVP yet. Ticket creation, replies, and resolution stay disabled until backend support is implemented."
      />

      {/* 2. SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 shrink-0">
        <StatCard title="Open Tickets" value={stats.open} icon={LifeBuoy} colorClass="bg-blue-50/50 border-blue-100 text-blue-950" />
        <StatCard title="Action Needed" value={stats.awaitingSeller} icon={AlertCircle} colorClass="border-amber-200 bg-amber-50/50 text-amber-950" />
        <StatCard title="Resolved" value={stats.resolved} icon={CheckCircle2} colorClass="bg-[#009E49]/5 border-[#009E49]/20 text-[#007a38]" />
        <StatCard title="Avg Response" value={`${stats.avgResponseHrs}h`} icon={Clock} colorClass="bg-zinc-50 border-zinc-200/80 text-zinc-900" />
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
            <option value="high">High & Urgent</option>
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
                <p className="text-xs text-zinc-500">Adjust filters or create a new ticket.</p>
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

        {/* RIGHT COLUMN: ACTIVE THREAD */}
        <div className={cn("flex-1 min-w-0 flex-col rounded-3xl border border-zinc-200/80 bg-white shadow-sm overflow-hidden", selectedTicketId ? "flex" : "hidden md:flex md:items-center md:justify-center md:bg-zinc-50/50")}>
          {!selectedTicket ? (
            <div className="text-center p-8">
              <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
              <h3 className="text-sm font-bold text-zinc-500">Select a ticket to view the conversation</h3>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="border-b border-zinc-100 bg-white p-4 md:p-6 shrink-0">
                <Button variant="ghost" size="sm" className="mb-3 h-8 -ml-2 text-xs font-bold text-zinc-500 md:hidden" onClick={() => setSelectedTicketId(null)}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to list
                </Button>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-zinc-900 md:text-lg leading-tight">{selectedTicket.subject}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{selectedTicket.id}</span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{selectedTicket.category}</span>
                    </div>
                  </div>
                  {selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" && (
                    <Button variant="outline" size="sm" disabled={SELLER_SUPPORT_BACKEND_PENDING} onClick={handleMarkResolved} className="h-9 shrink-0 rounded-xl border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 hidden sm:flex">
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Backend pending
                    </Button>
                  )}
                </div>
              </div>

              {/* Thread Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-zinc-50/30">
                {selectedTicket.messages.map((msg) => {
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

              {/* Thread Reply Input */}
              {selectedTicket.status !== "resolved" && selectedTicket.status !== "closed" ? (
                <div className="border-t border-zinc-200 bg-white p-4 shrink-0">
                  <div className="relative">
                    <textarea 
                      aria-label="Reply message"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={BACKEND_INTEGRATION_PENDING_MESSAGE}
                      disabled={SELLER_SUPPORT_BACKEND_PENDING}
                      className="min-h-20 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 pr-14 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                    />
                    <Button 
                      aria-label="Send reply"
                      size="icon" 
                      onClick={handleSendReply}
                      disabled={SELLER_SUPPORT_BACKEND_PENDING || !replyText.trim() || isReplying}
                      className="absolute bottom-3 right-3 h-8 w-8 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-zinc-100 bg-zinc-50 p-4 text-center shrink-0">
                  <p className="text-xs font-bold text-zinc-500">This ticket is {selectedTicket.status}. Replies are disabled.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 5. CREATE TICKET MODAL */}
      <CreateTicketModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={(newTicket) => {
          setTickets(prev => [newTicket, ...prev]);
          setSelectedTicketId(newTicket.id);
          setIsCreateModalOpen(false);
        }} 
      />
    </div>
  );
}
