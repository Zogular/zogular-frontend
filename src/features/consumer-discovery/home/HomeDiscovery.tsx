import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { DiscoverySectionHeader } from "@/features/consumer-discovery/components/DiscoverySectionHeader";
import { ProductGrid } from "@/features/consumer-discovery/components/ProductGrid";
import { EditorialDiscoveryIntro } from "@/features/consumer-discovery/home/EditorialDiscoveryIntro";
import { HomeCategoryRail } from "@/features/consumer-discovery/home/HomeCategoryRail";
import { HomeProductSection } from "@/features/consumer-discovery/home/HomeProductSection";
import type { HomeDiscoveryData } from "@/features/consumer-discovery/home/home-discovery-data";

export function HomeDiscovery({ categories, newArrivals, mostViewed, exploreMore }: HomeDiscoveryData) {
  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-12" data-testid="home-discovery">
      <div className="mx-auto max-w-[1176px] space-y-1 px-4 pt-2 min-[341px]:space-y-3 sm:space-y-7 sm:pt-4 md:space-y-9 md:px-6 md:pt-6">
        <EditorialDiscoveryIntro />
        <HomeCategoryRail categories={categories} />
        <HomeProductSection title="New Arrivals" products={newArrivals} href="/new-arrivals" />
        <HomeProductSection title="Most Viewed" products={mostViewed} />
        <section aria-label="Explore More" data-testid="home-explore-more">
          <DiscoverySectionHeader title="Explore More" className="mb-3" />
          {exploreMore.length > 0 ? (
            <ProductGrid products={exploreMore} label="Explore More products" />
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-8 text-center" role="status" data-testid="home-explore-empty">
              <PackageSearch className="h-6 w-6 text-zinc-500" aria-hidden="true" />
              <p className="mt-3 font-black text-zinc-950">No products are available yet</p>
              <p className="mt-1 text-sm text-zinc-600">The public catalog currently has no buyer-visible products.</p>
              <Link href="/categories" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-4 text-sm font-bold text-zinc-800 outline-none hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-[#009E49]">
                Browse categories
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
