import type { Metadata } from "next";
import { cache } from "react";
import { publicMetadata, searchLabel, safeSlug, unlisted, type SearchProps } from "@/lib/seo/public-search";
import { notFound } from "next/navigation";
import { ProductDetailsClient } from "@/components/product/ProductDetailsClient";
import { getProductDetailBySlug, getRelatedProducts } from "@/services/products";

export const dynamic = "force-dynamic";

interface ProductDetailsPageProps extends SearchProps {
  params: Promise<{ slug: string }>;
}

const productForRequest = cache(getProductDetailBySlug);

export async function generateMetadata({ params, searchParams }: ProductDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!safeSlug(slug)) return unlisted;
  const product = await productForRequest(slug);
  const label = product && product.slug === slug && searchLabel(product.title);
  return label ? publicMetadata("/product/" + slug, label, "View the " + label + " listing on Zogular, Zambia's online marketplace.", await searchParams) : unlisted;
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { slug } = await params;
  const productData = await productForRequest(slug);

  if (!productData) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts({
    productId: productData.id,
    excludeSlug: productData.slug,
  });

  return (
    <div data-nosnippet="">
      <ProductDetailsClient productData={productData} relatedProducts={relatedProducts} />
    </div>
  );
}
