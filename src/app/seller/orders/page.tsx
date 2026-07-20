"use client";

import { Suspense } from "react";
import { SellerOrdersCollection } from "@/features/seller-orders/components/seller-orders-collection";

function OrdersRouteFallback() {
  return (
    <div className="mx-auto max-w-350 space-y-4" aria-label="Loading seller orders" role="status">
      <div className="h-16 w-64 animate-pulse rounded-xl bg-zinc-100" />
      <div className="h-28 animate-pulse rounded-2xl border border-zinc-100 bg-white" />
      <div className="h-96 animate-pulse rounded-2xl border border-zinc-100 bg-white" />
    </div>
  );
}

export default function SellerOrdersPage() {
  return (
    <Suspense fallback={<OrdersRouteFallback />}>
      <SellerOrdersCollection />
    </Suspense>
  );
}
