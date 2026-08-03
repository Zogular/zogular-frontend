import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailsClient } from "@/components/product/ProductDetailsClient";
import { getProductDetailBySlug, getRelatedProducts } from "@/services/products";

export const dynamic = "force-dynamic";

interface ProductDetailsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  let product = null;
  try {
    product = await getProductDetailBySlug(slug);
  } catch {
    // Allow error to be handled by the page component and error.tsx
  }

  if (!product) return {};

  return {
    title: `${product.title} | Zogular`,
    description: product.description,
    openGraph: {
      title: `${product.title} | Zogular`,
      description: product.description,
      images: product.images.slice(0, 1),
    },
  };
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { slug } = await params;
  const productData = await getProductDetailBySlug(slug);

  if (!productData) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts({
    excludeSlug: productData.slug,
    categoryName: productData.category.name,
  });

  return (
    <ProductDetailsClient
      productData={productData}
      relatedProducts={relatedProducts}
    />
  );
}
