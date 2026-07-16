"use client";

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { ProductCard } from "@/components/productCard";
import type { Product } from "@/types/product";

export function FlashSales({ products }: { products: Product[] }) {
  return (
    <section className="container mx-auto max-w-7xl px-4 pt-6 md:px-6">
      <div className="mb-3 flex flex-col justify-between gap-4 md:mb-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <h3 className="flex items-center gap-2 text-xl font-black tracking-tight text-zinc-900 md:text-2xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF6B00] text-sm text-white md:h-8 md:w-8 md:text-base">
              <Zap className="h-4 w-4 fill-current md:h-5 md:w-5" />
            </span>
            Current Deals
          </h3>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-500">
            {products.length} discounted listings
          </span>

          <Link
            href="/flash-sales"
            className="group flex items-center text-sm font-bold text-[#009E49] hover:underline"
          >
            See all deals
            <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-6 md:mx-0 md:px-0 md:gap-4">
        {products.map((product) => (
          <div key={product.id} className="min-w-40 snap-start md:min-w-50">
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </section>
  );
}
