import { ProductCollectionPage } from "@/components/consumer/ProductCollectionPage";
import { getSearchableProducts } from "@/services/products";

export const dynamic = "force-dynamic";

export default async function NewArrivalsPage() {
  const products = await getSearchableProducts();
  const newArrivals = products
    .filter((product) => product.isNew || product.badge?.toLowerCase().includes("new"))
    .sort((left, right) => right.reviews - left.reviews);

  const fallback = [...products].sort((left, right) => right.reviews - left.reviews).slice(0, 24);

  return (
    <ProductCollectionPage
      title="New Arrivals"
      description="Latest listings from sellers across Zambia, curated for quick discovery."
      products={newArrivals.length ? newArrivals : fallback}
      emptyTitle="No new arrivals at the moment"
      emptyDescription="Sellers are preparing fresh listings. Check back again soon."
    />
  );
}
