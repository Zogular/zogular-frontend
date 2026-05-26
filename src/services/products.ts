import { normalizeProduct } from "@/lib/normalizers/product";
import { apiClient } from "@/services/api";
import type {
  CategoryFilterOption,
  CategoryPageData,
  ProductPaginationMeta,
  CategorySortOption,
} from "@/types/category";
import type { Product, ProductDetail } from "@/types/product";
import {
  getSellerConsumerCatalogProducts,
  getSellerConsumerProductDetailBySlug,
} from "@/services/seller-catalog";

const TRENDING_PRODUCTS: Product[] = [
  normalizeProduct({
    id: "macbook-air-m2-space-gray",
    slug: "macbook-air-m2-space-gray",
    name: "MacBook Air M2 - Space Gray",
    categoryName: "Computing",
    price: 26500,
    rating: 4.9,
    reviews: 342,
    badge: "Hot",
    image: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "classic-leather-crossbody-bag",
    slug: "classic-leather-crossbody-bag",
    name: "Classic Leather Crossbody Bag",
    categoryName: "Fashion",
    price: 850,
    rating: 4.7,
    reviews: 128,
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "nespresso-vertuo-coffee-machine",
    slug: "nespresso-vertuo-coffee-machine",
    name: "Nespresso Vertuo Coffee Machine",
    categoryName: "Appliances",
    price: 4200,
    rating: 4.8,
    reviews: 85,
    badge: "New",
    image: "https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "samsung-galaxy-s24-ultra",
    slug: "samsung-galaxy-s24-ultra",
    name: "Samsung Galaxy S24 Ultra",
    categoryName: "Phones",
    price: 29000,
    rating: 5,
    reviews: 412,
    badge: "Hot",
    image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "premium-yoga-mat",
    slug: "premium-yoga-mat",
    name: "Premium Yoga Mat",
    categoryName: "Sports",
    price: 450,
    rating: 4.6,
    reviews: 95,
    image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "dyson-supersonic-hair-dryer",
    slug: "dyson-supersonic-hair-dryer",
    name: "Dyson Supersonic Hair Dryer",
    categoryName: "Health",
    price: 9500,
    rating: 4.9,
    reviews: 215,
    badge: "Trending",
    image: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "organic-arabica-coffee-beans",
    slug: "organic-arabica-coffee-beans",
    name: "Organic Arabica Coffee Beans",
    categoryName: "Supermarket",
    price: 320,
    rating: 4.8,
    reviews: 512,
    badge: "Best Seller",
    image: "https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "minimalist-chronograph-watch",
    slug: "minimalist-chronograph-watch",
    name: "Minimalist Chronograph Watch",
    categoryName: "Fashion",
    price: 1200,
    rating: 4.7,
    reviews: 176,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "sony-playstation-5-console",
    slug: "sony-playstation-5-console",
    name: "Sony PlayStation 5 Console",
    categoryName: "Electronics",
    price: 12500,
    rating: 4.9,
    reviews: 843,
    badge: "Hot",
    image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "nike-air-max-270-sneakers",
    slug: "nike-air-max-270-sneakers",
    name: "Nike Air Max 270 Sneakers",
    categoryName: "Fashion",
    price: 2800,
    rating: 4.8,
    reviews: 320,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "waterpik-aquarius-flosser",
    slug: "waterpik-aquarius-flosser",
    name: "Waterpik Aquarius Flosser",
    categoryName: "Health",
    price: 1800,
    rating: 4.8,
    reviews: 215,
    image: "https://images.unsplash.com/photo-1559523182-a284c3fb7cff?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "logitech-mx-master-3s",
    slug: "logitech-mx-master-3s-mouse",
    name: "Logitech MX Master 3S Mouse",
    categoryName: "Computing",
    price: 2200,
    rating: 4.9,
    reviews: 843,
    badge: "Top Rated",
    image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
  }),
];

const FLASH_SALE_PRODUCTS: Product[] = [
  normalizeProduct({
    id: "iphone-15-pro-max-256",
    slug: "apple-iphone-15-pro-max-256gb",
    name: "Apple iPhone 15 Pro Max - 256GB",
    categoryName: "Phones & Tablets",
    price: 24500,
    originalPrice: 28000,
    discount: 12,
    badge: "-12%",
    rating: 4.9,
    reviews: 124,
    image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "sony-wh1000xm5",
    slug: "sony-wh-1000xm5-wireless-headphones",
    name: "Sony WH-1000XM5 Wireless Headphones",
    categoryName: "Electronics",
    price: 6800,
    originalPrice: 8500,
    discount: 20,
    badge: "-20%",
    rating: 4.8,
    reviews: 89,
    image: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "samsung-55-4k-tv",
    slug: "samsung-55-smart-4k-uhd-tv",
    name: 'Samsung 55" Smart 4K UHD TV',
    categoryName: "Electronics",
    price: 11200,
    originalPrice: 14000,
    discount: 20,
    badge: "-20%",
    rating: 4.7,
    reviews: 56,
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "nike-air-force-1",
    slug: "nike-air-force-1-07",
    name: "Nike Air Force 1 '07",
    categoryName: "Fashion",
    price: 2100,
    originalPrice: 3000,
    discount: 30,
    badge: "-30%",
    rating: 4.9,
    reviews: 210,
    image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "dell-xps-13",
    slug: "dell-xps-13-laptop-16gb-ram",
    name: "Dell XPS 13 Laptop - 16GB RAM",
    categoryName: "Computing",
    price: 22000,
    originalPrice: 26000,
    discount: 15,
    badge: "-15%",
    rating: 4.6,
    reviews: 42,
    image: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "playstation-5-console",
    slug: "playstation-5-console",
    name: "PlayStation 5 Console",
    categoryName: "Electronics",
    price: 12500,
    originalPrice: 14000,
    discount: 10,
    badge: "-10%",
    rating: 4.9,
    reviews: 312,
    image: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80",
  }),
];

