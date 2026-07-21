import * as React from "react";
import { Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ProductDetail } from "@/types/product";

export function ProductRatingsSummary({ productData }: { productData: ProductDetail }) {
  const ratingBreakdownRows = [5, 4, 3, 2, 1].map((stars) => ({ stars, pct: 0, count: 0 }));

  return (
    <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm md:p-8">
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
          <span className="mt-2 text-sm text-zinc-500">({productData.reviewCount} Verified Ratings)</span>
        </div>
        <div className="space-y-3">
          {productData.reviewCount > 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4 text-sm font-medium text-zinc-500">
              Detailed rating breakdown is not available yet.
            </div>
          ) : (
            ratingBreakdownRows.map((row) => (
              <div key={row.stars} className="flex items-center gap-4">
                <div className="flex w-12 shrink-0 items-center justify-end gap-1">
                  <span className="text-sm font-bold text-zinc-700">{row.stars}</span>
                  <Star className="h-3 w-3 fill-zinc-400 text-zinc-400" />
                </div>
                <Progress value={row.pct} className="h-2.5 flex-1 bg-zinc-100 [&>div]:bg-[#009E49]" />
                <span className="w-8 text-xs font-medium text-zinc-500">{row.count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
