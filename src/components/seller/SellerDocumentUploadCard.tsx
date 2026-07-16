"use client";

import { useId } from "react";
import { AlertCircle, Eye, FileBadge2, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SellerDocumentUploadState } from "@/types/seller";

function getStatusBadge(status: SellerDocumentUploadState["status"]) {
  switch (status) {
    case "uploading":
      return { label: "Uploading", className: "bg-[#fff1d8] text-[#9a6a11]" };
    case "uploaded":
      return { label: "Uploaded", className: "bg-emerald-100 text-emerald-700" };
    case "failed":
      return { label: "Retry", className: "bg-rose-100 text-rose-700" };
    default:
      return { label: "Pending", className: "bg-[#efe5d4] text-[#8a6a32]" };
  }
}

export function SellerDocumentUploadCard({
  label,
  helper,
  hint,
  required = false,
  accept,
  state,
  onSelectFile,
  onRetry,
  icon,
  disabled = false,
  className,
}: {
  label: string;
  helper: string;
  hint: string;
  required?: boolean;
  accept: string;
  state: SellerDocumentUploadState;
  onSelectFile: (file: File | null) => void | Promise<void>;
  onRetry: () => void | Promise<void>;
  icon: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const fileInputId = useId();
  const badge = getStatusBadge(state.status);
  const showImagePreview = state.fileKind === "image" && Boolean(state.previewUrl);

  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[#8a6a32]">
        {label}
        {required ? " *" : ""}
      </span>

      <div className="rounded-[1.35rem] border border-dashed border-[#d8c5ab] bg-[linear-gradient(180deg,rgba(255,252,247,0.82),rgba(249,242,231,0.72))] p-3.5 shadow-[0_14px_32px_rgba(42,30,17,0.05)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/70 bg-white/75 text-[#8a6a32] shadow-sm">
            {icon}
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]", badge.className)}>
            {badge.label}
          </span>
        </div>

        <div className="mt-3">
          <p className="text-sm font-black leading-tight text-[#24170c]">Upload from device</p>
          <p className="mt-1 text-[12px] font-medium leading-5 text-[#6b5a46]">{helper}</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#8a6a32]">{hint}</p>
        </div>

        {showImagePreview ? (
          <div className="mt-3 overflow-hidden rounded-[1rem] border border-white/70 bg-white/65">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.previewUrl ?? undefined}
              alt={label}
              className="h-36 w-full object-cover"
            />
          </div>
        ) : state.fileKind === "pdf" || state.fileName ? (
          <div className="mt-3 rounded-[1rem] border border-white/70 bg-white/65 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] border border-[#eadbc3] bg-[#fff9ef] text-[#8a6a32]">
                <FileBadge2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#24170c]">
                  {state.fileName || label}
                </p>
                <p className="text-[11px] font-semibold text-[#6b5a46]">
                  PDF or document file
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {state.status === "uploading" ? (
          <div className="mt-3 space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-[#0f8c48] transition-[width] duration-200"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <p className="text-[11px] font-semibold text-[#6b5a46]">
              {state.progress}% uploaded
            </p>
          </div>
        ) : null}

        {state.error ? (
          <div className="mt-3 flex items-start gap-2 rounded-[1rem] border border-rose-200 bg-rose-50/75 px-3 py-2.5 text-[12px] font-semibold leading-5 text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        ) : null}

        <input
          id={fileInputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            void onSelectFile(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <label
            htmlFor={fileInputId}
            aria-disabled={disabled || state.status === "uploading"}
            className={cn(
              "inline-flex h-10 items-center rounded-2xl border border-[#dbcab1] bg-white/78 px-3.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b5a46] transition-colors hover:bg-white",
              disabled || state.status === "uploading"
                ? "pointer-events-none opacity-60"
                : "cursor-pointer",
            )}
          >
            {state.status === "uploading" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {state.status === "uploaded" ? "Replace" : "Upload"}
          </label>

          {state.status === "failed" ? (
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => void onRetry()}
              className="h-10 rounded-2xl border-rose-200 bg-white/78 px-3.5 text-[11px] font-black uppercase tracking-[0.14em] text-rose-700 hover:bg-white"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          ) : null}

          {state.uploadedUrl ? (
            <a
              href={state.uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex h-10 items-center rounded-2xl border border-[#dbcab1] bg-white/78 px-3.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#6b5a46] transition-colors hover:bg-white",
                disabled && "pointer-events-none opacity-60",
              )}
            >
              <Eye className="mr-2 h-4 w-4" />
              View
            </a>
          ) : null}
        </div>

        <div className="mt-3 rounded-[1rem] border border-white/70 bg-white/65 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a6a32]">Status</p>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[#6b5a46]">
            {state.status === "uploaded"
              ? "File attached"
              : state.status === "uploading"
                ? "Uploading"
                : state.status === "failed"
                  ? "Upload failed"
                  : "No file yet"}
          </p>
        </div>
      </div>
    </div>
  );
}
