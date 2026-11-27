"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listingRevisionSubmissionSchema, type ListingRevisionSubmission } from "@/features/listing-revisions/types";
import { ApiError } from "@/services/api";
import { sellerListingRevisionsApi } from "@/services/listing-revisions";
import type { SellerProductListing } from "@/services/seller-catalog";

type History = Awaited<ReturnType<typeof sellerListingRevisionsApi.history>>;
type Fields = { title: string; description: string; price: string; salePrice: string };
type Attempt = {
  request: ListingRevisionSubmission;
  fields: Fields;
  expected: Omit<History["product"], "id" | "listingVersion">;
  priorIds: ReadonlySet<string>;
};
type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; history: History };
type Props = {
  product: Pick<SellerProductListing, "id" | "stock" | "images" | "status">;
  backHref: string;
  canSubmit: boolean;
};

function toFields(product: History["product"]): Fields {
  return { title: product.title, description: product.description, price: String(product.price),
    salePrice: product.salePrice === null ? "" : String(product.salePrice) };
}

function safeMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function hasDefinitiveRejection(error: unknown) {
  return error instanceof ApiError && [400, 401, 403, 404, 409, 422].includes(error.status);
}

export function SellerListingRevisionPanel({ product, backHref, canSubmit }: Props) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [refresh, setRefresh] = useState(0);
  const uncertain = useRef<Attempt | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    sellerListingRevisionsApi.history(product.id, controller.signal).then(
      (history) => {
        if (controller.signal.aborted) return;
        const attempt = uncertain.current;
        // History omits submission keys. An unchanged history cannot prove that a timed-out write did not commit.
        if (attempt && (history.product.listingVersion !== attempt.request.baseVersion ||
          history.revisions.some((revision) => !attempt.priorIds.has(revision.id) &&
            revision.baseVersion === attempt.request.baseVersion &&
            revision.payload.title === attempt.expected.title &&
            revision.payload.description === attempt.expected.description &&
            revision.payload.price === attempt.expected.price &&
            revision.payload.salePrice === attempt.expected.salePrice))) {
          uncertain.current = null;
        }
        setLoad({ kind: "ready", history });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setLoad({ kind: "error", message: safeMessage(error, "The listing could not be loaded.") });
      },
    );
    return () => controller.abort();
  }, [product.id, refresh]);

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
      {load.kind === "ready" && <RevisionEditor key={refresh} history={load.history} product={product}
        canSubmit={canSubmit} reload={reload} uncertain={uncertain} />}
    </section>
  );
}

function RevisionEditor({ history, product, canSubmit, reload, uncertain }: Omit<Props, "backHref"> & {
  history: History;
  reload: () => void;
  uncertain: { current: Attempt | null };
}) {
  const live = history.product;
  const [retainedAttempt] = useState(() => uncertain.current);
  const [fields, setFields] = useState(() => retainedAttempt?.fields ?? toFields(live));
  const [pending, setPending] = useState(() => history.revisions.find(({ status }) => status === "PENDING_REVIEW"));
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const inFlight = useRef(false);
  const feedback = history.revisions[0]?.status === "NEEDS_CHANGES" ? history.revisions[0].sellerVisibleReason : null;
  const current = toFields(live);
  const unchanged = Object.keys(current).every((key) => fields[key as keyof Fields] === current[key as keyof Fields]);

  function change(field: keyof Fields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending || blocked || inFlight.current || unchanged || retainedAttempt) return;
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
    const result = listingRevisionSubmissionSchema.safeParse({
      baseVersion: live.listingVersion, submissionKey: crypto.randomUUID(), changes,
    });
    if (!result.success) {
      setError("Check the changed fields and enter at least one valid change.");
      return;
    }
    await send({
      request: result.data,
      fields,
      expected: { title, description, price, salePrice },
      priorIds: new Set(history.revisions.map(({ id }) => id)),
    });
  }

  async function send(attempt: Attempt) {
    if (!canSubmit || pending || blocked || inFlight.current) return;
    setError(undefined);
    setNotice(undefined);
    inFlight.current = true;
    setBusy(true);
    try {
      const { revision } = await sellerListingRevisionsApi.submit(product.id, attempt.request);
      uncertain.current = null;
      if (revision.status === "PENDING_REVIEW") {
        setPending(revision);
        setNotice("Revision submitted for review.");
      } else {
        setBlocked(true);
        setNotice("This submission has already been processed. Refresh the listing for its current status.");
      }
    } catch (failure) {
      if (!hasDefinitiveRejection(failure)) {
        uncertain.current = attempt;
        setError("The submission could not be confirmed. Refresh the listing before trying again.");
        setBlocked(true);
      } else {
        setError(safeMessage(failure, "The revision could not be submitted."));
        if (retainedAttempt || (failure instanceof ApiError && [401, 403, 404, 409].includes(failure.status))) {
          setBlocked(true);
        }
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!pending || !confirmWithdraw || blocked || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await sellerListingRevisionsApi.withdraw(product.id, pending.id);
      reload();
    } catch (failure) {
      setError(safeMessage(failure, "Withdrawal could not be confirmed. Refresh the listing."));
      setBlocked(true);
      setConfirmWithdraw(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
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
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {feedback && <p className="break-words text-sm">{feedback}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {blocked && <Button type="button" variant="outline" onClick={reload}>Refresh listing</Button>}
      {pending ? (
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
          <fieldset disabled={busy || blocked || Boolean(retainedAttempt)} className="min-w-0 space-y-3">
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
          {retainedAttempt && !blocked && <div className="mt-3 space-y-2 text-sm">
            <p>The submission is not visible yet. You can retry the same changes without creating another submission.</p>
            <Button type="button" disabled={busy} onClick={() => send(retainedAttempt)}>Retry same submission</Button>
          </div>}
        </form>
      )}
    </div>
  );
}
