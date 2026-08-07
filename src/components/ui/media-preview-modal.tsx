"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, FileText, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url?: string | null;
  title?: string;
  fileKind?: "image" | "pdf" | "auto";
}

function checkIsPdf(url?: string | null, fileKind?: string): boolean {
  if (fileKind === "pdf") return true;
  if (fileKind === "image") return false;
  if (!url) return false;
  const cleanUrl = url.split("?")[0].toLowerCase();
  return cleanUrl.endsWith(".pdf");
}

export function MediaPreviewModal({
  isOpen,
  onClose,
  url,
  title = "File Preview",
  fileKind = "auto",
}: MediaPreviewModalProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const isPdf = checkIsPdf(url, fileKind);

  if (!url) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  const handleClose = () => {
    setZoomLevel(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent showCloseButton={false} className="max-w-4xl border-none bg-zinc-950/95 p-0 text-white shadow-2xl backdrop-blur-xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-2.5 sm:flex-nowrap sm:px-5 sm:py-3.5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800/90 text-zinc-300">
              <FileText className="h-4 w-4" />
            </div>
            <DialogTitle className="text-sm font-bold text-zinc-100 truncate">
              {title}
            </DialogTitle>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {!isPdf ? (
              <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 sm:mr-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  aria-label="Zoom out"
                  className="h-11 w-11 text-zinc-300 hover:bg-zinc-800 hover:text-white sm:h-9 sm:w-9"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-bold text-zinc-400 w-10 text-center select-none">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleZoomIn}
                  title="Zoom In"
                  aria-label="Zoom in"
                  className="h-11 w-11 text-zinc-300 hover:bg-zinc-800 hover:text-white sm:h-9 sm:w-9"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}

            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title="Open external link"
              aria-label="Open file in a new tab"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white sm:h-9 sm:w-9"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <a
              href={url}
              download
              title="Download file"
              aria-label="Download file"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white sm:h-9 sm:w-9"
            >
              <Download className="h-3.5 w-3.5" />
            </a>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Close preview"
              className="h-11 w-11 rounded-xl bg-zinc-800/80 text-zinc-300 hover:bg-rose-500/20 hover:text-rose-400 sm:h-9 sm:w-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-[240px] flex-1 select-none items-center justify-center overflow-auto bg-zinc-950/50 p-2 sm:min-h-[350px] sm:p-4 max-h-[calc(92vh-60px)]">
          {isPdf ? (
            <iframe
              src={url}
              className="h-full min-h-[360px] w-full rounded-2xl border border-zinc-800 sm:min-h-[500px]"
              title={title}
            />
          ) : (
            <div className="flex items-center justify-center min-h-full w-full overflow-auto">
              {/* Remote signed document URLs are not compatible with Next Image allowlists. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={title}
                style={{ transform: `scale(${zoomLevel})` }}
                className={cn(
                  "max-h-[75vh] max-w-full object-contain rounded-xl transition-transform duration-200 ease-out shadow-2xl",
                )}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
