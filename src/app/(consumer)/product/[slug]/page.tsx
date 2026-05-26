import type { Metadata } from "next";
import { ProductDetailsClient } from "@/components/product/ProductDetailsClient";
import { getProductDetailBySlug, getRelatedProducts, getSellerProducts } from "@/services/products";

interface ProductDetailsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);

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
  const [sellerProducts, relatedProducts] = await Promise.all([
    getSellerProducts({ excludeSlug: productData.slug }),
    getRelatedProducts({
      excludeSlug: productData.slug,
      categoryName: productData.category.name,
    }),
  ]);

  return (
    <ProductDetailsClient
      productData={productData}
      sellerProducts={sellerProducts}
      relatedProducts={relatedProducts}
    />
  );
}
