"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Share2, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WishlistButton } from "@/components/WishlistButton";
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
  const [activeImage, setActiveImage] = React.useState(images[0]);
  const router = useRouter();

  React.useEffect(() => {
    setActiveImage(images[0]);
  }, [images]);

  return (
    <div className="space-y-4 md:space-y-0 md:flex md:gap-4 md:h-[520px] md:sticky md:top-25 group">
      {/* Mobile Layout */}
      <div className="md:hidden">
        <div className="space-y-3">
          <div className="relative flex h-[380px] w-full items-center justify-center overflow-hidden bg-[#f4fbf6] rounded-b-3xl">
            <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2">
              <Button onClick={() => router.back()} variant="ghost" size="icon" title="Go back" aria-label="Go back" className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 text-zinc-900 shadow-sm backdrop-blur-md hover:bg-white">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {badge ? (
                <Badge className="pointer-events-auto border-none bg-[#FF6B00] px-3 py-1 text-[10px] uppercase tracking-widest shadow-md">
                  {badge}
                </Badge>
              ) : null}
            </div>
            <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col gap-2">
              <WishlistButton
                product={wishlistProduct}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-red-500"
                iconClassName="h-4 w-4"
              />
              <Button size="icon" title="Share product" aria-label="Share product" className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-zinc-900">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
            {activeImage === "/file.svg" ? <ProductImageUnavailable /> : <Image
              src={activeImage}
              alt={title}
              fill
              sizes="100vw"
              unoptimized
              className="object-contain"
            />}
          </div>
          <div className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => setActiveImage(src)}
                title={`Preview image ${index + 1}`}
                aria-label={`Preview image ${index + 1}`}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${activeImage === src ? "border-[#009E49] shadow-md" : "border-zinc-200 bg-zinc-50 opacity-80"}`}
              >
                {src === "/file.svg" ? <ProductImageUnavailable compact /> : <Image
                  src={src}
                  alt={`${title} thumbnail ${index + 1}`}
                  fill
                  sizes="64px"
                  unoptimized
                  className="object-cover"
                />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Thumbnail Rail */}
      <div className="hidden md:flex md:flex-col md:gap-3 md:w-20 md:overflow-y-auto hide-scrollbar">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setActiveImage(src)}
            title={`Preview image ${index + 1}`}
            aria-label={`Preview image ${index + 1}`}
            className={`relative aspect-square shrink-0 overflow-hidden rounded-xl border-2 transition-all ${activeImage === src ? "scale-[1.03] border-[#009E49] shadow-md" : "border-transparent bg-zinc-50 opacity-70 hover:border-zinc-300 hover:opacity-100"}`}
          >
            {src === "/file.svg" ? <ProductImageUnavailable compact /> : <Image
              src={src}
              alt={`${title} thumbnail ${index + 1}`}
              fill
              sizes="80px"
              unoptimized
              className="object-cover"
            />}
          </button>
        ))}
      </div>

      {/* Desktop Main Image */}
      <div className="hidden md:block relative flex-1 h-full w-full overflow-hidden rounded-3xl border border-zinc-200/50 bg-[#f4fbf6] shadow-sm">
        <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2">
          {badge ? (
            <Badge className="pointer-events-auto border-none bg-[#FF6B00] px-3 py-1 text-[10px] uppercase tracking-widest shadow-md">
              {badge}
            </Badge>
          ) : null}
        </div>
        <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <WishlistButton
            product={wishlistProduct}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-red-500"
            iconClassName="h-4 w-4"
          />
          <Button size="icon" title="Share product" aria-label="Share product" className="pointer-events-auto rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-zinc-900">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="pointer-events-none absolute bottom-4 right-4 z-30 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="icon" variant="ghost" title="Expand image" aria-label="Expand image" className="pointer-events-auto h-10 w-10 rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-zinc-900">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
        {activeImage === "/file.svg" ? <ProductImageUnavailable /> : <Image
          src={activeImage}
          alt={title}
          fill
          sizes="(min-width: 768px) 700px, 100vw"
          unoptimized
          className="object-contain transition-transform duration-700 hover:scale-[1.03]"
        />}
      </div>
    </div>
  );
}
