import Link from "next/link";
import { FolderTree, Search, Tag } from "lucide-react";
import { ProductCard } from "@/components/productCard";
import { searchCatalog } from "@/services/search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.q?.trim() ?? "";
  const results = await searchCatalog(query, { productLimit: 24, categoryLimit: 24 });

  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 pt-8 md:pt-12">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-8 rounded-3xl border border-zinc-200/70 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#009E49]/10 text-[#009E49]">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
                Search
              </h1>
              <p className="mt-1 text-sm font-medium text-zinc-500">
                {query
                  ? `Showing results for "${query}".`
                  : "Search products and categories from across Zogular."}
              </p>
            </div>
          </div>
        </div>

        {!query ? (
          <div className="rounded-3xl border border-zinc-200 border-dashed bg-white px-6 py-20 text-center shadow-sm">
            <h2 className="text-xl font-black text-zinc-900">Start your search</h2>
            <p className="mt-2 text-sm font-medium text-zinc-500">
              Use the navbar search to find products and categories.
            </p>
          </div>
        ) : results.totalCount === 0 ? (
          <div className="rounded-3xl border border-zinc-200 border-dashed bg-white px-6 py-20 text-center shadow-sm">
            <h2 className="text-xl font-black text-zinc-900">No results found</h2>
            <p className="mt-2 text-sm font-medium text-zinc-500">
              We couldn&apos;t find anything matching &quot;{query}&quot;.
            </p>
            <Link href="/categories" className="mt-6 inline-flex rounded-xl bg-zinc-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800">
              Browse Categories
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {results.products.length > 0 ? (
              <section>
                <div className="mb-5 flex items-center gap-2">
                  <Search className="h-4 w-4 text-[#009E49]" />
                  <h2 className="text-xl font-black text-zinc-900">Products</h2>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4">
                  {results.products.map((product) => (
                    <ProductCard key={product.slug} product={product} />
                  ))}
                </div>
              </section>
            ) : null}

            {results.categories.length > 0 ? (
              <section>
                <div className="mb-5 flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-[#009E49]" />
                  <h2 className="text-xl font-black text-zinc-900">Categories</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {results.categories.map((category) => (
                    <Link
                      key={category.id}
                      href={category.href}
                      className="flex items-start gap-3 rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-sm transition-all hover:border-[#009E49]/30 hover:shadow-md"
                    >
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#009E49]/10 text-[#009E49]">
                        {category.type === "subcategory" ? (
                          <Tag className="h-4 w-4" />
                        ) : (
                          <FolderTree className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-zinc-900">{category.title}</h3>
                        <p className="mt-1 text-xs font-medium text-zinc-500">
                          {category.parentName ? `${category.parentName} category` : category.description}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
