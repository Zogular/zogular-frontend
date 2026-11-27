/**
 * @file page.tsx
 * @description
 * Thin route orchestrator for customer detail inspection (/admin/buyers/[id]).
 * Extracts route param and renders the modular BuyerDetail section.
 */

"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { BuyerDetail } from "@/features/admin-buyers/sections/BuyerDetail";

export default function AdminBuyerDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl min-w-0 space-y-6 pb-12">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-40 animate-pulse rounded-3xl bg-zinc-100" />
        </div>
      }
    >
      <BuyerDetail id={id} />
    </Suspense>
  );
}
