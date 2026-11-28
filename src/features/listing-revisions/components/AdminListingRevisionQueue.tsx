"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardList } from "lucide-react";
import { AdminDetailSheet } from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ListingRevisionDecision } from "@/features/listing-revisions/types";
import { ApiError } from "@/services/api";
import { adminListingRevisionsApi as api } from "@/services/listing-revisions";

type Queue = Awaited<ReturnType<typeof api.queue>>;
type Entry = Queue["items"][number];
type Detail = Awaited<ReturnType<typeof api.detail>>;
type Read<T> = { state: "loading" } | { state: "error" } | { state: "ready"; data: T };

// This queue never uses the first-listing moderation endpoints or bulk actions.
export function AdminListingRevisionQueue({ canDecide }: { canDecide: boolean }) {
  const [queue, setQueue] = useState<Read<Queue>>({ state: "loading" });
  const [request, setRequest] = useState<{ cursor?: string }>({});
  const [entry, setEntry] = useState<Entry | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void api.queue({ cursor: request.cursor, limit: 20 }, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setQueue({ state: "ready", data }); },
      () => { if (!controller.signal.aborted) setQueue({ state: "error" }); },
    );
    return () => controller.abort();
  }, [request]);

  function load(cursor?: string) {
    setQueue({ state: "loading" });
    setRequest({ cursor });
  }

  return (
    <section aria-labelledby="listing-revisions-heading" className="min-w-0 space-y-3 border-t border-zinc-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="listing-revisions-heading" className="flex items-center gap-2 text-lg font-bold text-zinc-900">
          <ClipboardList aria-hidden="true" size={18} /> Listing revisions
        </h2>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={queue.state === "loading"}>Refresh revisions</Button>
      </div>
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      {queue.state === "loading" && <p role="status" className="text-sm text-zinc-600">Loading revisions...</p>}
      {queue.state === "error" && <p role="alert" className="text-sm text-rose-800">Could not load revisions. Refresh revisions to try again.</p>}
      {queue.state === "ready" && (
        <>
          {queue.data.items.length === 0 && <p className="text-sm text-zinc-600">No pending revisions.</p>}
          <ul className="divide-y divide-zinc-200">
            {queue.data.items.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center justify-between gap-3 py-3">
                <div className="min-w-0 break-words">
                  <p className="text-sm font-semibold text-zinc-900">{item.product.title}</p>
                  <p className="text-xs text-zinc-600">Submitted {new Date(item.createdAt).toLocaleDateString("en-ZM", { timeZone: "Africa/Lusaka" })}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setNotice(""); setEntry(item); }}>Review revision</Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {request.cursor && <Button variant="outline" size="sm" onClick={() => load()}>First page</Button>}
            {queue.data.nextCursor && <Button variant="outline" size="sm" onClick={() => load(queue.data.nextCursor!)}>Next page</Button>}
          </div>
        </>
      )}
      {entry && <RevisionReview key={entry.id} entry={entry} canDecide={canDecide} close={() => setEntry(null)}
        onDecided={(decision) => {
          setEntry(null);
          load();
          setNotice(decision === "approve" ? "Revision approved." : "Changes requested.");
        }}
      />}
    </section>
  );
}

