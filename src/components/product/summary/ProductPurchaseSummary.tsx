import * as React from "react";
import { ShieldCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AddToCartButton } from "@/components/AddToCartButton";
import { FulfillmentSellerRail } from "./FulfillmentSellerRail";
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
  const isUnavailable = productData.stock <= 0;
  const brandLabel = productData.brand ? `Brand: ${productData.brand}` : null;
  const hasDiscount = productData.originalPrice > productData.price;

  return (
    <>
      <div className="space-y-2 md:space-y-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 [animation-delay:100ms]">
        <div className="flex flex-wrap items-center gap-1 md:gap-2">
          {brandLabel ? (
            <Badge variant="outline" className="h-5 rounded-md border-[#009E49]/30 bg-[#009E49]/5 px-1.5 text-[10px] text-[#009E49] md:h-auto md:rounded-full md:px-2.5 md:text-xs">
              {brandLabel}
            </Badge>
          ) : null}
          {productData.condition ? (
            <Badge variant="secondary" className="h-5 rounded-md bg-zinc-100 px-1.5 text-[10px] text-zinc-800 hover:bg-zinc-200 md:h-auto md:rounded-full md:px-2.5 md:text-xs">
              {productData.condition}
            </Badge>
          ) : null}
          {productData.sku ? (
            <span className="hidden md:inline text-xs font-medium text-zinc-400">SKU: {productData.sku}</span>
          ) : null}
          <span className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-bold md:h-auto md:rounded-full md:px-2.5 md:py-1 md:text-[11px] ${stockMeta.className}`}>
            {stockMeta.label}
          </span>
        </div>
        <h1 className="text-xl font-bold leading-[1.2] text-zinc-900 md:text-3xl md:leading-tight lg:text-[32px]">
          {productData.title}
        </h1>
        {productData.reviewCount > 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2 py-1 shadow-sm">
              <Star className="h-3.5 w-3.5 fill-[#FF6B00] text-[#FF6B00]" />
              <span className="text-sm font-bold text-zinc-900">{productData.rating}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("product-reviews")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="cursor-pointer text-sm text-zinc-500 underline decoration-dotted underline-offset-4 transition-colors hover:text-zinc-800"
            >
              Read {productData.reviewCount} Reviews
            </button>
          </div>
        ) : null}
        <div className="pt-2">
          <div className="flex items-end gap-3">
            <span className="text-[25px] font-extrabold leading-none tracking-tight text-[#009E49] md:text-[34px] md:leading-none">
              {formatCurrency(productData.price)}
            </span>
            {hasDiscount ? (
              <div className="flex flex-col pb-1">
                <span className="text-sm text-zinc-400 line-through">
                  {formatCurrency(productData.originalPrice)}
                </span>
                <span className="text-xs font-bold text-red-500">
                  Save {formatCurrency(productData.originalPrice - productData.price)} (
                  {Math.round(
                    ((productData.originalPrice - productData.price) /
                      productData.originalPrice) *
                      100,
                  )}
                  %)
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
              <h3 className="text-sm font-semibold text-zinc-900">
                {selectedVariant.label}:{" "}
                <span className="font-normal text-zinc-600">{selectedVariant.value}</span>
              </h3>
            </div>
            <div className="flex gap-3">
              {productData.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedVariantId(variant.id)}
                  className={`h-14 w-14 rounded-xl border-2 ring-4 ring-white shadow-sm transition-all hover:scale-[1.03] ${
                    selectedVariantId === variant.id
                      ? variant.swatchClass
                      : variant.swatchClass.replace("border-[#FF6B00]", "border-zinc-200 opacity-70")
                  }`}
                  title={variant.value}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="hidden grid-cols-[120px_1fr] gap-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 [animation-delay:350ms] md:grid">
        <QuantitySelector
          value={quantity}
          max={productData.stock}
          disabled={isUnavailable}
          onDecrease={decrementQuantity}
          onIncrease={incrementQuantity}
        />
        <AddToCartButton
          product={wishlistProduct}
          quantity={quantity}
          variant={selectedVariant?.value}
          disabled={isUnavailable}
          className="h-10 md:h-12 rounded-2xl bg-[#FF6B00] text-base font-bold text-white shadow-lg shadow-[#FF6B00]/25 transition-all hover:-translate-y-0.5 hover:bg-[#e66000]"
        />
      </div>

      <div className="hidden flex-col gap-2 pt-1 md:flex">
        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
          <ShieldCheck className="h-4 w-4 text-[#009E49]" /> Cash on delivery. Final charges are confirmed at checkout.
        </div>
      </div>

      <FulfillmentSellerRail productData={productData} variant="stacked" className="xl:hidden" />
    </>
  );
}
