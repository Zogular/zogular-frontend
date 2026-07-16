import { ProductCollectionPage } from "@/components/consumer/ProductCollectionPage";
import { getFlashSaleProducts } from "@/services/products";

export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const products = await getFlashSaleProducts();

  return (
    <ProductCollectionPage
      title="Hot Deals"
      description="Limited-time platform discounts across electronics, fashion, and everyday essentials."
      products={products}
      emptyTitle="No active deals right now"
      emptyDescription="Check back shortly for new campaign discounts."
    />
  );
}