const CATEGORY_PRODUCTS: Product[] = [
  normalizeProduct({
    id: "fashion-ankara-midi-dress",
    slug: "ankara-midi-dress",
    name: "Ankara Midi Dress",
    categoryName: "Fashion",
    subcategoryName: "Women's Fashion",
    price: 620,
    originalPrice: 780,
    rating: 4.7,
    reviews: 76,
    badge: "New",
    image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "fashion-leather-office-loafers",
    slug: "leather-office-loafers",
    name: "Leather Office Loafers",
    categoryName: "Fashion",
    subcategoryName: "Footwear",
    price: 890,
    originalPrice: 1050,
    rating: 4.6,
    reviews: 91,
    image: "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "electronics-bluetooth-party-speaker",
    slug: "bluetooth-party-speaker",
    name: "Bluetooth Party Speaker",
    categoryName: "Electronics",
    subcategoryName: "Audio",
    price: 1750,
    originalPrice: 2150,
    rating: 4.8,
    reviews: 144,
    badge: "Hot",
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "electronics-43-inch-smart-tv",
    slug: "43-inch-smart-tv",
    name: '43" Smart LED TV',
    categoryName: "Electronics",
    subcategoryName: "TVs & Entertainment",
    price: 6500,
    originalPrice: 7200,
    rating: 4.7,
    reviews: 62,
    image: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "computing-hp-elitebook-840",
    slug: "hp-elitebook-840-g8",
    name: "HP EliteBook 840 G8",
    categoryName: "Computing",
    subcategoryName: "Laptops",
    price: 11800,
    originalPrice: 13200,
    rating: 4.6,
    reviews: 108,
    badge: "Top Rated",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "computing-wireless-keyboard-mouse",
    slug: "wireless-keyboard-mouse-combo",
    name: "Wireless Keyboard & Mouse Combo",
    categoryName: "Computing",
    subcategoryName: "Accessories",
    price: 420,
    originalPrice: 520,
    rating: 4.5,
    reviews: 73,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "phones-infinix-note-40-pro",
    slug: "infinix-note-40-pro",
    name: "Infinix Note 40 Pro",
    categoryName: "Phones & Tablets",
    subcategoryName: "Smartphones",
    price: 5400,
    originalPrice: 6100,
    rating: 4.6,
    reviews: 203,
    badge: "Popular",
    image: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "phones-tablet-android-10-inch",
    slug: "android-10-inch-tablet",
    name: 'Android 10" Learning Tablet',
    categoryName: "Phones & Tablets",
    subcategoryName: "Tablets",
    price: 2850,
    originalPrice: 3400,
    rating: 4.4,
    reviews: 58,
    image: "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "supermarket-breakfast-bundle",
    slug: "breakfast-pantry-bundle",
    name: "Breakfast Pantry Bundle",
    categoryName: "Supermarket",
    subcategoryName: "Pantry",
    price: 410,
    originalPrice: 490,
    rating: 4.8,
    reviews: 188,
    badge: "Best Seller",
    image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "supermarket-cooking-oil-5l",
    slug: "pure-vegetable-cooking-oil-5l",
    name: "Pure Vegetable Cooking Oil 5L",
    categoryName: "Supermarket",
    subcategoryName: "Household Essentials",
    price: 265,
    originalPrice: 310,
    rating: 4.7,
    reviews: 221,
    image: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "health-vitamin-c-zinc",
    slug: "vitamin-c-zinc-tablets",
    name: "Vitamin C + Zinc Tablets",
    categoryName: "Health & Beauty",
    subcategoryName: "Wellness",
    price: 185,
    originalPrice: 240,
    rating: 4.6,
    reviews: 84,
    image: "https://images.unsplash.com/photo-1550572017-edd951aa8f72?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "health-shea-body-lotion",
    slug: "shea-body-lotion",
    name: "Shea Body Lotion",
    categoryName: "Health & Beauty",
    subcategoryName: "Skincare",
    price: 145,
    originalPrice: 190,
    rating: 4.7,
    reviews: 117,
    badge: "New",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "sports-adjustable-dumbbells",
    slug: "adjustable-dumbbell-set",
    name: "Adjustable Dumbbell Set",
    categoryName: "Sports & Outdoors",
    subcategoryName: "Fitness",
    price: 1350,
    originalPrice: 1650,
    rating: 4.8,
    reviews: 96,
    badge: "Hot",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "sports-camping-chair",
    slug: "folding-camping-chair",
    name: "Folding Camping Chair",
    categoryName: "Sports & Outdoors",
    subcategoryName: "Outdoor Gear",
    price: 380,
    originalPrice: 460,
    rating: 4.5,
    reviews: 52,
    image: "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "home-ceramic-dinner-set",
    slug: "ceramic-dinner-set-16-piece",
    name: "Ceramic Dinner Set 16 Piece",
    categoryName: "Home & Living",
    subcategoryName: "Kitchen",
    price: 720,
    originalPrice: 860,
    rating: 4.6,
    reviews: 69,
    image: "https://images.unsplash.com/photo-1603199506016-b9a594b593c0?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: "home-modern-floor-lamp",
    slug: "modern-floor-lamp",
    name: "Modern Floor Lamp",
    categoryName: "Home & Living",
    subcategoryName: "Decor",
    price: 980,
    originalPrice: 1180,
    rating: 4.7,
    reviews: 48,
    badge: "New",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80",
  }),
];

