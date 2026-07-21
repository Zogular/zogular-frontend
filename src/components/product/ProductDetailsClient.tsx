"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, CheckCircle2, Minus, Plus, Share2, ShieldCheck, Star, Store, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { ProductCard } from "@/components/productCard";
import { WishlistButton } from "@/components/WishlistButton";
import { ProductImageUnavailable } from "@/components/product/ProductImageUnavailable";
import { AddToCartButton } from "@/components/AddToCartButton";
import { toProductFromDetail } from "@/lib/normalizers/product";
import type { Product, ProductDetail } from "@/types/product";

function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

function getStockMeta(stock: number) {
  if (stock <= 0) return { label: "Out of Stock", className: "text-red-600 bg-red-50 border-red-200" };
  if (stock <= 5) return { label: `Only ${stock} left`, className: "text-[#FF6B00] bg-orange-50 border-orange-200" };
  return { label: "In Stock", className: "text-[#009E49] bg-[#009E49]/10 border-[#009E49]/20" };
}

function QuantitySelector({
  value,
  onDecrease,
  onIncrease,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex h-12 items-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button type="button" onClick={onDecrease} title="Decrease quantity" aria-label="Decrease quantity" className="flex h-full w-12 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900">
        <Minus className="h-4 w-4" />
      </button>
      <div className="flex h-full min-w-12 items-center justify-center text-sm font-bold text-zinc-900">{value}</div>
      <button type="button" onClick={onIncrease} title="Increase quantity" aria-label="Increase quantity" className="flex h-full w-12 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-900">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function ProductImageGallery({
  images,
  title,
  badge,
  wishlistProduct,
}: {
  images: string[];
  title: string;
  badge: string | null;
  wishlistProduct: Product;
}) {
  const [activeImage, setActiveImage] = React.useState(images[0]);
  const router = useRouter();

  React.useEffect(() => {
    setActiveImage(images[0]);
  }, [images]);

  return (
    <div className="space-y-4 md:sticky md:top-25 group">
      <div className="md:hidden">
        <div className="space-y-3">
          <div className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-zinc-50">
            <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2">
              <Button onClick={() => router.back()} variant="ghost" size="icon" title="Go back" aria-label="Go back" className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 text-zinc-900 shadow-sm backdrop-blur-md hover:bg-white">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              {badge ? (
                <Badge className="pointer-events-auto border-none bg-[#FF6B00] px-3 py-1 text-[10px] uppercase tracking-widest shadow-md">
                  {badge}
                </Badge>
              ) : null}
            </div>
            <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col gap-2">
              <WishlistButton
                product={wishlistProduct}
                className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-red-500"
                iconClassName="h-4 w-4"
              />
              <Button size="icon" title="Share product" aria-label="Share product" className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-zinc-900">
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
            {activeImage === "/file.svg" ? <ProductImageUnavailable /> : <Image
              src={activeImage}
              alt={title}
              fill
              sizes="100vw"
              unoptimized
              className="object-contain"
            />}
          </div>
          <div className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                onClick={() => setActiveImage(src)}
                title={`Preview image ${index + 1}`}
                aria-label={`Preview image ${index + 1}`}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${activeImage === src ? "border-[#009E49] shadow-md" : "border-zinc-200 bg-zinc-50 opacity-80"}`}
              >
                {src === "/file.svg" ? <ProductImageUnavailable compact /> : <Image
                  src={src}
                  alt={`${title} thumbnail ${index + 1}`}
                  fill
                  sizes="64px"
                  unoptimized
                  className="object-cover"
                />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden md:block relative aspect-[3/4] max-h-[800px] w-full overflow-hidden rounded-3xl border border-zinc-200/50 bg-zinc-50 shadow-sm">
        <div className="pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2">
          {badge ? (
            <Badge className="pointer-events-auto border-none bg-[#FF6B00] px-3 py-1 text-[10px] uppercase tracking-widest shadow-md">
              {badge}
            </Badge>
          ) : null}
        </div>
        <div className="pointer-events-none absolute right-4 top-4 z-30 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <WishlistButton
            product={wishlistProduct}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-red-500"
            iconClassName="h-4 w-4"
          />
          <Button size="icon" title="Share product" aria-label="Share product" className="pointer-events-auto rounded-full bg-white/80 text-zinc-600 shadow-sm backdrop-blur-md hover:bg-white hover:text-zinc-900">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        {activeImage === "/file.svg" ? <ProductImageUnavailable /> : <Image
          src={activeImage}
          alt={title}
          fill
          sizes="(min-width: 768px) 700px, 100vw"
          unoptimized
          className="object-contain transition-transform duration-700 hover:scale-[1.03]"
        />}
      </div>

      <div className="hidden grid-cols-4 gap-4 md:grid">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setActiveImage(src)}
            title={`Preview image ${index + 1}`}
            aria-label={`Preview image ${index + 1}`}
            className={`aspect-square overflow-hidden rounded-xl border-2 transition-all ${activeImage === src ? "scale-[1.03] border-[#009E49] shadow-md" : "border-transparent bg-zinc-50 opacity-70 hover:border-zinc-300 hover:opacity-100"}`}
          >
            {src === "/file.svg" ? <ProductImageUnavailable compact /> : <Image
              src={src}
              alt={`${title} thumbnail ${index + 1}`}
              width={160}
              height={160}
              unoptimized
              className="h-full w-full object-contain"
            />}
          </button>
        ))}
      </div>
    </div>
  );
}

function RelatedSection({
  title,
  href,
  linkLabel,
  products,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  products: Product[];
}) {
  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
        {href && linkLabel ? (
          <Link href={href} className="text-sm font-bold text-[#009E49] hover:underline">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

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
  const stockMeta = getStockMeta(productData.stock);
  const brandLabel = productData.brand === "Zogular" ? "Verified listing" : `Brand: ${productData.brand}`;
  const hasDiscount = productData.originalPrice > productData.price;
  const ratingBreakdownRows = [5, 4, 3, 2, 1].map((stars) => ({ stars, pct: 0, count: 0 }));

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
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 [animation-delay:100ms]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-[#009E49]/30 bg-[#009E49]/5 text-[#009E49]">{brandLabel}</Badge>
                <span className="text-xs font-medium text-zinc-400">SKU: {productData.sku}</span>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${stockMeta.className}`}>{stockMeta.label}</span>
              </div>
              <h1 className="text-2xl font-bold leading-tight text-zinc-900 md:text-3xl lg:text-4xl">{productData.title}</h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 shadow-sm">
                  <Star className="h-3.5 w-3.5 fill-[#FF6B00] text-[#FF6B00]" />
                  <span className="text-sm font-bold text-zinc-900">{productData.rating}</span>
                </div>
                <button className="cursor-pointer text-sm text-zinc-500 underline decoration-dotted underline-offset-4 transition-colors hover:text-zinc-800">
                  Read {productData.reviewCount} Reviews
                </button>
              </div>
              <div className="pt-2">
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-extrabold tracking-tight text-[#009E49] md:text-4xl">{formatCurrency(productData.price)}</span>
                  {hasDiscount ? (
                    <div className="flex flex-col pb-1">
                      <span className="text-sm text-zinc-400 line-through">{formatCurrency(productData.originalPrice)}</span>
                      <span className="text-xs font-bold text-red-500">
                        Save {formatCurrency(productData.originalPrice - productData.price)} ({Math.round(((productData.originalPrice - productData.price) / productData.originalPrice) * 100)}%)
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {productData.variants.length > 0 && selectedVariant ? (
              <>
                <Separator className="bg-zinc-200/60 animate-in fade-in duration-500 [animation-delay:200ms]" />

                <div className="rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 [animation-delay:300ms]">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-900">{selectedVariant.label}: <span className="font-normal text-zinc-600">{selectedVariant.value}</span></h3>
                  </div>
                  <div className="flex gap-3">
                    {productData.variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`h-14 w-14 rounded-xl border-2 ring-4 ring-white shadow-sm transition-all hover:scale-[1.03] ${selectedVariantId === variant.id ? variant.swatchClass : variant.swatchClass.replace("border-[#FF6B00]", "border-zinc-200 opacity-70")}`}
                        title={variant.value}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            <div className="hidden grid-cols-[120px_1fr] gap-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 [animation-delay:350ms] md:grid">
              <QuantitySelector value={quantity} onDecrease={decrementQuantity} onIncrease={incrementQuantity} />
              <AddToCartButton
                product={wishlistProduct}
                quantity={quantity}
                variant={selectedVariant?.value}
                className="h-12 rounded-2xl bg-[#FF6B00] text-base font-bold text-white shadow-lg shadow-[#FF6B00]/25 transition-all hover:-translate-y-0.5 hover:bg-[#e66000]"
              />
            </div>

            <div className="hidden flex-col gap-2 pt-1 md:flex">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                <ShieldCheck className="h-4 w-4 text-[#009E49]" /> COD checkout with backend-reviewed totals
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 [animation-delay:500ms]">
              <div className="flex items-start gap-3 rounded-2xl border border-zinc-100 bg-white/80 p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="mt-0.5 rounded-full bg-[#f4fbf6] p-2">
                  <Truck className="h-5 w-5 text-[#009E49]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900">Doorstep Delivery</h4>
                  <p className="mt-1 text-xs text-zinc-500">{productData.shippingText}</p>
                </div>
              </div>

              <Link href={productData.seller.href} className="group flex items-center justify-between rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:border-[#009E49]/30 hover:shadow-md">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-[#f4fbf6] shadow-sm">
                    <AvatarImage src={productData.seller.avatar} />
                    <AvatarFallback>iS</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-zinc-900 transition-colors group-hover:text-[#009E49]">{productData.seller.name}</h4>
                      {productData.seller.verified ? <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" /> : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                      <span>{productData.seller.positiveRate}</span>
                      <span className="h-1 w-1 rounded-full bg-zinc-300" />
                      <span>{productData.seller.followers}</span>
                    </div>
                  </div>
                </div>
                <Store className="h-5 w-5 text-zinc-300 transition-all group-hover:scale-110 group-hover:text-[#009E49]" />
              </Link>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 [animation-delay:600ms]">
              <Accordion type="single" collapsible className="w-full" defaultValue="description">
                <AccordionItem value="description" className="border-b-zinc-100 px-4">
                  <AccordionTrigger className="py-4 text-sm font-bold text-zinc-900 hover:no-underline">Product Description</AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm leading-relaxed text-zinc-600">{productData.description}</AccordionContent>
                </AccordionItem>
                <AccordionItem value="specs" className="border-b-zinc-100 px-4">
                  <AccordionTrigger className="py-4 text-sm font-bold text-zinc-900 hover:no-underline">Specifications</AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm text-zinc-600">
                    <div className="grid grid-cols-1 gap-2">
                      {productData.specs.map((spec) => (
                        <div key={spec.label} className="flex justify-between border-b border-zinc-50/50 py-2">
                          <span className="text-zinc-500">{spec.label}</span>
                          <span className="text-right font-medium text-zinc-900">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="box" className="border-b-0 px-4">
                  <AccordionTrigger className="py-4 text-sm font-bold text-zinc-900 hover:no-underline">What&apos;s in the Box</AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm text-zinc-600">
                    <ul className="list-disc space-y-1.5 pl-5 marker:text-[#009E49]">
                      {productData.boxItems.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-12 px-4 md:px-0">
          <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm md:p-8">
            <h2 className="mb-6 text-xl font-bold text-zinc-900">Ratings & Reviews</h2>
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_2fr]">
              <div className="flex flex-col items-center justify-center space-y-2 text-center">
                <div className="flex items-baseline gap-1">
                  <span className="text-6xl font-extrabold tracking-tighter text-zinc-900 md:text-7xl">{productData.rating}</span>
                  <span className="text-2xl font-medium text-zinc-400">/ 5</span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${star <= Math.round(productData.rating) ? "fill-[#FF6B00] text-[#FF6B00]" : "fill-zinc-100 text-zinc-300"}`}
                    />
                  ))}
                </div>
                <span className="mt-2 text-sm text-zinc-500">({productData.reviewCount} Verified Ratings)</span>
              </div>
              <div className="space-y-3">
                {productData.reviewCount > 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 p-4 text-sm font-medium text-zinc-500">
                    Detailed rating breakdown is not available yet.
                  </div>
                ) : (
                  ratingBreakdownRows.map((row) => (
                    <div key={row.stars} className="flex items-center gap-4">
                      <div className="flex w-12 shrink-0 items-center justify-end gap-1">
                        <span className="text-sm font-bold text-zinc-700">{row.stars}</span>
                        <Star className="h-3 w-3 fill-zinc-400 text-zinc-400" />
                      </div>
                      <Progress value={row.pct} className="h-2.5 flex-1 bg-zinc-100 [&>div]:bg-[#009E49]" />
                      <span className="w-8 text-xs font-medium text-zinc-500">{row.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <RelatedSection title={`More from ${productData.seller.name}`} href={productData.seller.href} linkLabel="View Store" products={sellerProducts} />
          <RelatedSection title="You might also like" products={relatedProducts} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-zinc-200/50 bg-white/85 p-4 shadow-[0_-15px_40px_rgba(0,0,0,0.08)] backdrop-blur-2xl md:hidden">
        <div className="flex items-center gap-3">
          <Link href={productData.seller.href}>
            <Button variant="outline" title="Visit store" aria-label="Visit store" className="h-12 w-12 shrink-0 rounded-2xl border-zinc-300 bg-white/50 shadow-sm backdrop-blur-md">
              <Store className="h-5 w-5 text-zinc-600" />
            </Button>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <QuantitySelector value={quantity} onDecrease={decrementQuantity} onIncrease={incrementQuantity} />
            <AddToCartButton
              product={wishlistProduct}
              quantity={quantity}
              variant={selectedVariant?.value}
              className="h-12 flex-1 rounded-2xl bg-[#FF6B00] text-base font-bold text-white shadow-xl shadow-[#FF6B00]/30 transition-all hover:bg-[#e66000] active:scale-95"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
