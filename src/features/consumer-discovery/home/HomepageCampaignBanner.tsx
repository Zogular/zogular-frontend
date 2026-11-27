"use client";

import { useCallback, useState, type ReactNode } from "react";
import { getImageProps } from "next/image";
import Link from "next/link";
import type { PublicHomepageBanner } from "@/services/homepage-banners";

export function HomepageCampaignBanner({ banner, fallback }: {
  banner: PublicHomepageBanner;
  fallback: ReactNode;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const checkImage = useCallback((node: HTMLImageElement | null) => {
    // The initial image request can fail before this component hydrates.
    if (node?.complete && node.naturalWidth === 0) setImageFailed(true);
  }, []);
  if (imageFailed) return fallback;

  const mobile = getImageProps({ src: banner.mobileSrc, fill: true, alt: "", sizes: "100vw" }).props;
  const desktop = getImageProps({
    src: banner.desktopSrc,
    fill: true,
    alt: "",
    sizes: "(max-width: 1176px) calc(100vw - 48px), 1176px",
  }).props;

  return (
    <section
      data-testid="home-campaign-banner"
      className="relative isolate flex min-h-[200px] overflow-hidden rounded-[20px] bg-[#102018] text-white max-[340px]:min-h-[180px] sm:min-h-[232px] sm:rounded-[24px] md:min-h-[272px] lg:min-h-[296px]"
    >
      <picture className="absolute inset-0">
        <source media="(min-width: 768px)" srcSet={desktop.srcSet} sizes={desktop.sizes} />
        {/* The picture element selects the reviewed crop before requesting an image. */}
        <img {...mobile} ref={checkImage} alt="" loading="eager" fetchPriority="high" className="object-cover" onError={() => setImageFailed(true)} />
      </picture>
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-[#06150d]/95 via-[#06150d]/85 to-[#06150d]/70 md:via-[#06150d]/70 md:to-transparent" />
      <div className="relative my-auto max-w-xl space-y-2.5 px-5 py-4 sm:px-8 md:w-[62%] lg:px-10">
        <h1 className="wrap-anywhere text-2xl leading-tight font-black sm:text-3xl lg:text-4xl">{banner.headline}</h1>
        {banner.description && <p className="wrap-anywhere max-w-prose text-sm leading-snug text-white">{banner.description}</p>}
        <Link
          href={banner.href}
          prefetch={false}
          className="inline-flex min-h-11 max-w-full items-center rounded-xl bg-[#ff9d00] px-3 py-2 text-sm font-black wrap-anywhere text-zinc-950 hover:bg-[#ffad29] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#102018] sm:px-4"
        >
          {banner.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