const PRODUCT_DETAIL_MOCK: ProductDetail = {
  id: 1,
  slug: "macbook-air-m2-8gb-256gb-midnight",
  title: "MacBook Air M2 - 8GB RAM 256GB SSD (Midnight)",
  brand: "Apple",
  category: { name: "Electronics", href: "/category/electronics" },
  subcategory: { name: "Laptops", href: "/category/computing" },
  sku: "MAC-M2-256",
  price: 18500,
  originalPrice: 21000,
  rating: 4.9,
  reviewCount: 128,
  badge: "Top Seller",
  seller: {
    name: "iStore Lusaka",
    href: "/store/istore-lusaka",
    avatar: "https://github.com/shadcn.png",
    verified: true,
    positiveRate: "98% Positive",
    followers: "1.2k Followers",
  },
  stock: 6,
  shippingText: "Ready for delivery between Tomorrow and Thursday.",
  images: [
    "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1200&q=80",
  ],
  variants: [
    { id: "midnight", label: "Color", value: "Midnight", swatchClass: "bg-zinc-800 border-[#FF6B00]" },
    { id: "silver", label: "Color", value: "Silver", swatchClass: "bg-zinc-200 border-zinc-200" },
    { id: "starlight", label: "Color", value: "Starlight", swatchClass: "bg-[#e3e1d9] border-zinc-200" },
  ],
  description:
    "The radically redesigned MacBook Air features the next-generation M2 chip, an incredibly thin aluminum enclosure, and exceptional power efficiency. Built for high-performance productivity on the go, it includes a 13.6-inch Liquid Retina display, a 1080p FaceTime HD camera, and MagSafe 3 charging.",
  specs: [
    { label: "Processor", value: "Apple M2 chip" },
    { label: "Memory", value: "8GB Unified RAM" },
    { label: "Storage", value: "256GB SSD" },
    { label: "Display", value: '13.6" Liquid Retina' },
  ],
  boxItems: [
    "MacBook Air M2 Laptop",
    "30W USB-C Power Adapter",
    "USB-C to MagSafe 3 Cable (2m)",
    "Apple Documentation & Stickers",
  ],
};

const SELLER_PRODUCTS: Product[] = [
  normalizeProduct({
    id: 101,
    slug: "airpods-pro",
    title: "AirPods Pro",
    price: 4200,
    oldPrice: 4800,
    discount: 12,
    badge: "Hot",
    rating: 4.9,
    reviews: 320,
    image: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: 102,
    slug: "35w-adapter",
    title: "35W Adapter",
    price: 950,
    rating: 4.7,
    reviews: 85,
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: 103,
    slug: "magic-keyboard",
    title: "Magic Keyboard",
    price: 2800,
    oldPrice: 3200,
    discount: 12,
    rating: 4.8,
    reviews: 142,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: 104,
    slug: "screen-protector",
    title: "Screen Protector",
    price: 350,
    oldPrice: 500,
    discount: 30,
    badge: "Sale",
    rating: 4.5,
    reviews: 67,
    image: "https://images.unsplash.com/photo-1603313011101-320f26a4f6f6?auto=format&fit=crop&w=800&q=80",
  }),
];

const RELATED_PRODUCTS: Product[] = [
  normalizeProduct({
    id: 2,
    slug: "magic-mouse",
    title: "Magic Mouse",
    price: 1800,
    oldPrice: 2200,
    discount: 18,
    badge: "Popular",
    rating: 4.6,
    reviews: 45,
    image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: 3,
    slug: "usb-c-hub",
    title: "USB-C Hub",
    price: 450,
    rating: 4.8,
    reviews: 112,
    image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: 4,
    slug: "laptop-sleeve",
    title: "Laptop Sleeve",
    price: 250,
    oldPrice: 350,
    discount: 28,
    badge: "New",
    rating: 4.3,
    reviews: 24,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
  }),
  normalizeProduct({
    id: 5,
    slug: "desk-stand",
    title: "Desk Stand",
    price: 600,
    oldPrice: 800,
    discount: 25,
    badge: "Sale",
    rating: 4.9,
    reviews: 210,
    image: "https://images.unsplash.com/photo-1516542076529-1ea3854896f2?auto=format&fit=crop&w=800&q=80",
  }),
];

