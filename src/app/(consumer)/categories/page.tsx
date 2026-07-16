"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Laptop,
  Search,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Loader2,
  Tv,
} from "lucide-react";
import { buildCategorySubcategoryHref, getCategoryDirectory } from "@/services/categories";
import type { CategorySummary } from "@/types/category";

const CATEGORY_ICONS = {
  smartphone: Smartphone,
  laptop: Laptop,
  shirt: Shirt,
  "shopping-basket": ShoppingBasket,
  tv: Tv,
  "heart-pulse": HeartPulse,
  dumbbell: Dumbbell,
  sofa: Sofa,
} as const;

export default function CategoriesDirectoryPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categories, setCategories] = React.useState<CategorySummary[]>([]);
  const [requestState, setRequestState] = React.useState<"loading" | "success" | "error">("loading");
  const [requestVersion, setRequestVersion] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    getCategoryDirectory()
      .then((data) => {
        if (!active) return;
        setCategories(data);
        setRequestState("success");
      })
      .catch(() => {
        if (active) setRequestState("error");
      });
    return () => {
      active = false;
    };
  }, [requestVersion]);

  const retry = () => {
    setRequestState("loading");
    setRequestVersion((version) => version + 1);
  };

  const filteredCategories = categories.filter((category) => {
    const query = searchQuery.toLowerCase();
    const matchesCategory = category.name.toLowerCase().includes(query);
    const matchesSubcategory = category.children.some((subcategory) =>
      subcategory.name.toLowerCase().includes(query),
    );
    return matchesCategory || matchesSubcategory;
  });

  return (
    <main className="min-h-dvh bg-[#f4fbf6] pb-24 pt-8 md:pt-12">
      <div className="container mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 md:text-5xl">
              All Categories
            </h1>
            <p className="mt-3 text-sm font-medium text-zinc-500 md:text-base">
              Browse buyer-visible products across electronics, fashion, groceries, and more during the Lusaka pilot.
            </p>
            <Link href="/products" className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-zinc-900 px-5 text-sm font-black text-white shadow-md transition-colors hover:bg-zinc-800">
              Shop All Products
            </Link>
          </div>

          <div className="relative w-full shrink-0 md:w-80">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-4 w-4 text-zinc-400" />
            </div>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-sm font-medium text-zinc-900 shadow-sm transition-all outline-none placeholder:text-zinc-400 focus:border-[#009E49] focus:ring-4 focus:ring-[#009E49]/10"
            />
          </div>
        </div>

        {requestState === "loading" ? (
          <div className="flex min-h-64 items-center justify-center rounded-3xl border border-zinc-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-[#009E49]" aria-label="Loading categories" />
          </div>
        ) : requestState === "error" ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-amber-200 bg-amber-50 px-6 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-700" />
            <h2 className="mt-4 text-xl font-black text-zinc-950">Categories are temporarily unavailable</h2>
            <p className="mt-2 max-w-md text-sm font-medium leading-6 text-zinc-600">Zogular could not reach the catalog service. No empty category result has been assumed.</p>
            <button onClick={retry} className="mt-5 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-bold text-white hover:bg-zinc-800">Retry</button>
          </div>
        ) : filteredCategories.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-6">
            {filteredCategories.map((category) => {
              const Icon = CATEGORY_ICONS[category.iconKey];
              const categoryUrl = `/category/${category.slug}`;

              return (
                <div
                  key={category.id}
                  className="group flex flex-col rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm transition-all hover:border-[#009E49]/40 hover:shadow-md"
                >
                  <div className="mb-4 flex items-center gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${category.colorClass}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <Link href={categoryUrl} className="text-base font-bold text-zinc-900 transition-colors hover:text-[#009E49]">
                        {category.name}
                      </Link>
                      <p className="line-clamp-1 text-[11px] font-medium text-zinc-500">
                        {category.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-start gap-2 border-t border-zinc-100 pt-4">
                    {category.children.map((subcategory) => (
                      <Link
                        key={subcategory.slug}
                        href={buildCategorySubcategoryHref(category.slug, subcategory.slug)}
                        className="flex items-center justify-between text-sm font-medium text-zinc-600 transition-colors hover:text-[#009E49]"
                      >
                        {subcategory.name}
                        <ChevronRight className="h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                      </Link>
                    ))}
                  </div>

                  <div className="mt-5 pt-1">
                    <Link href={categoryUrl} className="flex h-10 w-full items-center justify-center rounded-xl bg-zinc-50 text-xs font-bold text-zinc-700 transition-colors hover:bg-[#009E49] hover:text-white">
                      View All {category.name}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-200 border-dashed bg-white py-24 text-center shadow-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-zinc-900">No categories found</h3>
            <p className="mt-2 max-w-sm text-sm font-medium text-zinc-500">
              We couldn&apos;t find any category matching &quot;{searchQuery}&quot;. Try a different search term.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-6 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
