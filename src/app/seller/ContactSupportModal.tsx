"use client";

import { useState } from "react";
import { X, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRAND } from "@/config/brand";
import { supportApi, TicketCategory, TicketPriority } from "@/services/support";

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketId: string) => void;
}

export function ContactSupportModal({ isOpen, onClose, onSuccess }: ContactSupportModalProps) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("general");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const ticket = await supportApi.createTicket(subject, category, priority, message);
      
      setSubject("");
      setCategory("general");
      setPriority("medium");
      setMessage("");
      
      if (onSuccess) {
        onSuccess(ticket.id);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm transition-opacity"
        onClick={!loading ? onClose : undefined}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="absolute right-4 top-4">
          <Button
            aria-label="Close support contact modal"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={loading}
            className="h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="mb-1 text-xl font-black text-zinc-900">Create Support Ticket</h2>
        <p className="mb-6 text-xs font-medium text-zinc-500">
          Describe your issue and ZOGULAR operations will respond in this thread.
        </p>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm font-bold text-red-900 leading-tight">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto pr-2 flex-1 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-zinc-500">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={loading}
              placeholder="Brief summary of the issue"
              className="h-11 rounded-xl bg-zinc-50 text-sm font-bold shadow-inner focus-visible:ring-zinc-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-zinc-500">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                disabled={loading}
                className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
              >
                <option value="general">General</option>
                <option value="order">Order Issue</option>
                <option value="payout">Payout</option>
                <option value="inventory">Inventory</option>
                <option value="tech">Technical</option>
                <option value="account">Account</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-zinc-500">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                disabled={loading}
                className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-zinc-500">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              placeholder="Please provide details about your issue..."
              className="h-32 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-zinc-900 font-bold text-white shadow-md hover:bg-zinc-800 transition-all active:scale-95"
          >
            {loading ? "Creating Ticket..." : "Submit Ticket"}
          </Button>
        </form>

        <div className="mt-6 pt-5 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Or email us</span>
          <a href={`mailto:${BRAND.supportEmail}`} className="flex items-center text-xs font-bold text-zinc-500 hover:text-zinc-900 transition-colors">
            <Mail className="mr-1.5 h-3.5 w-3.5" /> {BRAND.supportEmail}
          </a>
        </div>
      </div>
    </div>
  );
}
