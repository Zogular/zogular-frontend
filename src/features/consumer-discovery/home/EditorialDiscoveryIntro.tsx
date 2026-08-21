import Link from "next/link";
import { getImageProps } from "next/image";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

type EditorialDiscoveryIntroProps = {
  hasProducts: boolean;
};

type EditorialAction = {
  href: string;
  label: string;
  icon?: typeof Search;
};

const mobileImage = getImageProps({
  src: "/images/discovery/home-editorial-mobile.webp",
  alt: "",
  width: 960,
  height: 640,
  sizes: "100vw",
  quality: 80,
  loading: "eager",
  fetchPriority: "high",
});

const desktopImage = getImageProps({
  src: "/images/discovery/home-editorial-desktop.webp",
  alt: "",
  width: 1536,
  height: 512,
  sizes: "(max-width: 1176px) calc(100vw - 48px), 1176px",
  quality: 80,
  loading: "eager",
  fetchPriority: "high",
});

export function EditorialDiscoveryIntro({ hasProducts }: EditorialDiscoveryIntroProps) {
  const heading = hasProducts ? "Find what you need." : "Explore Zogular.";
  const description = hasProducts
    ? "Shop everyday products in Zambia."
    : "No products are available yet.";
  const actions: EditorialAction[] = hasProducts
    ? [{ href: "/products", label: "Shop now" }]
    : [
        { href: "/products", label: "Browse products" },
        { href: "/search", label: "Search", icon: Search },
      ];

  return (
    <section
      data-testid="home-editorial-intro"
      className="relative isolate h-[200px] overflow-hidden rounded-[20px] bg-[#102018] text-white max-[340px]:h-[180px] sm:h-[232px] sm:rounded-[24px] md:h-[272px] lg:h-[296px]"
    >
      <picture className="absolute inset-0 block">
        <source
          media="(min-width: 768px)"
          srcSet={desktopImage.props.srcSet}
          sizes={desktopImage.props.sizes}
        />
        <img
          {...mobileImage.props}
          alt=""
          className="h-full w-full object-cover"
          data-testid="home-editorial-image"
        />
      </picture>
      <div className="absolute inset-0 bg-linear-to-r from-[#06150d]/90 via-[#06150d]/50 to-transparent" />
      <div className={cn("relative flex h-full max-w-[640px] flex-col justify-center px-5 py-4 sm:px-8 md:w-[48%] md:px-10 lg:px-14", hasProducts ? "w-[62%] sm:w-[56%]" : "w-full sm:w-[68%]")}>
        <h1 className="max-w-[9ch] text-[28px] font-black leading-[0.98] tracking-tight sm:text-[34px] md:text-[42px] lg:text-[48px]">
          {heading}
        </h1>
        <p className="mt-2 max-w-[28ch] text-[13px] font-medium leading-5 text-white/95 sm:text-[15px] md:mt-3 md:text-base md:leading-6">
          {description}
        </p>
        <div className="mt-3 flex flex-nowrap gap-2 md:mt-5">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                prefetch={false}
                className={cn(
                  "relative inline-flex min-h-11 w-fit shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 text-sm font-black outline-none before:absolute before:inset-x-0 before:inset-y-[3px] before:rounded-xl before:transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-[#102018] motion-reduce:duration-0 motion-reduce:transition-none motion-reduce:before:duration-0 motion-reduce:before:transition-none sm:px-4",
                  index === 0
                    ? "text-zinc-950 before:bg-[#ff9d00] hover:before:bg-[#ffad29]"
                    : "text-white before:border before:border-white/65 before:bg-white/10 hover:before:bg-white/20",
                )}
              >
                {Icon ? <Icon className="relative z-10 h-4 w-4" aria-hidden="true" /> : null}
                <span className="relative z-10">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