const CATEGORY_META: Record<string, CategoryPageData["meta"]> = {
  "phones-and-tablets": {
    title: "Phones And Tablets",
    description: "Explore top smartphones, tablets, and accessories in Lusaka with fast delivery and trusted sellers.",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      { id: "smartphones", slug: "smartphones", name: "Smartphones" },
      { id: "tablets", slug: "tablets", name: "Tablets" },
      { id: "accessories", slug: "accessories", name: "Accessories" },
    ],
  },
  computing: {
    title: "Computing",
    description: "Discover laptops, desktops, and accessories for work, school, and everyday performance.",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      { id: "laptops", slug: "laptops", name: "Laptops" },
      { id: "desktops", slug: "desktops", name: "Desktops" },
      { id: "accessories", slug: "accessories", name: "Accessories" },
    ],
  },
  fashion: {
    title: "Fashion",
    description: "Shop premium fashion, footwear, and accessories curated for your style and everyday wear.",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      { id: "mens-fashion", slug: "mens-fashion", name: "Men's" },
      { id: "womens-fashion", slug: "womens-fashion", name: "Women's" },
      { id: "footwear", slug: "footwear", name: "Footwear" },
    ],
  },
  electronics: {
    title: "Electronics",
    description: "Find trending electronics, entertainment gear, and premium gadgets from trusted sellers.",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      { id: "audio-and-headphones", slug: "audio-and-headphones", name: "Audio" },
      { id: "tvs-and-entertainment", slug: "tvs-and-entertainment", name: "TVs" },
      { id: "cameras", slug: "cameras", name: "Cameras" },
    ],
  },
  supermarket: {
    title: "Supermarket",
    description: "Shop pantry staples, drinks, household essentials, and daily supplies with fast local delivery.",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      { id: "pantry", slug: "pantry", name: "Pantry" },
      { id: "household-essentials", slug: "household-essentials", name: "Household" },
      { id: "drinks", slug: "drinks", name: "Drinks" },
    ],
  },
  "health-and-beauty": {
    title: "Health & Beauty",
    description: "Discover skincare, wellness, grooming, and beauty essentials from trusted Zogular sellers.",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      { id: "skincare", slug: "skincare", name: "Skincare" },
      { id: "wellness", slug: "wellness", name: "Wellness" },
      { id: "grooming", slug: "grooming", name: "Grooming" },
    ],
  },
  "sports-and-outdoors": {
    title: "Sports & Outdoors",
    description: "Find fitness gear, outdoor essentials, and active lifestyle products for everyday movement.",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      { id: "fitness", slug: "fitness", name: "Fitness" },
      { id: "outdoor-gear", slug: "outdoor-gear", name: "Outdoor Gear" },
      { id: "team-sports", slug: "team-sports", name: "Team Sports" },
    ],
  },
  "home-and-living": {
    title: "Home & Living",
    description: "Upgrade your home with kitchen, decor, storage, and everyday living essentials.",
    subcategories: [
      { id: "all", slug: "all", name: "All" },
      { id: "kitchen", slug: "kitchen", name: "Kitchen" },
      { id: "decor", slug: "decor", name: "Decor" },
      { id: "storage", slug: "storage", name: "Storage" },
    ],
  },
};

const PRODUCT_IMAGE_PLACEHOLDER = "/file.svg";

const BACKEND_CATEGORY_BY_SLUG = {
  "phones-and-tablets": "PHONES",
  computing: "LAPTOPS",
  fashion: "FASHIONS",
  electronics: "ELECTRONICS",
  accessories: "ACCESSORIES",
  "home-and-living": "OTHERS",
} as const;

const FRONTEND_CATEGORY_BY_BACKEND: Record<string, { name: string; slug: string }> = {
  PHONES: { name: "Phones & Tablets", slug: "phones-and-tablets" },
  LAPTOPS: { name: "Computing", slug: "computing" },
  ACCESSORIES: { name: "Accessories", slug: "accessories" },
  FASHIONS: { name: "Fashion", slug: "fashion" },
  ELECTRONICS: { name: "Electronics", slug: "electronics" },
  OTHERS: { name: "Other Finds", slug: "products" },
};

const BACKEND_SORT_BY_CATEGORY_SORT: Record<CategorySortOption, "newest" | "price_asc" | "price_desc" | "popular"> = {
  recommended: "newest",
  "price-low": "price_asc",
  "price-high": "price_desc",
  "top-rated": "popular",
};

type BackendProductUser = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  telephone?: string | null;
};

type BackendReview = {
  rating?: number | null;
};

type BackendProduct = {
  id?: string;
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  price?: number | string | null;
  images?: unknown;
  condition?: string | null;
  category?: string | null;
  location?: string | null;
  brand?: string | null;
  model?: string | null;
  ram?: string | null;
  storage?: string | null;
  batteryHealth?: string | null;
  size?: string | null;
  color?: string | null;
  material?: string | null;
  compatibility?: string | null;
  isSold?: boolean | null;
  createdAt?: string | null;
  views?: number | null;
  user?: BackendProductUser | null;
  reviews?: BackendReview[] | null;
};

type BackendProductListResponse = {
  pagination?: {
    total?: number;
    page?: number;
    limit?: number;
    pages?: number;
  };
  data?: {
    products?: BackendProduct[];
    product?: BackendProduct;
  };
};

function titleFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCategoryMeta(slug: string): CategoryPageData["meta"] {
  return (
    CATEGORY_META[slug] ?? {
      title: titleFromSlug(slug),
      description: `Explore the best deals on ${titleFromSlug(slug).toLowerCase()} in Lusaka. Fast delivery, trusted sellers.`,
      subcategories: [{ id: "all", slug: "all", name: "All" }],
    }
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function parseBackendImages(value: unknown): string[] {
  let candidate = value;

  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      candidate = JSON.parse(value) as unknown;
    } catch {
      candidate = [];
    }
  }

  if (!Array.isArray(candidate)) return [];

  return candidate
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function getBackendCategoryMeta(category?: string | null) {
  const key = asString(category)?.toUpperCase() ?? "OTHERS";
  return FRONTEND_CATEGORY_BY_BACKEND[key] ?? FRONTEND_CATEGORY_BY_BACKEND.OTHERS;
}

function getBackendCategoryForSlug(slug: string): string | undefined {
  return BACKEND_CATEGORY_BY_SLUG[slug as keyof typeof BACKEND_CATEGORY_BY_SLUG];
}

function getBackendPriceQuery(filter: CategoryFilterOption) {
  if (filter === "under-500") return { maxPrice: 499 };
  if (filter === "500-2000") return { minPrice: 500, maxPrice: 2000 };
  if (filter === "over-2000") return { minPrice: 2001 };
  return {};
}

function isRecentProduct(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= 14 * 24 * 60 * 60 * 1000;
}

function getAverageRating(reviews?: BackendReview[] | null): number {
  if (!reviews?.length) return 0;
  const total = reviews.reduce((sum, review) => sum + toNumber(review.rating), 0);
  return Number((total / reviews.length).toFixed(1));
}

function normalizeBackendProduct(product: BackendProduct): Product {
  const title = asString(product.title) ?? titleFromSlug(asString(product.slug) ?? "product");
  const slug = asString(product.slug) ?? normalizeToSlug(title);
  const category = getBackendCategoryMeta(product.category);
  const images = parseBackendImages(product.images);
  const reviews = product.reviews?.length ?? 0;

  return normalizeProduct({
    id: asString(product.id) ?? slug,
    slug,
    title,
    name: title,
    categoryName: category.name,
    price: toNumber(product.price),
    originalPrice: null,
    badge: isRecentProduct(product.createdAt) ? "New" : null,
    isNew: isRecentProduct(product.createdAt),
    rating: getAverageRating(product.reviews),
    reviews,
    image: images[0] ?? PRODUCT_IMAGE_PLACEHOLDER,
  });
}

function getBackendProducts(payload: BackendProductListResponse): BackendProduct[] {
  return Array.isArray(payload.data?.products) ? payload.data.products : [];
}

function toPaginationMeta(
  payload: BackendProductListResponse,
  fallbackPage: number,
  fallbackPageSize: number,
  productCount: number,
): ProductPaginationMeta {
  const total = payload.pagination?.total ?? productCount;
  const page = payload.pagination?.page ?? fallbackPage;
  const pageSize = payload.pagination?.limit ?? fallbackPageSize;
  const totalPages = payload.pagination?.pages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const startItem = total ? (page - 1) * pageSize + 1 : 0;
  const endItem = total ? Math.min(startItem + productCount - 1, total) : 0;

  return {
    page,
    pageSize,
    total,
    totalPages,
    startItem,
    endItem,
  };
}

async function fetchBackendProducts(
  query: Record<string, string | number | boolean | null | undefined>,
): Promise<{ products: Product[]; pagination: ProductPaginationMeta } | null> {
  try {
    const payload = await apiClient<BackendProductListResponse>("/products", {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
      query,
    });
    const backendProducts = getBackendProducts(payload);
    const products = backendProducts.map(normalizeBackendProduct);
    const page = toNumber(query.page, 1);
    const pageSize = toNumber(query.limit, products.length || 20);

    if (!products.length) return null;

    return {
      products,
      pagination: toPaginationMeta(payload, page, pageSize, products.length),
    };
  } catch {
    return null;
  }
}

async function fetchBackendProductCollection(
  endpoint: string,
  query: Record<string, string | number | boolean | null | undefined>,
): Promise<Product[] | null> {
  try {
    const payload = await apiClient<BackendProductListResponse>(endpoint, {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
      query,
    });
    const products = getBackendProducts(payload).map(normalizeBackendProduct);
    return products.length ? products : null;
  } catch {
    return null;
  }
}

function buildBackendProductSpecs(product: BackendProduct): ProductDetail["specs"] {
  return [
    { label: "Category", value: getBackendCategoryMeta(product.category).name },
    { label: "Condition", value: asString(product.condition) ?? "Seller provided" },
    { label: "Location", value: asString(product.location) ?? "Confirmed at checkout" },
    { label: "Brand", value: asString(product.brand) ?? "Not specified" },
    { label: "Model", value: asString(product.model) ?? "Not specified" },
    { label: "RAM", value: asString(product.ram) ?? "Not specified" },
    { label: "Storage", value: asString(product.storage) ?? "Not specified" },
    { label: "Size", value: asString(product.size) ?? "Not specified" },
    { label: "Color", value: asString(product.color) ?? "Not specified" },
  ].filter((spec) => spec.value !== "Not specified");
}

function buildBackendProductVariants(product: BackendProduct): ProductDetail["variants"] {
  const variants = [
    asString(product.color)
      ? { id: "color", label: "Color", value: asString(product.color)!, swatchClass: "bg-white border-[#FF6B00]" }
      : null,
    asString(product.size)
      ? { id: "size", label: "Size", value: asString(product.size)!, swatchClass: "bg-zinc-100 border-[#FF6B00]" }
      : null,
    asString(product.condition)
      ? { id: "condition", label: "Condition", value: asString(product.condition)!, swatchClass: "bg-zinc-200 border-[#FF6B00]" }
      : null,
  ].filter((variant): variant is ProductDetail["variants"][number] => Boolean(variant));

  return variants.length
    ? variants
    : [{ id: "standard", label: "Option", value: "Standard", swatchClass: "bg-white border-[#FF6B00]" }];
}

function normalizeBackendProductDetail(product: BackendProduct): ProductDetail {
  const summary = normalizeBackendProduct(product);
  const category = getBackendCategoryMeta(product.category);
  const images = parseBackendImages(product.images);
  const title = summary.title ?? summary.name ?? titleFromSlug(summary.slug);
  const sellerName = [product.user?.firstName, product.user?.lastName]
    .map((part) => asString(part))
    .filter(Boolean)
    .join(" ");
  const brand = asString(product.brand) ?? "Zogular";

  return {
    id: summary.id,
    slug: summary.slug,
    title,
    brand,
    category: { name: category.name, href: `/category/${category.slug}` },
    subcategory: { name: category.name, href: `/category/${category.slug}` },
    sku: `ZM-${String(summary.id).replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || "ITEM"}`,
    price: summary.price,
    originalPrice: summary.originalPrice ?? summary.price,
    rating: summary.rating,
    reviewCount: summary.reviews,
    badge: summary.badge ?? null,
    seller: {
      name: sellerName || "Zogular Seller",
      href: `/store/${normalizeToSlug(sellerName || "zogular-seller")}`,
      avatar: "https://github.com/shadcn.png",
      verified: false,
      positiveRate: "Platform seller",
      followers: asString(product.location) ?? "Zambia",
    },
    stock: product.isSold ? 0 : 99,
    shippingText: "Delivery options and exact availability are confirmed at checkout.",
    images: images.length ? images : [PRODUCT_IMAGE_PLACEHOLDER],
    variants: buildBackendProductVariants(product),
    description: asString(product.description) ?? `${title} is available from a Zogular platform seller.`,
    specs: buildBackendProductSpecs(product),
    boxItems: [title, "Seller provided packaging", "Zogular order receipt"],
  };
}

async function fetchBackendProductDetailBySlug(slug: string): Promise<ProductDetail | null> {
  try {
    const payload = await apiClient<BackendProductListResponse>(`/products/${encodeURIComponent(slug)}`, {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
    });
    const product = payload.data?.product;
    return product ? normalizeBackendProductDetail(product) : null;
  } catch {
    return null;
  }
}

async function fetchBackendRelatedProducts(
  productId: string | number,
  limit: number,
): Promise<Product[] | null> {
  try {
    const payload = await apiClient<BackendProductListResponse>(`/products/${productId}/related`, {
      method: "GET",
      authMode: "omit",
      cache: "no-store",
      query: { limit },
    });
    const products = getBackendProducts(payload).map(normalizeBackendProduct);
    return products.length ? products : null;
  } catch {
    return null;
  }
}

function applyPriceFilter(products: Product[], filter: CategoryFilterOption): Product[] {
  if (filter === "all") return products;
  if (filter === "under-500") return products.filter((product) => product.price < 500);
  if (filter === "500-2000") {
    return products.filter((product) => product.price >= 500 && product.price <= 2000);
  }
  if (filter === "over-2000") return products.filter((product) => product.price > 2000);
  return products.filter((product) => product.rating >= 4);
}

function applySort(products: Product[], sort: CategorySortOption): Product[] {
  const list = [...products];

  if (sort === "price-low") return list.sort((a, b) => a.price - b.price);
  if (sort === "price-high") return list.sort((a, b) => b.price - a.price);
  if (sort === "top-rated") {
    return list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  }

  return list.sort((a, b) => {
    const scoreA = a.rating * 10 + a.reviews / 20 + (a.badge ? 5 : 0);
    const scoreB = b.rating * 10 + b.reviews / 20 + (b.badge ? 5 : 0);
    return scoreB - scoreA;
  });
}

function dedupeProducts(products: Product[]): Product[] {
  const seen = new Set<string>();

  return products.filter((product) => {
    if (seen.has(product.slug)) return false;
    seen.add(product.slug);
    return true;
  });
}

function buildPlatformCatalogProducts(): Product[] {
  const baseProducts = dedupeProducts([
    ...TRENDING_PRODUCTS,
    ...FLASH_SALE_PRODUCTS,
    ...CATEGORY_PRODUCTS,
    ...getSellerConsumerCatalogProducts(),
    ...SELLER_PRODUCTS,
    ...RELATED_PRODUCTS,
  ]);
  const editions = [
    { slug: "lusaka-ready", label: "Lusaka Ready", priceMultiplier: 1.02, reviewBoost: 14, badge: "Fast Delivery" },
    { slug: "value-pack", label: "Value Pack", priceMultiplier: 0.94, reviewBoost: 27, badge: "Deal" },
    { slug: "premium-pick", label: "Premium Pick", priceMultiplier: 1.12, reviewBoost: 39, badge: "Top Rated" },
  ];

  return dedupeProducts([
    ...baseProducts,
    ...baseProducts.flatMap((product) => {
      const title = product.title ?? product.name ?? titleFromSlug(product.slug);

      return editions.map((edition, index) =>
        normalizeProduct({
          ...product,
          id: `${product.id}-${edition.slug}`,
          slug: `${product.slug}-${edition.slug}`,
          title: `${title} ${edition.label}`,
          name: `${title} ${edition.label}`,
          price: Math.max(25, Math.round(product.price * edition.priceMultiplier)),
          originalPrice: product.originalPrice
            ? Math.round(product.originalPrice * edition.priceMultiplier)
            : Math.round(product.price * edition.priceMultiplier * 1.15),
          reviews: product.reviews + edition.reviewBoost + index,
          rating: Math.min(5, Number((product.rating + index * 0.05).toFixed(1))),
          badge: product.badge ?? edition.badge,
        }),
      );
    }),
  ]);
}

function paginateProducts(
  products: Product[],
  page: number,
  pageSize: number,
): { products: Product[]; pagination: ProductPaginationMeta } {
  const total = products.length;
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, total);

  return {
    products: products.slice(startIndex, endIndex),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages,
      startItem: total ? startIndex + 1 : 0,
      endItem: endIndex,
    },
  };
}

