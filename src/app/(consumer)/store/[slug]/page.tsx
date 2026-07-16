import { ProductCollectionPage } from "@/components/consumer/ProductCollectionPage";
import { getSearchableProducts, getSellerProducts } from "@/services/products";

export const dynamic = "force-dynamic";

function humanizeSlug(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeToSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).toLowerCase();

  const allProducts = await getSearchableProducts();
  const storeProducts = allProducts.filter((product) => {
    const categorySlug = normalizeToSlug(product.categoryName ?? "general");
    return `${categorySlug}-market` === normalizedSlug;
  });

  const fallbackProducts = await getSellerProducts();
  const visibleProducts = (storeProducts.length ? storeProducts : fallbackProducts).slice(0, 24);
  const storeName = humanizeSlug(normalizedSlug.replace(/-market$/, ""));

  return (
    <ProductCollectionPage
      title={`${storeName} Storefront`}
      description="Shop verified listings from this seller storefront with Zogular checkout and delivery support."
      products={visibleProducts}
      emptyTitle="No products in this storefront yet"
      emptyDescription="The seller has not published items here yet. Please check another category."
    />
  );
}
