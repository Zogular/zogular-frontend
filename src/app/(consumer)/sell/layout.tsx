import { publicMetadata } from "@/lib/seo/public-search";

export function generateMetadata() {
  return publicMetadata("/sell", "Sell Online in Zambia", "Learn how to register as a seller and list your products on Zogular.");
}

export default function SellLayout({ children }: { children: React.ReactNode }) {
  return children;
}