export async function getTrendingProducts(): Promise<Product[]> {
  const backendProducts = await fetchBackendProductCollection("/products/featured", { limit: 10 });
  if (backendProducts) return backendProducts;

  return TRENDING_PRODUCTS;
}

export async function getFlashSaleProducts(): Promise<Product[]> {
  const backendProducts = await fetchBackendProductCollection("/products", {
    limit: 8,
    sort: "price_asc",
  });
  if (backendProducts) return backendProducts;

  return FLASH_SALE_PRODUCTS;
}

export async function getCategoryPageData(
  slug: string,
  options: {
    subcategory?: string;
    filter?: CategoryFilterOption;
    sort?: CategorySortOption;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<CategoryPageData> {
  const backendCategory = getBackendCategoryForSlug(slug);
  const categoryProducts = buildPlatformCatalogProducts().filter((product) => {
    const normalizedCategory =
      product.categoryName?.toLowerCase().replace(/ & /g, " and ").replace(/\s+/g, "-") ?? "";
    return normalizedCategory === slug;
  });

  const activeSubcategory = options.subcategory ?? "all";
  const activeFilter = options.filter ?? "all";
  const activeSort = options.sort ?? "recommended";
  const activePage = options.page ?? 1;
  const activePageSize = options.pageSize ?? 50;
  const backendPriceQuery = getBackendPriceQuery(activeFilter);

  if (backendCategory && activeFilter !== "4-stars") {
    const backendData = await fetchBackendProducts({
      category: backendCategory,
      sort: BACKEND_SORT_BY_CATEGORY_SORT[activeSort],
      page: activePage,
      limit: activePageSize,
      ...backendPriceQuery,
    });

    if (backendData) {
      return {
        slug,
        meta: getCategoryMeta(slug),
        products: backendData.products,
        pagination: backendData.pagination,
      };
    }
  }

  const subcategoryProducts =
    activeSubcategory === "all"
      ? categoryProducts
      : categoryProducts.filter((product) => {
          const normalizedSubcategory =
            product.subcategoryName?.toLowerCase().replace(/ & /g, " and ").replace(/\s+/g, "-") ??
            "";
          return normalizedSubcategory === activeSubcategory;
        });

  const sortedProducts = applySort(applyPriceFilter(subcategoryProducts, activeFilter), activeSort);
  const paginated = paginateProducts(sortedProducts, activePage, activePageSize);

  return {
    slug,
    meta: getCategoryMeta(slug),
    products: paginated.products,
    pagination: paginated.pagination,
  };
}

function normalizeToSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function stableNumber(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  return min + (hash % (max - min + 1));
}

function getCatalogProducts(): Product[] {
  return buildPlatformCatalogProducts();
}

function buildProductDetailFromProduct(product: Product, requestedSlug: string): ProductDetail {
  const title = product.title ?? product.name ?? titleFromSlug(requestedSlug);
  const categoryName = product.categoryName ?? "General";
  const subcategoryName = product.subcategoryName ?? categoryName;
  const categorySlug = normalizeToSlug(categoryName);
  const subcategorySlug = normalizeToSlug(subcategoryName);
  const sellerSlug = `${normalizeToSlug(categoryName)}-market`;
  const skuSeed = String(product.id).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const sku = `ZM-${skuSeed.slice(-8) || "ITEM"}`;
  const mainImage = product.image || PRODUCT_DETAIL_MOCK.images[0];
  const originalPrice =
    product.originalPrice ??
    product.oldPrice ??
    Math.round(product.price * 1.15);
  const reviewCount = Math.max(1, product.reviews);
  const rating = Number((product.rating || 4.6).toFixed(1));
  const brand = title.split(" ")[0] || "Zogular";
  const stock = stableNumber(requestedSlug, 3, 24);

  return {
    ...PRODUCT_DETAIL_MOCK,
    id: product.id,
    slug: requestedSlug,
    title,
    brand,
    category: { name: categoryName, href: `/category/${categorySlug}` },
    subcategory: {
      name: subcategoryName,
      href: `/category/${categorySlug}?subcategory=${subcategorySlug}`,
    },
    sku,
    price: product.price,
    originalPrice,
    rating,
    reviewCount,
    badge: product.badge ?? (product.isNew ? "New" : null),
    seller: {
      ...PRODUCT_DETAIL_MOCK.seller,
      name: `${brand} Storefront`,
      href: `/store/${sellerSlug}`,
    },
    stock,
    shippingText:
      stock <= 5
        ? "Low stock in Lusaka. Order now for faster dispatch."
        : "Ready for delivery between tomorrow and the next business day.",
    images: [mainImage, ...PRODUCT_DETAIL_MOCK.images.filter((image) => image !== mainImage)].slice(0, 4),
    description:
      `${title} is part of Zogular's curated catalog for Zambia shoppers. ` +
      "You get reliable local delivery, verified sellers, and Zogular support from checkout to arrival.",
    specs: [
      { label: "Category", value: categoryName },
      { label: "Subcategory", value: subcategoryName },
      { label: "SKU", value: sku },
      { label: "Shipping", value: "Lusaka priority dispatch" },
    ],
    boxItems: [title, "Receipt & warranty notes", "Packaging and safety inserts"],
  };
}

export async function getProductDetailBySlug(slug: string): Promise<ProductDetail> {
  const normalizedSlug = decodeURIComponent(slug).trim().toLowerCase();
  const backendProductDetail = await fetchBackendProductDetailBySlug(normalizedSlug);
  if (backendProductDetail) return backendProductDetail;

  const sellerProductDetail = getSellerConsumerProductDetailBySlug(normalizedSlug);

  if (sellerProductDetail) return sellerProductDetail;

  const product = getCatalogProducts().find((item) => item.slug.toLowerCase() === normalizedSlug);

  if (!product) {
    // Fallback keeps manual/legacy slugs renderable without breaking product detail navigation.
    return buildProductDetailFromProduct(
      normalizeProduct({
        id: normalizedSlug,
        slug: normalizedSlug,
        title: titleFromSlug(normalizedSlug),
        categoryName: "General",
        price: PRODUCT_DETAIL_MOCK.price,
        rating: 4.6,
        reviews: 1,
        image: PRODUCT_DETAIL_MOCK.images[0],
      }),
      normalizedSlug,
    );
  }

  return buildProductDetailFromProduct(product, normalizedSlug);
}

export async function getSellerProducts(options: { excludeSlug?: string } = {}): Promise<Product[]> {
  return SELLER_PRODUCTS.filter((product) => product.slug !== options.excludeSlug);
}

export async function getRelatedProducts(
  options: { excludeSlug?: string; categoryName?: string } = {},
): Promise<Product[]> {
  if (options.excludeSlug) {
    const currentProduct = await fetchBackendProductDetailBySlug(options.excludeSlug);
    if (currentProduct) {
      const backendRelated = await fetchBackendRelatedProducts(currentProduct.id, 8);
      if (backendRelated) return backendRelated;
    }
  }

  const source = dedupeProducts([...RELATED_PRODUCTS, ...CATEGORY_PRODUCTS, ...TRENDING_PRODUCTS]);
  const normalizedCategory = options.categoryName?.toLowerCase();
  const sameCategory = normalizedCategory
    ? source.filter((product) => product.categoryName?.toLowerCase() === normalizedCategory)
    : source;

  const list = (sameCategory.length ? sameCategory : source).filter(
    (product) => product.slug !== options.excludeSlug,
  );

  return list.slice(0, 8);
}

export async function getSearchableProducts(): Promise<Product[]> {
  const backendData = await fetchBackendProducts({
    page: 1,
    limit: 100,
    sort: "newest",
  });
  if (backendData?.products.length) return backendData.products;

  return getCatalogProducts();
}

export async function getAllProductsPageData(
  options: {
    filter?: CategoryFilterOption;
    sort?: CategorySortOption;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{ products: Product[]; pagination: ProductPaginationMeta }> {
  const activeFilter = options.filter ?? "all";
  const activeSort = options.sort ?? "recommended";
  const activePage = options.page ?? 1;
  const activePageSize = options.pageSize ?? 50;
  const backendPriceQuery = getBackendPriceQuery(activeFilter);

  if (activeFilter !== "4-stars") {
    const backendData = await fetchBackendProducts({
      page: activePage,
      limit: activePageSize,
      sort: BACKEND_SORT_BY_CATEGORY_SORT[activeSort],
      ...backendPriceQuery,
    });
    if (backendData) return backendData;
  }

  const products = applySort(applyPriceFilter(getCatalogProducts(), activeFilter), activeSort);

  return paginateProducts(products, activePage, activePageSize);
}
