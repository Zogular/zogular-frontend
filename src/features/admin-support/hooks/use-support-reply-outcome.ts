"use client";

import { useEffect, useRef, useState } from "react";
import {
  adminSupportApi,
  isSupportReadAuthorizationFailure,
  isSupportSessionDenied,
  supportReplyRejection,
  type AdminSupportMessage,
  type AdminSupportTicket,
} from "@/services/admin/support";

type ReplyPhase = "editing" | "pending" | "uncertain" | "invalid" | "denied" | "missing" | "conflict" | "dismissed";
type ConversationCheck = "idle" | "checking" | "checked" | "failed";

interface ReplyEntry {
  draft: string;
  phase: ReplyPhase;
  check: ConversationCheck;
}

const emptyReply: ReplyEntry = { draft: "", phase: "editing", check: "idle" };

// The keyed Support workspace owns these drafts and outcomes, not any individual drawer opening.
export function useSupportReplyOutcome(actorId: string, canViewSensitiveFields: boolean, onAuthorizationDenied: () => void) {
  const [replies, setReplies] = useState<ReadonlyMap<string, ReplyEntry>>(() => new Map());
  const current = useRef(new Map<string, ReplyEntry>());
  const mounted = useRef(false);

  useEffect(() => {
    const entries = current.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      entries.clear();
    };
  }, []);

  // Update the command guard synchronously so closing or reopening cannot race a send.
  function write(ticketId: string, entry?: ReplyEntry) {
    if (entry) current.current.set(ticketId, entry);
    else current.current.delete(ticketId);
    setReplies(new Map(current.current));
  }

  function edit(ticketId: string, draft: string) {
    const entry = current.current.get(ticketId) ?? emptyReply;
    if (entry.phase !== "editing" && entry.phase !== "invalid") return;
    write(ticketId, draft ? { ...emptyReply, draft } : undefined);
  }

  async function send(ticketId: string, onSaved: (message: AdminSupportMessage) => void) {
    const entry = current.current.get(ticketId);
    if (!entry || entry.phase !== "editing" || !entry.draft.trim()) return;
    write(ticketId, { ...entry, phase: "pending" });

    let message: AdminSupportMessage;
    try {
      message = await adminSupportApi.replyToTicket(ticketId, entry.draft.trim(), actorId, canViewSensitiveFields);
    } catch (error) {
      if (!mounted.current) return;
      if (isSupportSessionDenied(error)) {
        onAuthorizationDenied();
        return;
      }
      write(ticketId, { ...entry, phase: supportReplyRejection(error) ?? "uncertain" });
      return;
    }
    if (!mounted.current) return;
    write(ticketId);
    onSaved(message);
  }

  async function checkConversation(
    ticketId: string,
    showTicket: (ticket: AdminSupportTicket) => boolean,
    ownsDrawer: () => boolean,
  ) {
    const entry = current.current.get(ticketId);
    if (!entry || (entry.phase !== "uncertain" && entry.phase !== "conflict") || entry.check === "checking") return;
    write(ticketId, { ...entry, check: "checking" });
    try {
      const ticket = await adminSupportApi.getTicket(ticketId, canViewSensitiveFields);
      if (!mounted.current) return;
      const displayed = showTicket(ticket);
      // A read cannot prove an uncertain write failed. Only a known conflict may unlock after review.
      if (!displayed) write(ticketId, entry);
      else if (entry.phase === "conflict") write(ticketId, { ...emptyReply, draft: entry.draft });
      else write(ticketId, { ...entry, check: "checked" });
    } catch (error) {
      if (!mounted.current) return;
      if (isSupportSessionDenied(error) || (ownsDrawer() && isSupportReadAuthorizationFailure(error))) {
        onAuthorizationDenied();
        return;
      }
      write(ticketId, ownsDrawer() ? { ...entry, check: "failed" } : entry);
    }
  }

  function dismiss(ticketId: string) {
    const entry = current.current.get(ticketId);
    if (entry?.phase === "uncertain" && entry.check === "checked") {
      write(ticketId, { ...emptyReply, phase: "dismissed" });
    }
  }

  return {
    replyFor: (ticketId: string | null) => (ticketId ? replies.get(ticketId) : undefined) ?? emptyReply,
    isBusy: (ticketId: string) => {
      const entry = current.current.get(ticketId);
      return entry?.phase === "pending" || entry?.check === "checking";
    },
    edit, send, checkConversation, dismiss,
  };
}
