import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

export function EditorialDiscoveryIntro() {
  return (
    <section
      data-testid="home-editorial-intro"
      className="rounded-[20px] border border-emerald-900/10 bg-[#073f2a] px-4 py-4 text-white shadow-[0_18px_50px_rgba(7,63,42,0.14)] sm:rounded-[24px] sm:px-7 sm:py-6 md:py-8 lg:px-10"
    >
      <div className="max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200 max-[340px]:sr-only">Zogular marketplace</p>
        <h1 className="mt-1.5 text-xl font-black leading-tight tracking-tight sm:mt-2 sm:text-3xl lg:text-4xl">
          Find current buyer-visible products.
        </h1>
        <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-emerald-50/85 sm:mt-2 sm:text-base sm:leading-6">
          Browse categories and open listings for current product details.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-5">
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-[#073f2a] outline-none transition-colors hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#073f2a]"
          >
            Browse products
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href="/search"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 text-sm font-bold text-white outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#073f2a]"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </Link>
        </div>
      </div>
    </section>
  );
}
