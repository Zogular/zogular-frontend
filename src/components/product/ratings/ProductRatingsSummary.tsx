import * as React from "react";
import { Star } from "lucide-react";
import type { ProductDetail } from "@/types/product";

export function ProductRatingsSummary({ productData }: { productData: ProductDetail }) {
  const hasValidRating = Number.isInteger(productData.reviewCount)
    && productData.reviewCount > 0
    && Number.isFinite(productData.rating)
    && productData.rating > 0
    && productData.rating <= 5;

  if (!hasValidRating) {
    return (
      <section
        id="product-reviews"
        className="scroll-mt-28 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm md:p-6 lg:border-zinc-200 lg:p-4 lg:shadow-none"
      >
        <h2 className="text-lg font-bold text-zinc-900">Ratings &amp; Reviews</h2>
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-5 py-6 text-center lg:px-4 lg:py-5">
          <p className="text-base font-semibold text-zinc-900">No verified reviews yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Be the first verified buyer to review this product.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="product-reviews" className="scroll-mt-28 rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm md:p-8 lg:rounded-2xl lg:border-zinc-200 lg:p-5 lg:shadow-none">
      <h2 className="mb-6 text-xl font-bold text-zinc-900">Ratings & Reviews</h2>
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_2fr]">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-extrabold tracking-tighter text-zinc-900 md:text-7xl">{productData.rating}</span>
            <span className="text-2xl font-medium text-zinc-400">/ 5</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${star <= Math.round(productData.rating) ? "fill-[#FF6B00] text-[#FF6B00]" : "fill-zinc-100 text-zinc-300"}`}
              />
            ))}
          </div>
          <span className="mt-2 text-sm text-zinc-500">{productData.reviewCount} customer reviews</span>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4 text-sm font-medium text-zinc-500">
            Detailed rating breakdown is not available yet.
          </div>
        </div>
      </div>
    </section>
  );
}
