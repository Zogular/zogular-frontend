import { DiscoverySectionHeader } from "@/features/consumer-discovery/components/DiscoverySectionHeader";
import { ProductRail } from "@/features/consumer-discovery/components/ProductRail";
import type { Product } from "@/types/product";

type HomeProductSectionProps = {
  title: "New Arrivals" | "Most Viewed";
  products: readonly Product[];
  href?: string;
};

export function HomeProductSection({ title, products, href }: HomeProductSectionProps) {
  if (products.length === 0 || (title === "Most Viewed" && products.length < 4)) return null;

  return (
    <section aria-label={title} data-testid={`home-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <DiscoverySectionHeader
        title={title}
        action={href ? { href, label: "View all" } : undefined}
        className="mb-2 sm:mb-3"
      />
      <ProductRail
        products={products}
        label={`${title} products`}
        prioritizeFirstImage={title === "New Arrivals"}
      />
    </section>
  );
}
