import CategoriesDirectoryClient from "@/features/categories/CategoriesDirectoryClient";
import { publicMetadata, type SearchProps } from "@/lib/seo/public-search";

export async function generateMetadata({ searchParams }: SearchProps) {
  return publicMetadata("/categories", "All Shopping Categories in Zambia", "Explore Zogular's product categories and browse listings from sellers in Zambia.", await searchParams);
}

export default function CategoriesDirectoryPage() {
  return <CategoriesDirectoryClient />;
}