function RevisionReview({ entry, canDecide, close, onDecided }: {
  entry: Entry;
  canDecide: boolean;
  close: () => void;
  onDecided: (decision: ListingRevisionDecision["decision"]) => void;
}) {
  const [detail, setDetail] = useState<Read<Detail>>({ state: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [authorityDenied, setAuthorityDenied] = useState(false);
  const [decisionError, setDecisionError] = useState<number | "unknown" | null>(null);
  const pending = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    void api.detail(entry.productId, entry.id, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setDetail({ state: "ready", data }); },
      () => { if (!controller.signal.aborted) setDetail({ state: "error" }); },
    );
    return () => controller.abort();
  }, [entry.id, entry.productId, refresh]);

  function reload() {
    setConfirmed(false);
    setDetail({ state: "loading" });
    setRefresh((value) => value + 1);
  }

  const snapshot = detail.state === "ready" ? detail.data : null;
  const isPending = snapshot?.revision.status === "PENDING_REVIEW";
  // Only approval writes the live listing; requesting changes closes the pending revision.
  const versionMatches = snapshot !== null && snapshot.product.listingVersion === snapshot.revision.baseVersion;
  const reviewStatus = !snapshot ? "" : !isPending ? "This revision is no longer pending."
    : !versionMatches ? "The listing version has changed. This revision cannot be approved." : "";
  const decisionNotice = decisionError === null ? ""
    : decisionError === 409 ? (reviewStatus ? "" : "This revision changed. Review the latest details before deciding.")
    : decisionError === 401 ? "Sign in again before deciding."
    : decisionError === 403 ? "You do not have permission to decide this revision."
    : "The decision could not be confirmed. Review the latest details before trying again.";

  async function decide(decision: ListingRevisionDecision) {
    const signal = lifecycle.current?.signal;
    if (!canDecide || authorityDenied || !isPending || pending.current || !signal || signal.aborted ||
      (decision.decision === "approve" && (!versionMatches || !confirmed))) return;
    pending.current = true;
    setBusy(true);
    setDecisionError(null);
    try {
      await api.decide(entry.productId, entry.id, decision, signal);
      if (!signal.aborted) onDecided(decision.decision);
    } catch (error) {
      if (signal.aborted) return;
      // A failed request can have an unknown outcome. Invalidate the snapshot and never replay it.
      const status = error instanceof ApiError ? error.status : null;
      if (status === 401 || status === 403) setAuthorityDenied(true);
      setDecisionError(status ?? "unknown");
      reload();
    } finally {
      pending.current = false;
      if (!signal.aborted) setBusy(false);
    }
  }

  return (
    <AdminDetailSheet open contained onOpenChange={(open) => { if (!open && !pending.current) close(); }}
      title="Review listing revision" description="Compare the current listing with the seller's proposed changes.">
      <div className="space-y-4">
        {decisionNotice && <p role="alert" className="text-sm text-amber-800">{decisionNotice}</p>}
        {detail.state === "loading" && <p role="status" className="text-sm">Loading revision details...</p>}
        {detail.state === "error" && (
          <>
            <p role="alert" className="text-sm text-rose-800">Could not load revision details.</p>
            <Button variant="outline" onClick={reload}>Refresh revision details</Button>
          </>
        )}
        {snapshot && (
          <>
            <p className="text-sm text-zinc-600">Current version {snapshot.product.listingVersion} / submitted against version {snapshot.revision.baseVersion}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ListingValues title="Current listing" values={snapshot.product} />
              <ListingValues title="Proposed listing" values={snapshot.revision.payload} />
            </div>
            {reviewStatus && <p role="status" className="text-sm text-amber-800">{reviewStatus}</p>}
            {canDecide && !authorityDenied && isPending && (
              <fieldset disabled={busy} className="min-w-0 space-y-3 border-t border-zinc-200 pt-4">
                {versionMatches && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                    Confirm applying the proposed values to the listing
                  </label>
                )}
                <Button disabled={busy || !versionMatches || !confirmed} onClick={() => void decide({ decision: "approve" })}>Approve revision</Button>
                <label className="block space-y-1 text-sm">
                  <span>Reason for requesting changes</span>
                  <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} />
                </label>
                <Button variant="outline" disabled={busy || !reason.trim()} onClick={() => void decide({ decision: "needs_changes", reason: reason.trim() })}>Request changes</Button>
              </fieldset>
            )}
          </>
        )}
      </div>
    </AdminDetailSheet>
  );
}

function ListingValues({ title, values }: { title: string; values: Detail["product"] | Detail["revision"]["payload"] }) {
  return (
    <section className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere]">
      <h3 className="font-semibold text-zinc-600">{title}</h3>
      <p className="font-bold text-zinc-900">{values.title}</p>
      <p className="whitespace-pre-wrap text-zinc-700">{values.description}</p>
      <p>Price: K{values.price.toLocaleString("en-ZM")}</p>
      <p>Sale price: {values.salePrice === null ? "None" : `K${values.salePrice.toLocaleString("en-ZM")}`}</p>
    </section>
  );
}
