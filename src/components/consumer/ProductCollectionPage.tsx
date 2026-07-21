import { ProductCard } from "@/components/productCard";
import type { Product } from "@/types/product";

type ProductCollectionPageProps = {
  title: string;
  description: string;
  products: Product[];
  emptyTitle: string;
  emptyDescription: string;
};

export function ProductCollectionPage({
  title,
  description,
  products,
  emptyTitle,
  emptyDescription,
}: ProductCollectionPageProps) {
  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8 md:pt-12">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-8 rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium text-zinc-500 md:text-base">{description}</p>
        </div>

        {products.length ? (
          <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-zinc-200 border-dashed bg-white px-6 py-20 text-center shadow-sm">
            <h2 className="text-xl font-black text-zinc-900">{emptyTitle}</h2>
            <p className="mt-2 text-sm font-medium text-zinc-500">{emptyDescription}</p>
          </div>
        )}
      </div>
    </main>
  );
}
