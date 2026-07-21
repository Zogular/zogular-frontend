"use client";

import * as React from "react";
import Link from "next/link";
import { toProductFromDetail } from "@/lib/normalizers/product";
import { ProductImageGallery } from "./gallery/ProductImageGallery";
import { ProductPurchaseSummary } from "./summary/ProductPurchaseSummary";
import { MobileStickyPurchaseBar } from "./summary/MobileStickyPurchaseBar";
import { ProductInfoSections } from "./information/ProductInfoSections";
import { ProductRatingsSummary } from "./ratings/ProductRatingsSummary";
import { RelatedSection } from "./recommendations/RelatedSection";
import type { Product, ProductDetail } from "@/types/product";

interface ProductDetailsClientProps {
  productData: ProductDetail;
  sellerProducts: Product[];
  relatedProducts: Product[];
}

export function ProductDetailsClient({
  productData,
  sellerProducts,
  relatedProducts,
}: ProductDetailsClientProps) {
  const [selectedVariantId, setSelectedVariantId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);

  React.useEffect(() => {
    setSelectedVariantId(productData.variants[0]?.id ?? "");
    setQuantity(1);
  }, [productData]);

  const wishlistProduct = toProductFromDetail(productData);
  const selectedVariant = productData.variants.length > 0 
    ? (productData.variants.find((variant) => variant.id === selectedVariantId) ?? productData.variants[0])
    : undefined;

  const decrementQuantity = () => setQuantity((prev) => Math.max(1, prev - 1));
  const incrementQuantity = () =>
    setQuantity((prev) => (productData.stock > 0 ? Math.min(productData.stock, prev + 1) : prev));

  return (
    <main className="min-h-screen bg-[#f4fbf6] pb-28 md:pb-12">
      <div className="container mx-auto max-w-7xl px-0 md:px-6 md:pt-8">
        <div className="mb-6 hidden animate-in items-center gap-2 text-sm text-zinc-500 fade-in duration-500 md:flex">
          <Link href="/" className="transition-colors hover:text-[#009E49]">Home</Link>
          <span className="text-zinc-300">/</span>
          <Link href={productData.category.href} className="transition-colors hover:text-[#009E49]">{productData.category.name}</Link>
          <span className="text-zinc-300">/</span>
          <Link href={productData.subcategory.href} className="transition-colors hover:text-[#009E49]">{productData.subcategory.name}</Link>
          <span className="text-zinc-300">/</span>
          <span className="font-medium text-zinc-900">{productData.title}</span>
        </div>

        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div className="relative w-full animate-in fade-in slide-in-from-left-8 duration-700">
            <ProductImageGallery
              images={productData.images}
              title={productData.title}
              badge={productData.badge}
              wishlistProduct={wishlistProduct}
            />
          </div>

          <div className="flex flex-col space-y-6 px-4 pb-8 pt-5 md:px-0 md:pt-0">
            <ProductPurchaseSummary
              productData={productData}
              selectedVariant={selectedVariant}
              selectedVariantId={selectedVariantId}
              setSelectedVariantId={setSelectedVariantId}
              quantity={quantity}
              incrementQuantity={incrementQuantity}
              decrementQuantity={decrementQuantity}
              wishlistProduct={wishlistProduct}
            />
            <ProductInfoSections productData={productData} />
          </div>
        </div>

        <div className="mt-8 space-y-12 px-4 md:px-0">
          <ProductRatingsSummary productData={productData} />
          <RelatedSection title={`More from ${productData.seller.name}`} href={productData.seller.href} linkLabel="View Store" products={sellerProducts} />
          <RelatedSection title="You might also like" products={relatedProducts} />
        </div>
      </div>

      <MobileStickyPurchaseBar
        productData={productData}
        selectedVariant={selectedVariant}
        quantity={quantity}
        incrementQuantity={incrementQuantity}
        decrementQuantity={decrementQuantity}
        wishlistProduct={wishlistProduct}
      />
    </main>
  );
}
