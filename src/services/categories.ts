import type { CategorySummary } from "@/types/category";

export type HeroBanner = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ctaLabel: string;
  ctaHref: string;
  overlayClass: string;
  badge: string;
};

const CATEGORY_DIRECTORY: CategorySummary[] = [
  {
    id: "phones-and-tablets",
    name: "Phones & Tablets",
    slug: "phones-and-tablets",
    description: "Smartphones, iPads, and premium mobile accessories.",
    iconKey: "smartphone",
    colorClass: "text-blue-600 bg-blue-500/10",
    children: [
      { id: "smartphones", name: "Smartphones", slug: "smartphones" },
      { id: "tablets", name: "Tablets", slug: "tablets" },
      { id: "accessories", name: "Accessories", slug: "accessories" },
    ],
  },
  {
    id: "computing",
    name: "Computing",
    slug: "computing",
    description: "High-performance laptops, desktops, and workspace gear.",
    iconKey: "laptop",
    colorClass: "text-zinc-600 bg-zinc-500/10",
    children: [
      { id: "laptops", name: "Laptops", slug: "laptops" },
      { id: "desktops", name: "Desktops", slug: "desktops" },
      { id: "accessories", name: "PC Accessories", slug: "accessories" },
    ],
  },
  {
    id: "fashion",
    name: "Fashion",
    slug: "fashion",
    description: "Trending apparel, footwear, and designer accessories.",
    iconKey: "shirt",
    colorClass: "text-pink-600 bg-pink-500/10",
    children: [
      { id: "mens-fashion", name: "Men's Fashion", slug: "mens-fashion" },
      { id: "womens-fashion", name: "Women's Fashion", slug: "womens-fashion" },
      { id: "footwear", name: "Footwear", slug: "footwear" },
    ],
  },
  {
    id: "supermarket",
    name: "Supermarket",
    slug: "supermarket",
    description: "Daily groceries, beverages, and household staples.",
    iconKey: "shopping-basket",
    colorClass: "text-[#009E49] bg-[#009E49]/10",
    children: [
      { id: "beverages", name: "Beverages", slug: "beverages" },
      { id: "snacks", name: "Snacks", slug: "snacks" },
      { id: "staples", name: "Pantry Staples", slug: "staples" },
    ],
  },
  {
    id: "electronics",
    name: "Electronics",
    slug: "electronics",
    description: "TVs, audio systems, and home entertainment setups.",
    iconKey: "tv",
    colorClass: "text-purple-600 bg-purple-500/10",
    children: [
      { id: "audio-and-headphones", name: "Audio & Headphones", slug: "audio-and-headphones" },
      { id: "tvs-and-entertainment", name: "TVs & Entertainment", slug: "tvs-and-entertainment" },
      { id: "cameras", name: "Cameras", slug: "cameras" },
    ],
  },
  {
    id: "health-and-beauty",
    name: "Health & Beauty",
    slug: "health-and-beauty",
    description: "Skincare, makeup, and personal wellness products.",
    iconKey: "heart-pulse",
    colorClass: "text-red-600 bg-red-500/10",
    children: [
      { id: "beauty", name: "Beauty", slug: "beauty" },
      { id: "personal-care", name: "Personal Care", slug: "personal-care" },
      { id: "vitamins", name: "Vitamins", slug: "vitamins" },
    ],
  },
  {
    id: "sports-and-outdoors",
    name: "Sports & Outdoors",
    slug: "sports-and-outdoors",
    description: "Gym equipment, activewear, and outdoor exploration gear.",
    iconKey: "dumbbell",
    colorClass: "text-[#FF6B00] bg-[#FF6B00]/10",
    children: [
      { id: "fitness", name: "Fitness", slug: "fitness" },
      { id: "outdoor-gear", name: "Outdoor Gear", slug: "outdoor-gear" },
      { id: "team-sports", name: "Team Sports", slug: "team-sports" },
    ],
  },
  {
    id: "home-and-living",
    name: "Home & Living",
    slug: "home-and-living",
    description: "Furniture, decor, and smart home automation.",
    iconKey: "sofa",
    colorClass: "text-amber-600 bg-amber-500/10",
    children: [
      { id: "furniture", name: "Furniture", slug: "furniture" },
      { id: "home-decor", name: "Home Decor", slug: "home-decor" },
      { id: "kitchenware", name: "Kitchenware", slug: "kitchenware" },
    ],
  },
];

const HERO_BANNERS: HeroBanner[] = [
  {
    id: "banner_1",
    title: "Grand Opening Sale",
    subtitle: "Welcome to Zogular. Shop across all categories with massive discounts.",
    image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=2070&q=80",
    ctaLabel: "Start Shopping",
    ctaHref: "/products",
    overlayClass: "from-[#009E49]/95 via-[#009E49]/70 to-transparent",
    badge: "Welcome",
  },
  {
    id: "banner_2",
    title: "Black Friday Deals",
    subtitle: "The biggest tech and electronics price drops of the entire year.",
    image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=2070&q=80",
    ctaLabel: "Shop Electronics",
    ctaHref: "/category/electronics",
    overlayClass: "from-zinc-950/95 via-zinc-900/80 to-transparent",
    badge: "Featured",
  },
  {
    id: "banner_3",
    title: "Up to 50% Off",
    subtitle: "Refresh your wardrobe with half-price deals on top global brands.",
    image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=2070&q=80",
    ctaLabel: "Shop Fashion",
    ctaHref: "/category/fashion",
    overlayClass: "from-[#FF6B00]/95 via-[#FF6B00]/70 to-transparent",
    badge: "Promo",
  },
];

export async function getCategoryDirectory(): Promise<CategorySummary[]> {
  return CATEGORY_DIRECTORY;
}

export async function getHomeCategories(): Promise<CategorySummary[]> {
  return CATEGORY_DIRECTORY;
}

export async function getHomeHeroBanners(): Promise<HeroBanner[]> {
  return HERO_BANNERS;
}

export function buildCategorySubcategoryHref(
  categorySlug: string,
  subcategorySlug: string,
): string {
  return `/category/${categorySlug}?subcategory=${subcategorySlug}`;
}
