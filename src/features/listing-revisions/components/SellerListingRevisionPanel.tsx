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

export function SellerListingRevisionPanel({ product, backHref, canSubmit }: Props) {
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    sellerListingRevisionsApi.history(product.id, controller.signal).then(
      (history) => { if (!controller.signal.aborted) setLoad({ kind: "ready", history }); },
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
        canSubmit={canSubmit} reload={reload} />}
    </section>
  );
}

function RevisionEditor({ history, product, canSubmit, reload }: Omit<Props, "backHref"> & {
  history: History;
  reload: () => void;
}) {
  const live = history.product;
  const [fields, setFields] = useState(() => toFields(live));
  const [pending, setPending] = useState(() => history.revisions.find(({ status }) => status === "PENDING_REVIEW"));
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const feedback = history.revisions[0]?.status === "NEEDS_CHANGES" ? history.revisions[0].sellerVisibleReason : null;
  const current = toFields(live);
  const unchanged = Object.keys(current).every((key) => fields[key as keyof Fields] === current[key as keyof Fields]);

  function change(field: keyof Fields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || pending || blocked || inFlight.current || unchanged) return;
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
    const fingerprint = JSON.stringify(changes);
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() };
    const result = listingRevisionSubmissionSchema.safeParse({
      baseVersion: live.listingVersion, submissionKey: attempt.current.key, changes,
    });
    if (!result.success) {
      setError("Check the changed fields and enter at least one valid change.");
      return;
    }
    setError(undefined);
    setNotice(undefined);
    inFlight.current = true;
    setBusy(true);
    try {
      const { revision } = await sellerListingRevisionsApi.submit(product.id, result.data);
      if (revision.status === "PENDING_REVIEW") {
        setPending(revision);
        setNotice("Revision submitted for review.");
      } else {
        setBlocked(true);
        setNotice("This submission has already been processed. Refresh the listing for its current status.");
      }
      attempt.current = null;
    } catch (failure) {
      setError(safeMessage(failure, "The revision could not be submitted."));
      if (failure instanceof ApiError && [401, 403, 404, 409].includes(failure.status)) setBlocked(true);
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
        </section>
      ) : !canSubmit ? <p className="text-sm">This listing is not available for revision.</p> : (
        <form onSubmit={submit}>
          <fieldset disabled={busy || blocked} className="min-w-0 space-y-3">
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
