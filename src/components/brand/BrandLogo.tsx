import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

type BrandLogoVariant = "light" | "dark";
type BrandLogoMode = "wordmark" | "icon";

type BrandLogoProps = {
  href?: string;
  variant?: BrandLogoVariant;
  mode?: BrandLogoMode;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

export function BrandLogo({
  href,
  variant = "light",
  mode = "wordmark",
  className,
  imageClassName,
  priority,
}: BrandLogoProps) {
  const src =
    mode === "wordmark"
      ? variant === "dark"
        ? BRAND.assets.wordmarkDark
        : BRAND.assets.wordmarkLight
      : variant === "dark"
        ? BRAND.assets.iconRoundedDark
        : BRAND.assets.iconLight;

  const image = (
    <Image
      src={src}
      alt={BRAND.name}
      width={mode === "wordmark" ? 520 : 96}
      height={mode === "wordmark" ? 104 : 96}
      preload={priority}
      sizes={mode === "wordmark" ? "(max-width: 767px) 200px, 260px" : "96px"}
      className={cn("h-auto w-auto object-contain", imageClassName)}
    />
  );

  if (!href) {
    return <span className={cn("inline-flex items-center", className)}>{image}</span>;
  }

  return (
    <Link
      href={href}
      aria-label={BRAND.name}
      className={cn("inline-flex items-center rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2", className)}
    >
      {image}
    </Link>
  );
}
