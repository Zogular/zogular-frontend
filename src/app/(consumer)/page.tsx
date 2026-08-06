import { HomePageClient } from "@/components/home/HomePageClient";
import { getHomeCategories, getHomeHeroBanners } from "@/services/categories";
import { getFlashSaleProducts, getTrendingProducts } from "@/services/products";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, heroBanners, flashSaleProducts, trendingProducts] = await Promise.all([
    getHomeCategories(),
    getHomeHeroBanners(),
    getFlashSaleProducts({ allowOptionalFallback: true }),
    getTrendingProducts({ allowOptionalFallback: true }),
  ]);

  return (
    <HomePageClient
      categories={categories}
      heroBanners={heroBanners}
      flashSaleProducts={flashSaleProducts}
      trendingProducts={trendingProducts}
    />
  );
}
