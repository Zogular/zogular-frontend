import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Store, Truck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddToCartButton } from "@/components/AddToCartButton";
import { QuantitySelector } from "./QuantitySelector";
import type { Product, ProductDetail } from "@/types/product";

export function formatCurrency(value: number) {
  return `K${value.toLocaleString()}`;
}

export function getStockMeta(stock: number) {
  if (stock <= 0) return { label: "Out of Stock", className: "text-red-600 bg-red-50 border-red-200" };
  if (stock <= 5) return { label: `Only ${stock} left`, className: "text-[#FF6B00] bg-orange-50 border-orange-200" };
  return { label: "In Stock", className: "text-[#009E49] bg-[#009E49]/10 border-[#009E49]/20" };
}

export function ProductPurchaseSummary({
  productData,
  selectedVariant,
  selectedVariantId,
  setSelectedVariantId,
  quantity,
  incrementQuantity,
  decrementQuantity,
  wishlistProduct,
}: {
  productData: ProductDetail;
  selectedVariant?: { id: string; label: string; value: string; swatchClass: string };
  selectedVariantId: string;
  setSelectedVariantId: (id: string) => void;
  quantity: number;
  incrementQuantity: () => void;
  decrementQuantity: () => void;
  wishlistProduct: Product;
}) {
  const stockMeta = getStockMeta(productData.stock);
  const brandLabel = productData.brand === "Zogular" ? "Verified listing" : `Brand: ${productData.brand}`;
  const hasDiscount = productData.originalPrice > productData.price;

  return (
    <>
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
    </>
  );
}
