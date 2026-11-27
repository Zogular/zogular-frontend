import Link from "next/link";
import { PackageOpen, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductPagination } from "@/components/product/ProductPagination";
import { ProductGrid } from "@/features/consumer-discovery/components/ProductGrid";
import { parseDiscoveryQuery } from "@/features/consumer-discovery/lib/discovery-query";
import { PUBLIC_STORE_MAX_PAGE, type PublicStorePage } from "@/services/public-store";

export function PublicStoreListing({ basePath, page, data }: {
  basePath: string;
  page: number;
  data?: PublicStorePage;
}) {
  return (
    <main className="min-h-[65svh] bg-[#f4fbf6] pb-20 pt-6 md:pt-9">
      <div className="container mx-auto max-w-[1280px] px-4 md:px-6">
        <nav aria-label="Breadcrumb" className="mb-3 text-sm font-medium text-zinc-600">
          <Link href="/products" className="inline-flex min-h-11 items-center hover:text-[#007d3a]">
            Browse products
          </Link>
        </nav>
        {!data ? (
          <div role="alert" className="border-y border-zinc-200 py-8">
            <h1 className="text-2xl font-bold text-zinc-950">Store products could not load</h1>
            <p className="mt-2 text-sm text-zinc-600">Try again in a moment.</p>
            <form className="mt-4" action={basePath} method="get">
              {page > 1 && <input type="hidden" name="page" value={page} />}
              <Button type="submit" variant="outline" className="min-h-11">
                <RotateCw aria-hidden="true" /> Try again
              </Button>
            </form>
          </div>
        ) : (
          <>
            <header className="border-b border-zinc-200 pb-4">
              <h1 className="break-words text-3xl font-black text-zinc-950 md:text-4xl">{data.store.name}</h1>
            </header>
            <section aria-labelledby="store-products" className="pt-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id="store-products" className="text-lg font-bold text-zinc-950">Products</h2>
                <p className="text-sm font-medium text-zinc-600">
                  {data.pagination.total.toLocaleString("en-ZM")} {data.pagination.total === 1 ? "product" : "products"}
                </p>
              </div>
              {data.pagination.total === 0 ? (
                <div className="flex items-start gap-3 border-y border-zinc-200 py-6">
                  <PackageOpen className="mt-0.5 size-5 shrink-0 text-[#007d3a]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-zinc-900">No products available yet</p>
                    <p className="mt-1 text-sm text-zinc-600">Check back later or browse other products.</p>
                  </div>
                </div>
              ) : (
                <>
                  <ProductGrid products={data.products} label="Store products" />
                  {data.pagination.pages > 1 && (
                    <ProductPagination
                      basePath={basePath}
                      page={page}
                      totalPages={Math.min(data.pagination.pages, PUBLIC_STORE_MAX_PAGE)}
                      total={data.pagination.total}
                      startItem={(page - 1) * data.pagination.limit + 1}
                      endItem={(page - 1) * data.pagination.limit + data.products.length}
                      query={parseDiscoveryQuery({})}
                    />
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
