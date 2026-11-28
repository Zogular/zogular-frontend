"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { clearAttemptReceipt, getAttemptReceiptKey, readAttemptReceipt, reserveAttemptReceipt } from "@/features/listing-revisions/attempt-receipt";
import {
  listingRevisionReservationSchema,
  type ListingRevisionReservation,
  type ListingRevisionSubmission,
  type OpenListingRevisionAttempt,
  type SettledListingRevisionAttempt,
} from "@/features/listing-revisions/types";
import { ApiError } from "@/services/api";
import { sellerListingRevisionsApi } from "@/services/listing-revisions";
import type { SellerProductListing } from "@/services/seller-catalog";

type History = Awaited<ReturnType<typeof sellerListingRevisionsApi.history>>;
type Fields = { title: string; description: string; price: string; salePrice: string };
type Attempt = {
  request: ListingRevisionSubmission;
  fields: Fields;
};
type LoadState = { kind: "loading" } | { kind: "error"; message: string } | {
  kind: "ready"; history: History; open: OpenListingRevisionAttempt | null;
  receiptLocked: boolean; outcome?: SettledListingRevisionAttempt;
};
type Props = {
  product: Pick<SellerProductListing, "id" | "stock" | "images" | "status">;
  backHref: string;
  sellerId?: string;
  canSubmit: boolean;
};

function toFields(product: History["product"]): Fields {
  return { title: product.title, description: product.description, price: String(product.price),
    salePrice: product.salePrice === null ? "" : String(product.salePrice) };
}

function safeMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

const outcomeLabel = {
  PENDING_REVIEW: "Revision submitted for review.",
  APPROVED: "The earlier revision was approved.",
  NEEDS_CHANGES: "The earlier revision needs changes.",
  WITHDRAWN: "The earlier revision was withdrawn.",
  RETIRED: "The unused submission was retired.",
} satisfies Record<SettledListingRevisionAttempt["status"], string>;

function historyConfirmsOutcome(history: History, previousVersion: number, outcome: SettledListingRevisionAttempt) {
  const version = history.product.listingVersion;
  if (version < previousVersion || version < outcome.baseVersion) return false;
  if (outcome.status === "RETIRED") return true;
  if (outcome.status === "APPROVED" && version <= outcome.baseVersion) return false;
  return history.revisions.some(({ id, status, baseVersion }) =>
    id === outcome.revisionId && status === outcome.status && baseVersion === outcome.baseVersion);
}

export function SellerListingRevisionPanel({ product, backHref, canSubmit, sellerId }: Props) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [refresh, setRefresh] = useState(0);
  const uncertain = useRef<Attempt | null>(null);
  const receiptKey = getAttemptReceiptKey(sellerId, product.id);

  useLayoutEffect(() => {
    const controller = new AbortController();
    async function loadListing(): Promise<Extract<LoadState, { kind: "ready" }>> {
      const { signal } = controller;
      let history = await sellerListingRevisionsApi.history(product.id, signal);
      signal.throwIfAborted();
      if (!canSubmit) return { kind: "ready", history, open: null, receiptLocked: false };
      const receipt = readAttemptReceipt(receiptKey);
      let open: OpenListingRevisionAttempt | null;
      try {
        open = await sellerListingRevisionsApi.outstandingAttempt(product.id, signal);
      } catch {
        return { kind: "ready", history, open: null, receiptLocked: true };
      }
      if (signal.aborted) return { kind: "ready", history, open, receiptLocked: true };
      let receiptLocked = receipt === undefined;
      let outcome: SettledListingRevisionAttempt | undefined;
      if (receipt) {
        try {
          const exact = await sellerListingRevisionsApi.exactAttempt(product.id, receipt.submissionKey, signal);
          if (signal.aborted) return { kind: "ready", history, open, receiptLocked: true };
          const matchesOpen = open?.submissionKey === exact.submissionKey && open.baseVersion === exact.baseVersion;
          if (exact.baseVersion !== receipt.baseVersion || (exact.status === "OPEN") !== matchesOpen) {
            receiptLocked = true;
          } else if (exact.status !== "OPEN") {
            const refreshed = await sellerListingRevisionsApi.history(product.id, signal);
            signal.throwIfAborted();
            // Never clear the receipt or expose withdrawal using a snapshot taken before exact reconciliation.
            if (historyConfirmsOutcome(refreshed, history.product.listingVersion, exact) &&
              clearAttemptReceipt(receiptKey, receipt)) {
              history = refreshed;
              outcome = exact;
            } else {
              receiptLocked = true;
            }
          }
        } catch {
          // Exact-key 404 and transport failures do not prove the attempt was absent or closed.
          receiptLocked = true;
        }
      }
      signal.throwIfAborted();
      const retained = uncertain.current?.request;
      if (!open || open.submissionKey !== retained?.submissionKey ||
        open.baseVersion !== retained.baseVersion || history.product.listingVersion !== open.baseVersion) {
        uncertain.current = null;
      }
      return { kind: "ready", history, open, receiptLocked, outcome };
    }
    loadListing().then(
      (ready) => { if (!controller.signal.aborted) setLoad(ready); },
      (error: unknown) => {
        if (!controller.signal.aborted) setLoad({ kind: "error", message: safeMessage(error, "The listing could not be loaded.") });
      },
    );
    return () => controller.abort();
  }, [product.id, receiptKey, refresh, canSubmit]);

  function reload() {
    setLoad({ kind: "loading" });
    setRefresh((current) => current + 1);
  }

  return (
    <section aria-labelledby="listing-revision-heading" className="mx-auto max-w-3xl space-y-4">
      <Button asChild variant="ghost" size="sm"><Link href={backHref}><ArrowLeft /> Back to listing</Link></Button>
      <h1 id="listing-revision-heading" className="text-xl font-semibold">Listing revision</h1>
      {load.kind === "loading" && <p role="status">Loading listing revision…</p>}
      {load.kind === "error" && <div className="space-y-2">
        <p role="alert">{load.message}</p>
        <Button type="button" variant="outline" onClick={reload}>Refresh listing</Button>
      </div>}
      {load.kind === "ready" && <RevisionEditor key={JSON.stringify([receiptKey, product.id, canSubmit, refresh])}
        history={load.history} product={product}
        canSubmit={canSubmit} reload={reload} uncertain={uncertain} receiptKey={receiptKey}
        receiptLocked={load.receiptLocked} open={load.open} outcome={load.outcome} />}
    </section>
  );
}

