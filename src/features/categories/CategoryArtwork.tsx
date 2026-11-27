import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const artworkPositions = new Map([
  ["electronics", "left top"],
  ["fashion", "right top"],
  ["health-and-beauty", "left bottom"],
  ["home-and-living", "right bottom"],
]);

export function CategoryArtwork({ slug, className, children }: {
  slug: string;
  className?: string;
  children: ReactNode;
}) {
  const position = artworkPositions.get(slug);
  return (
    <span aria-hidden="true" className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden", className)}>
      {children}
      {position ? (
        <span
          data-category-artwork={slug}
          className="absolute inset-0 bg-no-repeat"
          style={{
            backgroundImage: "url('/images/discovery/category-artwork.webp')",
            backgroundPosition: position,
            backgroundSize: "200% 200%",
          }}
        />
      ) : null}
    </span>
  );
}
