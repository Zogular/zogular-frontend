/**
 * @file page.tsx
 * @description
 * Thin route orchestrator for customer detail inspection (/admin/buyers/[id]).
 * Extracts route param and renders the modular BuyerDetail section.
 */

"use client";

import { Suspense, use } from "react";
import { useParams } from "next/navigation";
import { BuyerDetail } from "@/features/admin-buyers/sections/BuyerDetail";

interface PageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default function AdminBuyerDetailPage({ params }: PageProps) {
  const urlParams = useParams<{ id: string }>();
  let id = urlParams?.id;

  if (!id && params) {
    if (params instanceof Promise) {
      id = use(params).id;
    } else {
      id = params.id;
    }
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl min-w-0 space-y-6 pb-12">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-zinc-200" />
          <div className="h-40 animate-pulse rounded-3xl bg-zinc-100" />
        </div>
      }
    >
      <BuyerDetail id={id ?? ""} />
    </Suspense>
  );
}
