"use client";

import { useState } from "react";
import { ArrowUpRight, FileText } from "lucide-react";
import type { VendorApplication } from "@/types/seller";
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
          <DocumentCard label="NRC front" url={nrcFrontUrl} />
          <DocumentCard label="NRC back" url={application.nrcBackUrl} />
          <DocumentCard label="Shop photo" url={shopPhotoUrl} />
          {isRegisteredBusiness ? (
            <DocumentCard label="PACRA document" url={application.pacraDocumentUrl} />
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

function DocumentCard({ label, url }: { label: string; url?: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasUrl = Boolean(url?.trim());

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-stone-50/50">
      <div className="flex shrink-0 items-center gap-3.5">
        {hasUrl ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="group relative block h-10 w-14 shrink-0 overflow-hidden rounded-md border border-stone-200/60 bg-stone-100 shadow-sm transition hover:shadow-md cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url!}
              alt={label}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          </button>
        ) : (
          <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-stone-200 bg-stone-50">
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
            onClick={() => setPreviewOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200/60 bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-stone-700 shadow-sm transition hover:bg-stone-50 cursor-pointer"
          >
            View full <ArrowUpRight className="h-3 w-3" />
          </button>
          <MediaPreviewModal
            isOpen={previewOpen}
            onClose={() => setPreviewOpen(false)}
            url={url}
            title={label}
          />
        </>
      ) : (
        <span className="shrink-0 text-[11px] font-bold text-stone-400">Not provided</span>
      )}
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
