"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Heart, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/productCard";
import { FeedbackState } from "@/components/states/FeedbackState";
import { useWishlist } from "@/hooks/use-wishlist";

export default function SavedItemsPage() {
  const { items, hasHydrated, isSyncing, syncError, syncBackend } = useWishlist();
  const [search, setSearch] = React.useState("");

  const filteredItems = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((product) => {
      const title = (product.title ?? product.name ?? "").toLowerCase();
      const badge = (product.badge ?? "").toLowerCase();
      return title.includes(query) || badge.includes(query);
    });
  }, [items, search]);

  if (!hasHydrated || (isSyncing && items.length === 0)) {
    return <div className="py-16 text-center text-sm font-medium text-zinc-500">Loading your saved items...</div>;
  }

  if (syncError && items.length === 0) {
    return (
      <FeedbackState
        icon={AlertCircle}
        tone="danger"
        title="Saved items could not load"
        description="Please try again in a moment."
        action={<Button onClick={() => void syncBackend()}>Try Again</Button>}
      />
    );
  }

  const hasItems = items.length > 0;
  const hasFilteredItems = filteredItems.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
            Saved Items
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-500">
            Items you&apos;ve favorited to buy later.
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your wishlist..."
            className="h-11 rounded-xl border-zinc-200/60 bg-white pl-9 shadow-sm focus-visible:ring-[#009E49]"
          />
        </div>
      </div>

      {syncError && items.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between" role="alert">
          <p className="font-semibold text-amber-900">Some saved items may be out of date. Please try again.</p>
          <Button type="button" variant="outline" onClick={() => void syncBackend()} disabled={isSyncing} className="h-11 border-amber-300 bg-white text-amber-900">
            {isSyncing ? "Checking..." : "Try Again"}
          </Button>
        </div>
      ) : null}

      {!hasItems ? (
        <FeedbackState
          icon={Heart}
          title="Your wishlist is empty"
          description="Start saving items you like by clicking the heart icon."
          action={
            <Link href="/">
              <Button className="bg-[#009E49] text-white hover:bg-[#00853d]">
                Browse Products
              </Button>
            </Link>
          }
        />
      ) : !hasFilteredItems ? (
        <FeedbackState
          icon={Search}
          title="No saved items found"
          description={`Nothing in your wishlist matches "${search}".`}
          action={
            <Button variant="outline" onClick={() => setSearch("")}>
              Clear Search
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:gap-4">
          {filteredItems.map((product) => (
            <ProductCard key={`${product.id}-${product.slug}`} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
