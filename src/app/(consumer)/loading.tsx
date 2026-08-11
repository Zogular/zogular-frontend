import { DiscoveryProductSkeleton } from "@/features/consumer-discovery/components/DiscoveryProductSkeleton";

function SectionHeadingSkeleton({ width }: { width: string }) {
  return <div className={`mb-3 h-6 animate-pulse rounded bg-zinc-200 ${width}`} aria-hidden="true" />;
}

export default function Loading() {
  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-12" aria-label="Loading marketplace" role="status">
      <div className="mx-auto max-w-[1176px] space-y-7 px-4 pt-4 md:space-y-9 md:px-6 md:pt-6">
        <div className="h-[238px] animate-pulse rounded-[24px] bg-emerald-950/15 sm:h-[230px] md:h-[252px]" data-testid="home-intro-skeleton" />
        <section aria-label="Loading categories">
          <SectionHeadingSkeleton width="w-40" />
          <div className="flex gap-2.5 overflow-hidden">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="h-[76px] min-w-[132px] animate-pulse rounded-2xl bg-white" />
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
