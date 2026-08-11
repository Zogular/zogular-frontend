import { HomeDiscovery } from "@/features/consumer-discovery/home/HomeDiscovery";
import { loadHomeDiscoveryData } from "@/features/consumer-discovery/home/home-discovery-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const discovery = await loadHomeDiscoveryData();
  return <HomeDiscovery {...discovery} />;
}
