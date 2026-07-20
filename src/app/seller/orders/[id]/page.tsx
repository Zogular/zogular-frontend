"use client";

import { use } from "react";
import { SellerOrderDetailView } from "@/features/seller-orders/components/seller-order-detail";

export default function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SellerOrderDetailView orderId={id} />;
}