function RevisionEditor({ history, product, canSubmit, reload, uncertain, receiptKey, receiptLocked, open, outcome }: Omit<Props, "backHref"> & {
  history: History;
  reload: () => void;
  uncertain: { current: Attempt | null };
  receiptKey: string | null;
  receiptLocked: boolean;
  open: OpenListingRevisionAttempt | null;
  outcome?: SettledListingRevisionAttempt;
}) {
  const live = history.product;
  const [retainedAttempt] = useState(() => uncertain.current);
  const [fields, setFields] = useState(() => retainedAttempt?.fields ?? toFields(live));
  const pending = history.revisions.find(({ status }) => status === "PENDING_REVIEW");
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const inFlight = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const feedback = history.revisions[0]?.status === "NEEDS_CHANGES" ? history.revisions[0].sellerVisibleReason : null;
  const current = toFields(live);
  const unchanged = Object.keys(current).every((key) => fields[key as keyof Fields] === current[key as keyof Fields]);

  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => {
      controller.abort();
      lifetime.current = null;
    };
  }, [product.id, receiptKey, canSubmit]);

  function change(field: keyof Fields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending || open || blocked || receiptLocked || inFlight.current || unchanged) return;
    const title = fields.title.trim();
    const description = fields.description.trim();
    const price = fields.price.trim() ? Number(fields.price) : NaN;
    const salePrice = fields.salePrice.trim() ? Number(fields.salePrice) : null;
    const changes: ListingRevisionSubmission["changes"] = {
      ...(title !== live.title && { title }),
      ...(description !== live.description && { description }),
      ...(price !== live.price && { price }),
      ...(salePrice !== live.salePrice && { salePrice }),
    };
    if (salePrice !== null && (changes.salePrice !== undefined || changes.price !== undefined) && salePrice >= price) {
      setError("Sale price must be lower than the regular price.");
      return;
    }
    const result = listingRevisionReservationSchema.safeParse({ baseVersion: live.listingVersion, changes });
    if (!result.success) {
      setError("Check the changed fields and enter at least one valid change.");
      return;
    }
    await send(result.data);
  }

  async function send(reservation: ListingRevisionReservation, retry?: Attempt) {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || !canSubmit || pending || blocked || receiptLocked || inFlight.current) return;
    setError(undefined);
    inFlight.current = true;
    setBusy(true);
    try {
      if (!retry && readAttemptReceipt(receiptKey) !== null) {
        reload();
        return;
      }
      const outstanding = await sellerListingRevisionsApi.outstandingAttempt(product.id, signal);
      signal.throwIfAborted();
      if (retry ? outstanding?.submissionKey !== retry.request.submissionKey ||
        outstanding.baseVersion !== retry.request.baseVersion : outstanding !== null) {
        reload();
        return;
      }
      const reserved = retry ? null : await sellerListingRevisionsApi.reserveAttempt(product.id, reservation, signal);
      signal.throwIfAborted();
      const attempt = reserved ? {
        request: { ...reservation, submissionKey: reserved.submissionKey },
        fields,
      } : retry;
      if (!attempt) return;
      if (!reserveAttemptReceipt(receiptKey, attempt.request)) throw new Error("Attempt receipt unavailable");
      uncertain.current = attempt;
      await sellerListingRevisionsApi.submit(product.id, attempt.request, signal);
      signal.throwIfAborted();
      reload();
    } catch (failure) {
      if (signal.aborted) return;
      setError(failure instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(failure.status)
        ? failure.message : "The submission could not be confirmed. Refresh the listing before trying again.");
      setBlocked(true);
    } finally {
      if (!signal.aborted) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  async function retire() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || !open || !confirmRetire || blocked || receiptLocked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      if (!reserveAttemptReceipt(receiptKey, open)) throw new Error("Attempt receipt unavailable");
      await sellerListingRevisionsApi.settleAttempt(product.id, open.submissionKey, signal);
      signal.throwIfAborted();
      reload();
    } catch (failure) {
      if (signal.aborted) return;
      setError(safeMessage(failure, "Retirement could not be confirmed. Refresh the listing."));
      setBlocked(true);
    } finally {
      if (!signal.aborted) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  async function withdraw() {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || !pending || !confirmWithdraw || blocked || receiptLocked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await sellerListingRevisionsApi.withdraw(product.id, pending.id, signal);
      signal.throwIfAborted();
      reload();
    } catch (failure) {
      if (signal.aborted) return;
      setError(safeMessage(failure, "Withdrawal could not be confirmed. Refresh the listing."));
      setBlocked(true);
      setConfirmWithdraw(false);
    } finally {
      if (!signal.aborted) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <div className="space-y-4">
      <section aria-label="Current listing" className="space-y-1 border-b pb-4 text-sm">
        <h2 className="font-semibold">{product.status === "paused" ? "Current approved listing" : "Current listing"}</h2>
        <p className="break-words">{live.title}</p>
        <p>K{live.price}{live.salePrice !== null ? ` · Sale K${live.salePrice}` : ""}</p>
        <p>{product.stock} in stock · {product.images.length} photos</p>
      </section>
      {outcome && !receiptLocked && <p role="status" className="text-sm">{outcomeLabel[outcome.status]}</p>}
      {feedback && !receiptLocked && <p className="break-words text-sm">{feedback}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {blocked && <Button type="button" variant="outline" onClick={reload}>Refresh listing</Button>}
      {receiptLocked && <div className="space-y-2 text-sm">
        <p role="status">A new revision is locked because the previous submission cannot be confirmed.</p>
        {!blocked && <Button type="button" variant="outline" onClick={reload}>Refresh listing</Button>}
      </div>}
      {open && !pending && !receiptLocked && <section aria-label="Open submission" className="space-y-2 text-sm">
        <p>{retainedAttempt ? "Retry the same changes or retire this submission." : "An unfinished submission is open. Retire it before starting new changes."}</p>
        {!blocked && <div className="flex flex-wrap gap-2">
          {confirmRetire ? <>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmRetire(false)}>Keep submission</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={retire}>Confirm retirement</Button>
          </> : <>
            {retainedAttempt && canSubmit && <Button type="button" disabled={busy}
              onClick={() => send(retainedAttempt.request, retainedAttempt)}>Retry same submission</Button>}
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmRetire(true)}>Retire submission</Button>
          </>}
        </div>}
      </section>}
      {pending && !receiptLocked ? (
        <section aria-label="Pending revision" className="space-y-1 text-sm">
          <h2 className="font-semibold">Pending review</h2>
          <p className="break-words">{pending.payload.title}</p>
          <p className="whitespace-pre-wrap break-words">{pending.payload.description}</p>
          <p>K{pending.payload.price}{pending.payload.salePrice !== null ? ` · Sale K${pending.payload.salePrice}` : ""}</p>
          <p>{product.status === "paused" ? "The listing remains paused during review." : "The approved listing is unchanged during review."}</p>
          {!blocked && (confirmWithdraw ? (
            <div className="space-y-2">
              <p>Withdraw the proposed changes from review? Your approved listing will not change.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmWithdraw(false)}>Keep in review</Button>
                <Button type="button" variant="destructive" disabled={busy} onClick={withdraw}>Confirm withdrawal</Button>
              </div>
            </div>
          ) : <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmWithdraw(true)}>Withdraw revision</Button>)}
        </section>
      ) : !canSubmit ? <p className="text-sm">This listing is not available for revision.</p> : (
        <form onSubmit={submit}>
          <fieldset disabled={busy || blocked || receiptLocked || Boolean(open)} className="min-w-0 space-y-3">
            <label className="block space-y-1 text-sm"><span>Title</span>
              <Input value={fields.title} onChange={(event) => change("title", event.target.value)} maxLength={200} required />
            </label>
            <label className="block space-y-1 text-sm"><span>Description</span>
              <Textarea value={fields.description} onChange={(event) => change("description", event.target.value)} maxLength={5000} required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block min-w-0 space-y-1 text-sm"><span>Price (K)</span>
                <Input type="number" inputMode="decimal" step="any" min={1} required value={fields.price} onChange={(event) => change("price", event.target.value)} />
              </label>
              <label className="block min-w-0 space-y-1 text-sm"><span>Sale price (K)</span>
                <Input type="number" inputMode="decimal" step="any" min={0} value={fields.salePrice} onChange={(event) => change("salePrice", event.target.value)} />
              </label>
            </div>
            <Button type="submit" disabled={unchanged} className="w-full sm:w-auto">{busy ? "Submitting…" : "Submit revision for review"}</Button>
          </fieldset>
        </form>
      )}
    </div>
  );
}
