import { ProductCollectionPage } from "@/components/consumer/ProductCollectionPage";
import { getSearchableProducts } from "@/services/products";

export const dynamic = "force-dynamic";

export default async function BestSellersPage() {
  const products = await getSearchableProducts();
  const bestSellers = [...products]
    .sort((left, right) => right.reviews - left.reviews || right.rating - left.rating)
    .slice(0, 24);

  return (
    <ProductCollectionPage
      title="Best Sellers"
      description="Top-performing products shoppers keep coming back for."
      products={bestSellers}
      emptyTitle="No best-seller data yet"
      emptyDescription="Once sales activity grows, top products will appear here."
    />
  );
}
