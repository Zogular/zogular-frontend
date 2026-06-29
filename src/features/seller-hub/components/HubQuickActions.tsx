"use client";

import Link from "next/link";
import { Package, Plus, Search, Store } from "lucide-react";
import { hasSellerCapability } from "@/services/vendor-application";
import type { VendorApplication } from "@/types/seller";

export function HubQuickActions({ application }: { application: VendorApplication }) {
  const canCreateDraft = hasSellerCapability(application.status, "canCreateDraftProduct");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {canCreateDraft ? (
        <Link href="/seller/products/new" className="flex flex-col items-center justify-center rounded-2xl border border-[#009E49]/20 bg-[#009E49]/10 p-4 text-center transition-all hover:bg-[#009E49]/20">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#009E49] text-white shadow-sm">
            <Plus className="h-5 w-5" />
          </div>
          <p className="text-xs font-black text-[#009E49]">New Product</p>
        </Link>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-center opacity-70">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-zinc-500">
            <Plus className="h-5 w-5" />
          </div>
          <p className="text-xs font-black text-zinc-500">New Product</p>
        </div>
      )}

      <Link href="/seller/products" className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm transition-all hover:border-zinc-300 hover:shadow">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Package className="h-5 w-5" />
        </div>
        <p className="text-xs font-black text-zinc-900">Products</p>
      </Link>

      <Link href="/seller/status" className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm transition-all hover:border-zinc-300 hover:shadow">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Search className="h-5 w-5" />
        </div>
        <p className="text-xs font-black text-zinc-900">Seller Status</p>
      </Link>

      <Link href="/" className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm transition-all hover:border-zinc-300 hover:shadow">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600">
          <Store className="h-5 w-5" />
        </div>
        <p className="text-xs font-black text-zinc-900">Storefront</p>
      </Link>
    </div>
  );
}
