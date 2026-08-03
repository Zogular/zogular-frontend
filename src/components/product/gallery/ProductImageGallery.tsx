"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExpandedProductGalleryDialog } from "./ExpandedProductGalleryDialog";
import { WishlistButton } from "@/components/WishlistButton";
import { ProductBadge } from "@/components/product/ProductBadge";
import { ProductImageUnavailable } from "@/components/product/ProductImageUnavailable";
import type { Product } from "@/types/product";

export function ProductImageGallery({
  images,
  title,
  badge,
  wishlistProduct,
}: {
  images: string[];
  title: string;
  badge: string | null;
  wishlistProduct: Product;
}) {
  const galleryImages = React.useMemo(
    () => (images.length > 0 ? images : ["/file.svg"]),
    [images],
  );
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    setActiveIndex(0);
  }, [galleryImages]);

  const safeIndex = Math.min(Math.max(0, activeIndex), galleryImages.length - 1);
  const activeImage = galleryImages[safeIndex] ?? "/file.svg";

  const selectRelativeImage = React.useCallback(
    (offset: number) => {
      setActiveIndex((prev) => (prev + offset + galleryImages.length) % galleryImages.length);
    },
    [galleryImages.length],
  );

  const handleShare = async () => {
    const shareData = { title, url: window.location.href };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareData.url);
      toast.success("Product link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("We couldn't share this product.");
    }
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <>
      <div className="group space-y-4 lg:sticky lg:top-28 lg:flex lg:h-[clamp(460px,52vh,520px)] lg:gap-4 lg:space-y-0">
        {/* Mobile Layout */}
        <div className="lg:hidden md:mx-auto md:max-w-[34rem]">
          <div className="space-y-3">
            <div className="relative flex h-[clamp(240px,45svh,360px)] w-full items-center justify-center overflow-hidden rounded-b-3xl bg-[#f4fbf6] [@media(max-width:359px)_and_(max-height:640px)]:h-48 md:rounded-3xl md:border md:border-zinc-200/50 md:shadow-sm">
              <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2">
                <Button onClick={handleBack} variant="ghost" size="icon" title="Go back" aria-label="Go back" className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 text-zinc-900 shadow-sm backdrop-blur-md hover:bg-white">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {badge ? (
                  <ProductBadge label={badge} className="pointer-events-auto" />
                ) : null}
              </div>
              <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col gap-2">
                <WishlistButton
                  product={wishlistProduct}
                  className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-red-500"
                  iconClassName="h-4 w-4"
                />
                <Button type="button" onClick={handleShare} size="icon" title="Share product" aria-label="Share product" className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-zinc-900">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>

              {galleryImages.length > 1 ? (
                <>
                  <div data-testid="gallery-counter" className="pointer-events-none absolute bottom-4 left-4 z-30 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-md">
                    {safeIndex + 1} / {galleryImages.length}
                  </div>
                  <Button
                    type="button"
                    onClick={() => selectRelativeImage(-1)}
                    size="icon"
                    variant="ghost"
                    title="Previous product image"
                    aria-label="Previous product image"
                    className="absolute left-3 top-1/2 z-30 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-white/85 text-zinc-700 shadow-sm backdrop-blur-md before:absolute before:-inset-1.5 hover:bg-white [@media(max-width:359px)_and_(max-height:640px)]:flex"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={() => selectRelativeImage(1)}
                    size="icon"
                    variant="ghost"
                    title="Next product image"
                    aria-label="Next product image"
                    className="absolute right-3 top-1/2 z-30 hidden h-8 w-8 -translate-y-1/2 rounded-full bg-white/85 text-zinc-700 shadow-sm backdrop-blur-md before:absolute before:-inset-1.5 hover:bg-white [@media(max-width:359px)_and_(max-height:640px)]:flex"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}

              <Button
                type="button"
                onClick={() => setExpanded(true)}
                size="icon"
                variant="ghost"
                title="Expand image preview"
                aria-label="Expand image preview"
                className="absolute bottom-4 right-4 z-30 h-8 w-8 rounded-full bg-white/85 text-zinc-700 shadow-sm backdrop-blur-md hover:bg-white"
              >
                <Maximize className="h-4 w-4" />
              </Button>
              {activeImage === "/file.svg" ? (
                <ProductImageUnavailable />
              ) : (
                <Image
                  src={activeImage}
                  alt={title}
                  fill
                  priority={safeIndex === 0}
                  sizes="100vw"
                  className="object-contain"
                />
              )}
            </div>
            <div className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 [@media(max-width:359px)_and_(max-height:640px)]:hidden md:justify-center md:px-0">
              {galleryImages.map((src, index) => (
                <button
                  key={`thumb-${src}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  title={`Preview image ${index + 1}`}
                  aria-label={`Preview image ${index + 1}`}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${safeIndex === index ? "border-[#009E49] shadow-md" : "border-zinc-200 bg-zinc-50 opacity-80"}`}
                >
                  {src === "/file.svg" ? (
                    <ProductImageUnavailable compact />
                  ) : (
                    <Image
                      src={src}
                      alt={`${title} thumbnail ${index + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Thumbnail Rail */}
        <div className="hide-scrollbar hidden lg:h-full lg:w-20 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:flex">
          {galleryImages.map((src, index) => (
            <button
              key={`desk-thumb-${src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              title={`Preview image ${index + 1}`}
              aria-label={`Preview image ${index + 1}`}
              className={`relative aspect-[3/4] shrink-0 overflow-hidden rounded-xl border-2 transition-all ${safeIndex === index ? "scale-[1.03] border-[#009E49] shadow-md" : "border-transparent bg-zinc-50 opacity-70 hover:border-zinc-300 hover:opacity-100"}`}
            >
              {src === "/file.svg" ? (
                <ProductImageUnavailable compact />
              ) : (
                <Image
                  src={src}
                  alt={`${title} thumbnail ${index + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>

        {/* Desktop Main Image */}
        <div className="relative hidden h-full w-full flex-1 overflow-hidden rounded-3xl border border-zinc-200/50 bg-[#f4fbf6] shadow-sm lg:block">
          <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2">
            {badge ? <ProductBadge label={badge} className="pointer-events-auto" /> : null}
          </div>
          <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col gap-2 opacity-90 transition-opacity group-hover:opacity-100">
            <WishlistButton
              product={wishlistProduct}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-red-500"
              iconClassName="h-4 w-4"
            />
            <Button type="button" onClick={handleShare} size="icon" title="Share product" aria-label="Share product" className="pointer-events-auto rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-zinc-900">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 z-30 opacity-90 transition-opacity group-hover:opacity-100">
            <Button type="button" onClick={() => setExpanded(true)} size="icon" variant="ghost" title="Expand image preview" aria-label="Expand image preview" className="pointer-events-auto h-10 w-10 rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-zinc-900">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>

          {galleryImages.length > 1 ? (
            <div data-testid="gallery-counter" className="pointer-events-none absolute bottom-4 left-4 z-30 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white shadow-sm backdrop-blur-md">
              {safeIndex + 1} / {galleryImages.length}
            </div>
          ) : null}

          {activeImage === "/file.svg" ? (
            <ProductImageUnavailable />
          ) : (
            <Image
              src={activeImage}
              alt={title}
              fill
              priority={safeIndex === 0}
              sizes="(min-width: 1280px) 700px, (min-width: 1024px) 52vw, 100vw"
              className="object-contain transition-transform duration-700 hover:scale-[1.03]"
            />
          )}
        </div>
      </div>

      <ExpandedProductGalleryDialog
        open={expanded}
        onOpenChange={setExpanded}
        images={galleryImages}
        title={title}
        activeIndex={safeIndex}
        setActiveIndex={setActiveIndex}
        selectRelativeImage={selectRelativeImage}
      />
    </>
  );
}
