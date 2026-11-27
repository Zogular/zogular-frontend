import * as React from "react";
import Link from "next/link";
import { ProductCard } from "@/components/productCard";
import type { RelatedProductsResult } from "@/services/products";

export function RelatedSection({
  title,
  href,
  linkLabel,
  result,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  result: RelatedProductsResult;
}) {
  if (result.status === "unavailable") {
    return (
      <section>
        <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
        <p className="mt-2 text-sm text-zinc-700">We couldn&apos;t load related products.</p>
        <Link href="/products" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800 underline">
          Browse all products
        </Link>
      </section>
    );
  }
  const { products } = result;
  if (products.length === 0) return null;

  return (
    <section>
      <div className="mb-6 flex items-center justify-between lg:mb-4">
        <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
        {href && linkLabel ? (
          <Link href={href} className="text-sm font-bold text-[#009E49] hover:underline">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
