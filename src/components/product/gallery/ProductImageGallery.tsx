"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Share2 } from "lucide-react";
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
    <div className="space-y-4 md:sticky md:top-25 group">
      <div className="md:hidden">
        <div className="space-y-3">
          <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-zinc-50">
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

      <div className="hidden md:block relative aspect-[3/4] max-h-[800px] w-full overflow-hidden rounded-3xl border border-zinc-200/50 bg-zinc-50 shadow-sm">
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
        {activeImage === "/file.svg" ? <ProductImageUnavailable /> : <Image
          src={activeImage}
          alt={title}
          fill
          sizes="(min-width: 768px) 700px, 100vw"
          unoptimized
          className="object-contain transition-transform duration-700 hover:scale-[1.03]"
        />}
      </div>

      <div className="hidden grid-cols-4 gap-4 md:grid">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setActiveImage(src)}
            title={`Preview image ${index + 1}`}
            aria-label={`Preview image ${index + 1}`}
            className={`aspect-square overflow-hidden rounded-xl border-2 transition-all ${activeImage === src ? "scale-[1.03] border-[#009E49] shadow-md" : "border-transparent bg-zinc-50 opacity-70 hover:border-zinc-300 hover:opacity-100"}`}
          >
            {src === "/file.svg" ? <ProductImageUnavailable compact /> : <Image
              src={src}
              alt={`${title} thumbnail ${index + 1}`}
              width={160}
              height={160}
              unoptimized
              className="h-full w-full object-contain"
            />}
          </button>
        ))}
      </div>
    </div>
  );
}
