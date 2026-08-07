export interface Product {
  id: number | string;
  slug: string;
  title?: string;
  name?: string;
  categoryName?: string;
  categorySlug?: string;
  subcategoryName?: string;
  subcategorySlug?: string;
  price: number;
  oldPrice?: number | null;
  originalPrice?: number | null;
  discount?: number | null;
  badge?: string | null;
  isNew?: boolean;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  stock?: number;
  moderationStatus?: "approved" | "pending" | "rejected";
  sellerVisibility?: "visible" | "hidden";
  storeName?: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  value: string;
  swatchClass: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductSeller {
  name: string;
  href?: string;
  avatar?: string;
  verified?: boolean;
  positiveRate?: string;
  followers?: string;
}

export interface ProductDetail {
  id: number | string;
  slug: string;
  title: string;
  brand?: string;
  category: { name: string; href: string };
  subcategory: { name: string; href: string };
  sku?: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewCount: number;
  badge?: string | null;
  seller?: ProductSeller;
  condition?: string;
  stock: number;
  shippingText?: string;
  images: string[];
  variants: ProductVariant[];
  description: string;
  specs: ProductSpec[];
  boxItems: string[];
}

export type ProductInput = Partial<Product> & {
  id: number | string;
  slug: string;
  price: number;
  image: string;
};
