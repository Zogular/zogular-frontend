/**
 * @file page.tsx
 * @description
 * Thin route orchestrator for the Admin Customers list (/admin/buyers).
 * Composes the modular AdminBuyersWorkspace wrapped with Suspense.
 */

"use client";

import { Suspense } from "react";
import { AdminBuyersWorkspace } from "@/features/admin-buyers/components/AdminBuyersWorkspace";

export default function AdminBuyersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[96rem] space-y-4 p-6">
          <div className="h-8 w-48 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-20 w-full animate-pulse rounded-2xl bg-zinc-100" />
        </div>
      }
    >
      <AdminBuyersWorkspace />
    </Suspense>
  );
}
