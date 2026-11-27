import { HomeDiscovery } from "@/features/consumer-discovery/home/HomeDiscovery";
import { publicMetadata, type SearchProps } from "@/lib/seo/public-search";
import { loadHomeDiscoveryData } from "@/features/consumer-discovery/home/home-discovery-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: SearchProps) {
  return publicMetadata("/", "Online Shopping in Zambia", "Browse products from sellers in Zambia on Zogular. Explore categories and compare listings.", await searchParams);
}

export default async function HomePage() {
  const discovery = await loadHomeDiscoveryData();
  return <HomeDiscovery {...discovery} />;
}
