import { ProductCard } from "@/components/productCard";
import { getUniqueDiscoveryProducts } from "@/features/consumer-discovery/lib/discovery-outcomes";
import type { Product } from "@/types/product";
import { cn } from "@/lib/utils";

type ProductGridProps = {
  products: readonly Product[];
  label: string;
  className?: string;
};

export function ProductGrid({ products, label, className }: ProductGridProps) {
  const visibleProducts = getUniqueDiscoveryProducts(products);
  if (visibleProducts.length === 0) return null;

  return (
    <ul
      aria-label={label}
      data-testid="discovery-product-grid"
      className={cn(
        "grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {visibleProducts.map((product) => (
        <li key={`${typeof product.id}:${String(product.id)}`} className="min-w-0">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
