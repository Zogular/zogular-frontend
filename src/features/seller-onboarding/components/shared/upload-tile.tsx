import { Eye, FileUp, Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { UploadTileStatus } from "../../types/seller-onboarding.types";
import { StatusBadge } from "./status-badge";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

const uploadStatusMap: Record<UploadTileStatus, "draft" | "pending" | "ready" | "missing"> = {
  empty: "draft",
  pending: "pending",
  uploaded: "ready",
  rejected: "missing",
};

export type UploadTileProps = {
  title: string;
  description: string;
  status: UploadTileStatus;
  acceptLabel: string;
  url?: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
  disabled?: boolean;
  onSelectFile?: (file: File | null) => void;
  onRequestPreviewUrl?: () => Promise<string>;
};

export function UploadTile({
  title,
  description,
  status,
  acceptLabel,
  url,
  uploading = false,
  progress = 0,
  error,
  disabled = false,
  onSelectFile,
  onRequestPreviewUrl,
}: UploadTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const resolvedStatus = uploading ? "pending" : status;
  const locked = disabled || uploading;

  const openFilePicker = () => {
    if (locked) return;
    inputRef.current?.click();
  };

  const openPreview = async () => {
    if (!url || previewLoading) return;
    setPreviewError(null);

    if (!onRequestPreviewUrl) {
      setPreviewUrl(url);
      setPreviewOpen(true);
      return;
    }

    setPreviewLoading(true);
    try {
      const nextUrl = await onRequestPreviewUrl();
      setPreviewUrl(nextUrl);
      setPreviewOpen(true);
    } catch (error) {
      setPreviewError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Document preview is not available right now. Please try again.",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-3xl border border-dashed p-4 transition-colors",
        resolvedStatus === "uploaded"
          ? "border-[#0EA85B]/35 bg-[#E9F8EF]/70"
          : resolvedStatus === "rejected"
            ? "border-[#D9795F]/45 bg-[#FBE9E4]/70"
            : "border-[#D8C9B8] bg-[#FBF6EE]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white bg-[#FFFCF8] text-[#0B3425] shadow-sm">
          <FileUp className="h-4 w-4" />
        </div>
        <StatusBadge status={uploadStatusMap[resolvedStatus]} label={uploading ? "Uploading" : resolvedStatus === "empty" ? "Missing" : resolvedStatus === "uploaded" ? "Uploaded" : undefined} />
      </div>
      <h3 className="mt-4 text-sm font-black text-[#1F1A14]">{title}</h3>
      <p className="mt-1 text-xs font-medium leading-5 text-[#6F6A62]">{description}</p>
      {uploading ? (
        <div className="mt-4 space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#0EA85B]" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs font-bold text-[#6F6A62]">Uploading file...</p>
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-2xl bg-[#FBE9E4] px-3 py-2 text-xs font-bold leading-5 text-[#A5442E] break-words">
          {error}
        </p>
      ) : null}
      {previewError ? (
        <p className="mt-3 rounded-2xl bg-[#FBE9E4] px-3 py-2 text-xs font-bold leading-5 text-[#A5442E] break-words">
          {previewError}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
        disabled={locked}
        className="sr-only"
        onChange={(event) => {
          if (locked) return;
          onSelectFile?.(event.target.files?.[0] ?? null);
          event.currentTarget.value = "";
        }}
      />
      <div className="mt-4 flex flex-col gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9B948A]">{acceptLabel}</p>
        <div className="flex flex-wrap items-center gap-2">
          {url ? (
            <>
              <button
                type="button"
                onClick={openPreview}
                disabled={previewLoading}
                className="inline-flex min-h-11 min-w-[82px] flex-1 items-center justify-center rounded-xl border border-[#D8C9B8] bg-[#FFFCF8] px-3 py-2 text-xs font-black text-[#1F1A14] hover:bg-white disabled:cursor-wait disabled:opacity-70 cursor-pointer"
              >
                {previewLoading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                {previewLoading ? "Opening" : "View"}
              </button>
              <MediaPreviewModal
                isOpen={previewOpen}
                onClose={() => setPreviewOpen(false)}
                url={previewUrl}
                title={title}
              />
            </>
          ) : null}
          <button
            type="button"
            aria-disabled={locked}
            disabled={locked}
            onClick={openFilePicker}
            className={cn(
              "inline-flex min-h-11 min-w-[96px] flex-1 items-center justify-center rounded-xl border border-[#D8C9B8] bg-[#FFFCF8] px-3 py-2 text-xs font-black text-[#1F1A14] hover:bg-white",
              locked ? "opacity-60" : "cursor-pointer",
            )}
          >
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="mr-1.5 h-3.5 w-3.5" />}
            {disabled ? "Locked" : status === "uploaded" ? "Replace" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
