"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Tag, FolderTree, ArrowRight } from "lucide-react";
import { Command, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getSearchIndex, searchFromIndex } from "@/services/search";
import { getProductCategoryLabel, getProductTitle } from "@/lib/normalizers/product";
import type { SearchIndex } from "@/types/search";

type NavbarSearchProps = {
  mobile?: boolean;
};

export function NavbarSearch({ mobile = false }: NavbarSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchIndex, setSearchIndex] = React.useState<SearchIndex | null>(null);

  const deferredQuery = React.useDeferredValue(query);

  React.useEffect(() => {
    let active = true;

    getSearchIndex().then((index) => {
      if (active) setSearchIndex(index);
    });

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!containerRef.current || !target || containerRef.current.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const results = React.useMemo(() => {
    if (!searchIndex) return { products: [], categories: [], totalCount: 0 };
    return searchFromIndex(searchIndex, deferredQuery, { productLimit: 5, categoryLimit: 5 });
  }, [deferredQuery, searchIndex]);

  const normalizedQuery = query.trim();
  const hasQuery = normalizedQuery.length > 0;

  const navigateToSearch = React.useCallback(() => {
    const nextHref = normalizedQuery ? `/search?q=${encodeURIComponent(normalizedQuery)}` : "/search";
    React.startTransition(() => {
      router.push(nextHref);
    });
    setIsOpen(false);
  }, [normalizedQuery, router]);

  return (
    <div ref={containerRef} className="relative w-full">
      <Command id={mobile ? "mobile-navbar-search" : "desktop-navbar-search"} label={mobile ? "Mobile product search" : "Desktop product search"} shouldFilter={false} className="overflow-visible bg-transparent p-0">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            navigateToSearch();
          }}
          className="relative w-full"
        >
          <Search className="pointer-events-none absolute left-5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setIsOpen(value.trim().length > 0);
            }}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            placeholder={mobile ? "Search products..." : "Search products, brands and categories..."}
            className={cn(
              "w-full rounded-full border border-white/50 bg-white/65 pr-12 pl-11 text-base text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_20px_rgba(15,23,42,0.05)] outline-none transition-all placeholder:text-zinc-400 focus:border-[#009E49]/40 focus:bg-white focus:ring-2 focus:ring-[#009E49]/20",
              "h-12",
            )}
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#FF6B00] text-white shadow-md transition-transform hover:scale-105 hover:bg-[#e66000]"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        {isOpen ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
            <CommandList className={cn("max-h-96", mobile && "max-h-[60vh]")}>
              {results.totalCount === 0 ? (
                <div className="px-4 py-8 text-center text-sm font-medium text-zinc-500">
                  No results found.
                </div>
              ) : null}

              {results.products.length > 0 ? (
                <CommandGroup heading="Products">
                  {results.products.map((product) => (
                    <CommandItem
                      key={product.slug}
                      value={`product-${product.slug}`}
                      onSelect={() => {
                        router.push(`/product/${product.slug}`);
                        setIsOpen(false);
                      }}
                      className="items-start rounded-xl px-3 py-3"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-zinc-200/70 bg-zinc-50">
                        <div
                          className="absolute inset-1 bg-contain bg-center bg-no-repeat mix-blend-multiply"
                          style={{ backgroundImage: `url('${product.image}')` }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-zinc-900">{getProductTitle(product)}</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-zinc-500">
                          {getProductCategoryLabel(product) ?? "Product"}
                        </p>
                      </div>
                      <span className="ml-2 shrink-0 text-xs font-black text-zinc-900">
                        K{product.price.toLocaleString()}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {results.products.length > 0 && results.categories.length > 0 ? <CommandSeparator /> : null}

              {results.categories.length > 0 ? (
                <CommandGroup heading="Categories">
                  {results.categories.map((category) => (
                    <CommandItem
                      key={category.id}
                      value={`category-${category.id}`}
                      onSelect={() => {
                        router.push(category.href);
                        setIsOpen(false);
                      }}
                      className="rounded-xl px-3 py-3"
                    >
                      {category.type === "subcategory" ? (
                        <Tag className="mt-0.5 h-4 w-4 text-[#009E49]" />
                      ) : (
                        <FolderTree className="mt-0.5 h-4 w-4 text-[#009E49]" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-zinc-900">{category.title}</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-zinc-500">
                          {category.parentName ? `${category.parentName} category` : category.description}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {hasQuery ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Actions">
                    <CommandItem onSelect={navigateToSearch} className="rounded-xl px-3 py-3">
                      <Search className="h-4 w-4 text-[#FF6B00]" />
                      <span className="font-semibold text-zinc-900">Search for &quot;{normalizedQuery}&quot;</span>
                    </CommandItem>
                    <CommandItem onSelect={navigateToSearch} className="rounded-xl px-3 py-3">
                      <ArrowRight className="h-4 w-4 text-[#009E49]" />
                      <span className="font-semibold text-zinc-900">View all results</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              ) : null}
            </CommandList>
          </div>
        ) : null}
      </Command>
    </div>
  );
}
