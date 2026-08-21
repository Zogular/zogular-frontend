import Link from "next/link";
import {
  Gamepad2,
  Headphones,
  HeartPulse,
  House,
  Shapes,
  Shirt,
  Sparkles,
  Sun,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { DiscoverySectionHeader } from "@/features/consumer-discovery/components/DiscoverySectionHeader";
import type { HomeCategorySummary } from "@/types/category";

const categoryIcons: Readonly<Record<string, LucideIcon>> = {
  electronics: Headphones,
  fashion: Shirt,
  gaming: Gamepad2,
  "health-and-beauty": HeartPulse,
  "home-and-living": House,
  solar: Sun,
  tools: Wrench,
  beauty: Sparkles,
};

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
        {categories.map((category) => {
          const CategoryIcon = categoryIcons[category.slug] ?? Shapes;

          return <li key={category.id} className="min-w-[108px] max-w-[148px] flex-1 snap-start sm:min-w-[124px]">
            <Link
              href={`/category/${category.slug}`}
              prefetch={false}
              data-testid="home-category-link"
              className="flex min-h-[76px] h-full flex-col justify-center rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-left outline-none transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2 motion-reduce:transition-none max-[340px]:min-h-[68px] sm:min-h-[84px]"
            >
              <CategoryIcon className="mb-2 h-5 w-5 text-[#007a3d]" aria-hidden="true" />
              <span className="line-clamp-2 text-[13px] font-black leading-4 text-zinc-950">{category.name}</span>
              {category.productCount !== undefined ? (
                <span className="mt-1 text-[11px] font-semibold text-zinc-500">
                  {category.productCount.toLocaleString()} {category.productCount === 1 ? "product" : "products"}
                </span>
              ) : category.description ? (
                <span className="mt-1 line-clamp-1 text-[11px] text-zinc-500">{category.description}</span>
              ) : null}
            </Link>
          </li>;
        })}
      </ul> : (
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-600" role="status" data-testid="home-categories-empty">
          No categories are available yet.
        </div>
      )}
    </section>
  );
}
