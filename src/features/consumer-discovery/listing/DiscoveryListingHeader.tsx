import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ListingBreadcrumb = { label: string; href?: string };
export type ListingSubcategory = { label: string; href: string; active: boolean };

type DiscoveryListingHeaderProps = {
  breadcrumbs: readonly ListingBreadcrumb[];
  title: string;
  description?: string;
  approvedPublicProductCount?: number;
  subcategories?: readonly ListingSubcategory[];
  className?: string;
};

export function DiscoveryListingHeader({
  breadcrumbs,
  title,
  description,
  approvedPublicProductCount,
  subcategories = [],
  className,
}: DiscoveryListingHeaderProps) {
  return (
    <header className={cn("space-y-3", className)} data-testid="discovery-listing-header">
      <nav aria-label="Breadcrumb">
        <ol className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-zinc-500">
          {breadcrumbs.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
              {item.href ? (
                <Link href={item.href} className="truncate rounded-sm hover:text-[#007d3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49]">
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate text-zinc-800">{item.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="max-w-3xl">
        <h1 className="text-[26px] font-black leading-tight tracking-normal text-zinc-950 sm:text-[28px] md:text-[32px] lg:text-[36px]">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 md:text-base">{description}</p> : null}
        {approvedPublicProductCount !== undefined ? (
          <p className="mt-2 text-sm font-semibold text-zinc-700" data-testid="approved-public-count">
            {approvedPublicProductCount.toLocaleString()} {approvedPublicProductCount === 1 ? "product" : "products"}
          </p>
        ) : null}
      </div>

      {subcategories.length > 0 ? (
        <nav aria-label="Subcategories" className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
          {subcategories.map((subcategory) => (
            <Link
              key={subcategory.href}
              href={subcategory.href}
              aria-current={subcategory.active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009E49] focus-visible:ring-offset-2",
                subcategory.active
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-[#009E49] hover:text-[#007d3a]",
              )}
            >
              {subcategory.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
