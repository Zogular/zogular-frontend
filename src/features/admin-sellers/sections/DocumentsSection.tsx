"use client";

import { useState } from "react";
import { ArrowUpRight, FileText, Loader2 } from "lucide-react";
import { getAdminSellerDocumentAccess } from "@/services/admin/vendor-applications";
import { getSellerDocumentAccessMessage } from "@/services/seller-document-uploads";
import type { SellerDocumentType, VendorApplication } from "@/types/seller";
import { SectionCard } from "./TrustChecksSection";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

export function DocumentsSection({
  application,
}: {
  application: VendorApplication;
}) {
  const isRegisteredBusiness = application.sellerType === "REGISTERED_BUSINESS";
  const nrcFrontUrl = application.nrcFrontUrl || application.idDocument;
  const shopPhotoUrl = application.shopPhotoUrl || application.userPic;

  return (
    <SectionCard
      title="Documents and photos"
      description="Identity, shop, and registration files provided during onboarding."
      icon={FileText}
    >
      <div className="overflow-hidden rounded-2xl border border-stone-200/60 bg-white/50">
        <div className="divide-y divide-stone-200/50">
          <DocumentCard applicationId={application.id} documentType="NRC_FRONT" label="NRC front" url={nrcFrontUrl} />
          <DocumentCard applicationId={application.id} documentType="NRC_BACK" label="NRC back" url={application.nrcBackUrl} />
          <DocumentCard applicationId={application.id} documentType="SHOP_PHOTO" label="Shop photo" url={shopPhotoUrl} />
          {isRegisteredBusiness ? (
            <DocumentCard applicationId={application.id} documentType="PACRA_DOCUMENT" label="PACRA document" url={application.pacraDocumentUrl} />
          ) : null}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200/60 bg-white/50">
        <dl className="divide-y divide-stone-200/50">
          <DocMeta label="NRC number" value={application.nrcNumber} />
          {isRegisteredBusiness ? (
            <DocMeta label="PACRA number" value={application.pacraNumber} />
          ) : null}
          {application.tpin ? (
            <DocMeta label="TPIN" value={application.tpin} />
          ) : null}
        </dl>
      </div>
    </SectionCard>
  );
}

function DocumentCard({
  applicationId,
  documentType,
  label,
  url,
}: {
  applicationId: string;
  documentType: SellerDocumentType;
  label: string;
  url?: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasUrl = Boolean(url?.trim());

  async function openPreview() {
    if (!hasUrl || opening) return;
    setError(null);
    setOpening(true);
    try {
      const access = await getAdminSellerDocumentAccess(applicationId, documentType);
      setPreviewUrl(access.signedUrl);
      setPreviewOpen(true);
    } catch (caught) {
      setError(getSellerDocumentAccessMessage(caught));
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="px-4 py-3 transition-colors hover:bg-stone-50/50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex shrink-0 items-center gap-3.5">
        {hasUrl ? (
          <button
            type="button"
            onClick={openPreview}
            disabled={opening}
            className="group relative flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-200/60 bg-stone-100 shadow-sm transition hover:shadow-md disabled:cursor-wait disabled:opacity-70 cursor-pointer"
          >
            {opening ? <Loader2 className="h-4 w-4 animate-spin text-stone-500" /> : <FileText className="h-4 w-4 text-stone-500" />}
          </button>
        ) : (
          <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-stone-200 bg-stone-50">
            <FileText className="h-4 w-4 text-stone-300" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-400">{label}</p>
        </div>
      </div>

      {hasUrl ? (
        <>
          <button
            type="button"
            onClick={openPreview}
            disabled={opening}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-stone-200/60 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-stone-700 shadow-sm transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-70 cursor-pointer"
          >
            {opening ? "Opening" : "View full"} {opening ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}
          </button>
          <MediaPreviewModal
            isOpen={previewOpen}
            onClose={() => setPreviewOpen(false)}
            url={previewUrl}
            title={label}
          />
        </>
      ) : (
        <span className="shrink-0 text-[11px] font-bold text-stone-400">Not provided</span>
      )}
      </div>
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">{error}</p>
      ) : null}
    </div>
  );
}

function DocMeta({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 transition-colors hover:bg-stone-50/50 sm:items-center">
      <dt className="shrink-0 pt-0.5 text-xs font-bold text-stone-600 sm:pt-0">{label}</dt>
      <dd className="break-words text-right text-sm font-black text-stone-950">{value || "Not provided"}</dd>
    </div>
  );
}
