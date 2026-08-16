import { ProductCollectionPage } from "@/components/consumer/ProductCollectionPage";
import { NewArrivalsUnavailable } from "@/app/(consumer)/new-arrivals/NewArrivalsUnavailable";
import { ApiError } from "@/services/api";
import { getHomeNewArrivals, ProductListContractError } from "@/services/products";
import type { Product } from "@/types/product";

export const dynamic = "force-dynamic";

export default async function NewArrivalsPage() {
  let products: Product[];

  try {
    products = await getHomeNewArrivals(20);
  } catch (error) {
    if (error instanceof ApiError || error instanceof ProductListContractError) {
      return <NewArrivalsUnavailable />;
    }
    throw error;
  }

  return (
    <ProductCollectionPage
      title="New Arrivals"
      description="Browse the newest products available on Zogular."
      products={products}
      emptyTitle="No new arrivals yet"
      emptyDescription="Check back later for newly listed products."
    />
  );
}
