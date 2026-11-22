/**
 * @file page.tsx
 * @module app/admin/(protected)/products
 * @description
 * Thin route orchestrator for `/admin/products`.
 * Delegates all bounded server-paged queue logic to `AdminProductsWorkspace`.
 */

import { Suspense } from "react";
import { AdminProductsWorkspace } from "@/features/admin-products/components/AdminProductsWorkspace";

export default function AdminProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[88rem] space-y-4 pb-10">
          <div className="h-10 w-64 animate-pulse rounded-xl bg-zinc-200/70" />
          <div className="h-20 animate-pulse rounded-2xl bg-zinc-200/70" />
          <div className="h-80 animate-pulse rounded-3xl bg-zinc-200/70" />
        </div>
      }
    >
      <AdminProductsWorkspace />
    </Suspense>
  );
}
