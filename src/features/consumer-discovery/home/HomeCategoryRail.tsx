import Link from "next/link";
import { DiscoverySectionHeader } from "@/features/consumer-discovery/components/DiscoverySectionHeader";
import type { HomeCategorySummary } from "@/types/category";

export function HomeCategoryRail({ categories }: { categories: readonly HomeCategorySummary[] }) {
  return (
    <section aria-label="Shop by Category" data-testid="home-categories">
      <DiscoverySectionHeader
        title="Shop by Category"
        action={{ href: "/categories", label: "View all" }}
        className="mb-1.5 sm:mb-3"
      />
      {categories.length > 0 ? <ul
        aria-label="Product categories"
        className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:pb-2 [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((category) => (
          <li key={category.id} className="min-w-[132px] max-w-[180px] flex-1 snap-start">
            <Link
              href={`/category/${category.slug}`}
              data-testid="home-category-link"
              className="flex min-h-14 h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-left outline-none transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 min-[341px]:min-h-16 min-[341px]:py-2.5 sm:min-h-[76px] sm:py-3"
            >
              <span className="line-clamp-2 text-sm font-black leading-5 text-zinc-950">{category.name}</span>
              {category.productCount !== undefined ? (
                <span className="mt-2 text-xs font-semibold text-zinc-500">
                  {category.productCount.toLocaleString()} {category.productCount === 1 ? "product" : "products"}
                </span>
              ) : category.description ? (
                <span className="mt-2 line-clamp-1 text-xs text-zinc-500">{category.description}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul> : (
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-600" role="status" data-testid="home-categories-empty">
          No public categories are available yet.
        </div>
      )}
    </section>
  );
}
