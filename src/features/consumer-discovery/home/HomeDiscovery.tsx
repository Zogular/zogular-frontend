import { DiscoverySectionHeader } from "@/features/consumer-discovery/components/DiscoverySectionHeader";
import { ProductGrid } from "@/features/consumer-discovery/components/ProductGrid";
import { EditorialDiscoveryIntro } from "@/features/consumer-discovery/home/EditorialDiscoveryIntro";
import { HomeCategoryRail } from "@/features/consumer-discovery/home/HomeCategoryRail";
import { HomeProductSection } from "@/features/consumer-discovery/home/HomeProductSection";
import type { HomeDiscoveryData } from "@/features/consumer-discovery/home/home-discovery-data";

export function HomeDiscovery({ categories, newArrivals, mostViewed, exploreMore }: HomeDiscoveryData) {
  const hasProducts = newArrivals.length > 0 || mostViewed.length > 0 || exploreMore.length > 0;

  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-24 md:pb-12" data-testid="home-discovery">
      <div className="mx-auto max-w-[1176px] space-y-3 px-4 pt-2 max-[340px]:space-y-2 sm:space-y-6 sm:pt-4 md:space-y-8 md:px-6 md:pt-6">
        <EditorialDiscoveryIntro hasProducts={hasProducts} />
        <HomeCategoryRail categories={categories} />
        <HomeProductSection title="New Arrivals" products={newArrivals} href="/new-arrivals" />
        <HomeProductSection title="Most Viewed" products={mostViewed} />
        {exploreMore.length > 0 ? <section aria-label="Explore More" data-testid="home-explore-more">
          <DiscoverySectionHeader title="Explore More" className="mb-3" />
          <ProductGrid products={exploreMore} label="Explore More products" />
        </section> : null}
      </div>
    </main>
  );
}
