"use client";

import { useState } from "react";
import { ArrowUpRight, FileText, Loader2 } from "lucide-react";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { getAdminSellerDocumentAccess } from "@/services/admin/vendor-applications";
import { getSellerDocumentAccessMessage } from "@/services/seller-document-uploads";
import type { SellerDocumentType } from "@/types/seller";
import type { SellerReviewDetail } from "../types/seller-review.types";
import { SectionCard } from "./TrustChecksSection";

export function DocumentsSection({ detail }: { detail: SellerReviewDetail }) {
  const { application } = detail;
  const { documents } = detail.review.evidence;
  const { canViewSensitiveFields } = detail.review.capabilities;
  const rows: Array<{ type: SellerDocumentType; label: string }> = [
    { type: "NRC_FRONT", label: "NRC front" },
    { type: "NRC_BACK", label: "NRC back" },
    { type: "SHOP_PHOTO", label: "Shop photo" },
    ...(application.sellerType === "REGISTERED_BUSINESS"
      ? [{ type: "PACRA_DOCUMENT" as const, label: "PACRA document" }]
      : []),
  ];

  return (
    <SectionCard title="Signed documents" description="Open a fresh protected preview when a document is available." icon={FileText}>
      <div className="overflow-hidden rounded-xl border border-[color:rgba(184,135,70,0.24)] bg-[var(--admin-surface-mist)]">
        {rows.map((row) => (
          <DocumentRow
            key={row.type}
            applicationId={application.id}
            documentType={row.type}
            label={row.label}
            access={getSellerDocumentPresentation(documents[row.type], canViewSensitiveFields)}
          />
        ))}
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-3">
        <DocumentNumber label="NRC" value={application.nrcNumber} restricted={!canViewSensitiveFields} />
        {application.sellerType === "REGISTERED_BUSINESS" ? <DocumentNumber label="PACRA" value={application.pacraNumber} restricted={!canViewSensitiveFields} /> : null}
        <DocumentNumber label="TPIN" value={application.tpin} restricted={!canViewSensitiveFields} />
      </dl>
    </SectionCard>
  );
}

export type SellerDocumentPresentation = "available" | "restricted" | "absent";

export function getSellerDocumentPresentation(
  evidencePresent: boolean,
  canViewSensitiveFields: boolean,
): SellerDocumentPresentation {
  if (!evidencePresent) return "absent";
  return canViewSensitiveFields ? "available" : "restricted";
}

function DocumentRow({ applicationId, documentType, label, access }: { applicationId: string; documentType: SellerDocumentType; label: string; access: SellerDocumentPresentation }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPreview() {
    if (access !== "available" || opening) return;
    setOpening(true);
    setError(null);
    try {
      const access = await getAdminSellerDocumentAccess(applicationId, documentType);
      setPreviewUrl(access.signedUrl);
    } catch (caught) {
      setError(getSellerDocumentAccessMessage(caught));
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="border-b border-[color:rgba(184,135,70,0.18)] p-3 last:border-b-0 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[color:rgba(184,135,70,0.24)] bg-[var(--admin-surface-cream)] text-[var(--admin-canopy)]"><FileText className="size-4" /></div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-ink)]">{label}</p>
            <p data-testid={`document-state-${documentType}`} className="text-xs text-[var(--admin-ink-soft)]">
              {access === "available" ? "Available for review" : access === "restricted" ? "Restricted access" : "Not provided"}
            </p>
          </div>
        </div>
        {access === "available" ? (
          <button type="button" onClick={openPreview} disabled={opening} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[color:rgba(7,91,54,0.25)] bg-[var(--admin-surface-cream)] px-3 text-xs font-semibold text-[var(--admin-canopy)] outline-none hover:bg-[color:rgba(7,91,54,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--admin-ember)] disabled:cursor-wait disabled:opacity-70">
            {opening ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowUpRight className="size-4" />}
            {opening ? "Opening" : "View"}
          </button>
        ) : null}
      </div>
      {error ? <p role="status" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium leading-5 text-[var(--admin-escalation)]">{error}</p> : null}
      <MediaPreviewModal isOpen={Boolean(previewUrl)} onClose={() => setPreviewUrl(null)} url={previewUrl} title={label} />
    </div>
  );
}

function DocumentNumber({ label, value, restricted }: { label: string; value: string | null; restricted: boolean }) {
  return <div className="rounded-xl border border-[color:rgba(184,135,70,0.22)] bg-[var(--admin-surface-mist)] px-3 py-3"><dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--admin-ink-soft)]">{label}</dt><dd data-testid={`document-number-${label.toLowerCase()}`} className="mt-1 break-words text-sm font-semibold text-[var(--admin-ink)]">{restricted ? "Restricted access" : value || "Not provided"}</dd></div>;
}
