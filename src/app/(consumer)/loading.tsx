import { DiscoveryProductSkeleton } from "@/features/consumer-discovery/components/DiscoveryProductSkeleton";

function SectionHeadingSkeleton({ width }: { width: string }) {
  return <div className={`mb-3 h-6 animate-pulse rounded bg-zinc-200 ${width}`} aria-hidden="true" />;
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-12" aria-label="Loading marketplace" role="status">
      <div className="mx-auto max-w-[1176px] space-y-6 px-4 pt-2 sm:pt-4 md:space-y-8 md:px-6 md:pt-6">
        <div className="h-[200px] animate-pulse rounded-[20px] bg-emerald-950/15 max-[340px]:h-[180px] sm:h-[232px] sm:rounded-[24px] md:h-[272px] lg:h-[296px]" data-testid="home-intro-skeleton" />
        <section aria-label="Loading categories">
          <SectionHeadingSkeleton width="w-40" />
          <div className="flex gap-2.5 overflow-hidden">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="h-[76px] min-w-[108px] animate-pulse rounded-2xl bg-white max-[340px]:h-[68px] sm:h-[84px] sm:min-w-[124px]" />
            ))}
          </div>
        </section>
        <section aria-label="Loading New Arrivals">
          <SectionHeadingSkeleton width="w-32" />
          <DiscoveryProductSkeleton layout="rail" count={5} label="Loading New Arrivals" />
        </section>
        <section aria-label="Loading Explore More">
          <SectionHeadingSkeleton width="w-28" />
          <DiscoveryProductSkeleton layout="grid" count={10} label="Loading Explore More" />
        </section>
      </div>
      <span className="sr-only">Loading marketplace products and categories</span>
    </main>
  );
}
