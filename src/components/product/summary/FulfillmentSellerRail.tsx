import Link from "next/link";
import { Store, Truck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ProductDetail } from "@/types/product";

function sellerInitials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "S"
  );
}

function SellerContent({ seller, compact }: { seller: NonNullable<ProductDetail["seller"]>; compact: boolean }) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-3" data-testid="product-seller-identity">
        <Avatar className={compact ? "h-9 w-9 border border-zinc-100" : "h-12 w-12 border-2 border-[#f4fbf6] shadow-sm"}>
          <AvatarFallback className="text-xs font-semibold">{sellerInitials(seller.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {compact ? <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Sold by</p> : null}
          <p className="truncate text-sm font-bold text-zinc-900 transition-colors group-hover:text-[#009E49]">
            {seller.name}
          </p>
        </div>
      </div>
      {seller.href ? <Store className="h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-[#009E49]" /> : null}
    </>
  );
}

export function FulfillmentSellerRail({
  productData,
  variant,
  className = "",
}: {
  productData: ProductDetail;
  variant: "stacked" | "rail";
  className?: string;
}) {
  const deliveryText = productData.shippingText || "Delivery options and exact availability are confirmed at checkout.";

  if (variant === "stacked") {
    return (
      <div className={`grid grid-cols-1 gap-3 ${className}`}>
        <div className="flex items-start gap-3 rounded-2xl border border-zinc-100 bg-white/80 p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="mt-0.5 rounded-full bg-[#f4fbf6] p-2">
            <Truck className="h-5 w-5 text-[#009E49]" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-900">Doorstep Delivery</h4>
            <p className="mt-1 text-xs text-zinc-500">{deliveryText}</p>
          </div>
        </div>

        {productData.seller ? (
          productData.seller.href ? (
            <Link href={productData.seller.href} className="group flex items-center justify-between rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm transition-all hover:border-[#009E49]/30 hover:shadow-md">
              <SellerContent seller={productData.seller} compact={false} />
            </Link>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
              <SellerContent seller={productData.seller} compact={false} />
            </div>
          )
        ) : null}
      </div>
    );
  }

  return (
    <section className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white ${className}`} aria-label="Fulfillment and seller">
      <div className="p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
          <Truck className="h-4 w-4 text-[#009E49]" />
          Fulfillment
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">{deliveryText}</p>
      </div>
      {productData.seller ? (
        <div className="border-t border-zinc-100 p-4">
          {productData.seller.href ? (
            <Link href={productData.seller.href} className="group flex items-center justify-between gap-3">
              <SellerContent seller={productData.seller} compact />
            </Link>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <SellerContent seller={productData.seller} compact />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
