"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductImageUnavailable } from "@/components/product/ProductImageUnavailable";

interface ExpandedProductGalleryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  title: string;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  selectRelativeImage: (offset: number) => void;
}

export function ExpandedProductGalleryDialog({
  open,
  onOpenChange,
  images,
  title,
  activeIndex,
  setActiveIndex,
  selectRelativeImage,
}: ExpandedProductGalleryDialogProps) {
  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, images.length - 1));
  const activeImage = images[safeIndex] ?? "/file.svg";

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") selectRelativeImage(-1);
      if (event.key === "ArrowRight") selectRelativeImage(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectRelativeImage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="h-[min(92dvh,900px)] max-w-[min(94vw,1100px)] gap-3 overflow-hidden bg-zinc-950 p-3 text-white ring-white/15 sm:max-w-[min(94vw,1100px)]"
      >
        <DialogTitle className="sr-only">{title} image preview</DialogTitle>
        <DialogDescription className="sr-only">
          Browse all available product images. Image {safeIndex + 1} of {images.length}.
        </DialogDescription>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-zinc-900">
          <div data-testid="expanded-gallery-counter" className="pointer-events-none absolute left-3 top-3 z-30 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
            {safeIndex + 1} / {images.length}
          </div>

          {activeImage === "/file.svg" ? (
            <ProductImageUnavailable />
          ) : (
            <Image
              src={activeImage}
              alt={`${title} expanded image ${safeIndex + 1}`}
              fill
              sizes="94vw"
              className="object-contain"
            />
          )}

          {images.length > 1 ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => selectRelativeImage(-1)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/75"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => selectRelativeImage(1)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/75"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          ) : null}
        </div>

        <div className="hide-scrollbar flex shrink-0 justify-center gap-2 overflow-x-auto">
          {images.map((src, index) => (
            <button
              key={`expanded-${src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-zinc-900 ${
                safeIndex === index ? "border-emerald-400" : "border-transparent opacity-65"
              }`}
            >
              {src === "/file.svg" ? (
                <ProductImageUnavailable compact />
              ) : (
                <Image src={src} alt="" fill sizes="56px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
