import { ProductCollectionPage } from "@/components/consumer/ProductCollectionPage";
import { getTrendingProducts } from "@/services/products";

export const dynamic = "force-dynamic";

export default async function TrendingPage() {
  const products = await getTrendingProducts();

  return (
    <ProductCollectionPage
      title="Trending Near You"
      description="Products currently getting the most shopper attention across Zogular."
      products={products}
      emptyTitle="No trending products yet"
      emptyDescription="Fresh product activity will show here as listings gain momentum."
    />
  );
}
