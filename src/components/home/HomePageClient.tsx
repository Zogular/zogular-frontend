"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Autoplay from "embla-carousel-autoplay";
import Fade from "embla-carousel-fade";
import {
  Dumbbell,
  HeartPulse,
  Laptop,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Tv,
} from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlashSales } from "@/components/home/FlashSales";
import { TrendingProducts } from "@/components/home/TrendingProducts";
import { TrustBanner } from "@/components/home/TrustBanner";
import type { CategorySummary } from "@/types/category";
import type { Product } from "@/types/product";
import type { HeroBanner } from "@/services/categories";
import type { EmblaCarouselType } from "embla-carousel";

const CATEGORY_ICONS = {
  smartphone: Smartphone,
  laptop: Laptop,
  shirt: Shirt,
  "shopping-basket": ShoppingBasket,
  tv: Tv,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  sofa: Sofa,
} as const;

type HomePageClientProps = {
  categories: CategorySummary[];
  heroBanners: HeroBanner[];
  flashSaleProducts: Product[];
  trendingProducts: Product[];
};

export function HomePageClient({
  categories,
  heroBanners,
  flashSaleProducts,
  trendingProducts,
}: HomePageClientProps) {
  const pathname = usePathname();
  const [carouselApi, setCarouselApi] = React.useState<EmblaCarouselType | null>(null);
  const autoplayPlugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true }),
  );

  React.useEffect(() => {
    if (!carouselApi || pathname !== "/") return;

    carouselApi.reInit();
    autoplayPlugin.current.reset();
    autoplayPlugin.current.play();
  }, [carouselApi, pathname, heroBanners.length]);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      autoplayPlugin.current.reset();
      autoplayPlugin.current.play();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return (
    <main className="min-h-screen bg-[#f4fbf6]">
      <section className="container mx-auto max-w-7xl px-4 pt-4 md:px-6 md:pt-6">
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Carousel
              setApi={setCarouselApi}
              options={{ loop: true }}
              plugins={[autoplayPlugin.current, Fade()]}
              className="w-full overflow-hidden rounded-2xl border border-zinc-200/50 shadow-lg md:rounded-3xl"
            >
              <CarouselContent>
                {heroBanners.map((banner) => (
                  <CarouselItem key={banner.id}>
                    <div className="relative flex aspect-video w-full items-center md:aspect-21/9">
                      <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url('${banner.image}')` }}
                      />
                      <div className={`absolute inset-0 bg-linear-to-r ${banner.overlayClass}`} />

                      <div className="absolute left-3 top-2 z-20 md:left-8 md:top-6">
                        <Badge className="border-white/20 bg-white/20 px-3 py-1 font-bold tracking-wide text-white shadow-sm backdrop-blur-md">
                          {banner.badge}
                        </Badge>
                      </div>

                      <div className="relative z-10 mt-6 max-w-xl space-y-2 px-6 md:mt-0 md:space-y-4 md:px-12">
                        <h2 className="text-3xl font-black leading-tight tracking-tighter text-white drop-shadow-md md:text-5xl">
                          {banner.title}
                        </h2>
                        <p className="max-w-md text-sm font-medium text-white/90 drop-shadow-sm md:text-lg">
                          {banner.subtitle}
                        </p>
                        <div className="pt-2">
                          <Link href={banner.ctaHref}>
                            <Button className="h-12 rounded-xl bg-white px-8 font-bold text-zinc-900 shadow-[0_10px_25px_rgba(0,0,0,0.15)] transition-transform hover:scale-[1.02] hover:bg-zinc-100">
                              {banner.ctaLabel}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              <CarouselPrevious className="left-4 hidden border-white/40 bg-white/20 text-white backdrop-blur-md hover:bg-white/40 md:flex" />
              <CarouselNext className="right-4 hidden border-white/40 bg-white/20 text-white backdrop-blur-md hover:bg-white/40 md:flex" />
            </Carousel>
          </div>

          <div className="hidden h-full flex-col gap-6 lg:flex">
            <Link
              href="/deals"
              className="group relative flex-1 cursor-pointer overflow-hidden rounded-3xl border border-zinc-200/50 shadow-lg"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-linear-to-t from-[#FF6B00]/95 via-[#FF6B00]/40 to-transparent" />
              <div className="absolute left-4 top-4 z-20">
                <Badge className="border-white/20 bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                  Delivery
                </Badge>
              </div>
              <div className="absolute bottom-0 left-0 z-10 p-6">
                <h3 className="text-xl font-black leading-tight text-white">Lusaka Pilot Delivery</h3>
                <p className="mt-1 text-xs font-medium text-white/90">
                  Fees and timing are confirmed at checkout.
                </p>
              </div>
            </Link>

            <Link
              href="/category/electronics"
              className="group relative flex-1 cursor-pointer overflow-hidden rounded-3xl border border-zinc-200/50 shadow-lg"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-linear-to-t from-[#009E49]/95 via-[#009E49]/40 to-transparent" />
              <div className="absolute left-4 top-4 z-20">
                <Badge className="border-white/20 bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
                  Catalog
                </Badge>
              </div>
              <div className="absolute bottom-0 left-0 z-10 p-6">
                <h3 className="text-xl font-black leading-tight text-white">Shop Electronics</h3>
                <p className="mt-1 text-xs font-medium text-white/90">
                  Browse current buyer-visible listings.
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto max-w-7xl px-4 pt-8 md:px-6">
        <div className="mb-4 flex items-center justify-between md:mb-5">
          <h3 className="text-lg font-bold tracking-tight text-zinc-900 md:text-xl">
            Shop by Category
          </h3>
          <Link href="/categories" className="text-sm font-bold text-[#FF6B00] hover:underline">
            View All
          </Link>
        </div>

        <div className="hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0 md:gap-6">
          {categories.map((category) => {
            const Icon = CATEGORY_ICONS[category.iconKey];

            return (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="group flex min-w-20 snap-start flex-col items-center gap-3 md:min-w-24"
              >
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200/50 shadow-sm transition-transform duration-300 group-hover:scale-[1.03] group-hover:shadow-md md:h-20 md:w-20 ${category.colorClass}`}
                >
                  <Icon className="h-7 w-7 md:h-8 md:w-8" />
                </div>
                <span className="text-center text-xs font-semibold text-zinc-700 transition-colors group-hover:text-[#009E49] md:text-sm">
                  {category.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <FlashSales products={flashSaleProducts} />
      <TrendingProducts products={trendingProducts} />
      <TrustBanner />
    </main>
  );
}
